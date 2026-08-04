import { lanPianSong } from '../data/lanPianSong'
import type {
  CatalogFilters,
  CatalogSong,
  CatalogSongDraft,
  LikeResult,
  LyricsEnrichment,
  YouTubeSongMetadata,
} from '../types/catalog'
import { apiRequest } from './apiClient'
import { parseCatalogSongDraft } from './songValidation'

const filterFallback = (filters: CatalogFilters): CatalogSong[] => {
  const query = filters.query?.trim().toLocaleLowerCase() ?? ''
  if (filters.ownerId || filters.likedBy) return []
  return !query || `${lanPianSong.title} ${lanPianSong.artist ?? ''}`.toLocaleLowerCase().includes(query)
    ? [lanPianSong]
    : []
}

export const listCatalogSongs = async (filters: CatalogFilters = {}): Promise<CatalogSong[]> => {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.ownerId) params.set('owner', filters.ownerId)
  if (filters.likedBy) params.set('likedBy', filters.likedBy)
  try {
    const result = await apiRequest<{ songs: CatalogSong[] }>(
      `/songs${params.size ? `?${params}` : ''}`,
    )
    return result.songs.length ? result.songs : filterFallback(filters)
  } catch {
    return filterFallback(filters)
  }
}

export const publishCatalogSong = async (draftValue: unknown): Promise<CatalogSong> => {
  const draft: CatalogSongDraft = parseCatalogSongDraft(draftValue)
  const result = await apiRequest<{ song: CatalogSong }>('/songs', {
    method: 'POST',
    body: JSON.stringify(draft),
  })
  return result.song
}

export const setCatalogLike = async (songId: string, liked: boolean): Promise<LikeResult> =>
  apiRequest<LikeResult>(`/songs/${encodeURIComponent(songId)}/like`, {
    method: liked ? 'PUT' : 'DELETE',
  })

export const getYouTubeSongMetadata = (youtubeUrl: string): Promise<YouTubeSongMetadata> =>
  apiRequest<YouTubeSongMetadata>('/song-tools/youtube-metadata', {
    method: 'POST',
    body: JSON.stringify({ youtubeUrl }),
  })

export const enrichChineseLyrics = (
  lyrics: string,
  script: 'simplified' | 'traditional',
): Promise<LyricsEnrichment> =>
  apiRequest<LyricsEnrichment>('/song-tools/enrich-lyrics', {
    method: 'POST',
    body: JSON.stringify({ lyrics, script }),
  })
