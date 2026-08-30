import test from 'node:test'
import assert from 'node:assert/strict'

import { listUsers } from '../src/controllers/userController.js'

const mockSession = {
  executeRead: async (fn) => {
    const result = await fn({
      run: async () => ({
        records: [
          { get: () => ({ properties: { id: '1', username: 'alice', email: 'alice@miit.edu.mm', role: 'user', createdAt: '2026-08-08T00:00:00Z' } }) },
        ],
      })
    })
    return result
  },
  close: async () => {},
}

const mockDriver = {
  session: () => mockSession,
}

test('listUsers returns only non-page accounts', async () => {
  const req = {}
  let jsonResponse = null
  const res = {
    json: (value) => { jsonResponse = value; return value },
  }

  await listUsers(req, res, { driver: mockDriver })

  assert.ok(jsonResponse)
  assert.equal(Array.isArray(jsonResponse.users), true)
  assert.equal(jsonResponse.users.length, 1)
  assert.equal(jsonResponse.users[0].role, 'user')
  assert.equal(jsonResponse.users[0].username, 'alice')
})
