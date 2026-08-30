import test from 'node:test'
import assert from 'node:assert/strict'

import { isMongoUnavailableError } from '../src/config/mongodb.js'

test('classifies atlas whitelist and timeout errors as unavailable', () => {
  const whitelistError = new Error('Could not connect to any servers in your MongoDB Atlas cluster. One common reason is that you\'re trying to access the database from an IP that isn\'t whitelisted.')
  const timeoutError = new Error('Server selection timed out after 10000ms')
  const authError = new Error('Authentication failed')

  assert.equal(isMongoUnavailableError(whitelistError), true)
  assert.equal(isMongoUnavailableError(timeoutError), true)
  assert.equal(isMongoUnavailableError(authError), false)
})
