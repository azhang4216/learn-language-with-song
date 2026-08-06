import hanzi from 'hanzi'
import type { EnrichedLyricLine, EnrichedLyricToken, LyricsEnrichment } from '../src/types/catalog'

hanzi.start()

const toneMarks: Record<string, string[]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const markSyllable = (value: string): string => {
  const match = value.match(/^(.+?)([1-5])$/)
  if (!match) return value.replaceAll('u:', 'ü').replaceAll('v', 'ü')
  const syllable = match[1]!.replaceAll('u:', 'ü').replaceAll('v', 'ü')
  const tone = Number(match[2])
  if (tone === 5) return syllable
  const lower = syllable.toLocaleLowerCase()
  let index = lower.indexOf('a')
  if (index < 0) index = lower.indexOf('e')
  if (index < 0 && lower.includes('ou')) index = lower.indexOf('o')
  if (index < 0) {
    for (let cursor = lower.length - 1; cursor >= 0; cursor -= 1) {
      if ('aeiouü'.includes(lower[cursor]!)) {
        index = cursor
        break
      }
    }
  }
  if (index < 0) return syllable
  const vowel = lower[index]!
  const marked = toneMarks[vowel]?.[tone] ?? vowel
  const source = syllable[index]!
  const output = source === source.toLocaleUpperCase() ? marked.toLocaleUpperCase() : marked
  return `${syllable.slice(0, index)}${output}${syllable.slice(index + 1)}`
}

export const numberedPinyinToMarks = (value: string): string =>
  value.split(/(\s+)/).map((part) => /^\s+$/.test(part) ? part : markSyllable(part)).join('')

const isPunctuation = (value: string): boolean => /^[\p{P}\p{S}]+$/u.test(value)

const conciseGloss = (definition: string): string => definition
  .split('/')
  .map((part) => part.trim())
  .filter((part) => part && !part.startsWith('CL:'))
  .slice(0, 3)
  .join('; ')

type ChineseScript = 'simplified' | 'traditional'
type DictionaryEntry = NonNullable<ReturnType<typeof hanzi.definitionLookup>>[number]

const segmentText = (value: string): string[] => {
  const unicodeSafe: string[] = []
  for (const token of hanzi.segment(value)) {
    const previous = unicodeSafe.at(-1)
    if (previous && /[\uD800-\uDBFF]$/.test(previous) && /^[\uDC00-\uDFFF]/.test(token)) {
      unicodeSafe[unicodeSafe.length - 1] = `${previous}${token}`
    } else {
      unicodeSafe.push(token)
    }
  }

  return unicodeSafe.reduce<string[]>((grouped, token) => {
    const previous = grouped.at(-1)
    const isNonHanWord = (part: string): boolean =>
      /^[\p{L}\p{N}]+$/u.test(part) && !/\p{Script=Han}/u.test(part)
    if (previous && isNonHanWord(previous) && isNonHanWord(token)) {
      grouped[grouped.length - 1] = `${previous}${token}`
    } else {
      grouped.push(token)
    }
    return grouped
  }, [])
}

const dictionaryEntries = (text: string, script: ChineseScript): DictionaryEntry[] => {
  const preferredScript = script === 'traditional' ? 't' : 's'
  const fallbackScript = preferredScript === 't' ? 's' : 't'
  const preferred = hanzi.definitionLookup(text, preferredScript)
  if (preferred?.length) return preferred
  const fallback = hanzi.definitionLookup(text, fallbackScript)
  if (fallback?.length) return fallback
  return hanzi.definitionLookup(text) ?? []
}

const detectScript = (lyrics: string, requested: ChineseScript): ChineseScript => {
  let simplifiedEvidence = 0
  let traditionalEvidence = 0
  for (const token of segmentText(lyrics.replaceAll(/\s/g, ''))) {
    const simplified = hanzi.definitionLookup(token, 's')
    const traditional = hanzi.definitionLookup(token, 't')
    if (simplified?.length && !traditional?.length) simplifiedEvidence += token.length
    if (traditional?.length && !simplified?.length) traditionalEvidence += token.length
  }
  if (traditionalEvidence > simplifiedEvidence) return 'traditional'
  if (simplifiedEvidence > traditionalEvidence) return 'simplified'
  return requested
}

const enrichToken = (text: string, script: 'simplified' | 'traditional'): EnrichedLyricToken => {
  if (isPunctuation(text)) return { text, romanization: text, gloss: 'punctuation' }
  const entries = dictionaryEntries(text, script)
  const entry = entries.find((item) => item.pinyin === item.pinyin.toLocaleLowerCase()) ?? entries[0]
  return {
    text,
    romanization: entry ? numberedPinyinToMarks(entry.pinyin) : text,
    gloss: entry ? conciseGloss(entry.definition) || 'Meaning needs review' : 'Meaning needs review',
  }
}

const draftTranslation = (tokens: EnrichedLyricToken[]): string => {
  const words = tokens
    .filter((token) => !isPunctuation(token.text))
    .map((token) => token.gloss.split(';')[0]!.replace(/^to\s+/i, '').trim())
    .filter(Boolean)
  if (!words.length) return 'Translation needs review.'
  return `${words.join(' ')}.`
}

export const enrichChineseLyrics = (
  lyrics: string,
  script: 'simplified' | 'traditional',
): LyricsEnrichment => {
  const detectedScript = detectScript(lyrics, script)
  const lines: EnrichedLyricLine[] = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sourceText) => {
      const tokens = segmentText(sourceText)
        .filter((token) => token.trim())
        .map((token) => enrichToken(token, detectedScript))
      return { sourceText, tokens, translation: draftTranslation(tokens) }
    })
  return { sourceLocale: detectedScript === 'traditional' ? 'zh-Hant' : 'zh-Hans', lines }
}
