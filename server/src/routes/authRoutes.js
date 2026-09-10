import { Router } from 'express'

import { createPageAccount, loginUser, registerUser, resendVerificationCode, sendInvitations, verifyUser } from '../controllers/authController.js'
import { createPageRecord, getPageRecordBySlug, getPageRecordByOwner, listPageRecords, setPageVerified } from '../utils/pagePersistence.js'
import { listPageUsersFromMongo } from '../utils/userPersistence.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'

const router = Router()

router.get('/', (req, res) => {
  res.json({
    message: 'MiitVerse Auth routes',
    routes: ['/api/auth/register', '/api/auth/login', '/api/auth/verify', '/api/auth/verify/resend'],
  })
})

router.post('/register', registerUser)
router.get('/pages', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const pages = await listPageRecords()
    const pageUsers = await listPageUsersFromMongo()
    const pageIds = new Set(pages.map((page) => page.ownerId).filter(Boolean))
    const missingPageUsers = pageUsers.filter((user) => user.id && !pageIds.has(user.id))
    const pageUsersByEmail = new Map(pageUsers.map((user) => [user.email, user]))

    const repairedPages = pages.map((page) => {
      if (!page.ownerId) {
        const matchingUser = pageUsersByEmail.get(String(page.email || '').toLowerCase())
        if (matchingUser) {
          return { ...page, ownerId: matchingUser.id }
        }
      }
      return page
    })

    const createdPageRecords = []
    for (const user of missingPageUsers) {
      try {
        const record = await createPageRecord({
          id: user.id,
          pageName: user.username || user.email.split('@')[0] || 'Page',
          slug: user.username || user.email.split('@')[0],
          email: user.email,
          ownerId: user.id,
          description: `Official page for ${user.username || user.email.split('@')[0]}`,
          createdAt: user.createdAt,
        })

        if (record) {
          createdPageRecords.push({ ...record, ownerId: user.id })
        }
      } catch (error) {
        console.error('Failed to create missing page record for user:', user.id, error.message)
      }
    }

    res.json({ pages: [...repairedPages, ...createdPageRecords] })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load pages' })
  }
})
router.patch('/pages/:id/verified', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const page = await setPageVerified(req.params.id, Boolean(req.body?.verified))
    if (!page) {
      return res.status(404).json({ message: 'Page not found' })
    }
    res.json({
      message: `Blue mark ${page.verified ? 'enabled' : 'disabled'} for ${page.pageName}.`,
      page,
    })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to update page blue mark' })
  }
})
router.get('/pages/owner/:ownerId', authMiddleware, async (req, res) => {
  try {
    const page = await getPageRecordByOwner(req.params.ownerId)
    if (!page) {
      return res.status(404).json({ message: 'Page not found' })
    }

    res.json({ page })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load page' })
  }
})
router.get('/pages/:slug', authMiddleware, async (req, res) => {
  try {
    const page = await getPageRecordBySlug(req.params.slug)
    if (!page) {
      return res.status(404).json({ message: 'Page not found' })
    }

    res.json({ page })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load page' })
  }
})
router.get('/invitations/history', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    // Legacy SendGrid activity lookup for the admin invitation history view.
    // This does not affect verification emails, which use the Gmail SMTP service.
    const legacySendgridApiKey = process.env.SENDGRID_API_KEY || ''
    const legacySendgridFromEmail = process.env.SENDGRID_FROM_EMAIL || ''

    if (!legacySendgridApiKey) {
      return res.status(500).json({ message: 'Email service not configured' })
    }

    const query = `from_email = "${legacySendgridFromEmail}" AND subject = "You are invited to join MiitVerse"`
    const url = `https://api.sendgrid.com/v3/messages?limit=50&query=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${legacySendgridApiKey}` },
    })

    if (!response.ok) {
      const body = await response.text()
      return res.status(response.status).json({
        message: `Failed to load invitation history from email provider (${response.status}).`,
        detail: body.slice(0, 300),
      })
    }

    const data = await response.json()
    const history = (data.messages || []).map((message) => ({
      id: message.msg_id,
      to: message.to_email,
      subject: message.subject,
      status: message.status || 'unknown',
      lastEventTime: message.last_event_time || null,
      opensCount: message.opens_count || 0,
      clicksCount: message.clicks_count || 0,
    }))

    res.json({ history })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to load invitation history' })
  }
})
router.post('/create-page-account', authMiddleware, requireRole('admin'), createPageAccount)
router.post('/invite', authMiddleware, requireRole('admin'), sendInvitations)
router.post('/login', loginUser)
router.post('/verify', verifyUser)
router.post('/verify/resend', resendVerificationCode)

export default router