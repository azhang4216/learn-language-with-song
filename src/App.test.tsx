import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { lanPianSong } from './data/lanPianSong'
import type { LearningState } from './types/auth'

const playbackSpies = vi.hoisted(() => ({
  seekToTime: vi.fn(() => Promise.resolve()),
  play: vi.fn(() => Promise.resolve()),
}))

vi.mock('./components/YouTubePlayerDock', () => ({
  YouTubePlayerDock: ({
    collapsed,
    onToggleCollapsed,
    onTimeUpdate,
    onPlayingChange,
    onControllerChange,
  }: {
    collapsed: boolean
    onToggleCollapsed: () => void
    onTimeUpdate: (seconds: number) => void
    onPlayingChange: (playing: boolean) => void
    onControllerChange: (controller: unknown) => void
  }) => (
    <div aria-label="YouTube song player">
      <button onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand music player and show video' : 'Collapse music player and hide video'} />
      <button
        aria-label="Simulate active playback"
        onClick={() => {
          onControllerChange({ seekToTime: playbackSpies.seekToTime, play: playbackSpies.play })
          onTimeUpdate(16)
          onPlayingChange(true)
        }}
      />
    </div>
  ),
}))

describe('Verse catalogue learning experience', () => {
  beforeEach(() => {
    localStorage.clear()
    playbackSpies.seekToTime.mockClear()
    playbackSpies.play.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline test')))
  })

  const mockSignedIn = (state: LearningState = { vocabulary: [], songProgress: [] }) => {
    localStorage.setItem('verse.auth.session', 'test-session')
    const reviewStreaks = new Map<string, number>()
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/auth/session')) {
        return Promise.resolve(Response.json({
          user: { id: 'user-1', username: 'test_learner', displayName: 'Test Learner' },
        }))
      }
      if (url.endsWith('/api/me/state')) {
        return Promise.resolve(Response.json(state))
      }
      if (url.endsWith('/api/me/vocabulary') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { songId: string; cueId: string; tokenId: string }
        const cue = lanPianSong.cues.find((item) => item.id === body.cueId)!
        const token = cue.tokens!.find((item) => item.id === body.tokenId)!
        return Promise.resolve(Response.json({
          item: {
            ...body,
            sourceText: token.text,
            romanization: token.romanization?.text,
            gloss: token.glosses?.en,
            status: 'learning',
            familiarityStreak: 0,
            reviewState: 'learning',
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
        }))
      }
      if (url.endsWith('/api/me/vocabulary/review') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as {
          songId: string
          cueId: string
          tokenId: string
          familiar: boolean
        }
        const key = `${body.songId}:${body.cueId}:${body.tokenId}`
        const streak = body.familiar ? Math.min(2, (reviewStreaks.get(key) ?? 0) + 1) : 0
        reviewStreaks.set(key, streak)
        const cue = lanPianSong.cues.find((item) => item.id === body.cueId)!
        const token = cue.tokens!.find((item) => item.id === body.tokenId)!
        return Promise.resolve(Response.json({
          item: {
            songId: body.songId,
            cueId: body.cueId,
            tokenId: body.tokenId,
            sourceText: token.text,
            romanization: token.romanization?.text,
            gloss: token.glosses?.en,
            status: streak >= 2 ? 'learned' : 'learning',
            familiarityStreak: streak,
            reviewState: body.familiar ? 'learning' : 'review',
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
        }))
      }
      if (url.includes('/api/me/vocabulary/') && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      if (url.includes('/api/me/songs/') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as { status: 'learning' | 'learned'; lastPositionMs: number }
        return Promise.resolve(Response.json({
          progress: {
            songId: lanPianSong.id,
            status: body.status,
            lastPositionMs: body.lastPositionMs,
            learnedAt: body.status === 'learned' ? '2026-08-04T00:00:00.000Z' : null,
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
        }))
      }
      if (url.includes('/api/songs/') && init?.method === 'PUT') {
        return Promise.resolve(Response.json({ liked: true, likeCount: 1 }))
      }
      if (url.endsWith('/api/song-tools/youtube-metadata') && init?.method === 'POST') {
        return Promise.resolve(Response.json({
          videoId: 'n49Zi0fIGlA',
          title: '测试歌',
          artist: 'Tester',
          thumbnailUrl: 'https://i.ytimg.com/vi/n49Zi0fIGlA/hqdefault.jpg',
        }))
      }
      if (url.endsWith('/api/song-tools/enrich-lyrics') && init?.method === 'POST') {
        return Promise.resolve(Response.json({
          sourceLocale: 'zh-Hans',
          lines: [{
            sourceText: '打开电视',
            tokens: [
              { text: '打开', romanization: 'dǎkāi', gloss: 'turn on' },
              { text: '电视', romanization: 'diànshì', gloss: 'television' },
            ],
            translation: 'Turn on the television.',
          }],
        }))
      }
      if (url.includes('/api/songs')) {
        return Promise.resolve(Response.json({ songs: [lanPianSong] }))
      }
      return Promise.reject(new TypeError('unexpected test request'))
    }))
  }

  it('opens on the synchronized YouTube lesson and removes the old demo song', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: '烂片剧情' })).toBeInTheDocument()
    expect(screen.queryByText('窗边的早晨')).not.toBeInTheDocument()
    expect(await screen.findByText(/46 phrases/i)).toBeInTheDocument()
  })

  it('toggles pinyin and English independently', () => {
    render(<App />)
    expect(screen.getByText('dǎkāi')).toBeInTheDocument()
    expect(screen.getByText("I turn on the TV but can't find the remote.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Pinyin' }))
    expect(screen.queryByText('dǎkāi')).not.toBeInTheDocument()
    expect(screen.getByText("I turn on the TV but can't find the remote.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'English' }))
    expect(screen.queryByText("I turn on the TV but can't find the remote.")).not.toBeInTheDocument()
  })

  it('links a cohesive Chinese word to its pinyin and English meaning', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '打开, dǎkāi' }))

    expect(container.querySelector('.romanization-line .is-selected')).toHaveTextContent('dǎkāi')
    expect(container.querySelector('.selected-gloss')).toHaveTextContent('turn on')
    expect(screen.getByLabelText('Vocabulary details for 打开')).toBeInTheDocument()
  })

  it('searches the shared song catalogue', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /browse songs/i }))
    const catalog = screen.getByRole('dialog', { name: 'Song library' })
    expect(within(catalog).getByPlaceholderText('Search songs or artists')).toBeInTheDocument()
    expect(await within(catalog).findByRole('button', { name: /烂片剧情/i })).toBeInTheDocument()
  })

  it('lets a signed-in learner start a YouTube-only listening sync', async () => {
    mockSignedIn()
    render(<App />)
    expect(await screen.findByRole('button', { name: /test learner/i })).toBeInTheDocument()
    expect(screen.queryByText('Streaming lesson')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /add song/i })[0]!)

    const dialog = screen.getByRole('dialog', { name: 'Add a YouTube song' })
    fireEvent.change(within(dialog).getByLabelText('YouTube link'), { target: { value: 'https://youtu.be/n49Zi0fIGlA' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /next: song details/i }))
    expect(await within(dialog).findByDisplayValue('测试歌')).toBeInTheDocument()
    expect(within(dialog).getByDisplayValue('Tester')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /next: paste lyrics/i }))
    fireEvent.change(within(dialog).getByLabelText('Chinese lyrics · one line per row'), { target: { value: '打开电视' } })
    expect(within(dialog).queryByLabelText(/pinyin/i)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /generate learning draft/i }))

    expect(await within(dialog).findByDisplayValue('打开 电视')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Line 1 word 1 pinyin')).toHaveValue('dǎkāi')
    expect(within(dialog).getByLabelText('Line 1 word 1 meaning')).toHaveValue('turn on')
    expect(within(dialog).getByLabelText('Line 1 natural English translation')).toHaveValue('Turn on the television.')
    fireEvent.change(within(dialog).getByLabelText('Line 1 word 1 meaning'), { target: { value: 'switch on' } })
    expect(within(dialog).getByLabelText('Line 1 word 1 meaning')).toHaveValue('switch on')
    fireEvent.click(within(dialog).getByRole('button', { name: /save & start listening sync/i }))

    const studio = screen.getByRole('dialog', { name: '测试歌' })
    expect(within(studio).getByRole('button', { name: /use youtube/i })).toBeInTheDocument()
    expect(within(studio).queryByText(/spotify|apple music/i)).not.toBeInTheDocument()
    fireEvent.click(within(studio).getByRole('button', { name: /back to lyric review/i }))
    const reviewDialog = screen.getByRole('dialog', { name: 'Add a YouTube song' })
    expect(within(reviewDialog).getByLabelText('Line 1 word 1 meaning')).toHaveValue('switch on')
    fireEvent.click(within(reviewDialog).getByRole('button', { name: /save & start listening sync/i }))
    expect(screen.getByRole('dialog', { name: '测试歌' })).toBeInTheDocument()
  })

  it('likes a song and exposes it in Liked songs', async () => {
    mockSignedIn()
    render(<App />)
    expect(await screen.findByRole('button', { name: /test learner/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Like song' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unlike song' })).toBeInTheDocument())
    expect(screen.getByText('Liked songs').parentElement).toHaveTextContent('1')
  })

  it('asks anonymous learners to sign in before publishing', () => {
    render(<App />)
    fireEvent.click(screen.getAllByRole('button', { name: /add song/i })[0]!)
    const account = screen.getByRole('dialog', { name: 'Sign in to keep learning' })
    expect(within(account).getByLabelText('Username')).toBeInTheDocument()
    expect(within(account).getByLabelText('Password')).toBeInTheDocument()
    fireEvent.click(within(account).getByRole('button', { name: /create an account/i }))
    expect(screen.getByRole('dialog', { name: 'Create your account' })).toBeInTheDocument()
  })

  it('marks a song as currently learning and highlights it in the sidebar', async () => {
    mockSignedIn()
    render(<App />)
    expect(await screen.findByRole('button', { name: /test learner/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as learned' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Learn this song' }))
    expect(await screen.findByRole('button', { name: 'Currently learning' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as learned' })).toBeInTheDocument()
    expect(screen.getByText('Learning songs').parentElement).toHaveTextContent('1')
    expect(document.querySelector('.song-list-item.is-learning-song')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark as learned' }))
    expect(await screen.findByText('Learned', { selector: '.learned-status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as learned' })).not.toBeInTheDocument()
  })

  it('marks every repeated occurrence of a learning word and shows one flashcard', async () => {
    mockSignedIn()
    render(<App />)
    expect(await screen.findByRole('button', { name: /test learner/i })).toBeInTheDocument()
    const repeated = screen.getAllByRole('button', { name: '其实, qíshí' })
    expect(repeated.length).toBeGreaterThan(1)
    fireEvent.click(repeated[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Learn this word' }))
    await waitFor(() => repeated.forEach((button) => expect(button).toHaveClass('is-learning')))

    fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
    expect(screen.getByRole('heading', { name: 'Flashcards' })).toBeInTheDocument()
    expect(screen.getByText('1 word')).toBeInTheDocument()
    expect(screen.getByText('其实')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous flashcard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next flashcard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Familiar' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('qíshí')).toBeInTheDocument()
    expect(screen.getByText('actually')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Familiar' }))
    await waitFor(() => expect(screen.getByLabelText('Flashcard learning progress').querySelector('.mastery-legend .learning')).toHaveTextContent('1 learning'))

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Familiar' }))
    await waitFor(() => expect(screen.getByLabelText('Flashcard learning progress').querySelector('.mastery-legend .learned')).toHaveTextContent('1 learned'))

    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Not familiar' }))
    await waitFor(() => expect(screen.getByLabelText('Flashcard learning progress').querySelector('.mastery-legend .review')).toHaveTextContent('1 review more'))
  })

  it('keeps playback moving when a word in the active line is selected', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Simulate active playback' }))
    fireEvent.click(screen.getByRole('button', { name: '电视, diànshì' }))
    expect(playbackSpies.seekToTime).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '夜里, yèlǐ' }))
    expect(playbackSpies.seekToTime).toHaveBeenCalledOnce()
  })

  it('collapses the player into its compact mode', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse music player and hide video' }))
    expect(container.querySelector('.app-shell')).toHaveClass('player-collapsed')
    expect(screen.getByRole('button', { name: 'Expand music player and show video' })).toBeInTheDocument()
  })
})
