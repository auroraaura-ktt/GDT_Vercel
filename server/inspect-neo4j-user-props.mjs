import { driver } from './src/config/neo4j.js'

const session = driver.session()
try {
  const result = await session.run('MATCH (u:User { email: $email }) RETURN u', { email: 'kyaw_thein_tun@miitverse.com' })
  const record = result.records[0]
  if (!record) {
    console.log('NO_RECORD')
    process.exit(0)
  }
  console.log(JSON.stringify(record.get('u').properties, null, 2))
} finally {
  await session.close()
  await driver.close()
}
