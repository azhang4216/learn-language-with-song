import { describe, expect, it } from 'vitest'
import {
  enrichChineseLyrics,
  enrichChineseLyricsWithContext,
  numberedPinyinToMarks,
} from './chineseEnrichment'

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

  it('uses whole-song context for natural English and useful word grouping', async () => {
    const request = (async () => Response.json({
      output: [{
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            lines: [{
              translation: 'The wind has gone, leaving only fallen leaves along the street.',
              tokens: [
                {
                  text: '风走了',
                  romanization: 'fēng zǒu le',
                  contextualMeaning: 'the wind has gone',
                  alternativeMeanings: [],
                },
                {
                  text: '只',
                  romanization: 'zhǐ',
                  contextualMeaning: 'only',
                  alternativeMeanings: ['merely'],
                },
                {
                  text: '留下',
                  romanization: 'liúxià',
                  contextualMeaning: 'leave behind',
                  alternativeMeanings: ['remain'],
                },
                {
                  text: '一条街的叶落',
                  romanization: 'yì tiáo jiē de yè luò',
                  contextualMeaning: 'fallen leaves along the street',
                  alternativeMeanings: [],
                },
              ],
            }],
          }),
        }],
      }],
    })) as typeof fetch

    const result = await enrichChineseLyricsWithContext(
      '风走了只留下一条街的叶落',
      'simplified',
      { apiKey: 'test-key', request, title: '跳楼机', artist: 'LBI利比' },
    )

    expect(result.source).toBe('ai')
    expect(result.lines[0]?.translation).toBe('The wind has gone, leaving only fallen leaves along the street.')
    expect(result.lines[0]?.tokens.map((token) => token.text)).toEqual([
      '风走了',
      '只',
      '留下',
      '一条街的叶落',
    ])
    expect(result.lines[0]?.tokens[1]?.glossOptions).toContain('merely')
  })

  it('supports Groq-hosted Qwen while preserving application-side validation', async () => {
    const request = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.groq.com/openai/v1/chat/completions')
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: 'qwen/qwen3.6-27b',
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
      })
      return Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              lines: [{
                translation: 'You are gone, leaving only my tear-reddened eyes behind.',
                tokens: [
                  { text: '你', romanization: 'nǐ', contextualMeaning: 'you', alternativeMeanings: [] },
                  { text: '走了', romanization: 'zǒu le', contextualMeaning: 'are gone', alternativeMeanings: ['left'] },
                  { text: '只', romanization: 'zhǐ', contextualMeaning: 'only', alternativeMeanings: [] },
                  { text: '留下', romanization: 'liúxià', contextualMeaning: 'leave behind', alternativeMeanings: [] },
                  { text: '我', romanization: 'wǒ', contextualMeaning: 'my', alternativeMeanings: ['me'] },
                  { text: '双眼', romanization: 'shuāngyǎn', contextualMeaning: 'eyes', alternativeMeanings: [] },
                  { text: '的', romanization: 'de', contextualMeaning: 'linking particle', alternativeMeanings: [] },
                  { text: '红', romanization: 'hóng', contextualMeaning: 'red from crying', alternativeMeanings: ['red'] },
                ],
              }],
            }),
          },
        }],
      })
    }) as typeof fetch

    const result = await enrichChineseLyricsWithContext(
      '你走了只留下我双眼的红',
      'simplified',
      {
        apiKey: 'test-groq-key',
        model: 'qwen/qwen3.6-27b',
        provider: 'groq',
        request,
      },
    )

    expect(result).toMatchObject({ source: 'ai', provider: 'groq' })
    expect(result.lines[0]?.translation).toContain('tear-reddened eyes')
    expect(result.lines[0]?.tokens.map((token) => token.text).join('')).toBe('你走了只留下我双眼的红')
  })
})
