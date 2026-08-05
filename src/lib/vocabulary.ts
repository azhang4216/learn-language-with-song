import type { VocabularyLearningItem } from '../types/auth'
import type { LyricCue, LyricToken, Song } from '../types/song'

export const vocabularyIdentity = (text: string): string =>
  text.normalize('NFKC').replaceAll(/\s/g, '').toLocaleLowerCase()

export const tokenVocabularyIdentity = (token: LyricToken): string =>
  vocabularyIdentity(token.normalizedText ?? token.text)

export const savedVocabularyIdentity = (item: VocabularyLearningItem): string =>
  vocabularyIdentity(item.sourceText)

export interface VocabularyOccurrence {
  cue: LyricCue
  token: LyricToken
}

export const firstVocabularyOccurrence = (
  song: Song,
  sourceText: string,
): VocabularyOccurrence | undefined => {
  const identity = vocabularyIdentity(sourceText)
  for (const cue of song.cues) {
    const token = cue.tokens?.find((item) => tokenVocabularyIdentity(item) === identity)
    if (token) return { cue, token }
  }
  return undefined
}

export const matchingVocabularyOccurrences = (
  song: Song,
  selectedToken: LyricToken,
): VocabularyOccurrence[] => {
  const identity = tokenVocabularyIdentity(selectedToken)
  return song.cues.flatMap((cue) => (cue.tokens ?? [])
    .filter((token) => tokenVocabularyIdentity(token) === identity)
    .map((token) => ({ cue, token })))
}

export const dedupeVocabulary = (
  items: VocabularyLearningItem[],
): VocabularyLearningItem[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.songId}:${savedVocabularyIdentity(item)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
