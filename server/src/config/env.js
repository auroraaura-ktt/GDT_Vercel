import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(configDir, '..', '..')
const envPath = existsSync(resolve(projectRoot, '.env'))
  ? resolve(projectRoot, '.env')
  : resolve(projectRoot, '.env.example')
const atlasEnvPath = resolve(projectRoot, 'atlas-credentials.env')

loadEnv({ path: envPath })

if (existsSync(atlasEnvPath)) {
  loadEnv({ path: atlasEnvPath, override: true })
}

function normalizeEnvValue(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^(['"])(.*)\1$/, '$2')
}

function buildMongoUri() {
  const configuredUri = normalizeEnvValue(process.env.MONGODB_URI)
  if (configuredUri) {
    try {
      const parsed = new URL(configuredUri)
      if (parsed.username) {
        parsed.username = encodeURIComponent(decodeURIComponent(parsed.username))
      }
      if (parsed.password) {
        parsed.password = encodeURIComponent(decodeURIComponent(parsed.password))
      }

      // Atlas replica sets must not be pinned to one shard member. A member can
      // step down at any time, producing NotWritablePrimary errors for logins
      // and page creation. Let the MongoDB driver discover the current primary.
      for (const key of [...parsed.searchParams.keys()]) {
        if (key.toLowerCase() === 'directconnection') {
          parsed.searchParams.delete(key)
        }
      }
      return parsed.toString()
    } catch {
      return configuredUri
    }
  }

  const host = normalizeEnvValue(process.env.MONGODB_HOST)
  const username = normalizeEnvValue(process.env.MONGODB_USERNAME)
  const password = normalizeEnvValue(process.env.MONGODB_PASSWORD)
  const database = normalizeEnvValue(process.env.MONGODB_DATABASE || 'test')
  const protocol = normalizeEnvValue(process.env.MONGODB_PROTOCOL || 'mongodb+srv')
  const options = normalizeEnvValue(process.env.MONGODB_OPTIONS || '')

  if (host && username && password) {
    const encodedUsername = encodeURIComponent(username)
    const encodedPassword = encodeURIComponent(password)
    const suffix = options ? `?${options}` : ''
    return `${protocol}://${encodedUsername}:${encodedPassword}@${host}/${database}${suffix}`
  }

  return ''
}

export const env = {
  port: Number(process.env.PORT || 3001),
  clientOrigin: process.env.CLIENT_ORIGIN || 'https://miitverse-xi.vercel.app',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  // SendGrid API key for email service
  sendgridApiKey: process.env.SENDGRID_API_KEY || '',
  sendgridFromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@miitverse.com',
  sendgridFromName: process.env.SENDGRID_FROM_NAME || 'MiitVerse Authentication',
  mongodbUri: buildMongoUri(),
  mongodbHost: normalizeEnvValue(process.env.MONGODB_HOST),
  mongodbUsername: normalizeEnvValue(process.env.MONGODB_USERNAME),
  mongodbPassword: normalizeEnvValue(process.env.MONGODB_PASSWORD),
  mongodbDatabase: normalizeEnvValue(process.env.MONGODB_DATABASE || 'test'),
  mongodbProtocol: normalizeEnvValue(process.env.MONGODB_PROTOCOL || 'mongodb+srv'),
  neo4jUri: process.env.NEO4J_URI || 'neo4j+s://1bdef416.databases.neo4j.io',
  neo4jUser: process.env.NEO4J_USER || '1bdef416',
  neo4jPassword: process.env.NEO4J_PASSWORD || 'FncPa8gGXHqc9gfCFIKnyxrOlyFJ1qamH82NyQf7zbc',
  skipDb: (process.env.SKIP_DB || 'false').toLowerCase() === 'true',
}
