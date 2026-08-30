import neo4j from 'neo4j-driver'
import { config as loadEnv } from 'dotenv'
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

const email = readArg('email')
const id = readArg('id')
const role = readArg('role') || 'admin'

if (!email && !id) {
  console.error('Usage: npm run promote-user -- --email=user@example.com [--role=admin]')
  console.error('   or: npm run promote-user -- --id=user-id [--role=admin]')
  process.exit(1)
}

if (!['admin', 'moderator', 'user'].includes(role)) {
  console.error('Role must be one of: user, moderator, admin')
  process.exit(1)
}

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
)

async function main() {
  const session = driver.session()

  try {
    const query = email
      ? `MATCH (user:User { email: $value }) RETURN user LIMIT 1`
      : `MATCH (user:User { id: $value }) RETURN user LIMIT 1`

    const result = await session.executeRead((tx) =>
      tx.run(query, { value: email || id })
    )

    if (result.records.length === 0) {
      console.error('No matching user found.')
      process.exit(1)
    }

    const user = getUserProperties(result.records[0].get('user'))

    await session.executeWrite((tx) =>
      tx.run(
        `
          MATCH (user:User)
          WHERE user.email = $value OR user.id = $value
          SET user.role = $role
          RETURN user
        `,
        { value: email || id, role }
      )
    )

    console.log(`Updated ${user.email} (${user.id}) to role: ${role}`)
  } catch (error) {
    console.error('Failed to update user role:', error.message)
    process.exit(1)
  } finally {
    await session.close()
    await driver.close()
  }
}

main()