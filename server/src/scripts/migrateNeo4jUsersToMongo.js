import { MongoClient } from 'mongodb'
import { driver } from '../config/neo4j.js'

const defaultMongoUri = 'mongodb://wwwphoethar100_db_user:ha2X0Rb3ArtUxGIv@ac-7jx2aja-shard-00-01.qwqs1yw.mongodb.net:27017/?authSource=admin&retryWrites=true&w=majority&tls=true&directConnection=true'

function normalize(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildMongoUri() {
  const configuredUri = normalize(process.env.MONGODB_URI || defaultMongoUri)
  if (configuredUri) return configuredUri
  throw new Error('MONGODB_URI is not configured')
}

async function resolveWritablePrimaryUri() {
  const uri = buildMongoUri()
  return uri
}

async function fetchNeo4jUsers() {
  const session = driver.session()
  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (user:User)
        RETURN user
        ORDER BY user.createdAt DESC
      `)
    )
    return result.records.map((record) => record.get('user').properties)
  } finally {
    await session.close()
  }
}

export async function migrateNeo4jUsersToMongo() {
  const mongoUri = await resolveWritablePrimaryUri()
  console.log('[migrateNeo4jUsersToMongo] Connecting to MongoDB...')
  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 10000,
  })

  try {
    await client.connect()
    const db = client.db('MiitVerse')
    const usersCollection = db.collection('users')

    const usersFromNeo4j = await fetchNeo4jUsers()
    console.log(`[migrateNeo4jUsersToMongo] Found ${usersFromNeo4j.length} users in Neo4j`)

    if (usersFromNeo4j.length === 0) {
      console.log('[migrateNeo4jUsersToMongo] No users found to migrate.')
      return { migrated: 0 }
    }

    const result = await usersCollection.insertMany(
      usersFromNeo4j.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role || 'user',
        verified: Boolean(user.verified),
        createdAt: user.createdAt || new Date().toISOString(),
        source: 'neo4j-migration',
      })),
      { ordered: false }
    )

    console.log('[migrateNeo4jUsersToMongo] Done', result)
    return { migrated: result.insertedCount }
  } finally {
    await client.close()
  }
}

migrateNeo4jUsersToMongo().catch((error) => {
  console.error('[migrateNeo4jUsersToMongo] Failed:', error)
  process.exit(1)
})
