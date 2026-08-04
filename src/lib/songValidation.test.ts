import { describe, expect, it } from 'vitest'
import { lanPianSong } from '../data/lanPianSong'
import { parseCatalogSongDraft, parseSongMetadata, SongValidationError } from './songValidation'

describe('song metadata validation', () => {
  it('accepts the curated version 1 song', () => {
    expect(parseCatalogSongDraft(structuredClone(lanPianSong)).cues).toHaveLength(46)
  })

  it('rejects unsupported schema versions with a useful issue', () => {
    const invalid = { ...structuredClone(lanPianSong), schemaVersion: 2 }
    expect(() => parseSongMetadata(invalid)).toThrow(SongValidationError)
    expect(() => parseSongMetadata(invalid)).toThrow('schemaVersion must be 1')
  })

  it('rejects token timing outside its parent cue', () => {
    const invalid = structuredClone(lanPianSong)
    invalid.cues[0]!.tokens![0]!.startMs = 0
    invalid.cues[0]!.tokens![0]!.endMs = 10
    expect(() => parseSongMetadata(invalid)).toThrow('timing must be ordered and contained')
  })

  it('rejects missing word group data from catalogue submissions', () => {
    const invalid = structuredClone(lanPianSong)
    invalid.cues[0]!.tokens = []
    expect(() => parseCatalogSongDraft(invalid)).toThrow('authored word groups')
  })

  it('normalizes a valid YouTube link and thumbnail', () => {
    const input = structuredClone(lanPianSong)
    input.youtube.url = 'https://youtu.be/n49Zi0fIGlA?t=10'
    const result = parseCatalogSongDraft(input)
    expect(result.youtube.url).toBe('https://www.youtube.com/watch?v=n49Zi0fIGlA')
    expect(result.youtube.thumbnailUrl).toBe('https://i.ytimg.com/vi/n49Zi0fIGlA/hqdefault.jpg')
  })
})
