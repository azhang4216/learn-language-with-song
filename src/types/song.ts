export interface Romanization {
  system: string
  text: string
}

export interface LyricToken {
  id: string
  text: string
  normalizedText?: string
  startMs?: number
  endMs?: number
  romanization?: Romanization
  glosses?: Record<string, string>
  partOfSpeech?: string
}

export interface LyricCue {
  id: string
  startMs: number
  endMs: number
  sourceText: string
  romanization?: Romanization
  translations: {
    natural: string
    literal?: string
  }
  tokens?: LyricToken[]
}

export interface Song {
  schemaVersion: 1
  id: string
  title: string
  artist?: string
  artworkUrl?: string
  sourceLocale: string
  translationLocale: string
  audio: {
    src?: string
    durationMs?: number
  }
  cues: LyricCue[]
}

export interface TokenSelection {
  cue: LyricCue
  token: LyricToken
}
