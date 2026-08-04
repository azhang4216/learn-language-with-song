import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lanPianTimingProject } from '../data/lanPianTimingProject'
import {
  adjustBoundary,
  appendBoundary,
  createTimingExport,
  getTimingStorageKey,
  readTimingDraft,
  saveTimingDraft,
} from './timingAuthoring'

describe('one-pass lyric timing', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('records strictly increasing boundaries and stops after the final lyric end', () => {
    expect(appendBoundary([], 1500.4, 2)).toEqual([1500])
    expect(appendBoundary([1500], 1500.4, 2)).toEqual([1500])
    expect(appendBoundary([1500], 2900.8, 2)).toEqual([1500, 2901])
    expect(appendBoundary([1500, 2901, 4200], 6000, 2)).toEqual([1500, 2901, 4200])
  })

  it('nudges a boundary without crossing its neighbors', () => {
    expect(adjustBoundary([1000, 2000, 3000], 1, -1500)).toEqual([1000, 1001, 3000])
    expect(adjustBoundary([1000, 2000, 3000], 1, 1500)).toEqual([1000, 2999, 3000])
  })

  it('saves and restores the current pass locally', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00.000Z'))
    saveTimingDraft(lanPianTimingProject, [1020, 4780])

    expect(readTimingDraft(lanPianTimingProject)).toEqual([1020, 4780])
    expect(JSON.parse(localStorage.getItem(getTimingStorageKey(lanPianTimingProject.id))!))
      .toMatchObject({
        timingSchemaVersion: 1,
        projectId: lanPianTimingProject.id,
        updatedAt: '2026-08-05T12:00:00.000Z',
      })
    vi.useRealTimers()
  })

  it('loads the completed exported timing when no browser draft exists', () => {
    expect(readTimingDraft(lanPianTimingProject)).toEqual(lanPianTimingProject.defaultBoundariesMs)
    expect(readTimingDraft(lanPianTimingProject)).toHaveLength(47)
  })

  it('replaces an older browser draft with the completed export', () => {
    localStorage.setItem(getTimingStorageKey(lanPianTimingProject.id), JSON.stringify({
      timingSchemaVersion: 1,
      projectId: lanPianTimingProject.id,
      updatedAt: '2026-08-03T12:00:00.000Z',
      boundariesMs: [1_000, 2_000],
    }))

    expect(readTimingDraft(lanPianTimingProject)).toEqual(lanPianTimingProject.defaultBoundariesMs)
  })

  it('exports completed and partial cues from the same boundary list', () => {
    const exported = createTimingExport(lanPianTimingProject, [1000, 2400, 3900])

    expect(exported.track.youtubeVideoId).toBe('n49Zi0fIGlA')
    expect(exported.cues[0]?.romanization).toEqual({
      system: 'pinyin',
      text: 'Dǎkāi diànshì què zhǎo bú dào yáokòng',
    })
    expect(exported.cues[0]).toMatchObject({ startMs: 1000, endMs: 2400 })
    expect(exported.cues[1]).toMatchObject({ startMs: 2400, endMs: 3900 })
    expect(exported.cues[2]).not.toHaveProperty('endMs')
  })
})
