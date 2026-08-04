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
})
