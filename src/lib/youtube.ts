import type { TimingPlaybackController } from '../types/playback'

let scriptPromise: Promise<void> | null = null

const loadYouTubeApi = (): Promise<void> => {
  if (window.YT?.Player) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-verse-youtube]')
    if (existing) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.dataset.verseYoutube = 'true'
    script.addEventListener('error', () => reject(new Error('The YouTube player could not be loaded.')), { once: true })
    document.head.appendChild(script)
  })

  return scriptPromise
}

const youtubeErrorMessage = (code: number): string => {
  if (code === 101 || code === 150) return 'This upload does not allow embedded playback.'
  if (code === 100) return 'The YouTube upload is no longer available.'
  return `YouTube could not play this track (error ${code}).`
}

export const connectYouTubeTrack = async (
  host: HTMLDivElement,
  videoId: string,
): Promise<TimingPlaybackController> => {
  await loadYouTubeApi()
  if (!window.YT) throw new Error('The YouTube player returned an incomplete setup.')

  const player = await new Promise<YouTubePlayer>((resolve, reject) => {
    const instance = new window.YT!.Player(host, {
      width: '100%',
      height: '200',
      videoId,
      playerVars: {
        controls: 1,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => resolve(instance),
        onError: (event) => reject(new Error(youtubeErrorMessage(event.data))),
      },
    })
  })

  return {
    provider: 'youtube',
    get currentTime() { return player.getCurrentTime() || 0 },
    get duration() { return player.getDuration() || 0 },
    get isPlaying() { return player.getPlayerState() === window.YT?.PlayerState.PLAYING },
    get playbackRate() { return player.getPlaybackRate() || 1 },
    get availablePlaybackRates() { return player.getAvailablePlaybackRates() || [1] },
    play: async () => { player.playVideo() },
    pause: async () => { player.pauseVideo() },
    seekToTime: async (seconds) => { player.seekTo(seconds, true) },
    setPlaybackRate: async (rate) => { player.setPlaybackRate(rate) },
    destroy: () => player.destroy(),
  }
}
