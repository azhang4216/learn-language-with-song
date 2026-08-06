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

const unique = (values: string[]): string[] => [...new Map(
  values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => [value.toLocaleLowerCase(), value] as const),
).values()]

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
  if (isPunctuation(text)) {
    return { text, romanization: text, gloss: 'punctuation', glossOptions: ['punctuation'] }
  }
  const entries = dictionaryEntries(text, script)
  const entry = entries.find((item) => item.pinyin === item.pinyin.toLocaleLowerCase()) ?? entries[0]
  const glossOptions = unique(entries.flatMap((item) => item.definition
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('CL:')))).slice(0, 10)
  const gloss = entry ? conciseGloss(entry.definition) || 'Meaning needs review' : 'Meaning needs review'
  return {
    text,
    romanization: entry ? numberedPinyinToMarks(entry.pinyin) : text,
    gloss,
    glossOptions: unique([gloss, ...glossOptions]),
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
  return {
    sourceLocale: detectedScript === 'traditional' ? 'zh-Hant' : 'zh-Hans',
    source: 'dictionary',
    lines,
  }
}

interface ContextualEnrichmentOptions {
  apiKey?: string | null
  model?: string
  request?: typeof fetch
  title?: string
  artist?: string
  provider?: 'groq' | 'openai'
}

