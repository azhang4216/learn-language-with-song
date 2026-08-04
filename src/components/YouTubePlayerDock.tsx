import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { connectYouTubeTrack } from '../lib/youtube'
import { formatTime } from '../lib/format'
import type { TimingPlaybackController } from '../types/playback'
import type { CatalogSong } from '../types/catalog'
import { ChevronDownIcon, PauseIcon, PlayIcon, RewindIcon, YouTubeIcon } from './Icons'

interface YouTubePlayerDockProps {
  song: CatalogSong
  currentTime: number
  onTimeUpdate: (seconds: number) => void
  onPlayingChange: (playing: boolean) => void
  onControllerChange: (controller: TimingPlaybackController | null) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function YouTubePlayerDock({
  song,
  currentTime,
  onTimeUpdate,
  onPlayingChange,
  onControllerChange,
  collapsed,
  onToggleCollapsed,
}: YouTubePlayerDockProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<TimingPlaybackController | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('Loading the YouTube player…')
  const [duration, setDuration] = useState((song.audio.durationMs ?? 0) / 1000)
  const [isPlaying, setIsPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [rates, setRates] = useState<number[]>([1])

  useEffect(() => {
    let cancelled = false
    let interval: number | undefined
    const host = hostRef.current
    if (!host) return
    host.replaceChildren()
    const mount = document.createElement('div')
    host.appendChild(mount)

    void connectYouTubeTrack(mount, song.youtube.videoId)
      .then((controller) => {
        if (cancelled) {
          controller.destroy()
          return
        }
        controllerRef.current = controller
        onControllerChange(controller)
        setStatus('ready')
        setMessage('Official YouTube playback')
        if (controller.duration > 0) setDuration(controller.duration)
        setRates(controller.availablePlaybackRates.filter((value) => value <= 1))
        interval = window.setInterval(() => {
          const playback = controllerRef.current
          if (!playback) return
          onTimeUpdate(playback.currentTime)
          if (playback.duration > 0) setDuration(playback.duration)
          setIsPlaying(playback.isPlaying)
          onPlayingChange(playback.isPlaying)
          setRate(playback.playbackRate)
          setRates((current) => {
            const next = playback.availablePlaybackRates.filter((value) => value <= 1)
            return current.join(',') === next.join(',') ? current : next
          })
        }, 100)
      })
      .catch((error) => {
        if (cancelled) return
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'YouTube playback could not load.')
      })

    return () => {
      cancelled = true
      window.clearInterval(interval)
      controllerRef.current?.destroy()
      controllerRef.current = null
      onControllerChange(null)
    }
  }, [onControllerChange, onPlayingChange, onTimeUpdate, song.audio.durationMs, song.youtube.videoId])

  const togglePlayback = async () => {
    const controller = controllerRef.current
    if (!controller) return
    try {
      if (controller.isPlaying) await controller.pause()
      else await controller.play()
      setIsPlaying(controller.isPlaying)
      onPlayingChange(controller.isPlaying)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Playback was blocked. Press play again.')
    }
  }

  const seek = async (seconds: number) => {
    const controller = controllerRef.current
    if (!controller) return
    await controller.seekToTime(Math.max(0, seconds))
    onTimeUpdate(Math.max(0, seconds))
  }

  const changeRate = async (nextRate: number) => {
    const controller = controllerRef.current
    if (!controller) return
    await controller.setPlaybackRate(nextRate)
    setRate(controller.playbackRate)
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <footer className={`youtube-dock ${collapsed ? 'is-collapsed' : ''}`} aria-label="YouTube song player">
      <button
        className="youtube-dock-collapse"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? 'Expand music player and show video' : 'Collapse music player and hide video'}
        aria-expanded={!collapsed}
      >
        <ChevronDownIcon />
      </button>
      <div className="youtube-dock-video" ref={hostRef} aria-hidden={collapsed} inert={collapsed} />
      <div className="youtube-dock-song">
        <YouTubeIcon />
        <div>
          <strong>{song.title}</strong>
          <small className={status === 'error' ? 'is-error' : ''}>{message}</small>
        </div>
      </div>
      <div className="youtube-dock-controls">
        <div className="transport-controls">
          <button className="transport-secondary" onClick={() => void seek(currentTime - 5)} aria-label="Go back 5 seconds">
            <RewindIcon /><span>5</span>
          </button>
          <button
            className="play-button"
            onClick={() => void togglePlayback()}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={status !== 'ready'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon className="play-icon" />}
          </button>
          <label className="speed-control">
            <span className="visually-hidden">YouTube playback speed</span>
            <select
              value={rate}
              onChange={(event) => void changeRate(Number(event.target.value))}
              disabled={rates.length <= 1}
              aria-label="YouTube playback speed"
            >
              {rates.map((item) => <option value={item} key={item}>{item}×</option>)}
            </select>
          </label>
        </div>
        <div className="timeline-row">
          <span>{formatTime(currentTime)}</span>
          <input
            className="timeline"
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => void seek(Number(event.target.value))}
            style={{ '--range-progress': `${progress}%` } as CSSProperties}
            aria-label="Song progress"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </footer>
  )
}
