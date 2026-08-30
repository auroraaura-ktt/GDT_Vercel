import fs from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { driver } from '../config/neo4j.js'

function getUserProperties(node) {
  return node?.properties ?? node ?? {}
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(scriptDirectory, '..', '..')
const outputPath = resolve(serverRoot, 'users.json')

async function main() {
  const session = driver.session()

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          RETURN user
          ORDER BY user.createdAt DESC
        `
      )
    )

    const users = result.records.map((record) => {
      const user = getUserProperties(record.get('user'))

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      }
    })

    await fs.writeFile(outputPath, JSON.stringify({ users }, null, 2), 'utf8')
    console.log(`Exported ${users.length} users to ${outputPath}`)
  } catch (error) {
    console.error('Failed to export users:', error.message)
    process.exit(1)
  } finally {
    await session.close()
    await driver.close()
  }
}

main()
