import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomInt, randomUUID } from 'node:crypto'

import { driver } from '../config/neo4j.js'
import { env } from '../config/env.js'
import { isMongoUnavailableError } from '../config/mongodb.js'
import { normalizeEmail, isPageAccountEmail, isValidRegistrationEmail } from '../utils/accountAccess.js'
import { sendVerificationEmail, sendEmail } from '../utils/emailService.js'
import { createPageRecord, getPageRecordByOwner as getPageRecordByOwnerFromPersistence } from '../utils/pagePersistence.js'
import { persistUserToBothDatabases, getUserFromMongo, isNeo4jUnavailableError } from '../utils/userPersistence.js'
import { buildPageAccountPayload } from '../utils/authAccountHelpers.js'
import { pendingRegistrationStore } from '../utils/pendingRegistrations.js'

const verificationTtlMs = 15 * 60 * 1000
const verificationResendCooldownMs = 3 * 60 * 1000

function getPendingRegistrations() {
  return pendingRegistrationStore
}

function getUserProperties(node) {
  return node?.properties ?? node ?? {}
}

function serializeUser(record) {
  const user = typeof record?.get === 'function'
    ? getUserProperties(record.get('user'))
    : getUserProperties(record)

  if (!user) {
    return null
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  }
}

function sendVerificationEmailInBackground(email, code, pendingRegistration) {
  sendVerificationEmail(email, code)
    .then(() => {
      if (pendingRegistration) {
        pendingRegistration.emailDeliveryFailed = false
        pendingRegistration.lastSentAt = Date.now()
      }
      console.log(`Verification code successfully sent to ${email}`)
    })
    .catch((error) => {
      console.error(`Failed to send verification email to ${email}:`, error.message)
      if (pendingRegistration) {
        pendingRegistration.emailDeliveryFailed = true
        pendingRegistration.lastSendError = error.message
      }
    })
}

function buildInvitationLink(email) {
  const cleanOrigin = env.clientOrigin.replace(/\/+$/g, '')
  const encodedEmail = encodeURIComponent(email)
  return `${cleanOrigin}/register?email=${encodedEmail}`
}

async function sendInvitationEmail(toEmail) {
  const invitationLink = buildInvitationLink(toEmail)
  const html = `
    <div style="margin:0; padding:0; background:#eef3fb;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; background:#eef3fb;">
        <tr>
          <td align="center" style="padding:36px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:640px; border-collapse:collapse; overflow:hidden; border-radius:24px; background:#ffffff; box-shadow:0 22px 60px rgba(12, 35, 80, 0.14);">
              <tr>
                <td style="padding:0; background:#001e62;">
                  <div style="padding:30px 34px 28px; background:linear-gradient(135deg,#001e62 0%,#123781 62%,#f4b400 180%);">
                    <div style="font-family:Arial, sans-serif; color:#ffffff; font-size:13px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;">MiitVerse Invitation</div>
                    <h1 style="margin:18px 0 0; font-family:Arial, sans-serif; color:#ffffff; font-size:32px; line-height:1.18; font-weight:800;">You are invited to join MiitVerse</h1>
                    <p style="margin:12px 0 0; font-family:Arial, sans-serif; color:rgba(255,255,255,.82); font-size:16px; line-height:1.65;">The official MIIT social hub is ready for you. Create your account and connect with your campus community.</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:34px; font-family:Arial, sans-serif; color:#1f2937;">
                  <p style="margin:0; font-size:16px; line-height:1.7; color:#475569;">An administrator invited <strong style="color:#0f172a;">${toEmail}</strong> to MiitVerse. Use the secure button below to open the registration page with your email already filled in.</p>
                  <div style="margin:30px 0 26px; text-align:center;">
                    <a href="${invitationLink}" style="display:inline-block; padding:15px 30px; border-radius:999px; background:#0b3b9a; color:#ffffff; font-family:Arial, sans-serif; font-size:16px; font-weight:800; text-decoration:none; box-shadow:0 12px 24px rgba(11,59,154,.25);">Accept Invitation</a>
                  </div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; border:1px solid #dbe5f2; border-radius:16px; background:#f8fbff;">
                    <tr>
                      <td style="padding:18px;">
                        <p style="margin:0 0 8px; font-size:13px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:.08em;">Registration link</p>
                        <p style="margin:0; font-size:14px; line-height:1.55; color:#174287; word-break:break-word;">${invitationLink}</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:24px 0 0; font-size:13px; line-height:1.6; color:#64748b;">If you were not expecting this invitation, you can safely ignore this email.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 28px; font-family:Arial, sans-serif; color:#94a3b8; font-size:12px; line-height:1.6; background:#ffffff; border-top:1px solid #edf2f7;">
                  Sent by MiitVerse Authentication
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `

  const text = `You are invited to join MiitVerse.\n\nAccept your invitation and complete registration here:\n${invitationLink}\n\nIf you did not expect this invitation, please ignore this message.`

  return sendEmail(toEmail, 'You are invited to join MiitVerse', html, text)
}

