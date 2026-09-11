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

/**
 * Download a protected attachment using the signed-in session's bearer token.
 * Because browser `<a>`/`<img>` requests cannot attach an Authorization header,
 * the file is fetched here, converted to a blob, and saved via a temporary
 * object URL so protected files are only ever delivered through the
 * authenticated /api/social/download/:fileName endpoint.
 */
export async function downloadProtectedFile(path, { name, onProgress } = {}) {
  const authToken = getStoredAuthToken()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  let response
  try {
    const headers = new Headers({ Accept: 'application/octet-stream' })
    if (authToken) headers.set('Authorization', `Bearer ${authToken}`)
    response = await fetch(resolveApiUrl(path), {
      method: 'GET',
      headers,
      signal: controller.signal,
      credentials: 'same-origin',
    })
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Download timed out. Please try again.')
      timeoutError.status = 408
      throw timeoutError
    }
    throw error
  }

  if (!response.ok) {
    clearTimeout(timeoutId)
    const body = await response.json().catch(() => ({}))
    const err = new Error(body.message || `Download failed (${response.status})`)
    err.status = response.status
    throw err
  }

  const blob = await response.blob()
  clearTimeout(timeoutId)

  const fallbackName = name || (typeof path === 'string' ? path.split('/').pop() || 'file' : 'file')
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fallbackName || 'file'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

  onProgress?.()
  return true
}
