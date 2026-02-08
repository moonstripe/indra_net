/**
 * API base URL - empty string in dev (proxied by Vite), full URL in production
 */
export const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Build an API endpoint URL
 * In dev: /api/auth/me (proxied by Vite to localhost:8787)
 * In prod: https://indra-net-api.moonstripe.workers.dev/auth/me
 */
export function apiUrl(path: string): string {
  if (API_URL) {
    // Production: strip /api prefix since worker routes don't have it
    const cleanPath = path.startsWith('/api/') ? path.slice(4) : path
    return `${API_URL}${cleanPath}`
  }
  // Dev: keep /api prefix for Vite proxy
  return path
}

/**
 * Token management for cross-origin auth
 */
const TOKEN_KEY = 'indra_access_token'
const REFRESH_KEY = 'indra_refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/**
 * Fetch wrapper that automatically attaches auth headers
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path)
  const token = getAccessToken()

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Still send cookies for same-origin dev
  })

  // If 401 and we have a refresh token, try to refresh
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry the original request with new token
      const newHeaders = new Headers(options.headers)
      newHeaders.set('Authorization', `Bearer ${getAccessToken()}`)
      return fetch(url, {
        ...options,
        headers: newHeaders,
        credentials: 'include',
      })
    }
  }

  return res
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(apiUrl('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      clearTokens()
      return false
    }

    const data = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    clearTokens()
    return false
  }
}
