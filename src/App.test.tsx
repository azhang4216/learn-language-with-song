import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { lanPianSong } from './data/lanPianSong'
import type { LearningState } from './types/auth'

vi.mock('./components/YouTubePlayerDock', () => ({
  YouTubePlayerDock: ({
    collapsed,
    onToggleCollapsed,
  }: {
    collapsed: boolean
    onToggleCollapsed: () => void
  }) => (
    <div aria-label="YouTube song player">
      <button onClick={onToggleCollapsed} aria-label={collapsed ? 'Expand music player and show video' : 'Collapse music player and hide video'} />
    </div>
  ),
}))

describe('Verse catalogue learning experience', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline test')))
  })

  const mockSignedIn = (state: LearningState = { vocabulary: [], songProgress: [] }) => {
    localStorage.setItem('verse.auth.session', 'test-session')
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
    fireEvent.change(within(dialog).getByLabelText('Song title'), { target: { value: '测试歌' } })
    fireEvent.change(within(dialog).getByLabelText('Artist'), { target: { value: 'Tester' } })
    fireEvent.change(within(dialog).getByLabelText('YouTube link'), { target: { value: 'https://youtu.be/n49Zi0fIGlA' } })
    fireEvent.change(within(dialog).getByLabelText('Chinese · grouped words'), { target: { value: '打开 电视' } })
    fireEvent.change(within(dialog).getByLabelText('Pinyin · matching groups'), { target: { value: 'dǎkāi | diànshì' } })
    fireEvent.change(within(dialog).getByLabelText('Word meanings · matching groups'), { target: { value: 'turn on | television' } })
    fireEvent.change(within(dialog).getByLabelText('Natural English translation'), { target: { value: 'Turn on the television.' } })
    expect(within(dialog).getByText(/same validation before publishing/i)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /start listening sync/i }))

    const studio = screen.getByRole('dialog', { name: '测试歌' })
    expect(within(studio).getByRole('button', { name: /use youtube/i })).toBeInTheDocument()
    expect(within(studio).queryByText(/spotify|apple music/i)).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Learn this song' }))
    expect(await screen.findByRole('button', { name: 'Currently learning' })).toBeInTheDocument()
    expect(screen.getByText('Learning songs').parentElement).toHaveTextContent('1')
    expect(document.querySelector('.song-list-item.is-learning-song')).toBeInTheDocument()
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
    expect(screen.getByText('1 learning word')).toBeInTheDocument()
    expect(screen.getByText('其实')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reveal answer/i }))
    expect(screen.getByText('qíshí')).toBeInTheDocument()
    expect(screen.getByText('actually')).toBeInTheDocument()
  })

  it('collapses the player into its compact mode', () => {
    const { container } = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse music player and hide video' }))
    expect(container.querySelector('.app-shell')).toHaveClass('player-collapsed')
    expect(screen.getByRole('button', { name: 'Expand music player and show video' })).toBeInTheDocument()
  })
})
