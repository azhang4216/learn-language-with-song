import type { LyricCue, LyricToken } from '../types/song'

export const findActiveCueIndex = (cues: LyricCue[], timeMs: number): number =>
  cues.findIndex((cue) => timeMs >= cue.startMs && timeMs < cue.endMs)

export const findActiveTokenId = (
  cue: LyricCue | undefined,
  timeMs: number,
): string | null => {
  if (!cue?.tokens) return null

  return (
    cue.tokens.find(
      (token) =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        timeMs >= token.startMs &&
        timeMs < token.endMs,
    )?.id ?? null
  )
}

export const getTokenSeekTime = (cue: LyricCue, token: LyricToken): number =>
  token.startMs ?? cue.startMs
