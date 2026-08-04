import { useMemo, useState } from 'react'
import { BookIcon, ChevronDownIcon, UserIcon } from './Icons'
import { dedupeVocabulary } from '../lib/vocabulary'
import type { VocabularyLearningItem } from '../types/auth'
import type { CatalogSong } from '../types/catalog'

interface FlashcardModeProps {
  items: VocabularyLearningItem[]
  songs: CatalogSong[]
  signedIn: boolean
  onSignIn: () => void
}

export function FlashcardMode({ items, songs, signedIn, onSignIn }: FlashcardModeProps) {
  const cards = useMemo(
    () => dedupeVocabulary(items.filter((item) => item.status === 'learning')),
    [items],
  )
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const safeIndex = Math.min(index, Math.max(0, cards.length - 1))
  const card = cards[safeIndex]
  const song = card ? songs.find((item) => item.id === card.songId) : undefined

  const move = (direction: -1 | 1) => {
    if (!cards.length) return
    setIndex((safeIndex + direction + cards.length) % cards.length)
    setRevealed(false)
  }

  return (
    <section className="flashcard-page" aria-labelledby="flashcard-title">
      <header className="flashcard-header">
        <div>
          <span className="section-eyebrow">Review mode</span>
          <h1 id="flashcard-title">Flashcards</h1>
          <p>Recall the sound and meaning before revealing each answer.</p>
        </div>
        <span className="flashcard-total"><BookIcon /> {cards.length} learning {cards.length === 1 ? 'word' : 'words'}</span>
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
          <div className="flashcard-navigation">
            <button onClick={() => move(-1)}>Previous</button>
            <button className="primary-button" onClick={() => move(1)}>
              {safeIndex === cards.length - 1 ? 'Start again' : 'Next card'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
