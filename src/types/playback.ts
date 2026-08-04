export type PlaybackProvider = 'youtube'

export interface TimingPlaybackController {
  readonly provider: PlaybackProvider
  readonly currentTime: number
  readonly duration: number
  readonly isPlaying: boolean
  readonly playbackRate: number
  readonly availablePlaybackRates: number[]
  play(): Promise<void>
  pause(): Promise<void>
  seekToTime(seconds: number): Promise<void>
  setPlaybackRate(rate: number): Promise<void>
  destroy(): void
}
