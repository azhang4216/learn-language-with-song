import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config'
import { db } from './db'
import { HttpError } from './http'

export interface AuthUser {
  id: string
  username: string
  displayName: string
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

const scryptAsync = promisify(scrypt)
const usernamePattern = /^[a-z0-9_]{3,24}$/

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex')

const userFromRow = (row: Record<string, unknown>): AuthUser => ({
  id: String(row.id),
  username: String(row.username),
  displayName: String(row.display_name),
})

const normalizeUsername = (value: unknown): string => {
  if (typeof value !== 'string') throw new HttpError(400, 'Username is required.')
  const username = value.trim().toLocaleLowerCase()
  if (!usernamePattern.test(username)) {
    throw new HttpError(400, 'Username must be 3–24 letters, numbers, or underscores.')
  }
  return username
}

const readPassword = (value: unknown): string => {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new HttpError(400, 'Password must be 8–128 characters.')
  }
  return value
}

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, 64) as Buffer
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

const passwordMatches = async (password: string, stored: string): Promise<boolean> => {
  const [algorithm, saltText, expectedText] = stored.split('$')
  if (algorithm !== 'scrypt' || !saltText || !expectedText) return false
  try {
    const salt = Buffer.from(saltText, 'base64url')
    const expected = Buffer.from(expectedText, 'base64url')
    const actual = await scryptAsync(password, salt, expected.byteLength) as Buffer
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

const createSession = async (user: AuthUser): Promise<{ user: AuthUser; sessionToken: string }> => {
  const sessionToken = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + config.sessionDays * 86_400_000)
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(sessionToken), user.id, expiresAt],
  )
  return { user, sessionToken }
}

export const registerWithPassword = async (
  usernameValue: unknown,
  passwordValue: unknown,
): Promise<{ user: AuthUser; sessionToken: string }> => {
  const username = normalizeUsername(usernameValue)
  const password = readPassword(passwordValue)
  const passwordHash = await hashPassword(password)
  try {
    const result = await db.query(`
      INSERT INTO users (id, username, password_hash, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, display_name
    `, [randomUUID(), username, passwordHash, username])
    return createSession(userFromRow(result.rows[0] as Record<string, unknown>))
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'That username is already taken.')
    }
    throw error
  }
}

export const loginWithPassword = async (
  usernameValue: unknown,
  passwordValue: unknown,
): Promise<{ user: AuthUser; sessionToken: string }> => {
  const username = normalizeUsername(usernameValue)
  const password = readPassword(passwordValue)
  const result = await db.query(`
    SELECT id, username, display_name, password_hash
    FROM users WHERE lower(username) = $1
  `, [username])
  const row = result.rows[0] as Record<string, unknown> | undefined
  if (!row) {
    await scryptAsync(password, Buffer.alloc(16), 64)
    throw new HttpError(401, 'Username or password is incorrect.')
  }
  if (!await passwordMatches(password, String(row.password_hash))) {
    throw new HttpError(401, 'Username or password is incorrect.')
  }
  return createSession(userFromRow(row))
}

export const readAuth = async (request: Request): Promise<AuthUser | undefined> => {
  const header = request.header('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match?.[1]) return undefined
  const sessionHash = hashToken(match[1])
  const result = await db.query(`
    SELECT u.id, u.username, u.display_name
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
    if (!user) throw new HttpError(401, 'Please sign in to continue.')
    request.authUser = user
    next()
  } catch (error) {
    next(error)
  }
}
