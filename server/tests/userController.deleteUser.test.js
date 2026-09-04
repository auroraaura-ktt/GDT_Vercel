import test from 'node:test'
import assert from 'node:assert/strict'

import { deleteUser } from '../src/controllers/userController.js'

test('deleteUser removes the account from Neo4j and MongoDB', async () => {
  let mongoDeletedId = null
  const mockSession = {
    executeWrite: async (fn) => fn({
      run: async () => ({
        records: [{ get: () => 1 }],
      }),
    }),
    close: async () => {},
  }
  const mockDriver = { session: () => mockSession }
  const response = { statusCode: 200, body: null }
  const res = {
    status: (statusCode) => {
      response.statusCode = statusCode
      return res
    },
    json: (body) => {
      response.body = body
      return body
    },
  }

  await deleteUser(
    { params: { id: 'user-022' } },
    res,
    {
      driver: mockDriver,
      mongoDeleter: async (id) => {
        mongoDeletedId = id
        return { id }
      },
    }
  )

  assert.equal(mongoDeletedId, 'user-022')
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.message, 'User deleted successfully')
})