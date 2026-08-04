ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS familiarity_streak SMALLINT NOT NULL DEFAULT 0
    CHECK (familiarity_streak BETWEEN 0 AND 2);

ALTER TABLE user_vocabulary
  ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'learning'
    CHECK (review_state IN ('learning', 'review'));
