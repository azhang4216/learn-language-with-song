import { useEffect, useState } from 'react'
import { listCatalogSongs } from '../lib/catalogApi'
import type { CatalogSong } from '../types/catalog'
import { CloseIcon, HeartIcon, SearchIcon, YouTubeIcon } from './Icons'
import { SongArtwork } from './SongArtwork'

interface CatalogDialogProps {
  initialSongs: CatalogSong[]
  onClose: () => void
  onSelect: (song: CatalogSong) => void
}

export function CatalogDialog({ initialSongs, onClose, onSelect }: CatalogDialogProps) {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState(initialSongs)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      void listCatalogSongs({ query }).then((result) => {
        if (!cancelled) setSongs(result)
      }).finally(() => {
        if (!cancelled) setLoading(false)
      })
    }, query ? 220 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="catalog-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header catalog-header">
          <div>
            <span className="section-eyebrow">Shared catalogue</span>
            <h2 id="catalog-title">Song library</h2>
            <p>Lessons synchronized and prepared by the Verse community.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close song library"><CloseIcon /></button>
        </header>

        <label className="catalog-search">
          <SearchIcon />
          <span className="visually-hidden">Search songs or artists</span>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search songs or artists"
          />
          {loading && <span className="search-status">Searching…</span>}
        </label>

        <div className="catalog-grid" aria-live="polite">
          {songs.length === 0 && (
            <div className="catalog-empty">
              <SearchIcon />
              <strong>No songs found</strong>
              <span>Try another title or artist.</span>
            </div>
          )}
          {songs.map((song) => (
            <button className="catalog-card" key={song.id} onClick={() => onSelect(song)}>
              <SongArtwork title={song.title} artworkUrl={song.youtube.thumbnailUrl} size="large" />
              <span className="catalog-card-copy">
                <strong>{song.title}</strong>
                <small>{song.artist ?? 'Unknown artist'}</small>
                <span className="catalog-card-meta">
                  <span><YouTubeIcon /> YouTube</span>
                  <span><HeartIcon /> {song.likeCount}</span>
                  <span>{song.cues.length} lines</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
