import bcrypt from 'bcryptjs'
import neo4j from 'neo4j-driver'
import { config as loadEnv } from 'dotenv'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function getUserProperties(node) {
  return node?.properties ?? node ?? {}
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(scriptDirectory, '..', '..')
const envPath = existsSync(resolve(serverRoot, '.env'))
  ? resolve(serverRoot, '.env')
  : resolve(serverRoot, '.env.example')

loadEnv({ path: envPath })

const args = process.argv.slice(2)

function readArg(name) {
  const prefix = `--${name}=`
  const value = args.find((entry) => entry.startsWith(prefix))
  return value ? value.slice(prefix.length) : ''
}

const email = readArg('email') || 'mgkyaw1904@gmail.com'
const username = readArg('username') || email.split('@')[0]
const password = readArg('password') || 'Admin123456'
const role = readArg('role') || 'admin'
const count = Number(readArg('count') || '1')

if (!['admin', 'moderator', 'user'].includes(role)) {
  console.error('Role must be one of: user, moderator, admin')
  process.exit(1)
}

if (!Number.isInteger(count) || count < 1) {
  console.error('Count must be a positive integer')
  process.exit(1)
}

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://1bdef416.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USER || '1bdef416',
    process.env.NEO4J_PASSWORD || 'FncPa8gGXHqc9gfCFIKnyxrOlyFJ1qamH82NyQf7zbc'
  )
)

async function seedUser(session, seedEmail, seedUsername, seedPassword, seedRole) {
  const passwordHash = await bcrypt.hash(seedPassword, 10)
  const userId = randomUUID()
  const createdAt = new Date().toISOString()

  const result = await session.executeWrite((tx) =>
    tx.run(
      `
        MERGE (user:User { email: $email })
        ON CREATE SET
          user.id = $id,
          user.username = $username,
          user.passwordHash = $passwordHash,
          user.role = $role,
          user.createdAt = $createdAt,
          user.verified = true
        ON MATCH SET
          user.username = $username,
          user.passwordHash = $passwordHash,
          user.role = $role,
          user.verified = true
        RETURN user
      `,
      {
        email: seedEmail,
        id: userId,
        username: seedUsername,
        passwordHash,
        role: seedRole,
        createdAt,
      }
    )
  )

  return getUserProperties(result.records[0]?.get('user'))
}

async function main() {
  const session = driver.session()

  try {
    if (count === 1) {
      const user = await seedUser(session, email, username, password, role)
      console.log(`Seeded user ${user?.email || email} as role ${role}`)
      console.log(`Username: ${user?.username || username}`)
      console.log(`Password: ${password}`)
      return
    }

    const generatedUsers = []
    for (let index = 1; index <= count; index += 1) {
      const paddedIndex = String(index).padStart(3, '0')
      generatedUsers.push({
        email: `sampleuser${paddedIndex}@miit.edu.mm`,
        username: `sampleuser${paddedIndex}`,
      })
    }

    for (const userData of generatedUsers) {
      await seedUser(session, userData.email, userData.username, 'Sample123!', 'user')
    }

    console.log(`Seeded ${generatedUsers.length} sample users into Neo4j.`)
    console.log('Example emails:')
    generatedUsers.slice(0, 5).forEach((userData) => {
      console.log(`- ${userData.email}`)
    })
    if (generatedUsers.length > 5) {
      console.log(`...and ${generatedUsers.length - 5} more.`)
    }
  } catch (error) {
    console.error('Failed to seed user:', error.message)
    process.exit(1)
  } finally {
    await session.close()
    await driver.close()
  }
}

main()