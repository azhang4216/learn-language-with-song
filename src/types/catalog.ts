import type { Song } from './song'

export interface YouTubeSource {
  url: string
  videoId: string
  thumbnailUrl: string
}

export interface CatalogSong extends Song {
  youtube: YouTubeSource
  ownerId: string
  likeCount: number
  isLiked: boolean
  createdAt: string
  updatedAt: string
}

export interface CatalogSongDraft extends Song {
  youtube: YouTubeSource
}

export interface CatalogFilters {
  query?: string
  ownerId?: string
  likedBy?: string
}

export interface LikeResult {
  liked: boolean
  likeCount: number
}

export interface YouTubeSongMetadata {
  videoId: string
  title: string
  artist: string
  metadataSource: 'llm' | 'heuristic'
  thumbnailUrl: string
}

export interface EnrichedLyricToken {
  text: string
  romanization: string
  gloss: string
  glossOptions: string[]
}

export interface EnrichedLyricLine {
  sourceText: string
  tokens: EnrichedLyricToken[]
  translation: string
}

export interface LyricsEnrichment {
  sourceLocale: 'zh-Hans' | 'zh-Hant'
  source: 'ai' | 'dictionary'
  warning?: string
  lines: EnrichedLyricLine[]
}
