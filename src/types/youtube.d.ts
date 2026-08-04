interface YouTubePlayerEvent {
  target: YouTubePlayer
}

interface YouTubePlayerErrorEvent extends YouTubePlayerEvent {
  data: number
}

interface YouTubePlayerPlaybackRateEvent extends YouTubePlayerEvent {
  data: number
}

interface YouTubePlayer {
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  getAvailablePlaybackRates(): number[]
  pauseVideo(): void
  playVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
}

interface YouTubePlayerConstructor {
  new (
    element: HTMLElement,
    options: {
      width: string
      height: string
      videoId: string
      playerVars: Record<string, string | number>
      events: {
        onReady: (event: YouTubePlayerEvent) => void
        onError: (event: YouTubePlayerErrorEvent) => void
        onPlaybackRateChange?: (event: YouTubePlayerPlaybackRateEvent) => void
      }
    },
  ): YouTubePlayer
}

interface YouTubeNamespace {
  Player: YouTubePlayerConstructor
  PlayerState: {
    PLAYING: number
  }
}

interface Window {
  YT?: YouTubeNamespace
  onYouTubeIframeAPIReady?: () => void
}