async function lookupUserInMongoSafely(identifier) {
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : ''
  if (!normalizedIdentifier) {
    return null
  }

  try {
    return await getUserFromMongo(normalizedIdentifier)
  } catch (error) {
    if (isMongoUnavailableError(error)) {
      console.warn(`MongoDB lookup unavailable for ${normalizedIdentifier}; continuing in degraded mode`, error.message)
      return null
    }

    throw error
  }
}

async function doesUserAlreadyExist(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return false

  const existingMongoUser = await lookupUserInMongoSafely(normalizedEmail)
  if (existingMongoUser) {
    return true
  }

  const session = driver.session()
  try {
    const existing = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE user.email = $email
          RETURN user
          LIMIT 1
        `,
        { email: normalizedEmail }
      )
    )
    return existing.records.length > 0
  } finally {
    await session.close()
  }
}

export async function sendInvitations(req, res) {
  const { emails } = req.body || {}
  const requestEmails = Array.isArray(emails) ? emails : []

  if (requestEmails.length === 0) {
    return res.status(400).json({ message: 'Provide one or more email addresses to invite.' })
  }

  const allEmails = requestEmails
    .map((email) => normalizeEmail(String(email || '')))
    .filter(Boolean)

  if (allEmails.length === 0) {
    return res.status(400).json({ message: 'Provide valid email addresses.' })
  }

  const uniqueEmails = [...new Set(allEmails)]
  const invited = []
  const failed = []

  for (const email of uniqueEmails) {
    if (!isValidRegistrationEmail(email)) {
      failed.push({ email, reason: 'Invalid MIIT email address' })
      continue
    }

    if (await doesUserAlreadyExist(email)) {
      failed.push({ email, reason: 'User already exists' })
      continue
    }

    try {
      await sendInvitationEmail(email)
      invited.push(email)
    } catch (error) {
      failed.push({ email, reason: error.message || 'Failed to send invitation' })
    }
  }

  return res.status(200).json({
    message: 'Invitation email dispatch completed.',
    invited,
    failed,
  })
}

export async function registerUser(req, res) {
  const { username, email, password } = req.body || {}
  const trimmedUsername = username?.trim()
  const normalizedEmail = normalizeEmail(email)

  if (!trimmedUsername || !normalizedEmail || !password) {
    return res.status(400).json({
      message: 'username, email, and password are required',
    })
  }

  if (!isValidRegistrationEmail(normalizedEmail)) {
    return res.status(400).json({
      message: 'Only @miit.edu.mm email addresses are allowed for registration.',
    })
  }

  const existingMongoEmail = await lookupUserInMongoSafely(normalizedEmail)
  const existingMongoUsername = existingMongoEmail ? existingMongoEmail : await lookupUserInMongoSafely(trimmedUsername)

  if (existingMongoEmail || existingMongoUsername) {
    return res.status(409).json({ message: 'User already exists' })
  }

  const session = driver.session()

  try {
    const existing = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE user.email = $email OR user.username = $username
          RETURN user
          LIMIT 1
        `,
        { email: normalizedEmail, username: trimmedUsername }
      )
    )

    if (existing.records.length > 0) {
      return res.status(409).json({ message: 'User already exists' })
    }

    // Check whether the username is already pending for a different email.
    // Allow updating/resending for the same email (avoid blocking existing pending entries).
    const pendingRegistrations = getPendingRegistrations()
    const pendingUsernameExists = Array.from(pendingRegistrations.values()).some(
      (registration) => registration.username === trimmedUsername && registration.email !== normalizedEmail
    )

    let existingPending = pendingRegistrations.get(normalizedEmail)

    if (existingPending && existingPending.verificationExpires < Date.now()) {
      pendingRegistrations.delete(normalizedEmail)
      existingPending = null
    }

    if (existingPending) {
      const elapsedMs = Date.now() - (existingPending.lastSentAt || 0)

      if (elapsedMs < verificationResendCooldownMs) {
        return res.status(429).json({
          message: 'Verification already pending. Please wait before requesting a new code.',
          resendAvailableAt: new Date((existingPending.lastSentAt || 0) + verificationResendCooldownMs).toISOString(),
        })
      }

      if (
        trimmedUsername !== existingPending.username &&
        Array.from(pendingRegistrations.values()).some(
          (registration) => registration.email !== normalizedEmail && registration.username === trimmedUsername
        )
      ) {
        return res.status(409).json({ message: 'Username already pending verification' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const verificationCode = randomInt(10000000, 100000000).toString()
      const verificationExpires = Date.now() + verificationTtlMs

      existingPending.username = trimmedUsername
      existingPending.passwordHash = passwordHash
      existingPending.verificationCode = verificationCode
      existingPending.verificationExpires = verificationExpires
      existingPending.lastSentAt = Date.now()

      // Keep the original createdAt timestamp if present
      existingPending.createdAt ||= new Date().toISOString()

      pendingRegistrations.set(normalizedEmail, existingPending)
    } else {
      if (pendingUsernameExists) {
        return res.status(409).json({ message: 'Verification already pending' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const createdAt = new Date().toISOString()
      const verificationCode = randomInt(10000000, 100000000).toString()
      const verificationExpires = Date.now() + verificationTtlMs

      // Store pending registration temporarily
      pendingRegistrations.set(normalizedEmail, {
        username: trimmedUsername,
        email: normalizedEmail,
        passwordHash,
        verificationCode,
        verificationExpires,
        lastSentAt: Date.now(),
        createdAt,
      })
    }

    const pending = pendingRegistrations.get(normalizedEmail)
    sendVerificationEmailInBackground(normalizedEmail, pending.verificationCode, pending)

    return res.status(201).json({
      message: 'Verification email sending has started. Please check your inbox within a few seconds.',
      email: normalizedEmail,
      resendAvailableAt: new Date((pending.lastSentAt || Date.now()) + verificationResendCooldownMs).toISOString(),
      verificationExpiresAt: new Date(pending.verificationExpires).toISOString(),
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({ message: 'Registration failed' })
  } finally {
    await session.close()
  }
}

export async function resendVerificationCode(req, res) {
  const { email } = req.body || {}
  const normalizedEmail = email?.trim().toLowerCase()

  if (!normalizedEmail) {
    return res.status(400).json({ message: 'email is required' })
  }

  const pendingRegistrations = getPendingRegistrations()
  const pendingRegistration = pendingRegistrations.get(normalizedEmail)

  if (!pendingRegistration) {
    return res.status(404).json({ message: 'No verification pending' })
  }

  if (pendingRegistration.verificationExpires < Date.now()) {
    pendingRegistrations.delete(normalizedEmail)
    return res.status(400).json({ message: 'Verification code expired. Please register again.' })
  }

  const elapsedMs = Date.now() - (pendingRegistration.lastSentAt || 0)

  if (elapsedMs < verificationResendCooldownMs) {
    return res.status(429).json({
      message: 'Please wait before requesting a new code.',
      resendAvailableAt: new Date((pendingRegistration.lastSentAt || 0) + verificationResendCooldownMs).toISOString(),
    })
  }

  const verificationCode = randomInt(10000000, 100000000).toString()
  pendingRegistration.verificationCode = verificationCode
  pendingRegistration.verificationExpires = Date.now() + verificationTtlMs
  pendingRegistration.lastSentAt = Date.now()
  pendingRegistrations.set(normalizedEmail, pendingRegistration)

  sendVerificationEmailInBackground(normalizedEmail, verificationCode, pendingRegistration)
  console.log(`Background resend started for ${normalizedEmail}`)

  return res.status(200).json({
    message: 'Verification email resend started. Please check your inbox shortly.',
    resendAvailableAt: new Date(pendingRegistration.lastSentAt + verificationResendCooldownMs).toISOString(),
    verificationExpiresAt: new Date(pendingRegistration.verificationExpires).toISOString(),
  })
}

export async function findPageAccountConflict(accountPayload, deps = {}) {
  const { getUser = getUserFromMongo, driverInstance = driver } = deps

  let existingEmailUser = null

  try {
    existingEmailUser = await getUser(accountPayload.email)
  } catch (error) {
    if (!isMongoUnavailableError(error)) {
      throw error
    }

    console.warn('MongoDB page-account duplicate check unavailable; continuing with Neo4j.', error.message)
  }

  if (existingEmailUser) {
    return { field: 'email', user: existingEmailUser }
  }

  const session = driverInstance.session()

  try {
    try {
      const existing = await session.executeRead((tx) =>
        tx.run(
          `
            MATCH (user:User)
            WHERE user.email = $email
            RETURN user
            LIMIT 1
          `,
          { email: accountPayload.email }
        )
      )

      if (existing.records.length === 0) {
        return null
      }

      const user = getUserProperties(existing.records[0].get('user'))
      return { field: 'email', user }
    } catch (error) {
      if (!isNeo4jUnavailableError(error)) {
        throw error
      }

      console.warn('Neo4j page-account duplicate check unavailable; continuing with MongoDB.', error.message)
      return null
    }
  } finally {
    await session.close()
  }
}

export async function doesPageAccountAlreadyExist(accountPayload, deps = {}) {
  return Boolean(await findPageAccountConflict(accountPayload, deps))
}

export async function createPageAccount(req, res) {
  const { username, email, password, pageName } = req.body || {}
  const accountPayload = buildPageAccountPayload({ username, email, password, pageName })

  if (!accountPayload.username || !accountPayload.email || !accountPayload.password) {
    return res.status(400).json({ message: 'username, email, and password are required' })
  }

  if (!isPageAccountEmail(accountPayload.email)) {
    return res.status(400).json({ message: 'Page accounts must use an @miitverse.com email address.' })
  }

  const conflict = await findPageAccountConflict(accountPayload)
  if (conflict) {
    return res.status(409).json({
      message: 'An account already uses this email address. Choose a different @miitverse.com email.',
      conflict: { field: 'email' },
    })
  }

  const session = driver.session()

  try {
    const passwordHash = await bcrypt.hash(accountPayload.password, 10)
    const createdAt = new Date().toISOString()
    const userId = randomUUID()
    const mongoUserData = {
      id: userId,
      username: accountPayload.username,
      email: accountPayload.email,
      passwordHash,
      role: 'page',
      verified: true,
      createdAt,
    }

    await persistUserToBothDatabases(mongoUserData)

    let pageRecord = null
    let pageRecordError = null

    try {
      pageRecord = await createPageRecord({
        id: userId,
        pageName: accountPayload.pageName || accountPayload.username,
        slug: accountPayload.slug || accountPayload.username,
        email: accountPayload.email,
        ownerId: userId,
        description: `Official page for ${accountPayload.pageName || accountPayload.username}`,
      })
    } catch (error) {
      console.error('Page record creation error:', error)
      pageRecordError = error
    }

    const responseMessage = pageRecordError
      ? 'Page account created, but the page metadata could not be generated. The account can still sign in and page data will be completed on first login.'
      : 'Page account created successfully. It can sign in with its email and password.'

    return res.status(201).json({
      message: responseMessage,
      user: serializeUser({ properties: mongoUserData }),
      page: pageRecord,
    })
  } catch (error) {
    console.error('Page account creation error:', error)
    return res.status(500).json({ message: 'Page account creation failed' })
  } finally {
    await session.close()
  }
}

export function normalizeVerificationCode(code) {
  return String(code ?? '').trim().replace(/\D/g, '')
}

export async function verifyUser(req, res) {
  const { email, code } = req.body || {}
  const normalizedEmail = email?.trim().toLowerCase()
  const normalizedCode = normalizeVerificationCode(code)

  if (!normalizedEmail || !normalizedCode) {
    return res.status(400).json({ message: 'email and code are required' })
  }

  if (!/^\d{8}$/.test(normalizedCode)) {
    return res.status(400).json({ message: 'Verification code must be 8 digits' })
  }

  const session = driver.session()

  try {
    const pendingRegistrations = getPendingRegistrations()
    const pendingRegistration = pendingRegistrations.get(normalizedEmail)

    if (!pendingRegistration) {
      return res.status(404).json({ message: 'No verification pending' })
    }

    if (String(pendingRegistration.verificationCode).trim() !== normalizedCode) {
      return res.status(400).json({ message: 'Invalid verification code' })
    }

    if (pendingRegistration.verificationExpires < Date.now()) {
      pendingRegistrations.delete(normalizedEmail)
      return res.status(400).json({ message: 'Verification code expired' })
    }

    const existingMongoEmail = await lookupUserInMongoSafely(normalizedEmail)
    const existingMongoUsername = existingMongoEmail ? existingMongoEmail : await lookupUserInMongoSafely(pendingRegistration.username)

    if (existingMongoEmail || existingMongoUsername) {
      pendingRegistrations.delete(normalizedEmail)
      return res.status(409).json({ message: 'User already exists' })
    }

    let existingNeo4j = null
    try {
      existingNeo4j = await session.executeRead((tx) =>
        tx.run(
          `
            MATCH (user:User)
            WHERE user.email = $email OR user.username = $username
            RETURN user
            LIMIT 1
          `,
          {
            email: normalizedEmail,
            username: pendingRegistration.username,
          }
        )
      )
    } catch (error) {
      console.warn('Neo4j duplicate check failed during verification; continuing with registration.', error.message)
    }

    if (existingNeo4j?.records?.length > 0) {
      pendingRegistrations.delete(normalizedEmail)
      return res.status(409).json({ message: 'User already exists' })
    }

    const userId = randomUUID()
    const userData = {
      id: userId,
      username: pendingRegistration.username,
      email: pendingRegistration.email,
      passwordHash: pendingRegistration.passwordHash,
      role: 'user',
      verified: true,
      createdAt: pendingRegistration.createdAt,
    }

    await persistUserToBothDatabases(userData)

    pendingRegistrations.delete(normalizedEmail)

    return res.status(201).json({
      message: 'Email verified. Account created.',
      user: serializeUser({ properties: userData }),
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Verification failed' })
  } finally {
    await session.close()
  }
}

export async function buildLoginResponseUser(
  user,
  getPageRecordByOwnerFn = getPageRecordByOwnerFromPersistence,
  createPageRecordFn = createPageRecord
) {
  const responseUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  }

  if (user.role === 'page') {
    let pageRecord = await getPageRecordByOwnerFn(user.id)

    if (!pageRecord) {
      const fallbackPageName = String(user.username || user.email || '').trim() || 'page'
      const fallbackSlug = String(user.username || fallbackPageName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      pageRecord = await createPageRecordFn({
        id: user.id,
        pageName: fallbackPageName,
        slug: fallbackSlug,
        email: user.email,
        ownerId: user.id,
        description: `Official page for ${fallbackPageName}`,
      })
    }

    if (pageRecord?.slug) {
      responseUser.pageSlug = pageRecord.slug
    }
  }

  return responseUser
}

export async function loginUser(req, res) {
  const { email, password } = req.body || {}
  const normalizedEmail = normalizeEmail(email)
  const identifier = normalizedEmail || (email?.trim() || '')

  if (!identifier || !password) {
    return res.status(400).json({ message: 'email or username and password are required' })
  }

  let user = null
  let passwordMatches = false
  let session = null

  try {
    user = await lookupUserInMongoSafely(identifier)

    if (!user) {
      session = driver.session()

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

        if (result.records.length > 0) {
          user = getUserProperties(result.records[0].get('user'))
        }
      } catch (error) {
        console.warn('Neo4j login lookup failed, falling back to MongoDB:', error.message)
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    if (user.suspended) {
      return res.status(403).json({ message: 'This account has been suspended. Please contact an administrator.' })
    }

    passwordMatches = await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        email: user.email,
      },
      env.jwtSecret,
      { expiresIn: '7d' }
    )

    const responseUser = await buildLoginResponseUser(user)

    return res.json({
      message: 'Login successful',
      token,
      user: responseUser,
    })
  } catch (error) {
    console.error('Login failed:', error.message)
    return res.status(500).json({ message: 'Login failed' })
  } finally {
    if (session) {
      await session.close()
    }
  }
}
