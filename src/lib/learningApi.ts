import type {
  LearningState,
  SongLearningProgress,
  VocabularyLearningItem,
} from '../types/auth'
import { apiRequest } from './apiClient'

export const getLearningState = (): Promise<LearningState> =>
  apiRequest<LearningState>('/me/state')

export const saveVocabulary = async (
  songId: string,
  cueId: string,
  tokenId: string,
): Promise<VocabularyLearningItem> => {
  const result = await apiRequest<{ item: VocabularyLearningItem }>('/me/vocabulary', {
    method: 'PUT',
    body: JSON.stringify({ songId, cueId, tokenId }),
  })
  return result.item
}

export const removeVocabulary = async (
  songId: string,
  cueId: string,
  tokenId: string,
): Promise<void> => {
  await apiRequest<null>(
    `/me/vocabulary/${encodeURIComponent(songId)}/${encodeURIComponent(cueId)}/${encodeURIComponent(tokenId)}`,
    { method: 'DELETE' },
  )
}

export const saveSongProgress = async (
  songId: string,
  status: 'learning' | 'learned',
  lastPositionMs = 0,
): Promise<SongLearningProgress> => {
  const result = await apiRequest<{ progress: SongLearningProgress }>(
    `/me/songs/${encodeURIComponent(songId)}/progress`,
    {
      method: 'PUT',
      body: JSON.stringify({ status, lastPositionMs }),
    },
  )
  return result.progress
}
