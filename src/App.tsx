import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccountDialog } from './components/AccountDialog'
import { AddSongDialog } from './components/AddSongDialog'
import { CatalogDialog } from './components/CatalogDialog'
import { FlashcardMode } from './components/FlashcardMode'
import { CheckIcon, HeartIcon, InfoIcon, LibraryIcon, MusicIcon, PlusIcon, UserIcon, YouTubeIcon } from './components/Icons'
import { LyricsView } from './components/LyricsView'
import { SongArtwork } from './components/SongArtwork'
import { SongLibrary } from './components/SongLibrary'
import { VocabularyPanel } from './components/VocabularyPanel'
import { YouTubePlayerDock } from './components/YouTubePlayerDock'
import { lanPianSong } from './data/lanPianSong'
import { login, register, restoreSession, signOut } from './lib/authApi'
import { listCatalogSongs, setCatalogLike } from './lib/catalogApi'
import { localeName } from './lib/format'
import { getLearningState, removeVocabulary, saveSongProgress, saveVocabulary } from './lib/learningApi'
import { findActiveCueIndex, findActiveTokenId, getTokenSeekTime } from './lib/timing'
import {
  dedupeVocabulary,
  matchingVocabularyOccurrences,
  savedVocabularyIdentity,
  tokenVocabularyIdentity,
} from './lib/vocabulary'
import type { AuthUser, LearningState } from './types/auth'
import type { CatalogSong } from './types/catalog'
import type { TimingPlaybackController } from './types/playback'
import type { LyricCue, LyricToken, TokenSelection } from './types/song'

const ignorePlayingChange = () => undefined
const emptyLearningState: LearningState = { vocabulary: [], songProgress: [] }
type AppView = 'lesson' | 'flashcards'

