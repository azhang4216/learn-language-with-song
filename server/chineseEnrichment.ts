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

const enrichToken = (text: string, script: 'simplified' | 'traditional'): EnrichedLyricToken => {
  if (isPunctuation(text)) return { text, romanization: text, gloss: 'punctuation' }
  const entries = hanzi.definitionLookup(text, script === 'traditional' ? 't' : 's')
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
  const lines: EnrichedLyricLine[] = lyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sourceText) => {
      const tokens = hanzi.segment(sourceText)
        .filter((token) => token.trim())
        .map((token) => enrichToken(token, script))
      return { sourceText, tokens, translation: draftTranslation(tokens) }
    })
  return { sourceLocale: script === 'traditional' ? 'zh-Hant' : 'zh-Hans', lines }
}
