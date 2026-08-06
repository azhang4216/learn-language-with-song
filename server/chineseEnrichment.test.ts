import { describe, expect, it } from 'vitest'
import { enrichChineseLyrics, numberedPinyinToMarks } from './chineseEnrichment'

describe('Chinese lyric enrichment', () => {
  it('converts numbered pinyin to readable tone marks', () => {
    expect(numberedPinyinToMarks('da3 kai1 dian4 shi4')).toBe('dǎ kāi diàn shì')
    expect(numberedPinyinToMarks('lü4')).toBe('lǜ')
  })

  it('groups unspaced traditional lyrics and drafts learning data', () => {
    const result = enrichChineseLyrics('打開電視卻找不到遙控', 'traditional')
    expect(result.sourceLocale).toBe('zh-Hant')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]?.tokens.map((token) => token.text)).toEqual([
      '打開',
      '電視',
      '卻',
      '找不到',
      '遙控',
    ])
    expect(result.lines[0]?.tokens[0]).toMatchObject({
      romanization: 'dǎ kāi',
      gloss: expect.stringContaining('open'),
    })
    expect(result.lines[0]?.translation).toBeTruthy()
  })

  it('detects traditional lyrics even when the contributor leaves Simplified selected', () => {
    const result = enrichChineseLyrics('製作：LBI 利比\n打開電視卻找不到遙控', 'simplified')
    expect(result.sourceLocale).toBe('zh-Hant')
    expect(result.lines[0]?.tokens.find((token) => token.text === '製作')).toMatchObject({
      romanization: 'zhì zuò',
    })
  })

  it('keeps unknown dictionary tokens editable instead of crashing', () => {
    const result = enrichChineseLyrics('今天㐀心 LBI 🎵', 'simplified')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]?.tokens.some((token) => token.gloss === 'Meaning needs review')).toBe(true)
    expect(result.lines[0]?.tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'LBI', gloss: 'Meaning needs review' }),
      expect.objectContaining({ text: '🎵', gloss: 'punctuation' }),
    ]))
  })
})
