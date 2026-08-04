import type { LyricCue, LyricToken, Romanization, Song } from '../types/song'
import type { CatalogSongDraft } from '../types/catalog'
import { parseYouTubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from './youtubeUrl'

export class SongValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues[0] ?? 'The song metadata is invalid.')
    this.name = 'SongValidationError'
    this.issues = issues
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const finiteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const validateRomanization = (
  value: unknown,
  path: string,
  issues: string[],
): value is Romanization => {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`)
    return false
  }
  if (!nonEmptyString(value.system)) issues.push(`${path}.system is required.`)
  if (!nonEmptyString(value.text)) issues.push(`${path}.text is required.`)
  return nonEmptyString(value.system) && nonEmptyString(value.text)
}

const validateToken = (
  value: unknown,
  path: string,
  cue: { startMs: number; endMs: number },
  issues: string[],
): value is LyricToken => {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`)
    return false
  }

  if (!nonEmptyString(value.id)) issues.push(`${path}.id is required.`)
  if (!nonEmptyString(value.text)) issues.push(`${path}.text is required.`)
  if (value.normalizedText !== undefined && !nonEmptyString(value.normalizedText)) {
    issues.push(`${path}.normalizedText must be non-empty text when provided.`)
  }
  if (value.partOfSpeech !== undefined && !nonEmptyString(value.partOfSpeech)) {
    issues.push(`${path}.partOfSpeech must be non-empty text when provided.`)
  }
  if (value.romanization !== undefined) {
    validateRomanization(value.romanization, `${path}.romanization`, issues)
  }
  if (value.startMs !== undefined && !finiteNonNegative(value.startMs)) {
    issues.push(`${path}.startMs must be a non-negative number.`)
  }
  if (value.endMs !== undefined && !finiteNonNegative(value.endMs)) {
    issues.push(`${path}.endMs must be a non-negative number.`)
  }
  if ((value.startMs === undefined) !== (value.endMs === undefined)) {
    issues.push(`${path} must provide both startMs and endMs, or neither.`)
  }
  if (
    finiteNonNegative(value.startMs) &&
    finiteNonNegative(value.endMs) &&
    (value.startMs >= value.endMs ||
      value.startMs < cue.startMs ||
      value.endMs > cue.endMs)
  ) {
    issues.push(`${path} timing must be ordered and contained within its cue.`)
  }
  if (value.glosses !== undefined) {
    if (
      !isRecord(value.glosses) ||
      Object.values(value.glosses).some((gloss) => !nonEmptyString(gloss))
    ) {
      issues.push(`${path}.glosses must map locale codes to non-empty text.`)
    }
  }

  return nonEmptyString(value.id) && nonEmptyString(value.text)
}

