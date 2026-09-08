import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

import { connectMongoDB } from '../config/mongodb.js'
import { persistUserToBothDatabases } from '../utils/userPersistence.js'

const accounts = [
  { username: 'alice', email: 'alice@miit.edu.mm', password: 'alice' },
  { username: 'bob', email: 'bob@miit.edu.mm', password: 'bob' },
  { username: 'charlie', email: 'charlie@miit.edu.mm', password: 'charlie' },
  { username: 'diana', email: 'diana@miit.edu.mm', password: 'diana' },
]

async function main() {
  await connectMongoDB()

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 10)
    const data = {
      id: randomUUID(),
      username: account.username,
      email: account.email.toLowerCase(),
      passwordHash,
      role: 'user',
      verified: true,
      createdAt: new Date().toISOString(),
      suspended: false,
    }

    const result = await persistUserToBothDatabases(data)
    console.log(`${account.email} -> regular user seeded (mongo: ${result.mongoSaved}, neo4j: ${result.neo4jSaved})`)
  }

  const count = await mongoose.connection.db.collection('users').countDocuments({ role: 'user' })
  console.log('Regular user count:', count)
}

main().catch((error) => {
  console.error('Failed to seed initial regular users:', error)
  process.exit(1)
})
