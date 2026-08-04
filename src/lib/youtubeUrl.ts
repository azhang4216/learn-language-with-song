const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

export const parseYouTubeVideoId = (value: string): string | null => {
  const trimmed = value.trim()
  if (VIDEO_ID_PATTERN.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let candidate: string | null = null

    if (host === 'youtu.be') candidate = url.pathname.split('/').filter(Boolean)[0] ?? null
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      candidate = url.searchParams.get('v')
        ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1]
        ?? null
    }

    return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null
  } catch {
    return null
  }
}

export const youtubeWatchUrl = (videoId: string): string =>
  `https://www.youtube.com/watch?v=${videoId}`

export const youtubeThumbnailUrl = (videoId: string): string =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
