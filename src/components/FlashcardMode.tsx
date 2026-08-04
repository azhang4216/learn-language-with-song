import { useMemo, useState } from 'react'
import {
  BookIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
} from './Icons'
import { dedupeVocabulary } from '../lib/vocabulary'
import type { VocabularyLearningItem } from '../types/auth'
import type { CatalogSong } from '../types/catalog'

interface FlashcardModeProps {
  items: VocabularyLearningItem[]
  songs: CatalogSong[]
  signedIn: boolean
  onSignIn: () => void
  onRate: (card: VocabularyLearningItem, familiar: boolean) => Promise<void>
}

export function FlashcardMode({ items, songs, signedIn, onSignIn, onRate }: FlashcardModeProps) {
  const cards = useMemo(() => dedupeVocabulary(items), [items])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [rating, setRating] = useState(false)

  const safeIndex = Math.min(index, Math.max(0, cards.length - 1))
  const card = cards[safeIndex]
  const song = card ? songs.find((item) => item.id === card.songId) : undefined
  const learnedCount = cards.filter((item) => item.status === 'learned').length
  const reviewCount = cards.filter((item) =>
    item.status !== 'learned' && item.reviewState === 'review').length
  const learningCount = Math.max(0, cards.length - learnedCount - reviewCount)

  const move = (direction: -1 | 1) => {
    if (!cards.length) return
    setIndex((safeIndex + direction + cards.length) % cards.length)
    setRevealed(false)
  }

  const rate = async (familiar: boolean) => {
    if (!card || rating || !revealed) return
    setRating(true)
    try {
      await onRate(card, familiar)
      move(1)
    } catch {
      // The parent reports persistence errors without advancing the deck.
    } finally {
      setRating(false)
    }
  }

  const percent = (count: number): string => `${cards.length ? (count / cards.length) * 100 : 0}%`

  return (
    <section className="flashcard-page" aria-labelledby="flashcard-title">
      <header className="flashcard-header">
        <div>
          <span className="section-eyebrow">Review mode</span>
          <h1 id="flashcard-title">Flashcards</h1>
          <p>Reveal the answer, then tell Verse whether the word felt familiar.</p>
        </div>
        <span className="flashcard-total"><BookIcon /> {cards.length} {cards.length === 1 ? 'word' : 'words'}</span>
      </header>

      {!signedIn ? (
        <div className="flashcard-empty">
          <span><UserIcon /></span>
          <h2>Sign in to review your words</h2>
          <p>Your learning vocabulary is stored with your Verse account.</p>
          <button className="primary-button" onClick={onSignIn}>Sign in</button>
        </div>
      ) : !card ? (
        <div className="flashcard-empty">
          <span><BookIcon /></span>
          <h2>Your deck is ready for its first word</h2>
          <p>Open a song, select a grouped word, and choose “Learn this word.”</p>
        </div>
      ) : (
        <div className="flashcard-stage">
          <div className="flashcard-progress-row">
            <span>Card {safeIndex + 1} of {cards.length}</span>
            <span>{song?.title ?? 'Song vocabulary'}</span>
          </div>
          <div className="flashcard-deck">
            <button className="flashcard-arrow previous" onClick={() => move(-1)} aria-label="Previous flashcard">
              <ChevronLeftIcon />
            </button>
            <div className={revealed ? 'flashcard is-revealed' : 'flashcard'}>
              <span className="flashcard-prompt">What does this mean?</span>
              <strong lang="zh-Hans">{card.sourceText}</strong>
              {revealed ? (
                <div className="flashcard-answer" aria-live="polite">
                  <span>{card.romanization || 'Pinyin unavailable'}</span>
                  <p>{card.gloss || 'Meaning unavailable'}</p>
                </div>
              ) : (
                <button className="flashcard-reveal" onClick={() => setRevealed(true)}>
                  Reveal answer <ChevronDownIcon />
                </button>
              )}
            </div>
            <button className="flashcard-arrow next" onClick={() => move(1)} aria-label="Next flashcard">
              <ChevronRightIcon />
            </button>
          </div>

          <div className="flashcard-rating" aria-label="Rate this flashcard">
            <button className="not-familiar" onClick={() => void rate(false)} disabled={!revealed || rating}>
              Not familiar
            </button>
            <button className="familiar" onClick={() => void rate(true)} disabled={!revealed || rating}>
              <CheckIcon /> Familiar
            </button>
          </div>

          <section className="flashcard-mastery" aria-label="Flashcard learning progress">
            <div className="mastery-bar" aria-hidden="true">
              <span className="learned" style={{ width: percent(learnedCount) }} />
              <span className="learning" style={{ width: percent(learningCount) }} />
              <span className="review" style={{ width: percent(reviewCount) }} />
            </div>
            <div className="mastery-legend">
              <span className="learned"><i /> <strong>{learnedCount}</strong> learned</span>
              <span className="learning"><i /> <strong>{learningCount}</strong> learning</span>
              <span className="review"><i /> <strong>{reviewCount}</strong> review more</span>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
