import test from 'node:test'
import assert from 'node:assert/strict'

import { persistSocialPost } from '../src/utils/socialPersistence.js'

const post = {
  id: 'post-test-1',
  userId: 'admin-1',
  username: 'Administrator',
  content: 'Persist this post',
  createdAt: '2026-08-16T00:00:00.000Z',
}

test('post persistence writes Neo4j before MongoDB', async () => {
  const writes = []
  const result = await persistSocialPost(post, {
    neo4jWriter: async (value) => writes.push(['neo4j', value.id]),
    mongoWriter: async (value) => writes.push(['mongo', value.id]),
  })

  assert.deepEqual(writes, [['neo4j', 'post-test-1'], ['mongo', 'post-test-1']])
  assert.deepEqual(result, { neo4jSaved: true, mongoSaved: true })
})

test('post persistence rejects when Neo4j cannot save', async () => {
  await assert.rejects(
    persistSocialPost(post, {
      neo4jWriter: async () => { throw new Error('Neo4j unavailable') },
      mongoWriter: async () => assert.fail('MongoDB must not be written before Neo4j succeeds'),
    }),
    /Neo4j unavailable/
  )
})
