import { useState, type FormEvent } from 'react'
import { publishCatalogSong } from '../lib/catalogApi'
import { SongValidationError } from '../lib/songValidation'
import { parseYouTubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from '../lib/youtubeUrl'
import type { CatalogSong, CatalogSongDraft } from '../types/catalog'
import type { TimingProject } from '../types/timing'
import { AlertIcon, CloseIcon, TimerIcon, UploadIcon, YouTubeIcon } from './Icons'
import { TimingStudio } from './TimingStudio'

const MAX_UPLOAD_BYTES = 256 * 1024

interface PreparedLines {
  chineseWords: string[][]
  pinyinWords: string[][]
  glossWords: string[][]
  translations: string[]
}

interface AddSongDialogProps {
  onClose: () => void
  onPublished: (song: CatalogSong) => void
}

const rows = (value: string): string[] => value
  .split(/\r?\n/)
  .map((row) => row.trim())
  .filter(Boolean)

const groupedRows = (value: string, separator: RegExp): string[][] =>
  rows(value).map((row) => row.split(separator).map((group) => group.trim()).filter(Boolean))

const prepareLines = (
  chinese: string,
  pinyin: string,
  glosses: string,
  english: string,
): PreparedLines => {
  const chineseWords = groupedRows(chinese, /\s+/)
  const pinyinWords = groupedRows(pinyin, /\s*\|\s*/)
  const glossWords = groupedRows(glosses, /\s*\|\s*/)
  const translations = rows(english)
  const issues: string[] = []

  if (chineseWords.length === 0) issues.push('Add at least one Chinese lyric line.')
  if (chineseWords.length > 500) issues.push('A lesson can contain at most 500 lyric lines.')
  if (pinyinWords.length !== chineseWords.length) issues.push('Pinyin must have one row for every Chinese row.')
  if (glossWords.length !== chineseWords.length) issues.push('Word meanings must have one row for every Chinese row.')
  if (translations.length !== chineseWords.length) issues.push('English must have one row for every Chinese row.')

  chineseWords.forEach((words, index) => {
    if (pinyinWords[index]?.length !== words.length) {
      issues.push(`Line ${index + 1}: the number of pinyin groups must match the ${words.length} Chinese word groups.`)
    }
    if (glossWords[index]?.length !== words.length) {
      issues.push(`Line ${index + 1}: the number of meaning groups must match the ${words.length} Chinese word groups.`)
    }
  })

  if (issues.length) throw new SongValidationError(issues)
  return { chineseWords, pinyinWords, glossWords, translations }
}

const errorMessages = (error: unknown): string[] => {
  if (error instanceof SongValidationError) return error.issues.slice(0, 8)
  return [error instanceof Error ? error.message : 'The song could not be prepared.']
}

export function AddSongDialog({ onClose, onPublished }: AddSongDialogProps) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [chinese, setChinese] = useState('')
  const [pinyin, setPinyin] = useState('')
  const [glosses, setGlosses] = useState('')
  const [english, setEnglish] = useState('')
  const [issues, setIssues] = useState<string[]>([])
  const [publishing, setPublishing] = useState(false)
  const [timingProject, setTimingProject] = useState<TimingProject | null>(null)
  const [preparedLines, setPreparedLines] = useState<PreparedLines | null>(null)

  const beginTiming = (event: FormEvent) => {
    event.preventDefault()
    try {
      const videoId = parseYouTubeVideoId(youtubeUrl)
      if (!title.trim()) throw new SongValidationError(['Song title is required.'])
      if (!artist.trim()) throw new SongValidationError(['Artist is required.'])
      if (!videoId) throw new SongValidationError(['Enter a valid youtube.com or youtu.be link.'])
      const prepared = prepareLines(chinese, pinyin, glosses, english)
      const project: TimingProject = {
        schemaVersion: 1,
        id: `community-${crypto.randomUUID()}`,
        sourceLocale: 'zh-Hans',
        script: 'simplified',
        track: {
          title: title.trim(),
          artist: artist.trim(),
          durationMs: 0,
          youtubeVideoId: videoId,
          youtubeUrl: youtubeWatchUrl(videoId),
        },
        lines: prepared.chineseWords.map((words) => words.join('')),
        romanizations: prepared.pinyinWords.map((words) => words.join(' ')),
      }
      setIssues([])
      setPreparedLines(prepared)
      setTimingProject(project)
    } catch (error) {
      setIssues(errorMessages(error))
    }
  }

  const publishTimedSong = async (boundariesMs: number[]) => {
    if (!timingProject || !preparedLines) return
    setPublishing(true)
    setIssues([])
    const videoId = timingProject.track.youtubeVideoId
    const draft: CatalogSongDraft = {
      schemaVersion: 1,
      id: timingProject.id,
      title: timingProject.track.title,
      artist: timingProject.track.artist,
      artworkUrl: youtubeThumbnailUrl(videoId),
      sourceLocale: 'zh-Hans',
      translationLocale: 'en',
      audio: { durationMs: boundariesMs.at(-1) },
      youtube: {
        videoId,
        url: youtubeWatchUrl(videoId),
        thumbnailUrl: youtubeThumbnailUrl(videoId),
      },
      cues: preparedLines.chineseWords.map((words, cueIndex) => ({
        id: `line-${String(cueIndex + 1).padStart(2, '0')}`,
        startMs: boundariesMs[cueIndex]!,
        endMs: boundariesMs[cueIndex + 1]!,
        sourceText: words.join(''),
        romanization: {
          system: 'pinyin',
          text: preparedLines.pinyinWords[cueIndex]!.join(' '),
        },
        translations: { natural: preparedLines.translations[cueIndex]! },
        tokens: words.map((word, tokenIndex) => ({
          id: `line-${String(cueIndex + 1).padStart(2, '0')}-token-${tokenIndex + 1}`,
          text: word,
          romanization: {
            system: 'pinyin',
            text: preparedLines.pinyinWords[cueIndex]![tokenIndex]!,
          },
          glosses: { en: preparedLines.glossWords[cueIndex]![tokenIndex]! },
        })),
      })),
    }

    try {
      const song = await publishCatalogSong(draft)
      onPublished(song)
    } catch (error) {
      setIssues(errorMessages(error))
      setTimingProject(null)
    } finally {
      setPublishing(false)
    }
  }

  const uploadPreparedSong = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setIssues(['Prepared song files must be smaller than 256 KB.'])
      return
    }
    setPublishing(true)
    setIssues([])
    try {
      const song = await publishCatalogSong(JSON.parse(await file.text()) as unknown)
      onPublished(song)
    } catch (error) {
      setIssues(errorMessages(error))
    } finally {
      setPublishing(false)
    }
  }

  if (timingProject) {
    return (
      <TimingStudio
        project={timingProject}
        onClose={() => setTimingProject(null)}
        onComplete={(boundaries) => { void publishTimedSong(boundaries) }}
      />
    )
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="add-song-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-song-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <span className="section-eyebrow">Community contribution</span>
            <h2 id="add-song-title">Add a YouTube song</h2>
            <p>Prepare word-level learning data, then sync each lyric entrance while listening.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close add song"><CloseIcon /></button>
        </header>

        <form className="song-composer" onSubmit={beginTiming}>
          <div className="composer-grid">
            <label><span>Song title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label><span>Artist</span><input value={artist} onChange={(event) => setArtist(event.target.value)} required /></label>
          </div>
          <label>
            <span>YouTube link</span>
            <span className="input-with-icon"><YouTubeIcon /><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required /></span>
          </label>

          <div className="composer-instructions">
            <strong>One matching row in every box</strong>
            <span>Separate cohesive Chinese words with spaces. Separate the matching pinyin and word meanings with <code>|</code>.</span>
          </div>

          <div className="composer-textareas">
            <label>
              <span>Chinese · grouped words</span>
              <textarea value={chinese} onChange={(event) => setChinese(event.target.value)} placeholder={'打开 电视 却 找不到 遥控\n找到 遥控 翻到 外卖 变冷'} required />
            </label>
            <label>
              <span>Pinyin · matching groups</span>
              <textarea value={pinyin} onChange={(event) => setPinyin(event.target.value)} placeholder={'dǎkāi | diànshì | què | zhǎo bu dào | yáokòng\nzhǎodào | yáokòng | fān dào | wàimài | biàn lěng'} required />
            </label>
            <label>
              <span>Word meanings · matching groups</span>
              <textarea value={glosses} onChange={(event) => setGlosses(event.target.value)} placeholder={'turn on | television | yet | cannot find | remote control\nfind | remote control | turn to | takeout | go cold'} required />
            </label>
            <label>
              <span>Natural English translation</span>
              <textarea value={english} onChange={(event) => setEnglish(event.target.value)} placeholder={"I turn on the TV but can't find the remote.\nI find the remote, then notice the takeout has gone cold."} required />
            </label>
          </div>

          {issues.length > 0 && (
            <div className="composer-errors" role="alert"><AlertIcon /><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>
          )}

          <button className="start-timing-button" type="submit" disabled={publishing}>
            <TimerIcon /> Start listening sync
          </button>
        </form>

        <div className="prepared-upload">
          <div><strong>Already have a complete Verse JSON?</strong><span>It will go through the same validation before publishing.</span></div>
          <label className="upload-json-button">
            <UploadIcon /> {publishing ? 'Checking…' : 'Upload JSON'}
            <input className="visually-hidden" type="file" accept="application/json,.json" disabled={publishing} onChange={(event) => void uploadPreparedSong(event.target.files?.[0])} />
          </label>
        </div>
      </section>
    </div>
  )
}
