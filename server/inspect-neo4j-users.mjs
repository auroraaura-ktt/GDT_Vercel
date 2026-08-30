import { driver } from './src/config/neo4j.js'

const session = driver.session()

try {
  const result = await session.run('MATCH (u:User) WHERE u.email CONTAINS "miitverse.com" RETURN u.email AS email, u.username AS username, u.role AS role LIMIT 50')
  console.log(JSON.stringify(result.records.map((record) => ({
    email: record.get('email'),
    username: record.get('username'),
    role: record.get('role'),
  })), null, 2))
} finally {
  await session.close()
  await driver.close()
}
