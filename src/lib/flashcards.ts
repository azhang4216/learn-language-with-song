import type { VocabularyLearningItem } from '../types/auth'
import { savedVocabularyIdentity } from './vocabulary'

export type FlashcardOrder = 'chronological' | 'least-understood' | 'random'

const chronology = (left: VocabularyLearningItem, right: VocabularyLearningItem): number =>
  Date.parse(left.createdAt) - Date.parse(right.createdAt)

const understandingRank = (item: VocabularyLearningItem): number => {
  if (item.status === 'learned') return 3
  if (item.reviewState === 'review') return 0
  return item.familiarityStreak > 0 ? 2 : 1
}

const randomRank = (item: VocabularyLearningItem, seed: number): number => {
  const input = `${seed}:${item.songId}:${savedVocabularyIdentity(item)}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export const orderFlashcards = (
  cards: VocabularyLearningItem[],
  order: FlashcardOrder,
  randomSeed: number,
): VocabularyLearningItem[] => [...cards].sort((left, right) => {
  if (order === 'least-understood') {
    return understandingRank(left) - understandingRank(right) || chronology(left, right)
  }
  if (order === 'random') {
    return randomRank(left, randomSeed) - randomRank(right, randomSeed) || chronology(left, right)
  }
  return chronology(left, right)
})
