import test from 'node:test'
import assert from 'node:assert/strict'

import { persistUserToBothDatabases, queuePendingNeo4jWrite } from '../src/utils/userPersistence.js'

test('persists to mongo and queues Neo4j sync when Neo4j is unavailable', async () => {
  let mongoCalls = 0
  let neo4jCalls = 0

  const result = await persistUserToBothDatabases(
    {
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hash',
      role: 'user',
      verified: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      mongoWriter: async () => {
        mongoCalls += 1
        return { id: 'user-1' }
      },
      neo4jWriter: async () => {
        neo4jCalls += 1
        throw new Error('Neo4j unavailable')
      },
    }
  )

  assert.equal(mongoCalls, 1)
  assert.equal(neo4jCalls, 1)
  assert.equal(result.mongoSaved, true)
  assert.equal(result.neo4jSaved, false)
  assert.equal(queuePendingNeo4jWrite({ id: 'user-1' }), true)
})
