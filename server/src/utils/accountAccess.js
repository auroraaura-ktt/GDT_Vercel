export function normalizeEmail(email) {
  return email?.trim().toLowerCase() || ''
}

export function isValidRegistrationEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  return Boolean(normalizedEmail) && normalizedEmail.endsWith('@miit.edu.mm')
}

export function isPageAccountEmail(email) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    return false
  }

  return normalizedEmail.endsWith('@miitverse.com')
}

export function requiresEmailVerification(email, isPageAccount) {
  return !isPageAccount && isValidRegistrationEmail(email)
}
