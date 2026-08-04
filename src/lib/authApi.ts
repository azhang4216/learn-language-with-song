import type { AuthUser } from '../types/auth'
import { apiRequest, getSessionToken, setSessionToken } from './apiClient'

export const restoreSession = async (): Promise<AuthUser | null> => {
  if (!getSessionToken()) return null
  try {
    const result = await apiRequest<{ user: AuthUser }>('/auth/session')
    return result.user
  } catch {
    setSessionToken(null)
    return null
  }
}

const authenticate = async (
  path: '/auth/login' | '/auth/register',
  username: string,
  password: string,
): Promise<AuthUser> => {
  const result = await apiRequest<{ user: AuthUser; sessionToken: string }>(path, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setSessionToken(result.sessionToken)
  return result.user
}

export const login = (username: string, password: string): Promise<AuthUser> =>
  authenticate('/auth/login', username, password)

export const register = (username: string, password: string): Promise<AuthUser> =>
  authenticate('/auth/register', username, password)

export const signOut = async (): Promise<void> => {
  try {
    await apiRequest<null>('/auth/session', { method: 'DELETE' })
  } catch {
    // Local sign-out must still succeed if the API is temporarily unavailable.
  } finally {
    setSessionToken(null)
  }
}
