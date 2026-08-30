import 'dotenv/config'
import neo4j from 'neo4j-driver'
import bcrypt from 'bcryptjs'
import { env } from './src/config/env.js'

const driver = neo4j.driver(env.neo4jUri, neo4j.auth.basic(env.neo4jUser, env.neo4jPassword))
const session = driver.session()

const email = 'test@example.com'
const passwords = ['password123', 'Admin123456', 'Test123!', 'Sample123!']

try {
  const result = await session.executeRead((tx) =>
    tx.run('MATCH (u:User {email: $email}) RETURN u', { email })
  )

  if (result.records.length === 0) {
    console.log('no user')
    process.exit(0)
  }

  const u = result.records[0].get('u').properties
  console.log(JSON.stringify({ id: u.id, username: u.username, email: u.email, role: u.role, passwordHashExists: !!u.passwordHash, passwordHashPrefix: u.passwordHash ? `${u.passwordHash.slice(0, 10)}...` : null }, null, 2))

  for (const pw of passwords) {
    const ok = await bcrypt.compare(pw, u.passwordHash)
    console.log(pw, ok)
  }
} catch (e) {
  console.error('err', e.message)
} finally {
  await session.close()
  await driver.close()
}