const validateCue = (
  value: unknown,
  index: number,
  previousEnd: number,
  issues: string[],
): value is LyricCue => {
  const path = `cues[${index}]`
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`)
    return false
  }

  if (!nonEmptyString(value.id)) issues.push(`${path}.id is required.`)
  if (!finiteNonNegative(value.startMs)) {
    issues.push(`${path}.startMs must be a non-negative number.`)
  }
  if (!finiteNonNegative(value.endMs)) {
    issues.push(`${path}.endMs must be a non-negative number.`)
  }
  if (
    finiteNonNegative(value.startMs) &&
    finiteNonNegative(value.endMs) &&
    value.startMs >= value.endMs
  ) {
    issues.push(`${path}.endMs must be later than startMs.`)
  }
  if (finiteNonNegative(value.startMs) && value.startMs < previousEnd) {
    issues.push(`${path} overlaps the previous cue or is out of order.`)
  }
  if (!nonEmptyString(value.sourceText)) issues.push(`${path}.sourceText is required.`)
  if (value.romanization !== undefined) {
    validateRomanization(value.romanization, `${path}.romanization`, issues)
  }
  if (!isRecord(value.translations) || !nonEmptyString(value.translations.natural)) {
    issues.push(`${path}.translations.natural is required.`)
  } else if (
    value.translations.literal !== undefined &&
    !nonEmptyString(value.translations.literal)
  ) {
    issues.push(`${path}.translations.literal must be non-empty text when provided.`)
  }
  if (Array.isArray(value.tokens)) {
    const seen = new Set<string>()
    value.tokens.forEach((item, tokenIndex) => {
      if (
        validateToken(
          item,
          `${path}.tokens[${tokenIndex}]`,
          {
            startMs: finiteNonNegative(value.startMs) ? value.startMs : 0,
            endMs: finiteNonNegative(value.endMs) ? value.endMs : Number.MAX_VALUE,
          },
          issues,
        ) &&
        seen.has(item.id)
      ) {
        issues.push(`${path} contains a duplicate token id “${item.id}”.`)
      } else if (isRecord(item) && nonEmptyString(item.id)) {
        seen.add(item.id)
      }
    })
  } else if (value.tokens !== undefined) {
    issues.push(`${path}.tokens must be an array when provided.`)
  }

  return (
    nonEmptyString(value.id) &&
    finiteNonNegative(value.startMs) &&
    finiteNonNegative(value.endMs) &&
    nonEmptyString(value.sourceText)
  )
}

export const parseSongMetadata = (value: unknown): Song => {
  const issues: string[] = []
  if (!isRecord(value)) throw new SongValidationError(['The JSON root must be an object.'])

  if (value.schemaVersion !== 1) issues.push('schemaVersion must be 1.')
  if (!nonEmptyString(value.id)) issues.push('id is required.')
  if (!nonEmptyString(value.title)) issues.push('title is required.')
  if (value.artist !== undefined && !nonEmptyString(value.artist)) {
    issues.push('artist must be non-empty text when provided.')
  }
  if (value.artworkUrl !== undefined && !nonEmptyString(value.artworkUrl)) {
    issues.push('artworkUrl must be non-empty text when provided.')
  }
  if (!nonEmptyString(value.sourceLocale)) issues.push('sourceLocale is required.')
  if (!nonEmptyString(value.translationLocale)) {
    issues.push('translationLocale is required.')
  }
  if (!isRecord(value.audio)) {
    issues.push('audio must be an object.')
  } else {
    if (value.audio.src !== undefined && !nonEmptyString(value.audio.src)) {
      issues.push('audio.src must be non-empty text when provided.')
    }
    if (
      value.audio.durationMs !== undefined &&
      !finiteNonNegative(value.audio.durationMs)
    ) {
      issues.push('audio.durationMs must be a non-negative number when provided.')
    }
  }
  if (!Array.isArray(value.cues) || value.cues.length === 0) {
    issues.push('cues must contain at least one timed lyric cue.')
  } else {
    let previousEnd = 0
    const seen = new Set<string>()
    value.cues.forEach((item, index) => {
      if (validateCue(item, index, previousEnd, issues) && isRecord(item)) {
        if (seen.has(item.id as string)) {
          issues.push(`cues contains a duplicate id “${String(item.id)}”.`)
        }
        seen.add(item.id as string)
        previousEnd = item.endMs as number
      }
    })
  }

  if (issues.length > 0) throw new SongValidationError(issues)
  return value as unknown as Song
}

export const parseSongMetadataFile = async (file: File): Promise<Song> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text()) as unknown
  } catch {
    throw new SongValidationError(['The metadata file is not valid JSON.'])
  }
  return parseSongMetadata(parsed)
}

export const parseCatalogSongDraft = (value: unknown): CatalogSongDraft => {
  const song = parseSongMetadata(value)
  const issues: string[] = []
  if (!isRecord(value)) throw new SongValidationError(['The JSON root must be an object.'])

  if (song.title.trim().length > 120) issues.push('title must be 120 characters or fewer.')
  if ((song.artist?.trim().length ?? 0) > 120) issues.push('artist must be 120 characters or fewer.')
  if (!song.translationLocale.toLocaleLowerCase().startsWith('en')) {
    issues.push('translationLocale must identify English, such as “en” or “en-US”.')
  }
  const finalCueEnd = song.cues.at(-1)?.endMs ?? 0
  if (song.audio.durationMs !== undefined && song.audio.durationMs < finalCueEnd) {
    issues.push('audio.durationMs cannot end before the final lyric cue.')
  }

  const youtube = value.youtube
  if (!isRecord(youtube) || !nonEmptyString(youtube.url)) {
    issues.push('youtube.url is required.')
  }
  const videoId = isRecord(youtube) && nonEmptyString(youtube.url)
    ? parseYouTubeVideoId(youtube.url)
    : null
  if (!videoId) issues.push('youtube.url must be a valid YouTube video or Shorts link.')

  song.cues.forEach((cue, cueIndex) => {
    if (!cue.romanization) issues.push(`cues[${cueIndex}].romanization is required.`)
    if (!cue.tokens?.length) {
      issues.push(`cues[${cueIndex}].tokens must contain authored word groups.`)
      return
    }
    const groupedText = cue.tokens.map((token) => token.text).join('').replaceAll(/\s/g, '')
    if (groupedText !== cue.sourceText.replaceAll(/\s/g, '')) {
      issues.push(`cues[${cueIndex}].tokens must reproduce the complete Chinese lyric.`)
    }
    cue.tokens.forEach((token, tokenIndex) => {
      if (!token.romanization) {
        issues.push(`cues[${cueIndex}].tokens[${tokenIndex}].romanization is required.`)
      }
      const localizedGloss = token.glosses?.[song.translationLocale]
        ?? token.glosses?.en
      if (!nonEmptyString(localizedGloss)) {
        issues.push(`cues[${cueIndex}].tokens[${tokenIndex}] needs an English gloss.`)
      }
    })
  })

  if (issues.length > 0 || !videoId) throw new SongValidationError(issues)
  const thumbnailUrl = youtubeThumbnailUrl(videoId)
  return {
    ...song,
    artworkUrl: thumbnailUrl,
    youtube: {
      videoId,
      url: youtubeWatchUrl(videoId),
      thumbnailUrl,
    },
  }
}