export function App() {
  const [songs, setSongs] = useState<CatalogSong[]>([lanPianSong])
  const [activeSongId, setActiveSongId] = useState(lanPianSong.id)
  const [selection, setSelection] = useState<TokenSelection | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [learning, setLearning] = useState<LearningState>(emptyLearningState)
  const [view, setView] = useState<AppView>('lesson')
  const [playerCollapsed, setPlayerCollapsed] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [addSongOpen, setAddSongOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [toast, setToast] = useState('')
  const playbackRef = useRef<TimingPlaybackController | null>(null)

  const song = useMemo(
    () => songs.find((item) => item.id === activeSongId) ?? songs[0] ?? lanPianSong,
    [activeSongId, songs],
  )
  const currentTimeMs = currentTime * 1000
  const activeCueIndex = findActiveCueIndex(song.cues, currentTimeMs)
  const activeCue = song.cues[activeCueIndex]
  const activeTokenId = findActiveTokenId(activeCue, currentTimeMs)
  const yourSongs = user ? songs.filter((item) => item.ownerId === user.id) : []
  const likedSongs = user ? songs.filter((item) => item.isLiked) : []
  const learnedIds = new Set(learning.songProgress
    .filter((item) => item.status === 'learned')
    .map((item) => item.songId))
  const learnedSongs = songs.filter((item) => learnedIds.has(item.id))
  const learningIds = new Set(learning.songProgress
    .filter((item) => item.status === 'learning')
    .map((item) => item.songId))
  const learningSongs = songs.filter((item) => learningIds.has(item.id))
  const songProgressStatus = learning.songProgress.find((item) => item.songId === song.id)?.status
  const currentLearningVocabulary = learning.vocabulary.filter((item) => item.songId === song.id)
  const learningWordIdentities = new Set(currentLearningVocabulary.map(savedVocabularyIdentity))
  const selectionIsLearning = selection
    ? learningWordIdentities.has(tokenVocabularyIdentity(selection.token))
    : false

  const refreshAccountData = useCallback(async () => {
    const [catalog, state] = await Promise.all([listCatalogSongs(), getLearningState()])
    if (catalog.length) setSongs(catalog)
    setLearning(state)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([listCatalogSongs(), restoreSession()]).then(async ([catalog, restoredUser]) => {
      if (cancelled) return
      if (catalog.length) setSongs(catalog)
      setUser(restoredUser)
      if (restoredUser) {
        try {
          await refreshAccountData()
        } catch {
          if (!cancelled) setToast('Your account is connected, but saved progress could not be loaded.')
        }
      }
    })
    return () => { cancelled = true }
  }, [refreshAccountData])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3_000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const finishAuthentication = useCallback(async (signedInUser: AuthUser) => {
    setUser(signedInUser)
    let accountDataLoaded = true
    try {
      await refreshAccountData()
    } catch {
      accountDataLoaded = false
    }
    setToast(accountDataLoaded
      ? `Welcome, ${signedInUser.displayName}`
      : 'Signed in. Saved learning data will load when the server reconnects.')
    setAccountOpen(false)
  }, [refreshAccountData])

  const handleLogin = useCallback(async (username: string, password: string) => {
    await finishAuthentication(await login(username, password))
  }, [finishAuthentication])

  const handleRegister = useCallback(async (username: string, password: string) => {
    await finishAuthentication(await register(username, password))
  }, [finishAuthentication])

  const handleSignOut = useCallback(async () => {
    await signOut()
    setUser(null)
    setLearning(emptyLearningState)
    setSongs((current) => current.map((item) => ({ ...item, isLiked: false })))
    setToast('Signed out')
  }, [])

  const askToSignIn = (reason: string) => {
    setToast(reason)
    setAccountOpen(true)
  }

  const openAddSong = () => {
    if (!user) {
      askToSignIn('Sign in to publish a song.')
      return
    }
    setAddSongOpen(true)
    setLibraryOpen(false)
  }

  const handleControllerChange = useCallback((controller: TimingPlaybackController | null) => {
    playbackRef.current = controller
  }, [])

  const changeSong = useCallback((songId: string) => {
    playbackRef.current?.pause().catch(() => undefined)
    setActiveSongId(songId)
    setSelection(null)
    setCurrentTime(0)
    setView('lesson')
    setCatalogOpen(false)
    setLibraryOpen(false)
  }, [])

  const selectCatalogSong = (selectedSong: CatalogSong) => {
    setSongs((current) => [selectedSong, ...current.filter((item) => item.id !== selectedSong.id)])
    changeSong(selectedSong.id)
  }

  const selectToken = (cue: LyricCue, token: LyricToken) => {
    setSelection({ cue, token })
    const seconds = getTokenSeekTime(cue, token) / 1000
    setCurrentTime(seconds)
    const playback = playbackRef.current
    if (!playback) return
    void playback.seekToTime(seconds)
      .then(() => playback.play())
      .catch(() => setToast('Press play once, then word replay will work.'))
  }

  const toggleLike = async () => {
    if (!user) {
      askToSignIn('Sign in to save liked songs across devices.')
      return
    }
    const shouldLike = !song.isLiked
    try {
      const result = await setCatalogLike(song.id, shouldLike)
      setSongs((current) => current.map((item) => item.id === song.id
        ? { ...item, isLiked: result.liked, likeCount: result.likeCount }
        : item))
      setToast(shouldLike ? 'Saved to your liked songs' : 'Removed from your liked songs')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'The song could not be saved right now.')
    }
  }

  const toggleSelectedVocabulary = async () => {
    if (!selection) return
    if (!user) {
      askToSignIn('Sign in to add words to your learning list.')
      return
    }
    const { token } = selection
    const identity = tokenVocabularyIdentity(token)
    const occurrences = matchingVocabularyOccurrences(song, token)
    try {
      if (selectionIsLearning) {
        await Promise.all(occurrences.map((occurrence) =>
          removeVocabulary(song.id, occurrence.cue.id, occurrence.token.id)))
        setLearning((current) => ({
          ...current,
          vocabulary: current.vocabulary.filter((item) =>
            item.songId !== song.id || savedVocabularyIdentity(item) !== identity),
        }))
        setToast(occurrences.length > 1
          ? `Removed “${token.text}” everywhere in this song`
          : `Removed “${token.text}” from learning`)
      } else {
        const items = await Promise.all(occurrences.map((occurrence) =>
          saveVocabulary(song.id, occurrence.cue.id, occurrence.token.id)))
        setLearning((current) => ({
          ...current,
          vocabulary: [
            ...items,
            ...current.vocabulary.filter((saved) =>
              saved.songId !== song.id || savedVocabularyIdentity(saved) !== identity),
          ],
        }))
        setToast(occurrences.length > 1
          ? `Marked “${token.text}” everywhere in this song`
          : `Added “${token.text}” to learning`)
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'This word could not be saved.')
    }
  }

  const setSongStatus = async (status: 'learning' | 'learned') => {
    if (!user) {
      askToSignIn('Sign in to track your song progress.')
      return
    }
    if (songProgressStatus === status) {
      setToast(status === 'learning' ? 'This song is already in Learning' : 'This song is already learned')
      return
    }
    try {
      const progress = await saveSongProgress(song.id, status, currentTimeMs)
      setLearning((current) => ({
        ...current,
        songProgress: [progress, ...current.songProgress.filter((item) => item.songId !== song.id)],
      }))
      setToast(status === 'learning'
        ? `Added “${song.title}” to Learning`
        : `Marked “${song.title}” as learned`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Song progress could not be saved.')
    }
  }

  const handlePublished = (published: CatalogSong) => {
    setSongs((current) => [published, ...current.filter((item) => item.id !== published.id)])
    setAddSongOpen(false)
    changeSong(published.id)
    setToast(`“${published.title}” is now live in the catalogue`)
  }

  return (
    <div className={`app-shell ${playerCollapsed ? 'player-collapsed' : ''}`}>
      <a className="skip-link" href={view === 'lesson' ? '#lyrics' : '#flashcards'}>Skip to content</a>
      <SongLibrary
        activeSongId={song.id}
        yourSongs={yourSongs}
        likedSongs={likedSongs}
        learningSongs={learningSongs}
        learnedSongs={learnedSongs}
        learningSongIds={learningIds}
        activeView={view}
        mobileOpen={libraryOpen}
        onSelect={changeSong}
        onOpenCatalog={() => {
          setView('lesson')
          setCatalogOpen(true)
          setLibraryOpen(false)
        }}
        onOpenFlashcards={() => {
          setView('flashcards')
          setLibraryOpen(false)
        }}
        onAddSong={openAddSong}
        onClose={() => setLibraryOpen(false)}
      />
      {libraryOpen && <button className="sidebar-backdrop" onClick={() => setLibraryOpen(false)} aria-label="Close library" />}

      <main className="main-stage">
        <header className="topbar">
          <button className="mobile-library-button" onClick={() => setLibraryOpen(true)}>
            <LibraryIcon /> Library
          </button>
          <button className="breadcrumbs breadcrumb-button" onClick={() => setCatalogOpen(true)}>
            <span>Verse</span><span className="breadcrumb-slash">/</span><strong>{view === 'lesson' ? 'Now learning' : 'Flashcards'}</strong>
          </button>
          <div className="topbar-actions">
            <button className="header-import-button" onClick={() => setCatalogOpen(true)}>
              <LibraryIcon /> <span>Browse songs</span>
            </button>
            <button className="header-timing-button" onClick={openAddSong}>
              <PlusIcon /> <span>Add song</span>
            </button>
            <button className="header-account-button" onClick={() => setAccountOpen(true)}>
              <UserIcon />
              <span>{user ? user.displayName : 'Sign in'}</span>
            </button>
          </div>
        </header>

        {view === 'lesson' ? <div className="learning-layout">
          <div className="lesson-column" id="lyrics">
            <section className="song-hero" aria-labelledby="song-title">
              <div className="hero-art-wrap">
                <SongArtwork title={song.title} artworkUrl={song.youtube.thumbnailUrl} size="large" />
              </div>
              <div className="hero-copy">
                <div className="hero-kicker"><span /> {songProgressStatus === 'learned' ? 'Learned' : songProgressStatus === 'learning' ? 'Currently learning' : 'Song lesson'}</div>
                <div className="hero-title-row">
                  <h1 id="song-title">{song.title}</h1>
                  <button
                    className={`like-song-button ${song.isLiked ? 'is-liked' : ''}`}
                    onClick={() => void toggleLike()}
                    aria-label={song.isLiked ? 'Unlike song' : 'Like song'}
                    aria-pressed={song.isLiked}
                  ><HeartIcon /></button>
                </div>
                <p className="hero-artist">{song.artist ?? 'Unknown artist'}</p>
                <div className="song-tags">
                  <span>{localeName(song.sourceLocale)}</span>
                  <span className="tag-divider" />
                  <span>{song.cues.length} phrases</span>
                  <span className="tag-divider" />
                  <span className="tag-origin"><YouTubeIcon /> YouTube</span>
                  <span className="tag-divider" />
                  <span>{song.likeCount} likes</span>
                </div>
                <div className="hero-learning-actions">
                  <button
                    className={songProgressStatus === 'learning' ? 'learning-song-button is-learning' : 'learning-song-button'}
                    onClick={() => void setSongStatus('learning')}
                    aria-pressed={songProgressStatus === 'learning'}
                  ><MusicIcon /> {songProgressStatus === 'learning' ? 'Currently learning' : 'Learn this song'}</button>
                  <button
                    className={songProgressStatus === 'learned' ? 'learned-button is-learned' : 'learned-button'}
                    onClick={() => void setSongStatus('learned')}
                    aria-pressed={songProgressStatus === 'learned'}
                  ><CheckIcon /> {songProgressStatus === 'learned' ? 'Learned' : 'Mark as learned'}</button>
                </div>
                <div className="learning-hint"><InfoIcon /> Select a grouped word to replay it and highlight its pinyin and meaning.</div>
              </div>
            </section>

            <LyricsView
              key={song.id}
              song={song}
              currentTimeMs={currentTimeMs}
              activeCueIndex={activeCueIndex}
              activeTokenId={activeTokenId}
              selectedTokenId={selection?.token.id ?? null}
              learningWordIdentities={learningWordIdentities}
              onTokenSelect={selectToken}
            />
          </div>

          <VocabularyPanel
            selection={selection}
            translationLocale={song.translationLocale}
            isLearning={selectionIsLearning}
            onToggleLearning={() => void toggleSelectedVocabulary()}
            onClose={() => setSelection(null)}
          />
        </div> : (
          <div id="flashcards">
            <FlashcardMode
              items={learning.vocabulary}
              songs={songs}
              signedIn={Boolean(user)}
              onSignIn={() => setAccountOpen(true)}
            />
          </div>
        )}
      </main>

      <YouTubePlayerDock
        key={song.id}
        song={song}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        onPlayingChange={ignorePlayingChange}
        onControllerChange={handleControllerChange}
        collapsed={playerCollapsed}
        onToggleCollapsed={() => setPlayerCollapsed((current) => !current)}
      />

      {catalogOpen && (
        <CatalogDialog
          initialSongs={songs}
          onClose={() => setCatalogOpen(false)}
          onSelect={selectCatalogSong}
        />
      )}
      {addSongOpen && <AddSongDialog onClose={() => setAddSongOpen(false)} onPublished={handlePublished} />}
      {accountOpen && (
        <AccountDialog
          user={user}
          learningWordCount={dedupeVocabulary(
            learning.vocabulary.filter((item) => item.status === 'learning'),
          ).length}
          learnedSongCount={learnedIds.size}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSignOut={handleSignOut}
          onClose={() => setAccountOpen(false)}
        />
      )}
      {toast && <div className="toast" role="status"><MusicIcon />{toast}</div>}
    </div>
  )
}
