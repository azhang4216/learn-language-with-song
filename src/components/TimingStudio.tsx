import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from 'react'
import { lanPianTimingProject } from '../data/lanPianTimingProject'
import { formatTime } from '../lib/format'
import {
  adjustBoundary,
  appendBoundary,
  createTimingExport,
  readTimingDraft,
  saveTimingDraft,
} from '../lib/timingAuthoring'
import { connectYouTubeTrack } from '../lib/youtube'
import type { TimingPlaybackController } from '../types/playback'
import type { TimingProject } from '../types/timing'
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  TimerIcon,
  UndoIcon,
  YouTubeIcon,
} from './Icons'
import { SongArtwork } from './SongArtwork'

type ConnectionState = 'idle' | 'loading' | 'ready' | 'error'

const learningRates = (rates: number[]): number[] => {
  const supported = rates
    .filter((rate) => Number.isFinite(rate) && rate >= 0.1 && rate <= 1)
    .sort((a, b) => a - b)
  return [...new Set(supported.length ? supported : [1])]
}

interface TimingStudioProps {
  onClose: () => void
  project?: TimingProject
  onComplete?: (boundariesMs: number[]) => void
  backLabel?: string
}

export function TimingStudio({
  onClose,
  project = lanPianTimingProject,
  onComplete,
  backLabel = 'Back to Verse',
}: TimingStudioProps) {
  const [boundariesMs, setBoundariesMs] = useState<number[]>(() => readTimingDraft(project))
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [connectionMessage, setConnectionMessage] = useState(() => (
    project.defaultBoundariesMs?.length === project.lines.length + 1
      ? 'Your exported timing is loaded. Connect the original YouTube recording.'
      : 'Connect the YouTube recording, then stamp each lyric entrance.'
  ))
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackDuration, setPlaybackDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [availablePlaybackRates, setAvailablePlaybackRates] = useState<number[]>([1])
  const [selectedBoundary, setSelectedBoundary] = useState<number | null>(null)
  const playbackRef = useRef<TimingPlaybackController | null>(null)
  const studioRef = useRef<HTMLDivElement>(null)
  const youtubeHostRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef(new Map<number, HTMLButtonElement>())
  const autoConnectedRef = useRef(false)

  const completedLines = Math.max(0, Math.min(project.lines.length, boundariesMs.length - 1))
  const isComplete = boundariesMs.length === project.lines.length + 1
  const nextBoundaryIndex = boundariesMs.length
  const playbackTimeMs = currentTime * 1000
  const playbackLineIndex = isComplete
    ? project.lines.findIndex((_, index) => (
        playbackTimeMs >= boundariesMs[index]! && playbackTimeMs < boundariesMs[index + 1]!
      ))
    : -1
  const currentlySingingIndex = isComplete ? playbackLineIndex : boundariesMs.length - 1
  const nextLine = project.lines[nextBoundaryIndex]
  const progress = (completedLines / project.lines.length) * 100
  const duration = playbackDuration || project.track.durationMs / 1000
  const playbackKind = 'YouTube · full song'

  const connect = useCallback(async () => {
    playbackRef.current?.destroy()
    playbackRef.current = null
    setConnection('loading')
    setCurrentTime(0)
    setPlaybackDuration(0)
    setIsPlaying(false)
    setPlaybackRate(1)
    setAvailablePlaybackRates([1])
    setConnectionMessage('Opening YouTube…')

    try {
      const host = youtubeHostRef.current
      if (!host) throw new Error('The YouTube player mount is unavailable.')
      host.replaceChildren()
      const mount = document.createElement('div')
      host.appendChild(mount)
      const playback: TimingPlaybackController = await connectYouTubeTrack(mount, project.track.youtubeVideoId)

      playbackRef.current = playback
      if (Number.isFinite(playback.duration) && playback.duration > 0) {
        setPlaybackDuration(playback.duration)
      }
      setCurrentTime(Number.isFinite(playback.currentTime) ? playback.currentTime : 0)
      setIsPlaying(playback.isPlaying)
      setPlaybackRate(playback.playbackRate)
      setAvailablePlaybackRates(learningRates(playback.availablePlaybackRates))
      setConnection('ready')
      setConnectionMessage(isComplete
        ? 'YouTube is ready. Press play to follow your synchronized lyrics.'
        : 'YouTube is ready. Use the green play button, then stamp each lyric entrance.')
    } catch (error) {
      setConnection('error')
      setConnectionMessage(error instanceof Error ? error.message : 'YouTube could not connect.')
    }
  }, [isComplete, project.track.youtubeVideoId])

  useEffect(() => {
    studioRef.current?.focus()
  }, [])

  useEffect(() => {
    if (autoConnectedRef.current) return
    autoConnectedRef.current = true
    void connect()
  }, [connect])

  useEffect(() => {
    saveTimingDraft(project, boundariesMs)
  }, [boundariesMs, project])

  useEffect(() => {
    const targetIndex = isComplete
      ? currentlySingingIndex
      : Math.min(nextBoundaryIndex, project.lines.length - 1)
    if (targetIndex < 0) return
    lineRefs.current.get(targetIndex)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    })
  }, [currentlySingingIndex, isComplete, nextBoundaryIndex, project.lines.length])

  useEffect(() => {
    if (connection !== 'ready') return
    const interval = window.setInterval(() => {
      const playback = playbackRef.current
      if (!playback) return
      const nextTime = playback.currentTime
      const nextDuration = playback.duration
      if (Number.isFinite(nextTime)) setCurrentTime(nextTime)
      if (Number.isFinite(nextDuration) && nextDuration > 0) setPlaybackDuration(nextDuration)
      setIsPlaying(playback.isPlaying)
      const nextRate = playback.playbackRate
      if (Number.isFinite(nextRate) && nextRate > 0) {
        setPlaybackRate((current) => current === nextRate ? current : nextRate)
      }
      setAvailablePlaybackRates((current) => {
        const nextRates = learningRates(playback.availablePlaybackRates)
        return current.join(',') === nextRates.join(',') ? current : nextRates
      })
    }, 100)

    return () => window.clearInterval(interval)
  }, [connection])

  useEffect(() => () => {
    playbackRef.current?.destroy()
  }, [])

  const togglePlayback = useCallback(async () => {
    const playback = playbackRef.current
    if (!playback) return
    try {
      if (playback.isPlaying) await playback.pause()
      else await playback.play()
      setIsPlaying(playback.isPlaying)
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Playback was blocked. Press play once more to continue.')
    } finally {
      studioRef.current?.focus({ preventScroll: true })
    }
  }, [])

  const stamp = useCallback(() => {
    const playback = playbackRef.current
    if (!playback || connection !== 'ready' || isComplete) return
    const timeMs = playback.currentTime * 1000
    if (!Number.isFinite(timeMs)) return

    const next = appendBoundary(boundariesMs, timeMs, project.lines.length)
    if (next === boundariesMs) {
      setConnectionMessage('Move playback forward before stamping the next boundary.')
      return
    }
    setBoundariesMs(next)
    if (next.length === project.lines.length + 1) {
      setConnectionMessage('Timing pass complete. Review the lines, then export your JSON.')
    }
  }, [boundariesMs, connection, isComplete, project.lines.length])

  const undo = useCallback(() => {
    setBoundariesMs((current) => current.slice(0, -1))
    setSelectedBoundary(null)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, button, a, summary')) return
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.code === 'Space') {
        event.preventDefault()
        stamp()
      } else if (!isComplete && (event.code === 'Backspace' || event.code === 'KeyU')) {
        event.preventDefault()
        undo()
      } else if (event.code === 'KeyP' && connection === 'ready') {
        event.preventDefault()
        void togglePlayback()
      } else if (event.code === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connection, isComplete, onClose, stamp, togglePlayback, undo])

  const seek = async (seconds: number) => {
    const playback = playbackRef.current
    if (!playback) return
    await playback.seekToTime(seconds)
    setCurrentTime(seconds)
  }

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    void seek(Number(event.target.value))
  }

  const changePlaybackRate = async (rate: number) => {
    const playback = playbackRef.current
    if (!playback) return
    try {
      await playback.setPlaybackRate(rate)
      const actualRate = playback.playbackRate
      setPlaybackRate(Number.isFinite(actualRate) && actualRate > 0 ? actualRate : rate)
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'This source could not change playback speed.')
    }
  }

  const replayLine = async (seconds: number) => {
    const playback = playbackRef.current
    if (!playback) return
    try {
      await playback.seekToTime(seconds)
      setCurrentTime(seconds)
      if (!playback.isPlaying) await playback.play()
      setIsPlaying(playback.isPlaying)
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'This line could not be replayed.')
    }
  }

  const nudgeSelected = (deltaMs: number) => {
    if (selectedBoundary === null) return
    setBoundariesMs((current) => {
      const next = adjustBoundary(current, selectedBoundary, deltaMs)
      const adjusted = next[selectedBoundary]
      if (adjusted !== undefined) void seek(adjusted / 1000)
      return next
    })
  }

  const reset = () => {
    if (!window.confirm('Clear every timestamp in this timing pass?')) return
    setBoundariesMs([])
    setSelectedBoundary(null)
    setConnectionMessage('Timing cleared. Start playback and stamp the first lyric entrance.')
  }

  const exportDraft = () => {
    const payload = createTimingExport(project, boundariesMs)
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.id}.verse-timing.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="timing-studio"
      ref={studioRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="timing-project-title"
    >
      <header className="timing-header">
        <button className="timing-back" onClick={onClose}><ArrowLeftIcon /> {backLabel}</button>
        <div className="timing-brand"><TimerIcon /><span>{isComplete ? 'Synchronized lesson' : 'Timing studio'}</span></div>
        <div className="timing-save-state"><span className="privacy-dot" /> {isComplete ? `${project.lines.length} lines synced` : 'Saved locally'}</div>
      </header>

      <main className="timing-main">
        <aside className="timing-control-panel">
          <div className="timing-track-card">
            <SongArtwork title={project.track.title} artworkUrl={project.track.thumbnailUrl} size="medium" />
            <div>
              <span className="timing-kicker">{isComplete ? 'Prepared streaming lesson' : 'Streaming timing project'}</span>
              <h1 id="timing-project-title">{project.track.title}</h1>
              <p>{project.track.artist}</p>
            </div>
          </div>

          <div className={`stream-connection ${connection}`} role="status">
            <span className="connection-light" />
            <div>
              <strong>{connection === 'ready' ? playbackKind : connection === 'loading' ? 'Connecting' : connection === 'error' ? 'Connection issue' : 'Not connected'}</strong>
              <p>{connectionMessage}</p>
            </div>
          </div>

          {connection === 'error' && (
            <div className="provider-options" role="group" aria-label="Playback source">
              <button className="provider-button youtube" onClick={() => void connect()}>
                <YouTubeIcon />
                <span><strong>Retry YouTube</strong><small>Official full song · no login needed</small></span>
              </button>
            </div>
          )}

          <div
            className="youtube-player-shell is-visible"
            ref={youtubeHostRef}
          />

          {connection === 'ready' && (
            <div className="timing-player">
              <div className="timing-transport-row">
                <button className="timing-play-button" onClick={() => void togglePlayback()} aria-label={`${isPlaying ? 'Pause' : 'Play'} YouTube`}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <label className="timing-speed-control">
                  <span>Speed</span>
                  <select
                    value={playbackRate}
                    onChange={(event) => void changePlaybackRate(Number(event.target.value))}
                    disabled={availablePlaybackRates.length <= 1}
                    aria-label="YouTube playback speed"
                    title={availablePlaybackRates.length <= 1 ? 'This YouTube video only supports 1× playback' : undefined}
                  >
                    {availablePlaybackRates.map((rate) => (
                      <option value={rate} key={rate}>{rate}×</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="timing-seek-row">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.01"
                  value={Math.min(currentTime, duration)}
                  onChange={handleSeek}
                  style={{ '--range-progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as CSSProperties}
                  aria-label="YouTube playback position"
                />
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {isComplete && (
            <section className="timing-instructions">
              <span className="timing-kicker">Listening mode</span>
              <ol>
                <li>Press the green play button.</li>
                <li>Follow the highlighted pinyin and Chinese lyric.</li>
                <li>Select any line to replay it from its entrance.</li>
              </ol>
              <div className="shortcut-row"><span><kbd>P</kbd> Play/pause</span></div>
            </section>
          )}

          <div className="timing-actions">
            {!isComplete && <button onClick={undo} disabled={boundariesMs.length === 0}><UndoIcon /> Undo last</button>}
            <button onClick={exportDraft}><DownloadIcon /> Export JSON</button>
            {isComplete && onComplete && (
              <button className="publish-timing" onClick={() => onComplete(boundariesMs)}>
                <CheckIcon /> Publish lesson
              </button>
            )}
            {!isComplete && <button className="reset-timing" onClick={reset} disabled={boundariesMs.length === 0}>Clear timing</button>}
          </div>
        </aside>

        <section className="timing-workspace" aria-label="Lyric timing workspace">
          {!isComplete && (
            <section className="one-pass-guide" aria-labelledby="one-pass-title">
              <div className="one-pass-badge"><TimerIcon /><span>One pass</span></div>
              <div className="one-pass-copy">
                <span className="timing-kicker">The whole workflow</span>
                <h2 id="one-pass-title">Play once. Press Space as each lyric begins.</h2>
                <div className="one-pass-steps">
                  <span><b>1</b> Wait for YouTube to connect, then press Play.</span>
                  <span><b>2</b> At the start of every displayed line, press <kbd>Space</kbd>.</span>
                  <span><b>3</b> Press Space once more when the final lyric ends.</span>
                </div>
              </div>
            </section>
          )}
          <div className="timing-progress-header">
            <div>
              <span className="timing-kicker">{isComplete ? 'Synchronized lyrics' : 'Line timing'}</span>
              <h2>{isComplete ? 'Follow along with the vocal' : nextLine ? 'Stamp the next entrance' : 'Stamp the end of the final lyric'}</h2>
            </div>
            <div className="timing-count"><strong>{completedLines}</strong><span>/ {project.lines.length} {isComplete ? 'synced' : 'complete'}</span></div>
          </div>
          <div className="timing-progress-track"><span style={{ width: `${progress}%` }} /></div>

          <div className="timing-lyric-list">
            {project.lines.map((line, index) => {
              const start = boundariesMs[index]
              const end = boundariesMs[index + 1]
              const isNext = index === nextBoundaryIndex
              const isCurrent = index === currentlySingingIndex
              const isTimed = start !== undefined && end !== undefined
              return (
                <button
                  type="button"
                  className={`timing-line ${isNext ? 'is-next' : ''} ${isCurrent ? 'is-current' : ''} ${isTimed ? 'is-timed' : ''} ${selectedBoundary === index ? 'is-selected' : ''}`}
                  key={`${index}-${line}`}
                  ref={(element) => {
                    if (element) lineRefs.current.set(index, element)
                    else lineRefs.current.delete(index)
                  }}
                  disabled={start === undefined}
                  onClick={() => {
                    if (start === undefined) return
                    setSelectedBoundary(index)
                    if (isComplete) void replayLine(start / 1000)
                    else void seek(start / 1000)
                  }}
                >
                  <span className="timing-line-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="timing-line-copy">
                    <span className="timing-line-pinyin" lang="zh-Latn-pinyin">{project.romanizations[index]}</span>
                    <span className="timing-line-chinese" lang={project.sourceLocale}>{line}</span>
                  </span>
                  <span className="timing-line-time">
                    {isTimed ? `${formatTime(start / 1000)} – ${formatTime(end / 1000)}` : start !== undefined ? `${formatTime(start / 1000)} →` : isNext ? 'Next' : '—'}
                  </span>
                  {isTimed && <span className="timed-check"><CheckIcon /></span>}
                </button>
              )
            })}
            <div className={`timing-end-marker ${nextBoundaryIndex === project.lines.length ? 'is-next' : ''}`}>
              <span>{project.lines.length + 1}</span>
              <strong>End of final lyric</strong>
              <small>{boundariesMs.at(-1) !== undefined && isComplete ? formatTime(boundariesMs.at(-1)! / 1000) : nextBoundaryIndex === project.lines.length ? 'Press Space here' : 'Final boundary'}</small>
            </div>
          </div>

          {!isComplete && selectedBoundary !== null && boundariesMs[selectedBoundary] !== undefined && (
            <div className="timing-nudge-bar">
              <div><span>Adjust line {selectedBoundary + 1}</span><strong>{formatTime(boundariesMs[selectedBoundary]! / 1000)}</strong></div>
              <button onClick={() => nudgeSelected(-100)}>−100 ms</button>
              <button onClick={() => nudgeSelected(-50)}>−50 ms</button>
              <button onClick={() => nudgeSelected(50)}>+50 ms</button>
              <button onClick={() => nudgeSelected(100)}>+100 ms</button>
            </div>
          )}

          {!isComplete && (
            <button
              className="stamp-button"
              onClick={stamp}
              disabled={connection !== 'ready'}
            >
              <kbd>Space</kbd>
              <span>{nextBoundaryIndex === project.lines.length ? 'Stamp end of final lyric' : `Stamp line ${nextBoundaryIndex + 1}`}</span>
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
