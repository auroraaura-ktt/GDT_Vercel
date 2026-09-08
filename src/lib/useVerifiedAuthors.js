import { useEffect, useState } from 'react'

import { apiRequest } from './api'

// Verification belongs to the account, so comment/like authors are resolved
// against the live verified-accounts set instead of storing it on each item.
const CACHE_TTL_MS = 30000
export const VERIFIED_AUTHORS_UPDATED_EVENT = 'miitverse:verified-authors-updated'

let cachedSet = null
let cachedAt = 0
let inflight = null

export function invalidateVerifiedAuthorsCache() {
  cachedSet = null
  cachedAt = 0
  inflight = null

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VERIFIED_AUTHORS_UPDATED_EVENT, String(Date.now()))
    } catch {
      // Ignore storage failures in restricted/private browsing modes.
    }
    window.dispatchEvent(new CustomEvent(VERIFIED_AUTHORS_UPDATED_EVENT))
  }
}

async function loadVerifiedAuthors() {
  if (cachedSet && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSet
  }

  if (!inflight) {
    inflight = apiRequest('/social/verified-authors')
      .then((data) => {
        cachedSet = new Set((data?.verifiedAuthorIds || []).map((id) => String(id)))
        cachedAt = Date.now()
        inflight = null
        return cachedSet
      })
      .catch(() => {
        inflight = null
        return cachedSet || new Set()
      })
  }

  return inflight
}

export function useVerifiedAuthors() {
  const [verifiedIds, setVerifiedIds] = useState(() => cachedSet || new Set())

  useEffect(() => {
    let active = true

    const syncVerifiedAuthors = () => {
      loadVerifiedAuthors().then((nextSet) => {
        if (active) setVerifiedIds(nextSet)
      })
    }

    syncVerifiedAuthors()

    const handleStorageUpdate = (event) => {
      if (!event || event.key === VERIFIED_AUTHORS_UPDATED_EVENT || event.key === null) {
        syncVerifiedAuthors()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(VERIFIED_AUTHORS_UPDATED_EVENT, syncVerifiedAuthors)
      window.addEventListener('storage', handleStorageUpdate)
    }

    return () => {
      active = false
      if (typeof window !== 'undefined') {
        window.removeEventListener(VERIFIED_AUTHORS_UPDATED_EVENT, syncVerifiedAuthors)
        window.removeEventListener('storage', handleStorageUpdate)
      }
    }
  }, [])

  return verifiedIds
}