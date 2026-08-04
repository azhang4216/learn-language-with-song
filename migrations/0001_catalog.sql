CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  google_subject TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  artist TEXT NOT NULL CHECK (length(artist) BETWEEN 1 AND 120),
  youtube_video_id TEXT NOT NULL CHECK (length(youtube_video_id) = 11),
  youtube_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  source_locale TEXT NOT NULL,
  translation_locale TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lesson_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS songs_owner_created_idx ON songs(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS songs_title_idx ON songs(lower(title));
CREATE INDEX IF NOT EXISTS songs_artist_idx ON songs(lower(artist));
CREATE INDEX IF NOT EXISTS songs_youtube_idx ON songs(youtube_video_id);
CREATE UNIQUE INDEX IF NOT EXISTS songs_owner_video_idx ON songs(owner_id, youtube_video_id)
  WHERE owner_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS song_likes (
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (song_id, user_id)
);

CREATE INDEX IF NOT EXISTS song_likes_user_idx ON song_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_vocabulary (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  cue_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  source_text TEXT NOT NULL,
  romanization TEXT,
  gloss TEXT,
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning', 'learned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id, cue_id, token_id)
);

CREATE INDEX IF NOT EXISTS user_vocabulary_user_idx
  ON user_vocabulary(user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_song_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('learning', 'learned')),
  last_position_ms INTEGER NOT NULL DEFAULT 0 CHECK (last_position_ms >= 0),
  learned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS user_song_progress_user_idx
  ON user_song_progress(user_id, status, updated_at DESC);
