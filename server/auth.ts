import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { config } from './config'
import { db } from './db'
import { HttpError } from './http'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}

declare global {
  // Express requires namespace merging to add authenticated request state.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser
      sessionHash?: string
    }
  }
}

const googleClient = new OAuth2Client()
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const userFromRow = (row: Record<string, unknown>): AuthUser => ({
  id: String(row.id),
  email: String(row.email),
  displayName: String(row.display_name),
  ...(row.avatar_url ? { avatarUrl: String(row.avatar_url) } : {}),
})

export const readAuth = async (request: Request): Promise<AuthUser | undefined> => {
  const header = request.header('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match?.[1]) return undefined
  const sessionHash = hashToken(match[1])
  const result = await db.query(`
    SELECT u.id, u.email, u.display_name, u.avatar_url
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `, [sessionHash])
  if (!result.rows[0]) return undefined
  request.sessionHash = sessionHash
  return userFromRow(result.rows[0] as Record<string, unknown>)
}

export const optionalAuth = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    request.authUser = await readAuth(request)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAuth = async (
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await readAuth(request)
    if (!user) throw new HttpError(401, 'Please sign in with Google to continue.')
    request.authUser = user
    next()
  } catch (error) {
    next(error)
  }
}

export const exchangeGoogleCredential = async (
  credential: string,
): Promise<{ user: AuthUser; sessionToken: string }> => {
  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    })
  } catch {
    throw new HttpError(401, 'Google could not verify this sign-in.')
  }
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new HttpError(401, 'A verified Google email is required.')
  }

  const id = randomUUID()
  const displayName = payload.name?.trim() || payload.email.split('@')[0] || 'Learner'
  const result = await db.query(`
    INSERT INTO users (id, google_subject, email, display_name, avatar_url)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (google_subject) DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING id, email, display_name, avatar_url
  `, [id, payload.sub, payload.email, displayName, payload.picture ?? null])

  const sessionToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000)
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(sessionToken), result.rows[0].id, expiresAt],
  )
  return {
    user: userFromRow(result.rows[0] as Record<string, unknown>),
    sessionToken,
  }
}
