export function canUseUserLogin(role) {
  return role === 'user' || role === 'moderator' || role === 'page'
}

export function canAccessUserApp(role) {
  return canUseUserLogin(role)
}
