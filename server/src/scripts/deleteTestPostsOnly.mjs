import mongoose from 'mongoose'
import neo4j from 'neo4j-driver'

import { env } from '../config/env.js'
import { resolveMongoUri } from '../config/mongodb.js'

const suspiciousPatterns = [
  /test/i,
  /sample/i,
  /demo/i,
  /page post from admin verification/i,
  /faculty of computer science/i,
]

function isTestPost(post) {
  const text = `${post?.content || ''} ${post?.username || ''}`.toLowerCase()
  return suspiciousPatterns.some((pattern) => pattern.test(text))
}

async function main() {
  await mongoose.connect(resolveMongoUri(), {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })

  const db = mongoose.connection.db
  const postsCollection = db.collection('socialposts')
  const allPosts = await postsCollection.find({}).toArray()
  const deleteIds = allPosts.filter(isTestPost).map((post) => post.id)

  if (deleteIds.length > 0) {
    await postsCollection.deleteMany({ id: { $in: deleteIds } })
  }

  console.log('Mongo deleted test/demo posts:', deleteIds.length)

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
    const result = await session.run(
      `
        MATCH (p:Post)
        WHERE toLower(coalesce(p.content, '')) CONTAINS 'test'
           OR toLower(coalesce(p.content, '')) CONTAINS 'sample'
           OR toLower(coalesce(p.content, '')) CONTAINS 'page post from admin verification'
           OR toLower(coalesce(p.username, '')) CONTAINS 'demo'
           OR toLower(coalesce(p.username, '')) CONTAINS 'faculty of computer science'
        DETACH DELETE p
        RETURN count(p) AS removed
      `
    )

    const removed = result.records[0]?.get('removed')
    console.log('Neo4j deleted test/demo posts:', Number(removed ?? 0))
  } finally {
    await session.close()
    await driver.close()
  }

  const remainingPosts = await postsCollection.countDocuments()
  console.log('Mongo remaining posts:', remainingPosts)

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Failed to remove test posts:', error)
  process.exit(1)
})
