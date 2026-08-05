import { randomUUID } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { loginWithPassword, optionalAuth, registerWithPassword, requireAuth } from './auth'
import { config } from './config'
import { db } from './db'
import { assertString, HttpError } from './http'
import { enrichChineseLyrics } from './chineseEnrichment'
import { inferYouTubeMetadata } from './songMetadata'
import { parseCatalogSongDraft, SongValidationError } from '../src/lib/songValidation'
import { parseYouTubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from '../src/lib/youtubeUrl'
import type { CatalogSong, CatalogSongDraft } from '../src/types/catalog'

const app = express()
const maxResults = 100

interface SongRow {
  id: string
  title: string
  artist: string
  youtube_video_id: string
  youtube_url: string
  thumbnail_url: string
  source_locale: string
  translation_locale: string
  duration_ms: number
  owner_id: string | null
  lesson_json: unknown
  created_at: Date | string
  updated_at: Date | string
  like_count: string | number
  is_liked: boolean
}

const asIso = (value: Date | string): string => new Date(value).toISOString()

const rowToSong = (row: SongRow): CatalogSong => {
  const parsed = typeof row.lesson_json === 'string'
    ? JSON.parse(row.lesson_json) as unknown
    : row.lesson_json
  const draft = parseCatalogSongDraft(parsed)
  return {
    ...draft,
    id: row.id,
    title: row.title,
    artist: row.artist,
    artworkUrl: row.thumbnail_url,
    sourceLocale: row.source_locale,
    translationLocale: row.translation_locale,
    audio: { ...draft.audio, durationMs: Number(row.duration_ms) },
    youtube: {
      videoId: row.youtube_video_id,
      url: row.youtube_url,
      thumbnailUrl: row.thumbnail_url,
    },
    ownerId: row.owner_id ?? 'verse-curated',
    likeCount: Number(row.like_count) || 0,
    isLiked: Boolean(row.is_liked),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  }
}

const asyncRoute = (
  handler: (request: Request, response: Response) => Promise<unknown>,
) => (request: Request, response: Response, next: NextFunction): void => {
  void handler(request, response).catch(next)
}

app.disable('x-powered-by')
app.use((request, response, next) => {
  const origin = request.header('Origin')?.replace(/\/$/, '')
  if (origin && config.frontendOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  }
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (request.method === 'OPTIONS') {
    response.sendStatus(origin && config.frontendOrigins.includes(origin) ? 204 : 403)
    return
  }
  next()
})
app.use(express.json({ limit: '256kb', type: 'application/json' }))

app.get('/api/health', asyncRoute(async (_request, response) => {
  await db.query('SELECT 1')
  response.json({ ok: true })
}))

app.post('/api/auth/register', asyncRoute(async (request, response) => {
  const result = await registerWithPassword(request.body?.username, request.body?.password)
  response.status(201).json(result)
}))

app.post('/api/auth/login', asyncRoute(async (request, response) => {
  const result = await loginWithPassword(request.body?.username, request.body?.password)
  response.json(result)
}))

app.get('/api/auth/session', requireAuth, (request, response) => {
  response.json({ user: request.authUser })
})

app.delete('/api/auth/session', requireAuth, asyncRoute(async (request, response) => {
  await db.query('DELETE FROM sessions WHERE token_hash = $1', [request.sessionHash])
  response.sendStatus(204)
}))

app.post('/api/song-tools/youtube-metadata', requireAuth, asyncRoute(async (request, response) => {
  const youtubeUrl = assertString(request.body?.youtubeUrl, 'youtubeUrl', 500)
  const videoId = parseYouTubeVideoId(youtubeUrl)
  if (!videoId) throw new HttpError(400, 'Enter a valid youtube.com or youtu.be link.')

  let title = ''
  let artist = ''
  let metadataSource: 'llm' | 'heuristic' = 'heuristic'
  try {
    const metadataResponse = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(videoId))}&format=json`,
      { signal: AbortSignal.timeout(8_000) },
    )
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json() as { title?: unknown; author_name?: unknown }
      const inferred = await inferYouTubeMetadata(
        typeof metadata.title === 'string' ? metadata.title : '',
        typeof metadata.author_name === 'string' ? metadata.author_name : '',
        {
          apiKey: config.openAiApiKey,
          model: config.openAiMetadataModel,
        },
      )
      title = inferred.title
      artist = inferred.artist
      metadataSource = inferred.source
    }
  } catch {
    // Metadata is a convenience. The contributor can still enter both fields manually.
  }

  response.json({
    videoId,
    title,
    artist,
    metadataSource,
    thumbnailUrl: youtubeThumbnailUrl(videoId),
  })
}))

app.post('/api/song-tools/enrich-lyrics', requireAuth, asyncRoute(async (request, response) => {
  const lyrics = assertString(request.body?.lyrics, 'lyrics', 100_000)
  const script = request.body?.script
  if (script !== 'simplified' && script !== 'traditional') {
    throw new HttpError(400, 'script must be “simplified” or “traditional”.')
  }
  const lineCount = lyrics.split(/\r?\n/).filter((line) => line.trim()).length
  if (!lineCount) throw new HttpError(400, 'Add at least one Chinese lyric line.')
  if (lineCount > 500) throw new HttpError(400, 'A lesson can contain at most 500 lyric lines.')

  response.json(enrichChineseLyrics(lyrics, script))
}))

app.get('/api/songs', optionalAuth, asyncRoute(async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 100) : ''
  const owner = typeof request.query.owner === 'string' ? request.query.owner.trim() : ''
  const likedOnly = request.query.likedBy === 'me'
  if (likedOnly && !request.authUser) throw new HttpError(401, 'Please sign in to view liked songs.')

  const result = await db.query<SongRow>(`
    SELECT s.*,
      (SELECT COUNT(*)::int FROM song_likes count_likes WHERE count_likes.song_id = s.id) AS like_count,
      CASE WHEN $1::uuid IS NULL THEN FALSE ELSE EXISTS (
        SELECT 1 FROM song_likes viewer_like
        WHERE viewer_like.song_id = s.id AND viewer_like.user_id = $1::uuid
      ) END AS is_liked
    FROM songs s
    WHERE ($2 = '' OR s.title ILIKE $3 ESCAPE '\\' OR s.artist ILIKE $3 ESCAPE '\\')
      AND ($4 = '' OR s.owner_id::text = $4)
      AND ($5 = FALSE OR EXISTS (
        SELECT 1 FROM song_likes filtered_like
        WHERE filtered_like.song_id = s.id AND filtered_like.user_id = $1::uuid
      ))
    ORDER BY like_count DESC, s.updated_at DESC
    LIMIT $6
  `, [
    request.authUser?.id ?? null,
    query,
    `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`,
    owner,
    likedOnly,
    maxResults,
  ])
  response.setHeader('Cache-Control', request.authUser ? 'private, max-age=15' : 'public, max-age=30')
  response.json({ songs: result.rows.map(rowToSong) })
}))

app.post('/api/songs', requireAuth, asyncRoute(async (request, response) => {
  const draft = parseCatalogSongDraft(request.body)
  if (draft.cues.length > 500) throw new HttpError(400, 'A song can contain at most 500 lyric cues.')

  const slug = draft.title
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'song'
  const id = `${slug}-${randomUUID().slice(0, 8)}`
  const storedDraft: CatalogSongDraft = { ...draft, id }
  const result = await db.query<SongRow>(`
    INSERT INTO songs (
      id, title, artist, youtube_video_id, youtube_url, thumbnail_url,
      source_locale, translation_locale, duration_ms, owner_id, lesson_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *, 0::int AS like_count, FALSE AS is_liked
  `, [
    id,
    draft.title.trim(),
    draft.artist?.trim() || 'Unknown artist',
    draft.youtube.videoId,
    draft.youtube.url,
    draft.youtube.thumbnailUrl,
    draft.sourceLocale,
    draft.translationLocale,
    Math.round(draft.audio.durationMs ?? draft.cues.at(-1)!.endMs),
    request.authUser!.id,
    JSON.stringify(storedDraft),
  ])
  response.status(201).json({ song: rowToSong(result.rows[0]!) })
}))

app.put('/api/songs/:id/like', requireAuth, asyncRoute(async (request, response) => {
  const exists = await db.query('SELECT 1 FROM songs WHERE id = $1', [request.params.id])
  if (!exists.rowCount) throw new HttpError(404, 'Song not found.')
  await db.query(`
    INSERT INTO song_likes (song_id, user_id) VALUES ($1, $2)
    ON CONFLICT DO NOTHING
  `, [request.params.id, request.authUser!.id])
  const count = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM song_likes WHERE song_id = $1',
    [request.params.id],
  )
  response.json({ liked: true, likeCount: count.rows[0]?.count ?? 0 })
}))

app.delete('/api/songs/:id/like', requireAuth, asyncRoute(async (request, response) => {
  await db.query('DELETE FROM song_likes WHERE song_id = $1 AND user_id = $2', [
    request.params.id,
    request.authUser!.id,
  ])
  const count = await db.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM song_likes WHERE song_id = $1',
    [request.params.id],
  )
  response.json({ liked: false, likeCount: count.rows[0]?.count ?? 0 })
}))

app.get('/api/me/state', requireAuth, asyncRoute(async (request, response) => {
  const [vocabulary, progress] = await Promise.all([
    db.query(`
      SELECT song_id AS "songId", cue_id AS "cueId", token_id AS "tokenId",
        source_text AS "sourceText", romanization, gloss, status,
        familiarity_streak AS "familiarityStreak", review_state AS "reviewState",
        created_at AS "createdAt", updated_at AS "updatedAt"
      FROM user_vocabulary WHERE user_id = $1
      ORDER BY updated_at DESC
    `, [request.authUser!.id]),
    db.query(`
      SELECT song_id AS "songId", status, last_position_ms AS "lastPositionMs",
        learned_at AS "learnedAt", updated_at AS "updatedAt"
      FROM user_song_progress WHERE user_id = $1
      ORDER BY updated_at DESC
    `, [request.authUser!.id]),
  ])
  response.json({ vocabulary: vocabulary.rows, songProgress: progress.rows })
}))

app.put('/api/me/vocabulary', requireAuth, asyncRoute(async (request, response) => {
  const songId = assertString(request.body?.songId, 'songId', 160)
  const cueId = assertString(request.body?.cueId, 'cueId', 160)
  const tokenId = assertString(request.body?.tokenId, 'tokenId', 160)
  const result = await db.query<{ lesson_json: unknown }>(
    'SELECT lesson_json FROM songs WHERE id = $1',
    [songId],
  )
  if (!result.rows[0]) throw new HttpError(404, 'Song not found.')
  const draft = parseCatalogSongDraft(result.rows[0].lesson_json)
  const cue = draft.cues.find((item) => item.id === cueId)
  const token = cue?.tokens?.find((item) => item.id === tokenId)
  if (!cue || !token) throw new HttpError(404, 'Lyric word not found.')
  const saved = await db.query(`
    INSERT INTO user_vocabulary (
      user_id, song_id, cue_id, token_id, source_text, romanization, gloss
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (user_id, song_id, cue_id, token_id) DO UPDATE SET
      source_text = EXCLUDED.source_text,
      romanization = EXCLUDED.romanization,
      gloss = EXCLUDED.gloss,
      status = 'learning',
      familiarity_streak = 0,
      review_state = 'learning',
      updated_at = NOW()
    RETURNING song_id AS "songId", cue_id AS "cueId", token_id AS "tokenId",
      source_text AS "sourceText", romanization, gloss, status,
      familiarity_streak AS "familiarityStreak", review_state AS "reviewState",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `, [
    request.authUser!.id,
    songId,
    cueId,
    tokenId,
    token.text,
    token.romanization?.text ?? null,
    token.glosses?.[draft.translationLocale] ?? token.glosses?.en ?? null,
  ])
  response.json({ item: saved.rows[0] })
}))

app.put('/api/me/vocabulary/review', requireAuth, asyncRoute(async (request, response) => {
  const songId = assertString(request.body?.songId, 'songId', 160)
  const cueId = assertString(request.body?.cueId, 'cueId', 160)
  const tokenId = assertString(request.body?.tokenId, 'tokenId', 160)
  if (typeof request.body?.familiar !== 'boolean') {
    throw new HttpError(400, 'familiar must be true or false.')
  }
  const familiar = request.body.familiar as boolean
  const result = await db.query(`
    UPDATE user_vocabulary SET
      familiarity_streak = CASE
        WHEN $5 THEN LEAST(2, familiarity_streak + 1)
        ELSE 0
      END,
      status = CASE
        WHEN $5 AND familiarity_streak >= 1 THEN 'learned'
        ELSE 'learning'
      END,
      review_state = CASE WHEN $5 THEN 'learning' ELSE 'review' END,
      updated_at = NOW()
    WHERE user_id = $1 AND song_id = $2 AND cue_id = $3 AND token_id = $4
    RETURNING song_id AS "songId", cue_id AS "cueId", token_id AS "tokenId",
      source_text AS "sourceText", romanization, gloss, status,
      familiarity_streak AS "familiarityStreak", review_state AS "reviewState",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `, [request.authUser!.id, songId, cueId, tokenId, familiar])
  if (!result.rows[0]) throw new HttpError(404, 'Learning word not found.')
  response.json({ item: result.rows[0] })
}))

app.delete('/api/me/vocabulary/:songId/:cueId/:tokenId', requireAuth, asyncRoute(async (request, response) => {
  await db.query(`
    DELETE FROM user_vocabulary
    WHERE user_id = $1 AND song_id = $2 AND cue_id = $3 AND token_id = $4
  `, [request.authUser!.id, request.params.songId, request.params.cueId, request.params.tokenId])
  response.sendStatus(204)
}))

app.put('/api/me/songs/:id/progress', requireAuth, asyncRoute(async (request, response) => {
  const status = request.body?.status
  if (status !== 'learning' && status !== 'learned') {
    throw new HttpError(400, 'status must be “learning” or “learned”.')
  }
  const position = Number(request.body?.lastPositionMs ?? 0)
  if (!Number.isFinite(position) || position < 0) {
    throw new HttpError(400, 'lastPositionMs must be a non-negative number.')
  }
  const exists = await db.query('SELECT 1 FROM songs WHERE id = $1', [request.params.id])
  if (!exists.rowCount) throw new HttpError(404, 'Song not found.')
  const result = await db.query(`
    INSERT INTO user_song_progress (user_id, song_id, status, last_position_ms, learned_at)
    VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'learned' THEN NOW() ELSE NULL END)
    ON CONFLICT (user_id, song_id) DO UPDATE SET
      status = EXCLUDED.status,
      last_position_ms = EXCLUDED.last_position_ms,
      learned_at = CASE
        WHEN EXCLUDED.status = 'learned' THEN COALESCE(user_song_progress.learned_at, NOW())
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING song_id AS "songId", status, last_position_ms AS "lastPositionMs",
      learned_at AS "learnedAt", updated_at AS "updatedAt"
  `, [request.authUser!.id, request.params.id, status, Math.round(position)])
  response.json({ progress: result.rows[0] })
}))

app.delete('/api/me/songs/:id/progress', requireAuth, asyncRoute(async (request, response) => {
  await db.query('DELETE FROM user_song_progress WHERE user_id = $1 AND song_id = $2', [
    request.authUser!.id,
    request.params.id,
  ])
  response.sendStatus(204)
}))

app.use((_request, _response, next) => next(new HttpError(404, 'Not found.')))
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next
  if (error instanceof SongValidationError) {
    response.status(400).json({ error: error.message, issues: error.issues })
    return
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message })
    return
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    response.status(409).json({ error: 'You have already published a lesson for this YouTube video.' })
    return
  }
  if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: 'Song submissions must be smaller than 256 KB.' })
    return
  }
  console.error(error)
  response.status(500).json({ error: 'The server could not complete this request.' })
})

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Verse API listening on port ${config.port}`)
})

const shutdown = (): void => {
  server.close(() => {
    void db.end().finally(() => process.exit(0))
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
