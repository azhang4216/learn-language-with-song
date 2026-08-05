import { useMemo, useState } from 'react'
import {
  BookIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MusicIcon,
  UserIcon,
} from './Icons'
import { orderFlashcards, type FlashcardOrder } from '../lib/flashcards'
import {
  dedupeVocabulary,
  firstVocabularyOccurrence,
  tokenVocabularyIdentity,
  vocabularyIdentity,
} from '../lib/vocabulary'
import type { VocabularyLearningItem } from '../types/auth'
import type { CatalogSong } from '../types/catalog'

interface FlashcardModeProps {
  items: VocabularyLearningItem[]
  songs: CatalogSong[]
  signedIn: boolean
  onSignIn: () => void
  onRate: (card: VocabularyLearningItem, familiar: boolean) => Promise<void>
  onOpenInSong: (card: VocabularyLearningItem) => void
}

export function FlashcardMode({
  items,
  songs,
  signedIn,
  onSignIn,
  onRate,
  onOpenInSong,
}: FlashcardModeProps) {
  const allCards = useMemo(() => dedupeVocabulary(items), [items])
  const [order, setOrder] = useState<FlashcardOrder>('chronological')
  const [excludeLearned, setExcludeLearned] = useState(false)
  const [randomSeed, setRandomSeed] = useState(() => Math.floor(Math.random() * 2_147_483_647))
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [rating, setRating] = useState(false)

  const cards = useMemo(() => orderFlashcards(
    excludeLearned ? allCards.filter((item) => item.status !== 'learned') : allCards,
    order,
    randomSeed,
  ), [allCards, excludeLearned, order, randomSeed])
  const safeIndex = Math.min(index, Math.max(0, cards.length - 1))
  const card = cards[safeIndex]
  const song = card ? songs.find((item) => item.id === card.songId) : undefined
  const context = card && song ? firstVocabularyOccurrence(song, card.sourceText) : undefined
  const learnedCount = allCards.filter((item) => item.status === 'learned').length
  const reviewCount = allCards.filter((item) =>
    item.status !== 'learned' && item.reviewState === 'review').length
  const learningCount = Math.max(0, allCards.length - learnedCount - reviewCount)

  const move = (direction: -1 | 1) => {
    if (!cards.length) return
    setIndex((safeIndex + direction + cards.length) % cards.length)
    setRevealed(false)
  }

  const changeOrder = (nextOrder: FlashcardOrder) => {
    setOrder(nextOrder)
    if (nextOrder === 'random') setRandomSeed(Math.floor(Math.random() * 2_147_483_647))
    setIndex(0)
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

  return (
    <section className="flashcard-page" aria-labelledby="flashcard-title">
      <header className="flashcard-header">
        <div>
          <span className="section-eyebrow">Review mode</span>
          <h1 id="flashcard-title">Flashcards</h1>
          <p>Reveal the answer, then tell Verse whether the word felt familiar.</p>
        </div>
        <span className="flashcard-total"><BookIcon /> {allCards.length} {allCards.length === 1 ? 'word' : 'words'}</span>
      </header>

      {!signedIn ? (
        <div className="flashcard-empty">
          <span><UserIcon /></span>
          <h2>Sign in to review your words</h2>
          <p>Your learning vocabulary is stored with your Verse account.</p>
          <button className="primary-button" onClick={onSignIn}>Sign in</button>
        </div>
      ) : allCards.length === 0 ? (
        <div className="flashcard-empty">
          <span><BookIcon /></span>
          <h2>Your deck is ready for its first word</h2>
          <p>Open a song, select a grouped word, and choose “Learn this word.”</p>
        </div>
      ) : (
        <div className="flashcard-stage">
          <div className="flashcard-options">
            <label>
              <span>Card order</span>
              <select value={order} onChange={(event) => changeOrder(event.target.value as FlashcardOrder)}>
                <option value="chronological">Chronological</option>
                <option value="least-understood">Least understood first</option>
                <option value="random">Random</option>
              </select>
            </label>
            <label className="exclude-learned-toggle">
              <input
                type="checkbox"
                checked={excludeLearned}
                onChange={(event) => {
                  setExcludeLearned(event.target.checked)
                  setIndex(0)
                  setRevealed(false)
                }}
              />
              <span>Exclude learned words</span>
            </label>
            <span className="flashcard-shown-count">{cards.length} shown</span>
          </div>

          {!card ? (
            <div className="flashcard-filter-empty">
              <CheckIcon />
              <h2>No unlearned cards left</h2>
              <p>Turn off “Exclude learned words” to review the full deck.</p>
            </div>
          ) : (
            <>
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
                  <strong lang={song?.sourceLocale ?? 'zh-Hans'}>{card.sourceText}</strong>
                  {revealed ? (
                    <div className="flashcard-answer" aria-live="polite">
                      <span className="flashcard-answer-pinyin">{card.romanization || 'Pinyin unavailable'}</span>
                      <p className="flashcard-answer-meaning">{card.gloss || 'Meaning unavailable'}</p>
                      {context && (
                        <div className="flashcard-example">
                          <div className="flashcard-example-heading">
                            <span>First example in the song</span>
                            <button onClick={() => onOpenInSong(card)}>
                              <MusicIcon /> See in song <ChevronRightIcon />
                            </button>
                          </div>
                          <p className="flashcard-example-chinese" lang={song?.sourceLocale ?? 'zh-Hans'}>
                            {context.cue.tokens?.map((token) => (
                              <span
                                className={tokenVocabularyIdentity(token) === vocabularyIdentity(card.sourceText) ? 'is-vocabulary' : ''}
                                key={token.id}
                              >{token.text}</span>
                            )) ?? context.cue.sourceText}
                          </p>
                          {context.cue.romanization?.text && (
                            <p className="flashcard-example-pinyin" lang="zh-Latn-pinyin">{context.cue.romanization.text}</p>
                          )}
                          <p className="flashcard-example-translation">{context.cue.translations.natural}</p>
                        </div>
                      )}
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
            </>
          )}

          <MasteryProgress
            total={allCards.length}
            learned={learnedCount}
            learning={learningCount}
            review={reviewCount}
          />
        </div>
      )}
    </section>
  )
}

function MasteryProgress({
  total,
  learned,
  learning,
  review,
}: {
  total: number
  learned: number
  learning: number
  review: number
}) {
  const percent = (count: number): string => `${total ? (count / total) * 100 : 0}%`
  return (
    <section className="flashcard-mastery" aria-label="Flashcard learning progress">
      <div className="mastery-bar" aria-hidden="true">
        <span className="learned" style={{ width: percent(learned) }} />
        <span className="learning" style={{ width: percent(learning) }} />
        <span className="review" style={{ width: percent(review) }} />
      </div>
      <div className="mastery-legend">
        <span className="learned"><i /> <strong>{learned}</strong> learned</span>
        <span className="learning"><i /> <strong>{learning}</strong> learning</span>
        <span className="review"><i /> <strong>{review}</strong> review more</span>
      </div>
    </section>
  )
}
