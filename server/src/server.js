import 'dotenv/config'

import app from './app.js'
import { closeNeo4j } from './config/neo4j.js'
import { connectMongoDB, disconnectMongoDB } from './config/mongodb.js'
import { ensureUserConstraints } from './config/neo4jInit.js'
import { env } from './config/env.js'
import { verifyEmailConnection } from './utils/emailService.js'
import { flushPendingNeo4jWrites } from './utils/userPersistence.js'

let server
let neo4jRetryTimer

async function retryQueuedNeo4jWrites() {
  try {
    const flushed = await flushPendingNeo4jWrites()
    if (flushed > 0) {
      console.log(`✓ Flushed ${flushed} queued Neo4j write(s)`)
    }
  } catch (error) {
    console.warn('⚠ Failed to flush queued Neo4j writes:', error.message)
  }
}

async function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)

  if (neo4jRetryTimer) {
    clearInterval(neo4jRetryTimer)
    neo4jRetryTimer = null
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve))
    console.log('HTTP server closed')
  }

  try {
    await closeNeo4j()
    console.log('Neo4j connection closed')
  } catch (err) {
    console.error('Error closing Neo4j:', err.message)
  }

  try {
    await disconnectMongoDB()
    console.log('MongoDB connection closed')
  } catch (err) {
    console.error('Error closing MongoDB:', err.message)
  }

  process.exit(0)
}

async function start() {
  try {
    console.log('Connecting to MongoDB...')
    try {
      await connectMongoDB()
    } catch (err) {
      console.warn('⚠ MongoDB connection failed:', err.message)
    }

    if (!env.skipDb) {
      try {
        await ensureUserConstraints()
      } catch (error) {
        console.warn('⚠ Neo4j initialization failed; continuing with MongoDB-only mode:', error.message)
      }
    } else {
      console.log('SKIP_DB=true — skipping Neo4j initialization')
    }

    // Verify email service is working
    console.log('Verifying email service...')
    const emailConnected = await verifyEmailConnection()
    if (emailConnected) {
      console.log('✓ Email service verified and ready')
    } else {
      console.warn('⚠ Email service may have issues - verification failed')
    }

    await retryQueuedNeo4jWrites()

    server = app.listen(env.port, '0.0.0.0', () => {
      console.log(`✓ Server running on http://0.0.0.0:${env.port}`)
      console.log('✓ Ready to handle registrations and email verifications')
    })

    if (neo4jRetryTimer) {
      clearInterval(neo4jRetryTimer)
    }

    neo4jRetryTimer = setInterval(() => {
      retryQueuedNeo4jWrites()
    }, 15000)

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    process.on('unhandledRejection', (err) => {
      console.error('Unhandled Rejection:', err)
    })

    process.on('uncaughtException', async (err) => {
      await disconnectMongoDB()
      console.error('Uncaught Exception:', err)
      await shutdown('uncaughtException')
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)

    try {
      await closeNeo4j()
    } finally {
      process.exit(1)
    }
  }
}

start()