interface OpenAIResponse {
  output?: Array<{
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface ContextualTokenDraft {
  text?: unknown
  romanization?: unknown
  contextualMeaning?: unknown
  alternativeMeanings?: unknown
}

interface ContextualLineDraft {
  translation?: unknown
  tokens?: unknown
}

const responseText = (response: OpenAIResponse): string | undefined => response.output
  ?.flatMap((item) => item.content ?? [])
  .find((item) => item.type === 'output_text')
  ?.text

const normalizedChinese = (value: string): string => value.replaceAll(/\s/g, '')

const validateContextualLine = (
  value: ContextualLineDraft,
  fallback: EnrichedLyricLine,
): EnrichedLyricLine | null => {
  if (typeof value.translation !== 'string' || !value.translation.trim()) return null
  if (!Array.isArray(value.tokens) || !value.tokens.length) return null

  const drafts = value.tokens as ContextualTokenDraft[]
  if (drafts.some((token) => (
    typeof token.text !== 'string'
      || typeof token.romanization !== 'string'
      || typeof token.contextualMeaning !== 'string'
      || !token.text.trim()
      || !token.romanization.trim()
      || !token.contextualMeaning.trim()
      || !Array.isArray(token.alternativeMeanings)
      || token.alternativeMeanings.some((meaning) => typeof meaning !== 'string')
  ))) return null

  const joinedChinese = drafts.map((token) => token.text as string).join('')
  if (normalizedChinese(joinedChinese) !== normalizedChinese(fallback.sourceText)) return null

  return {
    sourceText: fallback.sourceText,
    translation: value.translation.trim().slice(0, 600),
    tokens: drafts.map((token) => {
      const text = (token.text as string).trim()
      const gloss = (token.contextualMeaning as string).trim().slice(0, 160)
      const fallbackOptions = fallback.tokens
        .filter((item) => text.includes(item.text) || item.text.includes(text))
        .flatMap((item) => item.glossOptions)
      return {
        text,
        romanization: (token.romanization as string).trim().slice(0, 160),
        gloss,
        glossOptions: unique([
          gloss,
          ...(token.alternativeMeanings as string[]).map((meaning) => meaning.slice(0, 160)),
          ...fallbackOptions,
        ]).slice(0, 10),
      }
    }),
  }
}

export const enrichChineseLyricsWithContext = async (
  lyrics: string,
  script: ChineseScript,
  options: ContextualEnrichmentOptions = {},
): Promise<LyricsEnrichment> => {
  const fallback = enrichChineseLyrics(lyrics, script)
  const withWarning = (warning: string): LyricsEnrichment => ({ ...fallback, warning })
  const provider = options.provider ?? 'openai'
  const providerName = provider === 'groq' ? 'Groq' : 'OpenAI'
  if (!options.apiKey) {
    return withWarning('Context-aware enrichment is unavailable because no AI provider key is configured on the backend.')
  }

  const uniqueLines = [...new Map(fallback.lines.map((line) => [line.sourceText, line])).values()]
  // Extremely long documents still get a safe, editable dictionary draft rather than
  // an incomplete AI response. Normal song lyrics are well below this threshold.
  if (uniqueLines.length > 120) {
    return withWarning('This draft is too long for contextual enrichment, so it is using dictionary suggestions.')
  }

  try {
    const result = await (options.request ?? fetch)(provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(provider === 'groq' ? {
        model: options.model ?? 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'system',
            content: [
              'Create accurate learner annotations for Chinese song lyrics.',
              'Write idiomatic, emotionally coherent English for each complete lyric line; it must read naturally, never like concatenated dictionary definitions.',
              'Use the whole song to infer omitted subjects, metaphors, slang, and the most plausible meaning, but do not invent events absent from the lyrics.',
              'Regroup each line into useful words and phrases. Token text joined together must exactly reproduce that Chinese line, ignoring whitespace.',
              'Give tone-mark pinyin, one short contextual English meaning, and up to four useful alternative meanings for every token.',
              'Preserve learningLines order.',
              'Return a JSON object exactly shaped as {"lines":[{"translation":"natural English","tokens":[{"text":"exact Chinese","romanization":"tone-mark pinyin","contextualMeaning":"short English","alternativeMeanings":["other meaning"]}]}]}.',
              'Return JSON only, without markdown or commentary.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              song: {
                title: options.title?.trim() || 'Unknown title',
                artist: options.artist?.trim() || 'Unknown artist',
              },
              songContext: fallback.lines.map((line) => line.sourceText),
              learningLines: uniqueLines.map((line) => ({ text: line.sourceText })),
            }),
          },
        ],
        reasoning_effort: 'none',
        response_format: { type: 'json_object' },
        temperature: 0.25,
        max_completion_tokens: 8_000,
      } : {
        model: options.model ?? 'gpt-5.6-terra',
        reasoning: { effort: 'low' },
        store: false,
        input: [
          {
            role: 'system',
            content: [{
              type: 'input_text',
              text: [
                'Create accurate learner annotations for Chinese song lyrics.',
                'Write idiomatic, emotionally coherent English for each complete lyric line; it should read naturally, never like concatenated dictionary definitions.',
                'Use the whole song to infer omitted subjects, metaphors, slang, and the most plausible meaning, but do not invent events absent from the lyrics.',
                'Regroup each line into useful words and phrases. The token text joined together must exactly reproduce that Chinese line, ignoring whitespace.',
                'Give tone-mark pinyin and one short contextual English meaning for every token.',
                'Include up to four short alternative meanings only when they are genuinely plausible or useful to an editor.',
                'Preserve the input learningLines array order and return one output line for each item. Return only the requested schema.',
              ].join(' '),
            }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: JSON.stringify({
                song: {
                  title: options.title?.trim() || 'Unknown title',
                  artist: options.artist?.trim() || 'Unknown artist',
                },
                songContext: fallback.lines.map((line) => line.sourceText),
                learningLines: uniqueLines.map((line) => ({
                  text: line.sourceText,
                  dictionaryDraft: line.tokens.map((token) => ({
                    text: token.text,
                    pinyin: token.romanization,
                    possibleMeanings: token.glossOptions,
                  })),
                })),
              }),
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'contextual_chinese_song_annotations',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                lines: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      translation: { type: 'string' },
                      tokens: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            text: { type: 'string' },
                            romanization: { type: 'string' },
                            contextualMeaning: { type: 'string' },
                            alternativeMeanings: {
                              type: 'array',
                              items: { type: 'string' },
                              maxItems: 4,
                            },
                          },
                          required: ['text', 'romanization', 'contextualMeaning', 'alternativeMeanings'],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ['translation', 'tokens'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['lines'],
              additionalProperties: false,
            },
          },
        },
        max_output_tokens: 20_000,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!result.ok) {
      const upstreamMessage = (await result.text()).slice(0, 1_000)
      console.error(`${providerName} lyric enrichment failed (${result.status}): ${upstreamMessage}`)
      let errorCode = ''
      try {
        const problem = JSON.parse(upstreamMessage) as { error?: { code?: unknown; type?: unknown } }
        errorCode = [problem.error?.code, problem.error?.type]
          .filter((value): value is string => typeof value === 'string')
          .join(' ')
          .toLocaleLowerCase()
      } catch {
        // The status-specific message below is still actionable without a JSON error body.
      }
      if (provider === 'openai' && result.status === 429 && errorCode.includes('quota')) {
        return withWarning('The OpenAI project has no available API quota. Add API billing or credits, then retry the contextual draft.')
      }
      if (result.status === 429) {
        return withWarning(`${providerName} is rate-limiting contextual enrichment. Wait for the free-tier limit to reset, then retry.`)
      }
      if (result.status === 401 || result.status === 403) {
        return withWarning(`The ${providerName} API key could not run contextual enrichment. Check the key, then retry.`)
      }
      return withWarning(`Context-aware enrichment failed (${providerName} ${result.status}). Check the backend logs, then retry.`)
    }
    const payload = await result.json() as OpenAIResponse | GroqResponse
    const text = provider === 'groq'
      ? (payload as GroqResponse).choices?.[0]?.message?.content
      : responseText(payload as OpenAIResponse)
    if (!text) return withWarning('Context-aware enrichment returned no usable result, so this draft is using dictionary suggestions.')
    const parsed = JSON.parse(text) as { lines?: unknown }
    if (!Array.isArray(parsed.lines) || parsed.lines.length !== uniqueLines.length) {
      return withWarning('Context-aware enrichment returned incomplete lines, so this draft is using dictionary suggestions.')
    }

    const contextualBySource = new Map<string, EnrichedLyricLine>()
    for (const [index, line] of uniqueLines.entries()) {
      const validated = validateContextualLine(parsed.lines[index] as ContextualLineDraft, line)
      if (!validated) {
        return withWarning('Context-aware enrichment changed or omitted Chinese text, so the safe dictionary draft was kept.')
      }
      contextualBySource.set(line.sourceText, validated)
    }

    return {
      ...fallback,
      source: 'ai',
      provider,
      lines: fallback.lines.map((line) => contextualBySource.get(line.sourceText) ?? line),
    }
  } catch (error) {
    console.error(`${providerName} lyric enrichment failed:`, error)
    return withWarning(`${providerName} contextual enrichment could not be completed, so this draft is using dictionary suggestions.`)
  }
}
