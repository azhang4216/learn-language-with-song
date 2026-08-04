import type { CatalogSong } from '../types/catalog'
import { CheckIcon, CloseIcon, HeartIcon, LibraryIcon, MusicIcon, PlusIcon } from './Icons'
import { SongArtwork } from './SongArtwork'

interface SongLibraryProps {
  activeSongId: string
  yourSongs: CatalogSong[]
  likedSongs: CatalogSong[]
  learnedSongs: CatalogSong[]
  mobileOpen: boolean
  onSelect: (songId: string) => void
  onOpenCatalog: () => void
  onAddSong: () => void
  onClose: () => void
}

interface SongSectionProps {
  label: string
  emptyMessage: string
  songs: CatalogSong[]
  activeSongId: string
  onSelect: (songId: string) => void
  onClose: () => void
}

function SongSection({
  label,
  emptyMessage,
  songs,
  activeSongId,
  onSelect,
  onClose,
}: SongSectionProps) {
  return (
    <>
      <div className="sidebar-section-header">
        <span>{label}</span>
        <span className="count-badge">{songs.length}</span>
      </div>
      <div className="song-list">
        {songs.length === 0 && <p className="sidebar-empty">{emptyMessage}</p>}
        {songs.map((song) => {
          const isActive = song.id === activeSongId
          return (
            <button
              className={`song-list-item ${isActive ? 'active' : ''}`}
              key={song.id}
              onClick={() => {
                onSelect(song.id)
                onClose()
              }}
              aria-current={isActive ? 'true' : undefined}
            >
              <SongArtwork title={song.title} artworkUrl={song.youtube.thumbnailUrl} size="small" />
              <span className="song-list-copy">
                <strong>{song.title}</strong>
                <small>{song.artist ?? 'Unknown artist'}</small>
              </span>
              {isActive && <span className="selected-check"><CheckIcon /></span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

export function SongLibrary({
  activeSongId,
  yourSongs,
  likedSongs,
  learnedSongs,
  mobileOpen,
  onSelect,
  onOpenCatalog,
  onAddSong,
  onClose,
}: SongLibraryProps) {
  return (
    <aside className={`library-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Song library">
      <div className="brand-row">
        <div className="brand-mark"><MusicIcon /></div>
        <span className="brand-name">Verse</span>
        <button className="icon-button close-library" onClick={onClose} aria-label="Close song library">
          <CloseIcon />
        </button>
      </div>

      <nav className="library-nav" aria-label="Library navigation">
        <button className="nav-item active" onClick={onOpenCatalog}>
          <LibraryIcon /><span>Song library</span>
        </button>
      </nav>

      <SongSection
        label="Your songs"
        emptyMessage="Songs you sync will appear here."
        songs={yourSongs}
        activeSongId={activeSongId}
        onSelect={onSelect}
        onClose={onClose}
      />
      <SongSection
        label="Liked songs"
        emptyMessage="Tap the heart on a song to save it."
        songs={likedSongs}
        activeSongId={activeSongId}
        onSelect={onSelect}
        onClose={onClose}
      />
      <SongSection
        label="Learned songs"
        emptyMessage="Finished songs will appear here."
        songs={learnedSongs}
        activeSongId={activeSongId}
        onSelect={onSelect}
        onClose={onClose}
      />

      <div className="sidebar-spacer" />

      <button className="import-card" onClick={onAddSong}>
        <span className="import-card-icon"><PlusIcon /></span>
        <span>
          <strong>Add a song</strong>
          <small>YouTube + listening sync</small>
        </span>
      </button>
      <p className="local-note"><HeartIcon /> Signed-in learners can publish immediately</p>
    </aside>
  )
}
