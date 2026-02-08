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
