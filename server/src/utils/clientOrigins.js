const DEFAULT_CLIENT_ORIGIN = 'https://gdt-vercel.vercel.app'

export const ALLOWED_INVITATION_HOSTS = [
  'gdt-vercel.vercel.app',
  'miitversebymiit.vercel.app',
]

function hostnameOf(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

export function normalizeClientOrigin(value, fallback = DEFAULT_CLIENT_ORIGIN) {
  const rawOrigin = String(value ?? '').trim()
  const cleanedOrigin = rawOrigin.replace(/\/+$/g, '')

  if (!cleanedOrigin) {
    return fallback
  }

  if (/^https?:\/\//i.test(cleanedOrigin)) {
    return cleanedOrigin
  }

  return `https://${cleanedOrigin}`
}

export function isAllowedInvitationOrigin(value) {
  const hostname = hostnameOf(value)
  return ALLOWED_INVITATION_HOSTS.includes(hostname)
}

function configuredOrigins() {
  const raw = String(process.env.CLIENT_ORIGIN || '').trim()
  if (!raw) return []

  return raw
    .split(/[, \n]+/)
    .map((entry) => normalizeClientOrigin(entry, ''))
    .filter(Boolean)
}

function originFromRequest(req) {
  const headerOrigin = String(req?.headers?.origin || '').trim()
  if (headerOrigin) {
    return normalizeClientOrigin(headerOrigin, '')
  }

  const referer = String(req?.headers?.referer || req?.get?.('referer') || '').trim()
  if (!referer) return ''

  try {
    return new URL(referer).origin
  } catch {
    return ''
  }
}

export function getCanonicalClientOrigin(req) {
  const vercelOrigin = process.env.VERCEL_URL
    ? normalizeClientOrigin(process.env.VERCEL_URL, '')
    : ''
  const requestOrigin = originFromRequest(req)

  const candidates = [
    requestOrigin,
    ...configuredOrigins(),
    vercelOrigin,
    DEFAULT_CLIENT_ORIGIN,
  ]

  const allowed = candidates.find((origin) => isAllowedInvitationOrigin(origin))
  return (allowed || DEFAULT_CLIENT_ORIGIN).replace(/\/+$/g, '')
}
