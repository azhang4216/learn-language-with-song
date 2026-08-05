import { useState, type FormEvent } from 'react'
import {
  enrichChineseLyrics,
  getYouTubeSongMetadata,
  publishCatalogSong,
} from '../lib/catalogApi'
import { SongValidationError } from '../lib/songValidation'
import { parseYouTubeVideoId, youtubeThumbnailUrl, youtubeWatchUrl } from '../lib/youtubeUrl'
import type {
  CatalogSong,
  CatalogSongDraft,
  EnrichedLyricLine,
  LyricsEnrichment,
} from '../types/catalog'
import type { TimingProject } from '../types/timing'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  TimerIcon,
  UploadIcon,
  YouTubeIcon,
} from './Icons'
import { TimingStudio } from './TimingStudio'

const MAX_UPLOAD_BYTES = 256 * 1024
type ComposerStep = 'youtube' | 'details' | 'lyrics' | 'loading' | 'review'

interface AddSongDialogProps {
  onClose: () => void
  onPublished: (song: CatalogSong) => void
}

const errorMessages = (error: unknown): string[] => {
  if (error instanceof SongValidationError) return error.issues.slice(0, 8)
  return [error instanceof Error ? error.message : 'The song could not be prepared.']
}

const stepNumber = (step: ComposerStep): number => {
  if (step === 'youtube') return 1
  if (step === 'details') return 2
  if (step === 'lyrics' || step === 'loading') return 3
  return 4
}

