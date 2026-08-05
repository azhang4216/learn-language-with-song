import { describe, expect, it, vi } from 'vitest'
import {
  inferYouTubeMetadata,
  inferYouTubeMetadataHeuristically,
} from './songMetadata'

describe('YouTube song metadata inference', () => {
  it('prefers original-language Artist《Title》 metadata over translated descriptors', () => {
    expect(inferYouTubeMetadataHeuristically(
      '利比《跳楼机》(官方歌词MV)｜LBI - Jumping Machine (Official Lyric Video)',
      'LBI利比',
    )).toEqual({
      title: '跳楼机',
      artist: 'LBI利比',
      source: 'heuristic',
    })
  })

  it('uses the common Artist - Title shape when it matches no quoted release pattern', () => {
    expect(inferYouTubeMetadataHeuristically(
      'LBI利比 - 烂片剧情 (Official Lyric Video)',
      'LBI利比 - Topic',
    )).toMatchObject({ title: '烂片剧情', artist: 'LBI利比' })
  })

  it('uses the structured model result when the OpenAI API is configured', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({
      output: [{
        content: [{
          type: 'output_text',
          text: JSON.stringify({ title: '跳楼机', artist: 'LBI利比' }),
        }],
      }],
    }))
    await expect(inferYouTubeMetadata('raw title', 'raw channel', {
      apiKey: 'test-key',
      request: request as typeof fetch,
    })).resolves.toEqual({ title: '跳楼机', artist: 'LBI利比', source: 'llm' })
    expect(request).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({
      method: 'POST',
    }))
  })

  it('falls back without failing the upload when the model is unavailable', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    await expect(inferYouTubeMetadata('Artist - Song (Official Video)', 'Artist', {
      apiKey: 'test-key',
      request: request as typeof fetch,
    })).resolves.toMatchObject({ title: 'Song', artist: 'Artist', source: 'heuristic' })
  })
})
