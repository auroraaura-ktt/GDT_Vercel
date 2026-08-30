import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'

export function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : authorization

  if (!token) {
    return res.status(401).json({ message: 'Missing token' })
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret)
    return next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}