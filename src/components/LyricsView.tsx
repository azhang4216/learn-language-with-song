import { useEffect, useRef, useState } from 'react'
import type { LyricCue, LyricToken, Song } from '../types/song'
import { tokenVocabularyIdentity } from '../lib/vocabulary'
import { FollowIcon } from './Icons'

interface LyricsViewProps {
  song: Song
  currentTimeMs: number
  activeCueIndex: number
  activeTokenId: string | null
  selectedTokenId: string | null
  learningWordIdentities: ReadonlySet<string>
  onTokenSelect: (cue: LyricCue, token: LyricToken) => void
}

export function LyricsView({
  song,
  currentTimeMs,
  activeCueIndex,
  activeTokenId,
  selectedTokenId,
  learningWordIdentities,
  onTokenSelect,
}: LyricsViewProps) {
  const [following, setFollowing] = useState(true)
  const [showPinyin, setShowPinyin] = useState(true)
  const [showEnglish, setShowEnglish] = useState(true)
  const [showLiteral, setShowLiteral] = useState(false)
  const lineRefs = useRef(new Map<string, HTMLElement>())
  const automaticScroll = useRef(false)
  const automaticScrollTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!following || activeCueIndex < 0) return
    const cue = song.cues[activeCueIndex]
    if (!cue) return

    automaticScroll.current = true
    window.clearTimeout(automaticScrollTimer.current)
    lineRefs.current.get(cue.id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    })
    automaticScrollTimer.current = window.setTimeout(() => {
      automaticScroll.current = false
    }, 900)

    return () => window.clearTimeout(automaticScrollTimer.current)
  }, [activeCueIndex, following, song.cues])

  const stopFollowing = () => setFollowing(false)

  return (
    <section className="lyrics-section" aria-label="Synchronized lyrics">
      <div className="lyrics-toolbar">
        <div>
          <span className="section-eyebrow">Lyrics</span>
          <h2>Sing, listen, learn</h2>
        </div>
        <div className="lyric-options">
          {!following && (
            <button className="follow-button" onClick={() => setFollowing(true)}>
              <FollowIcon /> Follow lyrics
            </button>
          )}
          <label className="lyric-toggle">
            <input
              type="checkbox"
              checked={showPinyin}
              onChange={(event) => setShowPinyin(event.target.checked)}
            />
            <span>Pinyin</span>
          </label>
          <label className="lyric-toggle">
            <input
              type="checkbox"
              checked={showEnglish}
              onChange={(event) => setShowEnglish(event.target.checked)}
            />
            <span>English</span>
          </label>
          {showEnglish && <label className="lyric-toggle literal-toggle">
            <input
              type="checkbox"
              checked={showLiteral}
              onChange={(event) => setShowLiteral(event.target.checked)}
            />
            <span>Literal</span>
          </label>}
        </div>
      </div>

      <div
        className="lyrics-scroll"
        onWheel={stopFollowing}
        onTouchMove={stopFollowing}
        onScroll={() => {
          if (!automaticScroll.current) stopFollowing()
        }}
      >
        <div className="lyrics-list">
          {song.cues.map((cue, index) => {
            const isActive = index === activeCueIndex
            const phase = isActive ? 'current' : cue.endMs <= currentTimeMs ? 'past' : 'future'
            const hasTimedTokens = cue.tokens?.some(
              (token) => token.startMs !== undefined && token.endMs !== undefined,
            )
            const selectedToken = cue.tokens?.find((token) => token.id === selectedTokenId)
            const selectedGloss = selectedToken?.glosses?.[song.translationLocale]
              ?? Object.values(selectedToken?.glosses ?? {})[0]

            return (
              <article
                className={`lyric-cue ${phase}`}
                key={cue.id}
                ref={(element) => {
                  if (element) lineRefs.current.set(cue.id, element)
                  else lineRefs.current.delete(cue.id)
                }}
                aria-current={isActive ? 'true' : undefined}
              >
                <div className="cue-marker" aria-hidden="true"><span /></div>
                <div className="cue-copy">
                  {showPinyin && (cue.tokens?.some((token) => token.romanization) ? (
                    <div className={`romanization-line ${isActive && !hasTimedTokens ? 'line-active' : ''}`} lang="zh-Latn-pinyin">
                      {cue.tokens.map((token) => (
                        <span className={`${activeTokenId === token.id ? 'is-active' : ''} ${selectedTokenId === token.id ? 'is-selected' : ''} ${learningWordIdentities.has(tokenVocabularyIdentity(token)) ? 'is-learning' : ''}`} key={token.id}>
                          {token.romanization?.text ?? token.text}
                        </span>
                      ))}
                    </div>
                  ) : cue.romanization ? (
                    <div className={`romanization-line ${isActive ? 'line-active' : ''}`} lang="zh-Latn-pinyin">
                      {cue.romanization.text}
                    </div>
                  ) : null)}

                  <div className="source-line" lang={song.sourceLocale}>
                    {cue.tokens?.length ? cue.tokens.map((token) => (
                      <button
                        className={`lyric-token ${activeTokenId === token.id ? 'is-active' : ''} ${selectedTokenId === token.id ? 'is-selected' : ''} ${learningWordIdentities.has(tokenVocabularyIdentity(token)) ? 'is-learning' : ''}`}
                        key={token.id}
                        onClick={() => onTokenSelect(cue, token)}
                        aria-label={`${token.text}${token.romanization?.text ? `, ${token.romanization.text}` : ''}`}
                      >
                        {token.text}
                      </button>
                    )) : <span>{cue.sourceText}</span>}
                  </div>

                  {showEnglish && (
                    <>
                      {selectedGloss && (
                        <div className="selected-gloss" aria-label={`Selected meaning: ${selectedGloss}`}>
                          {selectedGloss}
                        </div>
                      )}
                      <div className={`translation-line ${isActive ? 'line-active' : ''} ${selectedGloss ? 'has-word-selection' : ''}`} lang={song.translationLocale}>
                        {cue.translations.natural}
                      </div>
                      {showLiteral && cue.translations.literal && (
                        <div className="literal-line">Literal: {cue.translations.literal}</div>
                      )}
                    </>
                  )}
                </div>
              </article>
            )
          })}
          <div className="lyrics-end"><span /> End of song <span /></div>
        </div>
      </div>
    </section>
  )
}
