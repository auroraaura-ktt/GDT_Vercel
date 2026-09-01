import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { driver } from '../config/neo4j.js'
import bcrypt from 'bcryptjs'
import {
  getUserFromMongo,
  persistUserToBothDatabases,
  setUserSuspensionInMongo,
  setUserVerifiedInMongo,
} from '../utils/userPersistence.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const profileUploadDir = resolve(__dirname, '..', '..', 'data', 'uploads')

function getUserProperties(node) {
  return node?.properties ?? node ?? {}
}

export async function getCurrentUser(req, res) {
  // Login supports MongoDB-backed accounts when Neo4j is unavailable. Keep the
  // session refresh path consistent so those users are not logged out directly
  // after a successful login (notably page-role accounts).
  try {
    const mongoUser = await getUserFromMongo(req.user.id)

    if (mongoUser) {
      return res.json({
        user: {
          id: mongoUser.id,
          username: mongoUser.username,
          email: mongoUser.email,
          role: mongoUser.role,
          createdAt: mongoUser.createdAt,
          avatarUrl: mongoUser.avatarUrl || '',
        },
      })
    }
  } catch (error) {
    // Preserve the existing Neo4j lookup as a fallback for installations that
    // have not yet migrated users to MongoDB.
    console.warn('MongoDB current-user lookup failed, falling back to Neo4j:', error.message)
  }

  const session = driver.session()

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          RETURN user
          LIMIT 1
        `,
        { id: req.user.id }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const user = getUserProperties(result.records[0].get('user'))

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl || '',
      },
    })
  } finally {
    await session.close()
  }
}

export async function updateCurrentUser(req, res) {
  const { username } = req.body || {}
  const trimmedUsername = username?.trim()

  if (!trimmedUsername) {
    return res.status(400).json({ message: 'username is required' })
  }

  const session = driver.session()

  try {
    const existing = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE toLower(user.username) = toLower($username)
            AND user.id <> $id
          RETURN user
          LIMIT 1
        `,
        { username: trimmedUsername, id: req.user.id }
      )
    )

    if (existing.records.length > 0) {
      return res.status(409).json({ message: 'Username is already taken' })
    }

    const result = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          SET user.username = $username
          RETURN user
        `,
        { id: req.user.id, username: trimmedUsername }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const user = getUserProperties(result.records[0].get('user'))

    return res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl || '',
      },
    })
  } finally {
    await session.close()
  }
}

export async function updateCurrentAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({
      message: 'No profile photo provided',
    })
  }

  const allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ])

  if (!allowedTypes.has(req.file.mimetype)) {
    return res.status(400).json({
      message: 'Only JPG, PNG, WEBP and GIF images are allowed',
    })
  }

  try {
    mkdirSync(profileUploadDir, { recursive: true })

    const extensionMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }

    const extension = extensionMap[req.file.mimetype] || 'jpg'
    const fileName = `avatar-${req.user.id}-${Date.now()}.${extension}`
    const filePath = resolve(profileUploadDir, fileName)

    writeFileSync(filePath, req.file.buffer)

    const avatarUrl = `/api/social/uploads/${fileName}`
    const mongoUser = await getUserFromMongo(req.user.id)

    if (!mongoUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    const updatedUserData = {
      ...mongoUser,
      avatarUrl,
    }

    await persistUserToBothDatabases(updatedUserData)

    return res.json({
      message: 'Profile photo updated successfully',
      user: {
        id: mongoUser.id,
        username: mongoUser.username,
        email: mongoUser.email,
        role: mongoUser.role,
        createdAt: mongoUser.createdAt,
        avatarUrl,
      },
    })
  } catch (error) {
    console.error('Profile photo upload failed:', error)

    return res.status(500).json({
      message: 'Failed to update profile photo',
    })
  }
}

export async function updateCurrentPassword(req, res) {
  const { currentPassword, newPassword } = req.body || {}

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required' })
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long' })
  }

  const session = driver.session()

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          RETURN user
          LIMIT 1
        `,
        { id: req.user.id }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const user = getUserProperties(result.records[0].get('user'))
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          SET user.passwordHash = $passwordHash
          RETURN user
        `,
        { id: req.user.id, passwordHash }
      )
    )

    return res.json({ message: 'Password updated successfully' })
  } finally {
    await session.close()
  }
}

export async function listUsers(req, res, deps = {}) {
  const driverInstance = deps.driver || driver
  const session = driverInstance.session()

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE user.role IS NULL OR user.role <> 'page'
          RETURN user
          ORDER BY user.createdAt DESC
        `
      )
    )

    return res.json({
      users: result.records.map((record) => {
        const user = getUserProperties(record.get('user'))

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          suspended: Boolean(user.suspended),
          verified: user.verified !== undefined ? Boolean(user.verified) : true,
          createdAt: user.createdAt,
        }
      }),
    })
  } finally {
    await session.close()
  }
}

