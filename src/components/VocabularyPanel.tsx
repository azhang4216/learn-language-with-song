import type { TokenSelection } from '../types/song'
import { BookIcon, CheckIcon, CloseIcon, InfoIcon, MusicIcon } from './Icons'

interface VocabularyPanelProps {
  selection: TokenSelection | null
  translationLocale: string
  isLearning: boolean
  onToggleLearning: () => void
  onClose: () => void
}

export function VocabularyPanel({
  selection,
  translationLocale,
  isLearning,
  onToggleLearning,
  onClose,
}: VocabularyPanelProps) {
  if (!selection) {
    return (
      <aside className="vocabulary-panel empty" aria-label="Vocabulary details">
        <div className="vocab-empty-icon"><span>词</span></div>
        <h2>Explore the lyrics</h2>
        <p>Select a Chinese word to hear it in context and uncover its meaning.</p>
        <div className="vocab-tip"><InfoIcon /><span>Multi-character words stay together, just as a learner needs them.</span></div>
      </aside>
    )
  }

  const { cue, token } = selection
  const gloss = token.glosses?.[translationLocale] ?? Object.values(token.glosses ?? {})[0]

  return (
    <aside className="vocabulary-panel has-selection" aria-label={`Vocabulary details for ${token.text}`}>
      <div className="vocab-panel-topline">
        <span>Vocabulary</span>
        <button className="icon-button vocab-close" onClick={onClose} aria-label="Close vocabulary details"><CloseIcon /></button>
      </div>
      <div className="vocab-character">{token.text}</div>
      <div className="vocab-pinyin">{token.romanization?.text ?? 'Romanization unavailable'}</div>
      <div className="vocab-gloss">{gloss ?? 'Gloss unavailable'}</div>

      <button
        className={isLearning ? 'vocab-learning-button is-learning' : 'vocab-learning-button'}
        onClick={onToggleLearning}
        aria-pressed={isLearning}
      >
        {isLearning ? <CheckIcon /> : <BookIcon />}
        {isLearning ? 'Added to learning words' : 'Learn this word'}
      </button>

      <div className="vocab-meta">
        {token.partOfSpeech && <span>{token.partOfSpeech}</span>}
        {token.normalizedText && <span>Base: {token.normalizedText}</span>}
      </div>

      <div className="phrase-context">
        <div className="context-label"><MusicIcon /> In this lyric</div>
        <p className="context-source">{cue.sourceText}</p>
        <p className="context-pinyin">{cue.romanization?.text}</p>
        <p className="context-translation">“{cue.translations.natural}”</p>
      </div>

      {cue.translations.literal && (
        <details className="literal-detail">
          <summary>Literal meaning</summary>
          <p>{cue.translations.literal}</p>
        </details>
      )}
    </aside>
  )
}
