import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'

import { env } from '../config/env.js'

const FALLBACK_SENDGRID_FROM = 'noreply@sendgrid.net'

export function resolveSendgridFromAddress(fromEmail) {
  const configuredValue = String(fromEmail || '').trim()

  if (!configuredValue) {
    return FALLBACK_SENDGRID_FROM
  }

  const emailToCheck = configuredValue.toLowerCase()
  const personalProviders = ['@gmail.com', '@hotmail.com', '@outlook.com', '@yahoo.com', '@icloud.com', '@live.com', '@msn.com']

  if (personalProviders.some((provider) => emailToCheck.includes(provider))) {
    return FALLBACK_SENDGRID_FROM
  }

  return configuredValue
}

export function decideEmailFallbackRoute({ sendgridEnabled, gmailEnabled } = {}) {
  const sendgridIsEnabled = Boolean(sendgridEnabled)
  const gmailIsEnabled = Boolean(gmailEnabled)

  if (sendgridIsEnabled && gmailIsEnabled) {
    return ['sendgrid', 'gmail']
  }

  if (sendgridIsEnabled) {
    return ['sendgrid', 'none']
  }

  if (gmailIsEnabled) {
    return ['gmail', 'none']
  }

  return ['none', 'none']
}

export function getPrimaryEmailSender(provider, configuredEmail, fallbackValue = '') {
  const normalizedValue = String(configuredEmail || '').trim()

  if (normalizedValue) {
    return normalizedValue
  }

  return fallbackValue
}

if (env.sendgridApiKey) {
  sgMail.setApiKey(env.sendgridApiKey)
}

function buildVerificationEmailPayload(code) {
  return {
    subject: 'Your MiitVerse Email Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #333;">Email Verification Required</h2>
        <p style="color: #666; font-size: 16px;">Welcome to MiitVerse!</p>
        <p style="color: #666; font-size: 16px;">Your verification code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 36px; letter-spacing: 2px; margin: 0;">${code}</h1>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in <strong>15 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">© 2026 MiitVerse. All rights reserved.</p>
      </div>
    `,
    text: `Your MiitVerse verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
  }
}

async function sendWithSendGrid({ to, subject, html, text }) {
  if (!env.sendgridApiKey) {
    throw new Error('SendGrid API key not configured')
  }

  const fromAddress = resolveSendgridFromAddress(env.sendgridFromEmail)
  const payload = {
    to,
    from: `${env.sendgridFromName} <${fromAddress}>`,
    replyTo: `${env.sendgridFromName} <${fromAddress}>`,
    subject,
    html,
    text,
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'MiitVerse Mailer',
    },
  }

  const result = await sgMail.send(payload)
  console.log('Verification email sent successfully via SendGrid:', result[0].statusCode, result[0].headers['x-message-id'])
  return true
}

async function sendWithGmailSmtp({ to, subject, html, text }) {
  const gmailUser = String(env.gmailUser || '').trim()
  const gmailPassword = String(env.gmailAppPassword || '').trim()
  const gmailFromAddress = String(env.gmailFromEmail || gmailUser || '').trim()

  if (!gmailUser || !gmailPassword || !gmailFromAddress) {
    throw new Error('Gmail SMTP backup is not configured')
  }

  const transporter = nodemailer.createTransport({
    host: env.gmailSmtpHost,
    port: Number(env.gmailSmtpPort || 465),
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  })

  const result = await transporter.sendMail({
    from: `${env.sendgridFromName || 'MiitVerse'} <${gmailFromAddress}>`,
    to,
    subject,
    html,
    text,
  })

  console.log('Verification email sent successfully via Gmail SMTP:', result.messageId)
  return true
}

async function sendWithConfiguredProvider(to, subject, html, text) {
  const [primaryProvider, backupProvider] = decideEmailFallbackRoute({
    sendgridEnabled: Boolean(env.sendgridApiKey),
    gmailEnabled: Boolean(env.gmailUser && env.gmailAppPassword),
  })

  const providerOrder = [primaryProvider, backupProvider].filter((provider) => provider && provider !== 'none')

  if (!providerOrder.length) {
    throw new Error('No email provider is configured')
  }

  let lastError = null

  for (const provider of providerOrder) {
    try {
      if (provider === 'sendgrid') {
        return await sendWithSendGrid({ to, subject, html, text })
      }

      if (provider === 'gmail') {
        return await sendWithGmailSmtp({ to, subject, html, text })
      }
    } catch (error) {
      lastError = error
      console.warn(`Email provider '${provider}' failed:`, error.message || error)
    }
  }

  throw lastError || new Error('Email sending failed through all configured providers')
}

/**
 * Send verification email with 8-digit code
 * @param {string} email - Recipient email
 * @param {string} code - 8-digit verification code
 * @returns {Promise<boolean>} - True if sent successfully
 */
export async function sendVerificationEmail(email, code) {
  const payload = buildVerificationEmailPayload(code)
  return sendWithConfiguredProvider(email, payload.subject, payload.html, payload.text)
}

/**
 * Verify SendGrid connection
 * @returns {Promise<boolean>}
 */
export async function verifyEmailConnection() {
  const hasSendgrid = Boolean(env.sendgridApiKey)
  const hasGmail = Boolean(env.gmailUser && env.gmailAppPassword)

  if (!hasSendgrid && !hasGmail) {
    console.warn('No email providers configured')
    return false
  }

  return true
}

/**
 * Send general email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<boolean>}
 */
export async function sendEmail(to, subject, html, text = '') {
  return sendWithConfiguredProvider(to, subject, html, text)
}
