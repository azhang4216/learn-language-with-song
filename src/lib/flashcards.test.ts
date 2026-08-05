import { describe, expect, it } from 'vitest'
import type { VocabularyLearningItem } from '../types/auth'
import { orderFlashcards } from './flashcards'

const card = (
  sourceText: string,
  createdAt: string,
  state: Partial<VocabularyLearningItem> = {},
): VocabularyLearningItem => ({
  songId: 'song',
  cueId: `cue-${sourceText}`,
  tokenId: `token-${sourceText}`,
  sourceText,
  status: 'learning',
  familiarityStreak: 0,
  reviewState: 'learning',
  createdAt,
  updatedAt: createdAt,
  ...state,
})

describe('flashcard ordering', () => {
  const cards = [
    card('new', '2026-08-03T00:00:00.000Z'),
    card('learned', '2026-08-01T00:00:00.000Z', { status: 'learned', familiarityStreak: 2 }),
    card('review', '2026-08-04T00:00:00.000Z', { reviewState: 'review' }),
    card('almost', '2026-08-02T00:00:00.000Z', { familiarityStreak: 1 }),
  ]

  it('orders chronologically by when a word entered the deck', () => {
    expect(orderFlashcards(cards, 'chronological', 1).map((item) => item.sourceText))
      .toEqual(['learned', 'almost', 'new', 'review'])
  })

  it('puts review-more and new words ahead of better-understood cards', () => {
    expect(orderFlashcards(cards, 'least-understood', 1).map((item) => item.sourceText))
      .toEqual(['review', 'new', 'almost', 'learned'])
  })

  it('keeps a random deck stable for the same session seed', () => {
    expect(orderFlashcards(cards, 'random', 42).map((item) => item.sourceText))
      .toEqual(orderFlashcards(cards, 'random', 42).map((item) => item.sourceText))
  })
})
