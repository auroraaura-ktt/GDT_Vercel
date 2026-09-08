function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem('miitverse-auth')
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return parsed?.token || null
  } catch {
    return null
  }
}

export function resolveApiUrl(path) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const trimmedBase = baseUrl.replace(/\/+$/g, '')
  const trimmedPath = path.replace(/^\/+/, '')

  return `${trimmedBase}/${trimmedPath}`
}

export async function apiRequest(path, options = {}) {
  const timeoutMs = options.timeout ?? 15000
  const { timeout, signal, headers: requestHeaders, ...fetchOptions } = options
  const authToken = getStoredAuthToken()

  const url = resolveApiUrl(path)

  const controller = new AbortController()
  const abortSignal = signal || controller.signal
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const headers = new Headers(requestHeaders || {})
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData
  if (!headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('Authorization') && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  let response

  try {
    response = await fetch(url, {
      signal: abortSignal,
      ...fetchOptions,
      headers,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please try again.')
      timeoutError.status = 408
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.message || 'Request failed')
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}
