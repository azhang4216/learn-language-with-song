import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { lanPianSong } from '../data/lanPianSong'
import type { VocabularyLearningItem } from '../types/auth'
import { FlashcardMode } from './FlashcardMode'

const vocabularyItem = (
  sourceText: string,
  cueId: string,
  tokenId: string,
  state: Partial<VocabularyLearningItem>,
): VocabularyLearningItem => ({
  songId: lanPianSong.id,
  cueId,
  tokenId,
  sourceText,
  romanization: '',
  gloss: '',
  status: 'learning',
  familiarityStreak: 0,
  reviewState: 'learning',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
  ...state,
})

describe('FlashcardMode deck controls', () => {
  it('switches ordering and can exclude learned cards without hiding overall progress', () => {
    const firstCue = lanPianSong.cues[0]!
    const firstToken = firstCue.tokens![0]!
    const reviewCue = lanPianSong.cues.find((cue) => cue.tokens?.some((token) => token.text === '其实'))!
    const reviewToken = reviewCue.tokens!.find((token) => token.text === '其实')!
    render(
      <FlashcardMode
        items={[
          vocabularyItem(firstToken.text, firstCue.id, firstToken.id, {
            romanization: firstToken.romanization?.text,
            gloss: firstToken.glosses?.en,
            status: 'learned',
            familiarityStreak: 2,
            createdAt: '2026-08-01T00:00:00.000Z',
          }),
          vocabularyItem(reviewToken.text, reviewCue.id, reviewToken.id, {
            romanization: reviewToken.romanization?.text,
            gloss: reviewToken.glosses?.en,
            reviewState: 'review',
          }),
        ]}
        songs={[lanPianSong]}
        signedIn
        onSignIn={vi.fn()}
        onRate={vi.fn().mockResolvedValue(undefined)}
        onOpenInSong={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Card order' })).toHaveValue('chronological')
    expect(document.querySelector('.flashcard > strong')).toHaveTextContent(firstToken.text)

    fireEvent.change(screen.getByRole('combobox', { name: 'Card order' }), {
      target: { value: 'least-understood' },
    })
    expect(document.querySelector('.flashcard > strong')).toHaveTextContent('其实')

    fireEvent.click(screen.getByRole('checkbox', { name: 'Exclude learned words' }))
    expect(screen.getByText('1 shown')).toBeInTheDocument()
    expect(screen.getByLabelText('Flashcard learning progress').querySelector('.mastery-legend .learned'))
      .toHaveTextContent('1 learned')

    fireEvent.change(screen.getByRole('combobox', { name: 'Card order' }), {
      target: { value: 'random' },
    })
    expect(screen.getByRole('combobox', { name: 'Card order' })).toHaveValue('random')
  })
})
