import test from 'node:test'
import assert from 'node:assert/strict'

import { listSocialPostsFromMongo, normalizeDatabasePost, persistSocialPost } from '../src/utils/socialPersistence.js'

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

test('social feed lookup can read posts from MongoDB when the database is available', async () => {
  const originalFind = globalThis.__mongoFindMock || null
  const collection = [{
    id: 'mongo-post-123',
    userId: 'user-1',
    username: 'Mongo User',
    content: 'Stored in MongoDB',
    image: null,
    createdAt: '2026-08-20T11:00:00.000Z',
    likes: 5,
    likedBy: [],
    comments: [],
    reposts: 0,
    visibility: 'public',
    suspended: false,
  }]

  globalThis.__mongoFindMock = async () => collection

  try {
    const result = await listSocialPostsFromMongo()
    assert.equal(result.length, 1)
    assert.equal(result[0].id, 'mongo-post-123')
    assert.equal(result[0].username, 'Mongo User')
  } finally {
    if (originalFind === null) {
      delete globalThis.__mongoFindMock
    } else {
      globalThis.__mongoFindMock = originalFind
    }
  }
})

test('Mongo post reads normalize legacy content, image, and author fields', () => {
  const normalized = normalizeDatabasePost({
    _id: 'legacy-mongo-id',
    userId: 'user-legacy',
    author: 'Legacy Author',
    message: 'Legacy post text',
    imageUrl: '/api/social/uploads/legacy.png',
    createdAt: '2026-08-20T11:00:00.000Z',
  })

  assert.equal(normalized.id, 'legacy-mongo-id')
  assert.equal(normalized.username, 'Legacy Author')
  assert.equal(normalized.author, 'Legacy Author')
  assert.equal(normalized.content, 'Legacy post text')
  assert.equal(normalized.image, '/api/social/uploads/legacy.png')
  assert.equal(normalized.authorType, 'user')
})
