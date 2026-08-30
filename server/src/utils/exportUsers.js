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

export async function updateUsersJson() {
  console.log('[updateUsersJson] Starting...')
  const session = driver.session()

  try {
    console.log('[updateUsersJson] Querying database...')
    const result = await session.executeRead((tx) =>
      tx.run(
        `
          MATCH (user:User)
          RETURN user
          ORDER BY user.createdAt DESC
        `
      )
    )

    console.log(`[updateUsersJson] Found ${result.records.length} users`)
    
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

    console.log(`[updateUsersJson] Writing to ${outputPath}`)
    await fs.writeFile(outputPath, JSON.stringify({ users }, null, 2), 'utf8')
    console.log(`[updateUsersJson] ✓ Updated users.json with ${users.length} users`)
  } catch (error) {
    console.error('[updateUsersJson] ✗ Failed to update users.json:', error)
  } finally {
    await session.close()
    console.log('[updateUsersJson] Session closed')
  }
}
