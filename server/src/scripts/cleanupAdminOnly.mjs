import fs from 'node:fs'
import path from 'node:path'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import neo4j from 'neo4j-driver'

import { env } from '../config/env.js'
import { resolveMongoUri } from '../config/mongodb.js'

const adminAccounts = [
  { email: 'kyaw_thein_tun@miitverse.com', username: 'MiitVerse_ktt' },
  { email: 'shine_wunna_tun@miitverse.com', username: 'MiitVerse_swt' },
  { email: 'kyaw_lin@miitverse.com', username: 'MiitVerse_kl' },
  { email: 'minn_khant@miitverse.com', username: 'MiitVerse_mk' },
]

const adminEmails = adminAccounts.map((account) => account.email.toLowerCase())
const adminUsernames = adminAccounts.map((account) => account.username)

const mongoUsers = () => mongoose.connection.db.collection('users')
const mongoPosts = () => mongoose.connection.db.collection('socialposts')

async function ensureMongoAdmins() {
  for (const account of adminAccounts) {
    const passwordHash = await bcrypt.hash(account.username, 10)
    await mongoUsers().updateOne(
      { email: account.email.toLowerCase() },
      {
        $set: {
          id: `admin-${account.username}`,
          username: account.username,
          email: account.email.toLowerCase(),
          passwordHash,
          role: 'admin',
          verified: true,
          suspended: false,
          createdAt: new Date().toISOString(),
          source: 'mongo',
        },
      },
      { upsert: true }
    )
  }
}

async function cleanupMongo() {
  await mongoUsers().deleteMany({
    $and: [
      { email: { $exists: true } },
      {
        $nor: [
          { email: { $in: adminEmails } },
          { username: { $in: adminUsernames } },
        ],
      },
    ],
  })

  await mongoUsers().updateMany(
    {
      $or: [
        { email: { $in: adminEmails } },
        { username: { $in: adminUsernames } },
      ],
    },
    {
      $set: {
        role: 'admin',
        verified: true,
        suspended: false,
      },
    }
  )

  await mongoPosts().deleteMany({})
}

async function cleanupNeo4j() {
  const driver = neo4j.driver(
    env.neo4jUri,
    neo4j.auth.basic(env.neo4jUser, env.neo4jPassword),
    {
      connectionTimeout: 5000,
      connectionAcquisitionTimeout: 5000,
      maxTransactionRetryTime: 5000,
    }
  )

  const session = driver.session()

  try {
    await session.run(
      `
        MATCH (u:User)
        WHERE NOT toLower(coalesce(u.email, '')) IN $emails
          AND NOT toLower(coalesce(u.username, '')) IN $usernames
        DETACH DELETE u
      `,
      {
        emails: adminEmails,
        usernames: adminUsernames,
      }
    )

    for (const account of adminAccounts) {
      const passwordHash = await bcrypt.hash(account.username, 10)
      await session.run(
        `
          MERGE (u:User { email: $email })
          SET u.username = $username,
              u.email = $email,
              u.passwordHash = $passwordHash,
              u.role = 'admin',
              u.verified = true,
              u.suspended = false,
              u.createdAt = coalesce(u.createdAt, datetime())
        `,
        {
          email: account.email.toLowerCase(),
          username: account.username,
          passwordHash,
        }
      )
    }

    await session.run('MATCH (p:Post) DETACH DELETE p')
    await session.run('MATCH (page:Page) DETACH DELETE page')
  } finally {
    await session.close()
    await driver.close()
  }
}

function resetJsonStore(filePath, defaultValue) {
  fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8')
}

async function main() {
  await mongoose.connect(resolveMongoUri(), {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })

  try {
    await ensureMongoAdmins()
    await cleanupMongo()
    await cleanupNeo4j()

    const serverRoot = path.resolve(process.cwd(), '..')
    resetJsonStore(path.join(serverRoot, 'data', 'social-posts.json'), [])
    resetJsonStore(path.join(serverRoot, 'data', 'pending-registrations.json'), {})
    resetJsonStore(path.join(serverRoot, 'users.json'), {
      users: adminAccounts.map((account) => ({
        id: `admin-${account.username}`,
        username: account.username,
        email: account.email,
        role: 'admin',
        createdAt: new Date().toISOString(),
      })),
    })

    const mongoCount = await mongoUsers().countDocuments()
    console.log('Mongo users remaining:', mongoCount)
    console.log('Admins kept:', adminAccounts.map((account) => `${account.email} / ${account.username} / ${account.username}`).join(' | '))
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error('Cleanup failed:', error)
  process.exit(1)
})
