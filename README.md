# Verse

Verse is a YouTube-based Mandarin learning player with synchronized lyrics, cohesive word groups, pinyin, and English meanings. The catalogue starts with the completed 46-line lesson for **烂片剧情 — LBI利比**.

## Product status

P0 is implemented:

- YouTube playback with line-synchronized Chinese, pinyin, and English
- Playback speed controls supported by the YouTube player
- Google sign-in with server-side ID-token verification
- Public catalogue and search
- Immediate publishing for any signed-in user
- Cross-device “Your songs” and liked songs
- Save individual lyric words as learning vocabulary for future flashcards
- Mark songs learned and see them in the learned-song library
- One-pass space-bar timing and prepared Verse JSON upload

Planned:

- **P1:** email/password sign-up and sign-in, plus flashcard review sessions
- **P2:** private drafts, admin review, and approval before public publishing

Only YouTube is used for playback. Verse stores YouTube references and lesson metadata; it does not store commercial audio.

## Architecture

```text
GitHub Pages (React/Vite)
       │ HTTPS + bearer session
       ▼
Render web service (Express API + Google verification)
       │ internal DATABASE_URL
       ▼
Render Postgres (accounts, sessions, songs, likes, words, progress)
```

A Cloudflare Worker and D1 are not needed in this architecture. The former Worker/D1 implementation has been replaced by the Render API and Postgres schema so there is one backend and one source of truth.

## First-time production setup

### 1. Create the Google web client

In [Google Cloud Console](https://console.cloud.google.com/), configure the OAuth consent screen and create an **OAuth client ID → Web application**. Add these Authorized JavaScript origins:

```text
http://localhost:4173
https://azhang4216.github.io
```

Use the origin only—do not append the repository path. Copy the client ID ending in `.apps.googleusercontent.com`. This sign-in flow does not require a Google client secret.

### 2. Create the Render API and database

1. In Render, choose **New → Blueprint**.
2. Connect `azhang4216/learn-language-with-song` and select its `render.yaml`.
3. Enter the Google web client ID when Render asks for `GOOGLE_CLIENT_ID`.
4. Review and apply the Blueprint.
5. Wait for the database migration and `/api/health` health check to pass.
6. Copy the web-service URL. The configured name should produce `https://learn-language-with-song-api-azhang4216.onrender.com`; use the actual Render URL if it differs.

The Blueprint creates:

- a free Render web service;
- a persistent `basic-256mb` Render Postgres database;
- an internal `DATABASE_URL` connection, with public database access disabled;
- exact CORS access for the GitHub Pages origin;
- automatic migrations and seed data on startup.

The database is intentionally on a paid persistent plan because it will contain user accounts and learning progress. For a short-lived test, change the database plan to `free` before applying the Blueprint, but Render free Postgres databases expire after 30 days.

### 3. Connect GitHub Pages to Render and Google

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Value |
| --- | --- |
| `VITE_CATALOG_API_URL` | The HTTPS Render web-service URL |
| `VITE_GOOGLE_CLIENT_ID` | The same Google web client ID |

Then open **Actions → Test and deploy GitHub Pages → Run workflow**. The workflow tests and builds the app before deploying it. GitHub Pages is configured to use GitHub Actions and publishes at:

```text
https://azhang4216.github.io/learn-language-with-song/
```

### 4. Verify the live path

1. Open the Pages URL and confirm the seeded song loads.
2. Sign in with Google.
3. Like the song, save a lyric word, and mark the song learned.
4. Refresh or use another browser to confirm the state comes back after sign-in.
5. Add a small test song and confirm it appears immediately in the public catalogue.

If Google reports an origin error, re-check that the Cloud Console contains `https://azhang4216.github.io` exactly. If the app shows its seeded offline catalogue but account actions fail, verify `VITE_CATALOG_API_URL` and rerun the Pages workflow.

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

Edit `.env` with your real Google client ID. Vite runs at `http://localhost:4173`; the Express API runs at `http://localhost:10000`.

Quality checks:

```bash
npm run lint
npm test
npm run build
```

## Data model and API

Postgres stores:

- `users` and hashed, expiring `sessions`;
- public `songs` with their complete lesson JSON;
- per-user `song_likes`;
- `user_vocabulary` snapshots for flashcard learning;
- `user_song_progress` for learning/learned state.

Public API reads remain anonymous. Publishing, likes, vocabulary, and progress require a valid session. Google ID tokens are verified by the backend against `GOOGLE_CLIENT_ID`; the database stores Google’s stable subject identifier and never stores a Google password or access token.

Relevant files:

- `server/index.ts` — Render Express API
- `server/auth.ts` — Google verification and database sessions
- `server/migrate.ts` — transactional migrations and seed lesson
- `migrations/0001_catalog.sql` — Postgres schema
- `render.yaml` — Render Blueprint
- `.github/workflows/pages.yml` — tested GitHub Pages deployment
- `src/data/lanPianSong.ts` — initial curated lesson

## License

MIT. See [LICENSE](./LICENSE).
