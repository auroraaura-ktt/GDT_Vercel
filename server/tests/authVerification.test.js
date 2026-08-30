import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeVerificationCode } from '../src/controllers/authController.js'

test('normalizeVerificationCode strips spaces and non-digits before validating an 8-digit code', () => {
  assert.equal(normalizeVerificationCode(' 1234 5678 '), '12345678')
  assert.equal(normalizeVerificationCode('12-34-56-78'), '12345678')
  assert.equal(normalizeVerificationCode('12345678'), '12345678')
})
