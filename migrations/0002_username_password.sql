ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users
SET username = 'legacy_' || substr(md5(id::text), 1, 12)
WHERE username IS NULL;

UPDATE users
SET password_hash = 'disabled'
WHERE password_hash IS NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_format_check
      CHECK (username ~ '^[a-z0-9_]{3,24}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users(lower(username));

ALTER TABLE users DROP COLUMN IF EXISTS google_subject;
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
