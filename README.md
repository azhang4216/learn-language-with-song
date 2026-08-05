# Verse

Verse is a YouTube-based Mandarin learning player with synchronized lyrics, cohesive word groups, pinyin, and English meanings. The catalogue starts with the completed 46-line lesson for **烂片剧情 — LBI利比**.

## Product status

The MVP includes:

- YouTube playback with line-synchronized Chinese, pinyin, and English
- Playback speed controls supported by the YouTube player
- Username/password registration and sign-in
- Public catalogue and search
- Immediate publishing for any signed-in user
- Cross-device “Your songs” and liked songs
- Save repeated lyric vocabulary as one highlighted learning word across the song
- Review saved words in a deduplicated flashcard tab with familiar/review-more grading, persisted two-answer mastery, first-occurrence song context, configurable ordering/filtering, and a three-color progress summary
- Mark songs as currently learning before marking them learned, and see both library sections
- Collapse the bottom player into audio controls without showing the video
- A guided YouTube contribution flow that intelligently extracts editable song details, accepts ungrouped simplified or traditional lyrics, generates dictionary-backed word groups/pinyin/meanings, and provides a full review editor before timing
- One-pass space-bar timing, return-to-edit support, and prepared Verse JSON upload

The MVP intentionally has no email, email verification, password reset, or social sign-in. Private drafts, admin review, and publishing approval are planned for P2.

Only YouTube is used for playback. Verse stores YouTube references and lesson metadata; it does not store commercial audio.

## Architecture

```text
GitHub Pages (React/Vite)
       │ HTTPS + bearer session
       ▼
Render web service (Express API)
       ├── OpenAI Responses API (optional metadata interpretation)
       │ internal DATABASE_URL
       ▼
Render Postgres (accounts, sessions, songs, likes, words, progress)
```

A Cloudflare Worker and D1 are not needed. The Render API and Postgres database are the only backend and source of truth.

## Create the Render backend and database

The repository already contains `render.yaml`, which defines both resources. Use a **Blueprint**, not Render Workflow and not Static Site.

1. Return to your Render workspace dashboard. The “Create a new Workflow” screen is the wrong flow.
2. Open **Blueprints** in the workspace’s left sidebar.
3. Select **New Blueprint Instance**. In dashboard versions that show it, **+ New → Blueprint** opens the same flow.
4. Connect GitHub if needed, then select `azhang4216/learn-language-with-song`.
5. Use:
   - Blueprint name: `learn-language-with-song`
   - Branch: `main`
   - Blueprint path: `render.yaml`
6. Review the two resources and select **Deploy Blueprint**.
7. Wait for the database and web service to become available. The web-service health check is `/api/health`.
8. Copy the web-service URL shown by Render. The configured service name should produce `https://learn-language-with-song-api-azhang4216.onrender.com`; use the actual URL if it differs.

The Blueprint creates:

- a Starter Render web service, the lowest always-on instance type;
- a free Render Postgres database for the initial MVP;
- an internal `DATABASE_URL` connection, with public database access disabled;
- exact CORS access for the GitHub Pages origin;
- automatic migrations and the seed lesson on startup.

Render free Postgres databases expire after 30 days, so this MVP database must be upgraded or replaced before that deadline to preserve accounts and learning progress.

## Activate intelligent YouTube metadata

The backend always has a local metadata parser and recognizes original-language patterns such as `利比《跳楼机》`. For more ambiguous video titles, it can use the OpenAI Responses API to return a strict song-title/artist result. The contributor still reviews and can edit both fields.

To activate the model on Render:

1. Open the `learn-language-with-song-api-azhang4216` web service.
2. Open **Environment** and add a secret named `OPENAI_API_KEY`.
3. Save the change and let Render redeploy the service.

The Blueprint sets `OPENAI_METADATA_MODEL=gpt-5.6-luna`, which is appropriate for this small structured extraction task. You can override it in Render. Keep `OPENAI_API_KEY` only on the backend—never add it to a `VITE_` variable or GitHub Pages.

## Connect GitHub Pages to Render

The repository’s GitHub Actions variable already points to the expected Render URL. If Render assigns a different URL:

1. Open the GitHub repository.
2. Go to **Settings → Secrets and variables → Actions → Variables**.
3. Update `VITE_CATALOG_API_URL` to the actual HTTPS Render web-service URL.
4. Open **Actions → Test and deploy GitHub Pages → Run workflow**.

GitHub Pages publishes at:

```text
https://azhang4216.github.io/learn-language-with-song/
```

## Verify the live application

1. Open the Pages URL and confirm the seeded song loads.
2. Select **Sign in**, then switch to **Create account**.
3. Create a username of 3–24 letters, numbers, or underscores and a password of at least 8 characters.
4. Like the song, save a lyric word, mark the song currently learning, then mark it learned.
5. Refresh and sign in again to confirm the saved state returns.
6. Add a small test song and confirm it appears immediately in the public catalogue.

If the seeded offline catalogue appears but account actions fail, verify the Render service is healthy and `VITE_CATALOG_API_URL` matches its URL.

## Run locally

Requirements: Node.js 24, npm, and Postgres.

```bash
cp .env.example .env
npm install
createdb verse
npm run db:migrate
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Vite runs at `http://localhost:4173`; the Express API runs at `http://localhost:10000`.

Quality checks:

```bash
npm run lint
npm test
npm run build
```

## Authentication and data

Postgres stores:

- `users` with normalized usernames and salted `scrypt` password hashes;
- hashed, expiring `sessions`;
- public `songs` with their complete lesson JSON;
- per-user `song_likes`;
- `user_vocabulary` snapshots, familiarity streaks, and review state for flashcard learning;
- `user_song_progress` for learning/learned state.

Public catalogue reads remain anonymous. Publishing, likes, vocabulary, and progress require a valid session. The application never stores plaintext passwords.

Relevant files:

- `server/index.ts` — Render Express API
- `server/auth.ts` — password hashing, login, registration, and sessions
- `server/migrate.ts` — transactional migrations and seed lesson
- `migrations/0001_catalog.sql` — Postgres schema
- `render.yaml` — Render Blueprint
- `.github/workflows/pages.yml` — tested GitHub Pages deployment
- `src/data/lanPianSong.ts` — initial curated lesson

## License

MIT. See [LICENSE](./LICENSE).