export async function resetPassword(req, res) {
  const { userId, newPassword } = req.body || {}

  if (!userId || !newPassword) {
    return res.status(400).json({ message: 'userId and newPassword are required' })
  }

  const session = driver.session()

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10)

    const result = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          SET user.passwordHash = $passwordHash
          RETURN user
        `,
        { id: userId, passwordHash }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const user = getUserProperties(result.records[0].get('user'))

    return res.json({
      message: 'Password reset successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })
  } catch {
    return res.status(500).json({ message: 'Failed to reset password' })
  } finally {
    await session.close()
  }
}

export async function setUserSuspension(req, res) {
  const { suspended } = req.body || {}
  const userId = req.params.id

  if (typeof suspended !== 'boolean') {
    return res.status(400).json({ message: 'suspended must be a boolean' })
  }

  if (userId === req.user.id) {
    return res.status(400).json({ message: 'You cannot suspend your own admin account' })
  }

  const session = driver.session()
  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          SET user.suspended = $suspended
          RETURN user
        `,
        { id: userId, suspended }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const updatedUser = getUserProperties(result.records[0].get('user'))
    try {
      await setUserSuspensionInMongo(userId, suspended)
    } catch (error) {
      console.warn('MongoDB suspension update failed:', error.message)
    }

    return res.json({
      message: suspended ? 'User suspended successfully' : 'User restored successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        suspended: Boolean(updatedUser.suspended),
        createdAt: updatedUser.createdAt,
      },
    })
  } finally {
    await session.close()
  }
}

export async function setUserVerified(req, res) {
  const { verified } = req.body || {}
  const userId = req.params.id

  if (typeof verified !== 'boolean') {
    return res.status(400).json({ message: 'verified must be a boolean' })
  }

  const session = driver.session()
  try {
    const existing = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          RETURN user
          LIMIT 1
        `,
        { id: userId }
      )
    )

    if (existing.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const targetUser = getUserProperties(existing.records[0].get('user'))

    // Blue mark applies to regular users and page accounts, never to admins.
    if (targetUser.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot receive a blue mark' })
    }

    const result = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          SET user.verified = $verified
          RETURN user
        `,
        { id: userId, verified }
      )
    )

    if (result.records.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const updatedUser = getUserProperties(result.records[0].get('user'))
    try {
      await setUserVerifiedInMongo(userId, verified)
    } catch (error) {
      console.warn('MongoDB verified update failed:', error.message)
    }

    return res.json({
      message: verified ? 'Blue mark enabled for user' : 'Blue mark disabled for user',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        verified: Boolean(updatedUser.verified),
        suspended: Boolean(updatedUser.suspended),
        createdAt: updatedUser.createdAt,
      },
    })
  } finally {
    await session.close()
  }
}

export async function deleteUser(req, res) {
  const session = driver.session()

  try {
    const result = await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User { id: $id })
          WITH user
          DETACH DELETE user
          RETURN count(*) AS deletedCount
        `,
        { id: req.params.id }
      )
    )

    const deletedCountValue = result.records[0]?.get('deletedCount')
    const deletedCount = typeof deletedCountValue?.toNumber === 'function'
      ? deletedCountValue.toNumber()
      : Number(deletedCountValue || 0)

    if (deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({ message: 'User deleted successfully' })
  } finally {
    await session.close()
  }
}
