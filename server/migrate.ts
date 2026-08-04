import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lanPianSong } from '../src/data/lanPianSong'
import type { CatalogSongDraft } from '../src/types/catalog'
import { db } from './db'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationDirectory = join(root, 'migrations')

const draftFromSeed = (): CatalogSongDraft => ({
  schemaVersion: lanPianSong.schemaVersion,
  id: lanPianSong.id,
  title: lanPianSong.title,
  ...(lanPianSong.artist ? { artist: lanPianSong.artist } : {}),
  ...(lanPianSong.artworkUrl ? { artworkUrl: lanPianSong.artworkUrl } : {}),
  sourceLocale: lanPianSong.sourceLocale,
  translationLocale: lanPianSong.translationLocale,
  audio: lanPianSong.audio,
  cues: lanPianSong.cues,
  youtube: lanPianSong.youtube,
})

const run = async (): Promise<void> => {
  const client = await db.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    const names = (await readdir(migrationDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    for (const name of names) {
      const found = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
      if (found.rowCount) continue
      const sql = await readFile(join(migrationDirectory, name), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
        await client.query('COMMIT')
        console.log(`Applied ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    const draft = draftFromSeed()
    await client.query(`
      INSERT INTO songs (
        id, title, artist, youtube_video_id, youtube_url, thumbnail_url,
        source_locale, translation_locale, duration_ms, owner_id, lesson_json,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        youtube_video_id = EXCLUDED.youtube_video_id,
        youtube_url = EXCLUDED.youtube_url,
        thumbnail_url = EXCLUDED.thumbnail_url,
        source_locale = EXCLUDED.source_locale,
        translation_locale = EXCLUDED.translation_locale,
        duration_ms = EXCLUDED.duration_ms,
        lesson_json = EXCLUDED.lesson_json,
        updated_at = EXCLUDED.updated_at
    `, [
      lanPianSong.id,
      lanPianSong.title,
      lanPianSong.artist ?? 'Unknown artist',
      lanPianSong.youtube.videoId,
      lanPianSong.youtube.url,
      lanPianSong.youtube.thumbnailUrl,
      lanPianSong.sourceLocale,
      lanPianSong.translationLocale,
      lanPianSong.audio.durationMs ?? lanPianSong.cues.at(-1)!.endMs,
      JSON.stringify(draft),
      lanPianSong.createdAt,
      lanPianSong.updatedAt,
    ])
    console.log('Database is ready.')
  } finally {
    client.release()
    await db.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
