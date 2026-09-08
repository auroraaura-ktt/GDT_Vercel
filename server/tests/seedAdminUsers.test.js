import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPassword } from '../src/scripts/seedAdminUsers.js'

test('buildPassword uses the admin username exactly as the password', () => {
  const account = { username: 'MiitVerse_ktt' }
  assert.equal(buildPassword(account), 'MiitVerse_ktt')
})
