import test from 'node:test'
import assert from 'node:assert/strict'

import { doesPageAccountAlreadyExist, doesUserAlreadyExist, findPageAccountConflict } from '../src/controllers/authController.js'

const existingPageEmail = 'miitverse@miitverse.com'

const mockPageUser = {
  id: 'page-123',
  username: 'Student Affair',
  email: existingPageEmail,
  role: 'page',
}

function createPayload(email, username) {
  return { email, username }
}

function makeDriverStub(records = []) {
  return {
    session: () => ({
      executeRead: async () => ({ records }),
      close: async () => {},
    }),
  }
}

test('page account duplicate detection rejects when email already exists', async () => {
  const payload = createPayload(existingPageEmail, 'newpage')
  const exists = await doesPageAccountAlreadyExist(payload, {
    getUser: async (identifier) => (identifier === existingPageEmail ? mockPageUser : null),
    driverInstance: makeDriverStub(),
  })

  assert.equal(exists, true)
})

test('page account conflict identifies an already-used email address', async () => {
  const conflict = await findPageAccountConflict(createPayload(existingPageEmail, 'newpage'), {
    getUser: async (identifier) => (identifier === existingPageEmail ? mockPageUser : null),
    driverInstance: makeDriverStub(),
  })

  assert.equal(conflict.field, 'email')
})

test('page account duplicate detection allows a repeated page name when the email is new', async () => {
  const payload = createPayload('newpage@miitverse.com', 'Student Affair')
  const exists = await doesPageAccountAlreadyExist(payload, {
    getUser: async (identifier) => (identifier === existingPageEmail ? mockPageUser : null),
    driverInstance: makeDriverStub(),
  })

  assert.equal(exists, false)
})

test('page account duplicate detection continues when Neo4j is temporarily unavailable', async () => {
  const unavailableDriver = {
    session: () => ({
      executeRead: async () => {
        throw new Error('Neo4j service unavailable')
      },
      close: async () => {},
    }),
  }

  const exists = await doesPageAccountAlreadyExist(createPayload('newpage@miitverse.com', 'New Page'), {
    getUser: async () => null,
    driverInstance: unavailableDriver,
  })

  assert.equal(exists, false)
})

test('user duplicate check continues when Neo4j is temporarily unavailable', async () => {
  const unavailableDriver = {
    session: () => ({
      executeRead: async () => {
        throw new Error('Neo4j service unavailable')
      },
      close: async () => {},
    }),
  }

  const exists = await doesUserAlreadyExist('new@miit.edu.mm', {
    getMongoUser: async () => null,
    driver: unavailableDriver,
  })

  assert.equal(exists, false)
})
