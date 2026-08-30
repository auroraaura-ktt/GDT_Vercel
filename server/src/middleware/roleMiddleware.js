export function requireRole(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' })
    }

    return next()
  }
}

export const adminMiddleware = requireRole('admin')