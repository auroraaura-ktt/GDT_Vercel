import { normalizeEmail } from './accountAccess.js';

export function buildPageAccountPayload(input = {}) {
  const email = normalizeEmail(input.email);
  const requestedUsername = String(input.username || '').trim();
  const emailLocalPart = email.split('@')[0] || '';
  const username = requestedUsername || emailLocalPart;
  const password = String(input.password || '').trim();
  const pageName = String(input.pageName || requestedUsername || emailLocalPart).trim();

  return {
    username,
    email,
    password,
    pageName,
    role: 'page',
    verified: true,
    slug: String(pageName).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
}
