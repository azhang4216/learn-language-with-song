export interface SongMetadata {
  title: string
  artist: string
  source: 'llm' | 'heuristic'
}

interface MetadataOptions {
  apiKey?: string | null
  model?: string
  request?: typeof fetch
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

const videoDescriptor = [
  'official',
  'official video',
  'official music video',
  'official lyric video',
  'lyrics?',
  'lyric video',
  'audio',
  'music video',
  'visuali[sz]er',
  'mv',
  '官方(?:歌詞|歌词)?(?:mv|影片|视频)?',
  '歌詞(?:mv|版|影片)?',
  '歌词(?:mv|版|视频)?',
].join('|')

const bracketedDescriptor = new RegExp(
  `\\s*(?:\\((?:${videoDescriptor}).*?\\)|\\[(?:${videoDescriptor}).*?\\])\\s*`,
  'gi',
)

const cleanTitle = (value: string): string => value
  .replace(bracketedDescriptor, ' ')
  .replace(/\s+(?:official|lyrics?|audio|mv)\s*$/gi, '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s\-–—|｜:：]+|[\s\-–—|｜:：]+$/g, '')
  .trim()

const cleanArtist = (value: string): string => value
  .replace(/\s+-\s+Topic$/i, '')
  .replace(/\s+(?:official|vevo)$/i, '')
  .replace(/^[\s\-–—|｜:：]+|[\s\-–—|｜:：]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const normalizedComparison = (value: string): string => cleanArtist(value)
  .normalize('NFKC')
  .toLocaleLowerCase()
  .replace(/[^\p{L}\p{N}]/gu, '')

export const inferYouTubeMetadataHeuristically = (
  titleValue: string,
  authorValue: string,
): SongMetadata => {
  const rawTitle = titleValue.normalize('NFKC').trim()
  const channelArtist = cleanArtist(authorValue)

  // East Asian releases commonly put the canonical metadata first as Artist《Title》,
  // followed by translated metadata and video descriptors.
  const quoted = rawTitle.match(/^\s*([^\u300a\u3008|｜]{1,80}?)\s*[\u300a\u3008]([^\u300b\u3009]{1,160})[\u300b\u3009]/u)
  if (quoted) {
    const quotedArtist = cleanArtist(quoted[1] ?? '')
    const comparableQuotedArtist = normalizedComparison(quotedArtist)
    const comparableChannel = normalizedComparison(channelArtist)
    const artist = comparableQuotedArtist && comparableChannel
      && (comparableChannel.includes(comparableQuotedArtist)
        || comparableQuotedArtist.includes(comparableChannel))
      ? channelArtist
      : quotedArtist || channelArtist
    return {
      artist,
      title: cleanTitle(quoted[2] ?? ''),
      source: 'heuristic',
    }
  }

  const cleaned = cleanTitle(rawTitle)
  const parts = cleaned
    .split(/\s+(?:-|–|—|｜|\|)\s+/)
    .map((part) => cleanTitle(part))
    .filter(Boolean)

  if (parts.length >= 2) {
    const comparableChannel = normalizedComparison(channelArtist)
    const artistIndex = comparableChannel
      ? parts.findIndex((part) => {
        const comparablePart = normalizedComparison(part)
        return comparablePart === comparableChannel
          || comparableChannel.includes(comparablePart)
          || comparablePart.includes(comparableChannel)
      })
      : -1
    if (artistIndex >= 0) {
      return {
        artist: cleanArtist(parts[artistIndex]!),
        title: parts.find((_part, index) => index !== artistIndex) ?? cleaned,
        source: 'heuristic',
      }
    }
    return {
      artist: cleanArtist(parts[0]!),
      title: parts[1]!,
      source: 'heuristic',
    }
  }

  return { title: cleaned, artist: channelArtist, source: 'heuristic' }
}

const responseText = (response: OpenAIResponse): string | undefined => response.output
  ?.flatMap((item) => item.content ?? [])
  .find((item) => item.type === 'output_text')
  ?.text

const metadataPrompt = [
  'Extract the canonical song title and primary performing artist from YouTube metadata.',
  'Prefer the original-language title over a translated title when both are shown.',
  'Treat Official, MV, lyric video, audio, visualizer, channel labels, and translations as descriptors, not artist names.',
  'Use the channel name only as supporting evidence.',
  'Return a JSON object with exactly two string fields: title and artist.',
].join(' ')

const inferWithModel = async (
  titleValue: string,
  authorValue: string,
  options: Required<Pick<MetadataOptions, 'apiKey' | 'model' | 'request' | 'provider'>>,
): Promise<SongMetadata | null> => {
  const isGroq = options.provider === 'groq'
  const result = await options.request(
    isGroq
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/responses',
    {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(isGroq
      ? {
          model: options.model,
          messages: [
            { role: 'system', content: metadataPrompt },
            {
              role: 'user',
              content: JSON.stringify({ youtubeTitle: titleValue, youtubeChannel: authorValue }),
            },
          ],
          reasoning_effort: 'none',
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_completion_tokens: 400,
        }
      : {
          model: options.model,
          reasoning: { effort: 'low' },
          store: false,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: metadataPrompt }],
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: JSON.stringify({ youtubeTitle: titleValue, youtubeChannel: authorValue }),
              }],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'song_metadata',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  artist: { type: 'string' },
                },
                required: ['title', 'artist'],
                additionalProperties: false,
              },
            },
          },
          max_output_tokens: 800,
        }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!result.ok) return null
  const payload = await result.json() as OpenAIResponse | GroqResponse
  const text = isGroq
    ? (payload as GroqResponse).choices?.[0]?.message?.content
    : responseText(payload as OpenAIResponse)
  if (!text) return null
  const parsed = JSON.parse(text) as { title?: unknown; artist?: unknown }
  if (typeof parsed.title !== 'string' || typeof parsed.artist !== 'string') return null
  const title = cleanTitle(parsed.title).slice(0, 160)
  const artist = cleanArtist(parsed.artist).slice(0, 160)
  return title && artist ? { title, artist, source: 'llm' } : null
}

export const inferYouTubeMetadata = async (
  titleValue: string,
  authorValue: string,
  options: MetadataOptions = {},
): Promise<SongMetadata> => {
  const fallback = inferYouTubeMetadataHeuristically(titleValue, authorValue)
  if (!options.apiKey || !titleValue.trim()) return fallback
  try {
    const provider = options.provider ?? 'openai'
    return await inferWithModel(titleValue, authorValue, {
      apiKey: options.apiKey,
      model: options.model ?? (provider === 'groq' ? 'qwen/qwen3.6-27b' : 'gpt-5.6-luna'),
      request: options.request ?? fetch,
      provider,
    }) ?? fallback
  } catch {
    return fallback
  }
}