export function AddSongDialog({ onClose, onPublished }: AddSongDialogProps) {
  const [step, setStep] = useState<ComposerStep>('youtube')
  const [projectId] = useState(() => `community-${crypto.randomUUID()}`)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [script, setScript] = useState<'simplified' | 'traditional'>('simplified')
  const [lyrics, setLyrics] = useState('')
  const [enrichment, setEnrichment] = useState<LyricsEnrichment | null>(null)
  const [issues, setIssues] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [timingProject, setTimingProject] = useState<TimingProject | null>(null)

  const continueFromYouTube = async (event: FormEvent) => {
    event.preventDefault()
    const parsedVideoId = parseYouTubeVideoId(youtubeUrl)
    if (!parsedVideoId) {
      setIssues(['Enter a valid youtube.com or youtu.be link.'])
      return
    }
    setWorking(true)
    setIssues([])
    setNotice('')
    setVideoId(parsedVideoId)
    try {
      const metadata = await getYouTubeSongMetadata(youtubeUrl)
      setTitle((current) => current || metadata.title)
      setArtist((current) => current || metadata.artist)
      setNotice(metadata.metadataSource === 'llm'
        ? 'AI interpreted the video title and channel. Please confirm both fields before continuing.'
        : 'We made a best guess from the video title and channel. Please confirm both fields before continuing.')
    } catch {
      setNotice('We could not extract the video details automatically. Add the title and artist below.')
    } finally {
      setWorking(false)
      setStep('details')
    }
  }

  const continueFromDetails = (event: FormEvent) => {
    event.preventDefault()
    const nextIssues: string[] = []
    if (!title.trim()) nextIssues.push('Song title is required.')
    if (!artist.trim()) nextIssues.push('Artist is required.')
    if (nextIssues.length) {
      setIssues(nextIssues)
      return
    }
    setIssues([])
    setStep('lyrics')
  }

  const generateLearningDraft = async (event: FormEvent) => {
    event.preventDefault()
    const rows = lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    if (!rows.length) {
      setIssues(['Paste at least one Chinese lyric line.'])
      return
    }
    if (rows.length > 500) {
      setIssues(['A lesson can contain at most 500 lyric lines.'])
      return
    }
    setIssues([])
    setStep('loading')
    try {
      setEnrichment(await enrichChineseLyrics(lyrics, script))
      setStep('review')
    } catch (error) {
      setIssues(errorMessages(error))
      setStep('lyrics')
    }
  }

  const updateLine = (lineIndex: number, update: (line: EnrichedLyricLine) => EnrichedLyricLine) => {
    setEnrichment((current) => current ? {
      ...current,
      lines: current.lines.map((line, index) => index === lineIndex ? update(line) : line),
    } : current)
  }

  const updateGroupedWords = (lineIndex: number, value: string) => {
    const words = value.split(/\s+/).map((word) => word.trim()).filter(Boolean)
    updateLine(lineIndex, (line) => ({
      ...line,
      sourceText: words.join(''),
      tokens: words.map((word, tokenIndex) => ({
        text: word,
        romanization: line.tokens[tokenIndex]?.romanization ?? '',
        gloss: line.tokens[tokenIndex]?.gloss ?? '',
      })),
    }))
  }

  const beginTiming = () => {
    if (!enrichment) return
    const nextIssues: string[] = []
    enrichment.lines.forEach((line, lineIndex) => {
      if (!line.tokens.length) nextIssues.push(`Line ${lineIndex + 1} needs at least one Chinese word group.`)
      if (line.tokens.some((token) => !token.text.trim())) nextIssues.push(`Line ${lineIndex + 1} has an empty Chinese word group.`)
      if (line.tokens.some((token) => !token.romanization.trim())) nextIssues.push(`Line ${lineIndex + 1} needs pinyin for every word.`)
      if (line.tokens.some((token) => !token.gloss.trim())) nextIssues.push(`Line ${lineIndex + 1} needs a meaning for every word.`)
      if (!line.translation.trim()) nextIssues.push(`Line ${lineIndex + 1} needs a natural English translation.`)
    })
    if (nextIssues.length) {
      setIssues(nextIssues.slice(0, 8))
      return
    }
    setIssues([])
    setTimingProject({
      schemaVersion: 1,
      id: projectId,
      sourceLocale: enrichment.sourceLocale,
      script,
      track: {
        title: title.trim(),
        artist: artist.trim(),
        durationMs: 0,
        youtubeVideoId: videoId,
        youtubeUrl: youtubeWatchUrl(videoId),
      },
      lines: enrichment.lines.map((line) => line.tokens.map((token) => token.text).join('')),
      romanizations: enrichment.lines.map((line) => line.tokens.map((token) => token.romanization).join(' ')),
    })
  }

  const publishTimedSong = async (boundariesMs: number[]) => {
    if (!timingProject || !enrichment) return
    setPublishing(true)
    setIssues([])
    const draft: CatalogSongDraft = {
      schemaVersion: 1,
      id: timingProject.id,
      title: timingProject.track.title,
      artist: timingProject.track.artist,
      artworkUrl: youtubeThumbnailUrl(videoId),
      sourceLocale: enrichment.sourceLocale,
      translationLocale: 'en',
      audio: { durationMs: boundariesMs.at(-1) },
      youtube: {
        videoId,
        url: youtubeWatchUrl(videoId),
        thumbnailUrl: youtubeThumbnailUrl(videoId),
      },
      cues: enrichment.lines.map((line, cueIndex) => ({
        id: `line-${String(cueIndex + 1).padStart(2, '0')}`,
        startMs: boundariesMs[cueIndex]!,
        endMs: boundariesMs[cueIndex + 1]!,
        sourceText: line.tokens.map((token) => token.text).join(''),
        romanization: {
          system: 'pinyin',
          text: line.tokens.map((token) => token.romanization).join(' '),
        },
        translations: { natural: line.translation.trim() },
        tokens: line.tokens.map((token, tokenIndex) => ({
          id: `line-${String(cueIndex + 1).padStart(2, '0')}-token-${tokenIndex + 1}`,
          text: token.text.trim(),
          romanization: { system: 'pinyin', text: token.romanization.trim() },
          glosses: { en: token.gloss.trim() },
        })),
      })),
    }

    try {
      onPublished(await publishCatalogSong(draft))
    } catch (error) {
      setIssues(errorMessages(error))
      setTimingProject(null)
      setStep('review')
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
      onPublished(await publishCatalogSong(JSON.parse(await file.text()) as unknown))
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
        backLabel="Back to lyric review"
        onClose={() => {
          setTimingProject(null)
          setStep('review')
        }}
        onComplete={(boundaries) => { void publishTimedSong(boundaries) }}
      />
    )
  }

  const currentStep = stepNumber(step)

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
            <p>We will prepare the language data for review before you synchronize it to the recording.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close add song"><CloseIcon /></button>
        </header>

        <ol className="composer-stepper" aria-label="Song contribution progress">
          {['YouTube', 'Details', 'Lyrics', 'Review', 'Sync'].map((label, index) => (
            <li className={index + 1 === currentStep ? 'active' : index + 1 < currentStep ? 'complete' : ''} key={label}>
              <span>{index + 1 < currentStep ? <CheckIcon /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        {step === 'youtube' && (
          <form className="song-composer composer-single-step" onSubmit={(event) => void continueFromYouTube(event)}>
            <div className="composer-step-heading">
              <span>Step 1</span>
              <h3>Start with the YouTube link</h3>
              <p>We’ll use the video to suggest the song title and artist on the next page.</p>
            </div>
            <label>
              <span>YouTube link</span>
              <span className="input-with-icon"><YouTubeIcon /><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" required /></span>
            </label>
            {issues.length > 0 && <ComposerErrors issues={issues} />}
            <div className="composer-actions"><span /><button className="start-timing-button" type="submit" disabled={working}>{working ? 'Reading video…' : 'Next: song details'}</button></div>
          </form>
        )}

        {step === 'details' && (
          <form className="song-composer composer-single-step" onSubmit={continueFromDetails}>
            <div className="composer-step-heading">
              <span>Step 2</span>
              <h3>Check the song details</h3>
              <p>These were interpreted from the video title and channel. Edit either field before continuing.</p>
            </div>
            {notice && <div className="composer-notice">{notice}</div>}
            <div className="composer-grid">
              <label><span>Song title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
              <label><span>Artist</span><input value={artist} onChange={(event) => setArtist(event.target.value)} required /></label>
            </div>
            {issues.length > 0 && <ComposerErrors issues={issues} />}
            <div className="composer-actions">
              <button className="composer-back" type="button" onClick={() => setStep('youtube')}><ArrowLeftIcon /> Back</button>
              <button className="start-timing-button" type="submit">Next: paste lyrics</button>
            </div>
          </form>
        )}

        {step === 'lyrics' && (
          <form className="song-composer composer-single-step" onSubmit={(event) => void generateLearningDraft(event)}>
            <div className="composer-step-heading">
              <span>Step 3</span>
              <h3>Paste the Chinese lyrics</h3>
              <p>Keep one sung line per row. You do not need to add spaces or group the words—we’ll do that next.</p>
            </div>
            <fieldset className="script-choice">
              <legend>Chinese script</legend>
              <label className={script === 'simplified' ? 'selected' : ''}><input type="radio" name="script" value="simplified" checked={script === 'simplified'} onChange={() => setScript('simplified')} /> Simplified Chinese</label>
              <label className={script === 'traditional' ? 'selected' : ''}><input type="radio" name="script" value="traditional" checked={script === 'traditional'} onChange={() => setScript('traditional')} /> Traditional Chinese</label>
            </fieldset>
            <label>
              <span>Chinese lyrics · one line per row</span>
              <textarea className="raw-lyrics-input" value={lyrics} onChange={(event) => setLyrics(event.target.value)} placeholder={'打開電視卻找不到遙控\n找到遙控翻到外賣變冷'} required />
            </label>
            {issues.length > 0 && <ComposerErrors issues={issues} />}
            <div className="composer-actions">
              <button className="composer-back" type="button" onClick={() => setStep('details')}><ArrowLeftIcon /> Back</button>
              <button className="start-timing-button" type="submit">Generate learning draft</button>
            </div>
          </form>
        )}

        {step === 'loading' && (
          <div className="enrichment-loading" role="status" aria-live="polite">
            <span className="loading-orbit"><i /><i /><i /></span>
            <h3>Preparing the learning view</h3>
            <p>Grouping Chinese words and drafting pinyin, word meanings, and line translations…</p>
          </div>
        )}

        {step === 'review' && enrichment && (
          <div className="enrichment-review">
            <div className="composer-step-heading">
              <span>Step 4</span>
              <h3>Review the generated language data</h3>
              <p>Everything below is editable. Check the word grouping, pinyin, meanings, and natural translation before synchronizing.</p>
            </div>
            <div className="enrichment-review-note"><CheckIcon /> Dictionary-generated first draft · changes are saved while this window is open</div>
            <div className="enrichment-lines">
              {enrichment.lines.map((line, lineIndex) => (
                <article className="enrichment-line" key={`line-${lineIndex}`}>
                  <div className="enrichment-line-heading"><span>{String(lineIndex + 1).padStart(2, '0')}</span><strong>Lyric line</strong></div>
                  <label className="grouped-words-field">
                    <span>Chinese word groups · separate groups with spaces</span>
                    <input
                      value={line.tokens.map((token) => token.text).join(' ')}
                      onChange={(event) => updateGroupedWords(lineIndex, event.target.value)}
                      aria-label={`Line ${lineIndex + 1} grouped Chinese words`}
                    />
                  </label>
                  <div className="enrichment-token-list">
                    {line.tokens.map((token, tokenIndex) => (
                      <div className="enrichment-token" key={`${lineIndex}-${tokenIndex}`}>
                        <input
                          className="token-pinyin"
                          value={token.romanization}
                          onChange={(event) => updateLine(lineIndex, (currentLine) => ({
                            ...currentLine,
                            tokens: currentLine.tokens.map((currentToken, index) => index === tokenIndex
                              ? { ...currentToken, romanization: event.target.value }
                              : currentToken),
                          }))}
                          aria-label={`Line ${lineIndex + 1} word ${tokenIndex + 1} pinyin`}
                        />
                        <input
                          className="token-chinese"
                          value={token.text}
                          onChange={(event) => updateLine(lineIndex, (currentLine) => ({
                            ...currentLine,
                            sourceText: currentLine.tokens.map((currentToken, index) => index === tokenIndex ? event.target.value : currentToken.text).join(''),
                            tokens: currentLine.tokens.map((currentToken, index) => index === tokenIndex
                              ? { ...currentToken, text: event.target.value }
                              : currentToken),
                          }))}
                          aria-label={`Line ${lineIndex + 1} word ${tokenIndex + 1} Chinese`}
                        />
                        <input
                          className="token-gloss"
                          value={token.gloss}
                          onChange={(event) => updateLine(lineIndex, (currentLine) => ({
                            ...currentLine,
                            tokens: currentLine.tokens.map((currentToken, index) => index === tokenIndex
                              ? { ...currentToken, gloss: event.target.value }
                              : currentToken),
                          }))}
                          aria-label={`Line ${lineIndex + 1} word ${tokenIndex + 1} meaning`}
                        />
                      </div>
                    ))}
                  </div>
                  <label className="natural-translation-field">
                    <span>Natural English translation</span>
                    <input
                      value={line.translation}
                      onChange={(event) => updateLine(lineIndex, (currentLine) => ({ ...currentLine, translation: event.target.value }))}
                      aria-label={`Line ${lineIndex + 1} natural English translation`}
                    />
                  </label>
                </article>
              ))}
            </div>
            {issues.length > 0 && <ComposerErrors issues={issues} />}
            <div className="composer-actions review-actions">
              <button className="composer-back" type="button" onClick={() => setStep('lyrics')}><ArrowLeftIcon /> Back to lyrics</button>
              <button className="start-timing-button" type="button" onClick={beginTiming}><TimerIcon /> Save & start listening sync</button>
            </div>
          </div>
        )}

        {step === 'youtube' && (
          <div className="prepared-upload">
            <div><strong>Already have a complete Verse JSON?</strong><span>It will go through the same validation before publishing.</span></div>
            <label className="upload-json-button">
              <UploadIcon /> {publishing ? 'Checking…' : 'Upload JSON'}
              <input className="visually-hidden" type="file" accept="application/json,.json" disabled={publishing} onChange={(event) => void uploadPreparedSong(event.target.files?.[0])} />
            </label>
          </div>
        )}
      </section>
    </div>
  )
}

function ComposerErrors({ issues }: { issues: string[] }) {
  return (
    <div className="composer-errors" role="alert"><AlertIcon /><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>
  )
}
