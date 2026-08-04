export interface AuthUser {
  id: string
  username: string
  displayName: string
}

export interface VocabularyLearningItem {
  songId: string
  cueId: string
  tokenId: string
  sourceText: string
  romanization?: string | null
  gloss?: string | null
  status: 'learning' | 'learned'
  familiarityStreak: number
  reviewState: 'learning' | 'review'
  createdAt: string
  updatedAt: string
}

export interface SongLearningProgress {
  songId: string
  status: 'learning' | 'learned'
  lastPositionMs: number
  learnedAt?: string | null
  updatedAt: string
}

export interface LearningState {
  vocabulary: VocabularyLearningItem[]
  songProgress: SongLearningProgress[]
}
