import test from 'node:test'
import assert from 'node:assert/strict'

import { isPageAccountEmail, isValidRegistrationEmail, normalizeEmail, requiresEmailVerification } from '../src/utils/accountAccess.js'

test('normalizes email addresses to lowercase', () => {
  assert.equal(normalizeEmail('Miit@MIIT.EDU.MM'), 'miit@miit.edu.mm')
})

test('detects reserved page-account email domains', () => {
  assert.equal(isPageAccountEmail('blueprint@miitverse.com'), true)
  assert.equal(isPageAccountEmail('blueprint@example.com'), false)
})

test('accepts only MIIT university emails for public registration', () => {
  assert.equal(isValidRegistrationEmail('student@miit.edu.mm'), true)
  assert.equal(isValidRegistrationEmail('student@gmail.com'), false)
  assert.equal(isValidRegistrationEmail('student@miit.edu.mm '), true)
})

test('requires verification for public registration but not for admin-created page accounts', () => {
  assert.equal(requiresEmailVerification('student@miit.edu.mm', false), true)
  assert.equal(requiresEmailVerification('page@miit.edu.mm', true), false)
})
