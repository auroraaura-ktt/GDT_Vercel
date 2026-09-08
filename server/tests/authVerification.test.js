import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildInvitationLink,
  isVerificationCodeMatch,
  normalizeVerificationCode,
} from '../src/controllers/authController.js'
import { resolveSendgridFromAddress, decideEmailFallbackRoute, getPrimaryEmailSender } from '../src/utils/emailService.js'

test('normalizeVerificationCode strips spaces and non-digits before validating an 8-digit code', () => {
  assert.equal(normalizeVerificationCode(' 1234 5678 '), '12345678')
  assert.equal(normalizeVerificationCode('12-34-56-78'), '12345678')
  assert.equal(normalizeVerificationCode('12345678'), '12345678')
})

test('isVerificationCodeMatch treats formatted stored codes as the same as a clean 8-digit input', () => {
  assert.equal(isVerificationCodeMatch('12 34 56 78', '12345678'), true)
  assert.equal(isVerificationCodeMatch('1234-5678', '12345678'), true)
  assert.equal(isVerificationCodeMatch('12345678', '12345679'), false)
})

test('buildInvitationLink uses the canonical MiitVerse origin and encodes the email safely', () => {
  const originalRenderOrigin = process.env.RENDER_EXTERNAL_URL
  const originalVercelUrl = process.env.VERCEL_URL
  const originalClientOrigin = process.env.CLIENT_ORIGIN

  delete process.env.RENDER_EXTERNAL_URL
  delete process.env.VERCEL_URL
  process.env.CLIENT_ORIGIN = 'https://miitverse-xi.vercel.app'

  try {
    assert.equal(
      buildInvitationLink('student@miit.edu.mm'),
      'https://miitverse-xi.vercel.app/register?email=student%40miit.edu.mm'
    )
  } finally {
    if (originalRenderOrigin === undefined) delete process.env.RENDER_EXTERNAL_URL
    else process.env.RENDER_EXTERNAL_URL = originalRenderOrigin

    if (originalVercelUrl === undefined) delete process.env.VERCEL_URL
    else process.env.VERCEL_URL = originalVercelUrl

    if (originalClientOrigin === undefined) delete process.env.CLIENT_ORIGIN
    else process.env.CLIENT_ORIGIN = originalClientOrigin
  }
})

test('buildInvitationLink prefers the Vercel production host over stale Render defaults', () => {
  const originalRenderOrigin = process.env.RENDER_EXTERNAL_URL
  const originalVercelUrl = process.env.VERCEL_URL
  const originalClientOrigin = process.env.CLIENT_ORIGIN

  process.env.RENDER_EXTERNAL_URL = 'https://miitverse.onrender.com'
  process.env.VERCEL_URL = 'miitverse-xi.vercel.app'
  process.env.CLIENT_ORIGIN = 'https://miitverse-xi.vercel.app'

  try {
    assert.equal(
      buildInvitationLink('student@miit.edu.mm'),
      'https://miitverse-xi.vercel.app/register?email=student%40miit.edu.mm'
    )
  } finally {
    if (originalRenderOrigin === undefined) delete process.env.RENDER_EXTERNAL_URL
    else process.env.RENDER_EXTERNAL_URL = originalRenderOrigin

    if (originalVercelUrl === undefined) delete process.env.VERCEL_URL
    else process.env.VERCEL_URL = originalVercelUrl

    if (originalClientOrigin === undefined) delete process.env.CLIENT_ORIGIN
    else process.env.CLIENT_ORIGIN = originalClientOrigin
  }
})

test('resolveSendgridFromAddress avoids personal mailbox senders that hurt delivery', () => {
  assert.equal(resolveSendgridFromAddress('miitverse_auth@hotmail.com'), 'noreply@sendgrid.net')
  assert.equal(resolveSendgridFromAddress('noreply@miitverse.com'), 'noreply@miitverse.com')
  assert.equal(resolveSendgridFromAddress(''), 'noreply@sendgrid.net')
})

test('decideEmailFallbackRoute prefers SendGrid and falls back to Gmail SMTP when needed', () => {
  assert.deepEqual(decideEmailFallbackRoute({ sendgridEnabled: true, gmailEnabled: false }), ['sendgrid', 'none'])
  assert.deepEqual(decideEmailFallbackRoute({ sendgridEnabled: false, gmailEnabled: true }), ['gmail', 'none'])
  assert.deepEqual(decideEmailFallbackRoute({ sendgridEnabled: true, gmailEnabled: true }), ['sendgrid', 'gmail'])
})

test('getPrimaryEmailSender resolves the configured sender for the active provider', () => {
  assert.equal(getPrimaryEmailSender('sendgrid', 'noreply@miitverse.com', 'MiitVerse'), 'noreply@miitverse.com')
  assert.equal(getPrimaryEmailSender('gmail', 'notify@gmail.com', 'MiitVerse'), 'notify@gmail.com')
})
