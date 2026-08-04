const SESSION_KEY = 'verse.auth.session'
const apiBase = (import.meta.env.VITE_CATALOG_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export const getSessionToken = (): string | null => localStorage.getItem(SESSION_KEY)

export const setSessionToken = (token: string | null): void => {
  if (token) localStorage.setItem(SESSION_KEY, token)
  else localStorage.removeItem(SESSION_KEY)
}

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = getSessionToken()
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBase}/api${path}`, { ...init, headers })
  const result = response.status === 204
    ? null
    : await response.json().catch(() => null) as T | { error?: string } | null
  if (!response.ok) {
    if (response.status === 401) setSessionToken(null)
    const message = typeof result === 'object' && result !== null && 'error' in result && result.error
      ? result.error
      : `Request failed (${response.status}).`
    throw new ApiError(response.status, message)
  }
  return result as T
}
