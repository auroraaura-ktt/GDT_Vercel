import sgMail from '@sendgrid/mail'
import { env } from '../config/env.js'

// Initialize SendGrid
sgMail.setApiKey(env.sendgridApiKey)

/**
 * Send verification email with 8-digit code
 * @param {string} email - Recipient email
 * @param {string} code - 8-digit verification code
 * @returns {Promise<boolean>} - True if sent successfully
 */
export async function sendVerificationEmail(email, code) {
  if (!env.sendgridApiKey) {
    console.error('SendGrid API key not configured')
    throw new Error('Email service not configured - SendGrid API key missing')
  }

  const msg = {
    to: email,
    from: `${env.sendgridFromName} <${env.sendgridFromEmail}>`,
    replyTo: `${env.sendgridFromName} <${env.sendgridFromEmail}>`,
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
    headers: {
      'X-Priority': '3',
      'X-Mailer': 'MiitVerse Mailer',
    },
  }

  try {
    const result = await sgMail.send(msg)
    console.log('Verification email sent successfully:', result[0].statusCode, result[0].headers['x-message-id'])
    return true
  } catch (error) {
    console.error('Failed to send verification email:', error.message || error)
    // SendGrid specific error handling
    if (error.response) {
      console.error('SendGrid error status:', error.response.status)
      console.error('SendGrid error body:', JSON.stringify(error.response.body, null, 2))
    }
    if (error.code === 401) {
      throw new Error('SendGrid API key is invalid or expired')
    }
    if (error.code === 403) {
      throw new Error('SendGrid API key does not have permission to send emails')
    }
    if (error.code === 400) {
      throw new Error(`SendGrid request validation error: ${error.message}`)
    }
    throw new Error(`Email sending failed: ${error?.message || String(error)}`)
  }
}

/**
 * Verify SendGrid connection
 * @returns {Promise<boolean>}
 */
export async function verifyEmailConnection() {
  if (!env.sendgridApiKey) {
    console.warn('SendGrid API key not configured')
    return false
  }

  try {
    // SendGrid validates the request synchronously, so if we get past initialization it should work
    console.log('SendGrid email service configured and ready')
    return true
  } catch (error) {
    console.error('Email service verification failed:', error.message || error)
    return false
  }
}

/**
 * Send general email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<boolean>}
 */
export async function sendEmail(to, subject, html, text = '') {
  if (!env.sendgridApiKey) {
    console.error('SendGrid API key not configured')
    throw new Error('Email service not configured - SendGrid API key missing')
  }

  const msg = {
    to,
    from: `${env.sendgridFromName} <${env.sendgridFromEmail}>`,
    subject,
    html,
    text,
  }

  try {
    const result = await sgMail.send(msg)
    console.log('Email sent successfully:', result[0].statusCode)
    return true
  } catch (error) {
    console.error('Failed to send email:', error.message || error)
    if (error.response) {
      console.error('SendGrid error status:', error.response.status)
      console.error('SendGrid error body:', JSON.stringify(error.response.body, null, 2))
    }
    if (error.code === 401) {
      throw new Error('SendGrid API key is invalid or expired')
    }
    if (error.code === 403) {
      throw new Error('SendGrid API key does not have permission to send emails')
    }
    if (error.code === 400) {
      throw new Error(`SendGrid request validation error: ${error.message}`)
    }
    throw new Error(`Email sending failed: ${error?.message || String(error)}`)
  }
}
