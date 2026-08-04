export interface TimingTrack {
  title: string
  artist: string
  durationMs: number
  youtubeVideoId: string
  youtubeUrl: string
}

export interface TimingProject {
  schemaVersion: 1
  id: string
  sourceLocale: string
  script: 'simplified'
  track: TimingTrack
  lines: string[]
  romanizations: string[]
  defaultBoundariesMs?: number[]
  preparedTimingUpdatedAt?: string
}

export interface SavedTimingDraft {
  timingSchemaVersion: 1
  projectId: string
  updatedAt: string
  boundariesMs: number[]
}

export interface ExportedTimingProject extends SavedTimingDraft {
  track: TimingTrack
  sourceLocale: string
  script: 'simplified'
  cues: Array<{
    id: string
    sourceText: string
    romanization: {
      system: 'pinyin'
      text: string
    }
    startMs?: number
    endMs?: number
  }>
}
