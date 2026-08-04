import { describe, expect, it } from 'vitest'
import type { LyricCue } from '../types/song'
import { findActiveCueIndex, findActiveTokenId, getTokenSeekTime } from './timing'

const cues: LyricCue[] = [
  {
    id: 'line-1',
    startMs: 1_000,
    endMs: 5_000,
    sourceText: '打开电视',
    translations: { natural: 'Turn on the television.' },
    tokens: [
      { id: 'line-1-token-1', text: '打开', startMs: 1_000, endMs: 2_500 },
      { id: 'line-1-token-2', text: '电视', startMs: 2_500, endMs: 5_000 },
    ],
  },
  {
    id: 'line-2',
    startMs: 8_000,
    endMs: 12_000,
    sourceText: '找不到遥控',
    translations: { natural: "Can't find the remote." },
  },
]

describe('timing helpers', () => {
  it('finds a cue only inside its authored timing window', () => {
    expect(findActiveCueIndex(cues, 1_500)).toBe(0)
    expect(findActiveCueIndex(cues, 7_700)).toBe(-1)
    expect(findActiveCueIndex(cues, 9_000)).toBe(1)
  })

  it('uses authored token boundaries for word highlighting', () => {
    expect(findActiveTokenId(cues[0], 2_500)).toBe('line-1-token-2')
    expect(findActiveTokenId(cues[0], 7_000)).toBeNull()
  })

  it('falls back to the parent cue when a token has no timing', () => {
    const cue = cues[0]!
    expect(getTokenSeekTime(cue, { id: 'untimed', text: '风' })).toBe(cue.startMs)
  })
})
