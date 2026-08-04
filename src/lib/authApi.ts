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

export const signInWithGoogle = async (credential: string): Promise<AuthUser> => {
  const result = await apiRequest<{ user: AuthUser; sessionToken: string }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  })
  setSessionToken(result.sessionToken)
  return result.user
}

export const signOut = async (): Promise<void> => {
  try {
    await apiRequest<null>('/auth/session', { method: 'DELETE' })
  } catch {
    // Local sign-out must still succeed if the API is temporarily unavailable.
  } finally {
    setSessionToken(null)
  }
}
