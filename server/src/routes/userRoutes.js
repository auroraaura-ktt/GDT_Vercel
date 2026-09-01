import { Router } from 'express'
import multer from 'multer'

import {
  deleteUser,
  getCurrentUser,
  listUsers,
  resetPassword,
  setUserSuspension,
  setUserVerified,
  updateCurrentUser,
  updateCurrentPassword,
  updateCurrentAvatar,
} from '../controllers/userController.js'

import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireRole } from '../middleware/roleMiddleware.js'

const router = Router()

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'))
    }

    cb(null, true)
  },
})

router.get('/me', authMiddleware, getCurrentUser)
router.patch('/me/avatar', authMiddleware, avatarUpload.single('avatar'), updateCurrentAvatar)
router.patch('/me', authMiddleware, updateCurrentUser)
router.patch('/me/password', authMiddleware, updateCurrentPassword)
router.get('/', authMiddleware, requireRole('admin', 'moderator'), listUsers)
router.post('/reset-password', authMiddleware, requireRole('admin'), resetPassword)
router.patch('/:id/suspension', authMiddleware, requireRole('admin'), setUserSuspension)
router.patch('/:id/verified', authMiddleware, requireRole('admin'), setUserVerified)
router.delete('/:id', authMiddleware, requireRole('admin'), deleteUser)

export default router
