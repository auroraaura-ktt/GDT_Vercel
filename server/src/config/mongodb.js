import mongoose from 'mongoose'
import { env } from './env.js'

function normalize(value) {
  return typeof value === 'string' ? value.trim().replace(/^['"]|['"]$/g, '') : ''
}

export function isMongoUnavailableError(error) {
  const message = error?.message || ''
  const code = error?.code || error?.codeName || ''
  const combined = `${code} ${message}`.toLowerCase()

  return /whitelist|server selection timed out|topology|econnrefused|etimedout|timeout|timed out|no servers|connection failed|not reachable|unavailable|not whitelisted|ip address|notwritableprimary|not primary|primary stepped down/i.test(combined)
}

function resolveMongoUri() {
  // env.mongodbUri normalizes Atlas connection options, including removal of
  // directConnection=true so the driver can follow primary elections.
  const uri = normalize(env.mongodbUri || process.env.MONGODB_URI)

  if (uri) {
    return uri
  }

  const host = normalize(process.env.MONGODB_HOST)
  const username = normalize(process.env.MONGODB_USERNAME)
  const password = normalize(process.env.MONGODB_PASSWORD)
  const database = normalize(process.env.MONGODB_DATABASE || 'miitverse')
  const protocol = normalize(process.env.MONGODB_PROTOCOL || 'mongodb+srv')
  const options =
    normalize(process.env.MONGODB_OPTIONS) ||
    'retryWrites=true&w=majority&appName=Cluster0'

  if (host && username && password) {
    return `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}/${database}?${options}`
  }

  throw new Error('MONGODB_URI is not configured.')
}

export async function connectMongoDB() {
  try {
    const mongoUri = resolveMongoUri()

    console.log('Connecting to MongoDB...')
    console.log(
      'Host:',
      mongoUri.replace(/\/\/.*@/, '//***:***@')
    )

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })

    console.log('✓ MongoDB connected successfully')
    return mongoose.connection
  } catch (error) {
    if (isMongoUnavailableError(error)) {
      console.warn('⚠ MongoDB unavailable; continuing in degraded mode:', error.message)
      return null
    }

    console.error('✗ MongoDB connection failed:')
    console.error(error)
    throw error
  }
}

export async function disconnectMongoDB() {
  await mongoose.disconnect()
}

export default mongoose
