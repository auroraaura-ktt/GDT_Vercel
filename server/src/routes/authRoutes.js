import { Router } from 'express'

import { createPageAccount, loginUser, registerUser, resendVerificationCode, sendInvitations, verifyUser } from '../controllers/authController.js'
import { createPageRecord, getPageRecordBySlug, getPageRecordByOwner, listPageRecords } from '../utils/pagePersistence.js'
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
router.post('/create-page-account', authMiddleware, requireRole('admin'), createPageAccount)
router.post('/invite', authMiddleware, requireRole('admin'), sendInvitations)
router.post('/login', loginUser)
router.post('/verify', verifyUser)
router.post('/verify/resend', resendVerificationCode)

export default router