interface SongArtworkProps {
  title: string
  artworkUrl?: string
  size?: 'small' | 'medium' | 'large'
}

export function SongArtwork({ title, artworkUrl, size = 'medium' }: SongArtworkProps) {
  return (
    <div className={`song-artwork artwork-${size}`} aria-hidden="true">
      {artworkUrl ? (
        <img src={artworkUrl} alt="" />
      ) : (
        <>
          <span className="art-sun" />
          <span className="art-window" />
          <span className="art-character">{Array.from(title)[0] ?? '乐'}</span>
          <span className="art-rings" />
        </>
      )}
    </div>
  )
}
