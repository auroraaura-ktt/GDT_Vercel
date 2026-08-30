import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

import { connectMongoDB } from '../config/mongodb.js'
import { persistUserToBothDatabases } from '../utils/userPersistence.js'

const adminAccounts = [
  { email: 'kyaw_thein_tun@miitverse.com', username: 'MiitVerse_ktt' },
  { email: 'shine_wunna_tun@miitverse.com', username: 'MiitVerse_swt' },
  { email: 'kyaw_lin@miitverse.com', username: 'MiitVerse_kl' },
  { email: 'minn_khant@miitverse.com', username: 'MiitVerse_mk' },
]

const defaultPassword = process.env.ADMIN_SEED_PASSWORD || 'Admin123456'

function buildPassword(username) {
  return process.env.ADMIN_SEED_PASSWORD || username
}

async function main() {
  await connectMongoDB()

  for (const account of adminAccounts) {
    const passwordHash = await bcrypt.hash(buildPassword(account.username), 10)
    const userData = {
      id: randomUUID(),
      username: account.username,
      email: account.email,
      passwordHash,
      role: 'admin',
      verified: true,
      createdAt: new Date().toISOString(),
    }

    const result = await persistUserToBothDatabases(userData)
    console.log(`${account.email} -> admin seeded (mongo: ${result.mongoSaved}, neo4j: ${result.neo4jSaved})`)
  }
}

main().catch((error) => {
  console.error('Failed to seed admin users:', error.message)
  process.exit(1)
})
