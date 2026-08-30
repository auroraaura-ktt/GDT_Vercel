import test from 'node:test'
import assert from 'node:assert/strict'

import { canAccessUserApp, canUseUserLogin } from '../src/lib/authAccess.js'

test('blocks admin accounts from the regular user login form', () => {
  assert.equal(canUseUserLogin('admin'), false)
  assert.equal(canUseUserLogin('user'), true)
  assert.equal(canUseUserLogin('moderator'), true)
  assert.equal(canUseUserLogin('page'), true)
})

test('blocks admin accounts from the regular user app routes', () => {
  assert.equal(canAccessUserApp('admin'), false)
  assert.equal(canAccessUserApp('user'), true)
  assert.equal(canAccessUserApp('moderator'), true)
  assert.equal(canAccessUserApp('page'), true)
})
