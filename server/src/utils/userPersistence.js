import mongoose from 'mongoose'
import { driver } from '../config/neo4j.js'

const pendingNeo4jWrites = []
const mongoUserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: { type: String, default: 'user' },
    suspended: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    source: { type: String, default: 'mongo' },
  },
  { timestamps: true }
)

const UserModel = mongoose.models.User || mongoose.model('User', mongoUserSchema)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isNeo4jUnavailableError(error) {
  const message = error?.message || ''
  const code = error?.code || error?.codeName || ''
  return [code, message].some((value) => /serviceunavailable|connection refused|connect|timeout|neo4j|not available/i.test(String(value)))
}

export function queuePendingNeo4jWrite(userData) {
  if (!userData?.id) {
    return false
  }

  const existing = pendingNeo4jWrites.find((item) => item.id === userData.id)
  if (existing) {
    return true
  }

  pendingNeo4jWrites.push({
    id: userData.id,
    username: userData.username,
    email: userData.email,
    passwordHash: userData.passwordHash,
    avatarUrl: userData.avatarUrl || '',
    role: userData.role || 'user',
    verified: Boolean(userData.verified),
    createdAt: userData.createdAt || new Date().toISOString(),
  })
  return true
}

export async function writeUserToMongo(userData = {}) {
  const normalizedEmail = typeof userData.email === 'string' ? userData.email.trim().toLowerCase() : ''
  const normalizedUsername = typeof userData.username === 'string' ? userData.username.trim() : ''

  const update = {
    $set: {
      source: userData.source || 'neo4j-fallback',
    },
  }

  if (userData.id) {
    update.$set.id = userData.id
  }

  if (normalizedUsername) {
    update.$set.username = normalizedUsername
  }

  if (normalizedEmail) {
    update.$set.email = normalizedEmail
  }

  if (userData.passwordHash) {
    update.$set.passwordHash = userData.passwordHash
  }

  if (userData.role) {
    update.$set.role = userData.role
  }

  if (typeof userData.avatarUrl === 'string') {
    update.$set.avatarUrl = userData.avatarUrl
  }

  if (typeof userData.verified === 'boolean') {
    update.$set.verified = userData.verified
  }

  if (typeof userData.suspended === 'boolean') {
    update.$set.suspended = userData.suspended
  }

  if (userData.createdAt) {
    update.$set.createdAt = userData.createdAt
  }

  const query = userData.id
    ? {
        $or: [
          { id: userData.id },
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ],
      }
    : normalizedEmail
      ? { email: normalizedEmail }
      : {}

  return UserModel.findOneAndUpdate(query, update, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  }).lean()
}

export async function getUserFromMongo(identifier) {
  const normalized = typeof identifier === 'string' ? identifier.trim() : ''

  if (!normalized) {
    return null
  }

  return UserModel.findOne({
    $or: [
      { id: normalized },
      { email: normalized.toLowerCase() },
      { username: { $regex: `^${escapeRegExp(normalized)}$`, $options: 'i' } },
    ],
  }).lean()
}

export async function listUsersFromMongo() {
  return UserModel.find({}).sort({ createdAt: -1 }).lean()
}

export async function listPageUsersFromMongo() {
  return UserModel.find({ role: 'page' }).sort({ createdAt: -1 }).lean()
}

export async function deleteUserFromMongo(userId) {
  return UserModel.findOneAndDelete({ id: userId })
}

export async function setUserVerifiedInMongo(userId, verified) {
  const updated = await UserModel.findOneAndUpdate(
    { id: userId },
    { $set: { verified: Boolean(verified) } },
    { new: true }
  ).lean()
  return updated
}

export async function setUserSuspensionInMongo(userId, suspended) {
  return UserModel.findOneAndUpdate(
    { id: userId },
    { $set: { suspended: Boolean(suspended) } },
    { new: true }
  ).lean()
}

export async function syncUserToNeo4j(userData) {
  const session = driver.session()

  try {
    await session.executeWrite((tx) =>
      tx.run(
        `
          MERGE (user:User { id: $id })
          SET user.username = $username,
              user.email = $email,
              user.passwordHash = $passwordHash,
              user.role = $role,
              user.verified = $verified,
              user.createdAt = $createdAt,
              user.avatarUrl = coalesce($avatarUrl, user.avatarUrl),
              user.source = 'mongo'
          RETURN user
        `,
        {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          passwordHash: userData.passwordHash,
          avatarUrl: userData.avatarUrl || null,
          role: userData.role || 'user',
          verified: Boolean(userData.verified),
          createdAt: userData.createdAt || new Date().toISOString(),
        }
      )
    )
    return true
  } catch (error) {
    if (!isNeo4jUnavailableError(error)) {
      console.error('Neo4j sync failed:', error.message)
    }
    queuePendingNeo4jWrite(userData)
    return false
  } finally {
    await session.close()
  }
}

export async function persistUserToBothDatabases(userData = {}, deps = {}) {
  const mongoWriter = deps.mongoWriter || writeUserToMongo
  const neo4jWriter = deps.neo4jWriter || syncUserToNeo4j

  let mongoSaved = false
  try {
    mongoSaved = Boolean(await mongoWriter(userData))
  } catch (error) {
    console.warn('MongoDB persistence failed:', error.message)
  }

  let neo4jSaved = false
  if (userData?.id) {
    try {
      neo4jSaved = Boolean(await neo4jWriter(userData))
    } catch (error) {
      queuePendingNeo4jWrite(userData)
      console.warn('Neo4j persistence failed; queued for retry:', error.message)
    }
  }

  return { mongoSaved, neo4jSaved }
}

export async function flushPendingNeo4jWrites() {
  if (pendingNeo4jWrites.length === 0) {
    return 0
  }

  const pending = [...pendingNeo4jWrites]
  pendingNeo4jWrites.length = 0

  let flushed = 0
  for (const item of pending) {
    const saved = await syncUserToNeo4j(item)
    if (saved) {
      flushed += 1
    }
  }

  return flushed
}

export async function tryReadUserFromNeo4j(identifier) {
  const session = driver.session()

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE toLower(user.email) = toLower($identifier)
             OR toLower(user.username) = toLower($identifier)
          RETURN user
          LIMIT 1
        `,
        { identifier }
      )
    )

    if (result.records.length === 0) {
      return null
    }

    const user = result.records[0].get('user').properties
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role || 'user',
      verified: Boolean(user.verified),
      createdAt: user.createdAt,
    }
  } catch (error) {
    if (!isNeo4jUnavailableError(error)) {
      console.error('Neo4j read failed:', error.message)
    }
    return null
  } finally {
    await session.close()
  }
}
