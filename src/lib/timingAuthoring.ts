import type { ExportedTimingProject, SavedTimingDraft, TimingProject } from '../types/timing'

export const TIMING_STORAGE_PREFIX = 'verse.timing.'

export const getTimingStorageKey = (projectId: string): string =>
  `${TIMING_STORAGE_PREFIX}${projectId}`

export const appendBoundary = (
  boundariesMs: number[],
  timeMs: number,
  lineCount: number,
): number[] => {
  if (boundariesMs.length >= lineCount + 1) return boundariesMs
  const rounded = Math.max(0, Math.round(timeMs))
  const previous = boundariesMs.at(-1)
  if (previous !== undefined && rounded <= previous) return boundariesMs
  return [...boundariesMs, rounded]
}

export const adjustBoundary = (
  boundariesMs: number[],
  boundaryIndex: number,
  deltaMs: number,
): number[] => {
  const current = boundariesMs[boundaryIndex]
  if (current === undefined) return boundariesMs
  const lower = (boundariesMs[boundaryIndex - 1] ?? -1) + 1
  const upper = (boundariesMs[boundaryIndex + 1] ?? Number.MAX_SAFE_INTEGER) - 1
  const next = Math.min(upper, Math.max(lower, current + deltaMs))
  return boundariesMs.map((value, index) => index === boundaryIndex ? next : value)
}

export const readTimingDraft = (project: TimingProject): number[] => {
  try {
    const raw = localStorage.getItem(getTimingStorageKey(project.id))
    if (!raw) return [...(project.defaultBoundariesMs ?? [])]
    const parsed = JSON.parse(raw) as Partial<SavedTimingDraft>
    if (
      parsed.timingSchemaVersion !== 1 ||
      parsed.projectId !== project.id ||
      !Array.isArray(parsed.boundariesMs)
    ) return [...(project.defaultBoundariesMs ?? [])]

    const preparedAt = project.preparedTimingUpdatedAt
      ? Date.parse(project.preparedTimingUpdatedAt)
      : Number.NaN
    const draftAt = parsed.updatedAt ? Date.parse(parsed.updatedAt) : Number.NaN
    if (
      project.defaultBoundariesMs
      && Number.isFinite(preparedAt)
      && (!Number.isFinite(draftAt) || draftAt <= preparedAt)
    ) return [...project.defaultBoundariesMs]

    return parsed.boundariesMs
      .filter((value): value is number => Number.isFinite(value) && value >= 0)
      .slice(0, project.lines.length + 1)
      .reduce<number[]>((boundaries, value) => {
        const previous = boundaries.at(-1)
        if (previous === undefined || value > previous) boundaries.push(value)
        return boundaries
      }, [])
  } catch {
    return [...(project.defaultBoundariesMs ?? [])]
  }
}

export const saveTimingDraft = (project: TimingProject, boundariesMs: number[]): void => {
  const draft: SavedTimingDraft = {
    timingSchemaVersion: 1,
    projectId: project.id,
    updatedAt: new Date().toISOString(),
    boundariesMs,
  }
  localStorage.setItem(getTimingStorageKey(project.id), JSON.stringify(draft))
}

export const createTimingExport = (
  project: TimingProject,
  boundariesMs: number[],
): ExportedTimingProject => ({
  timingSchemaVersion: 1,
  projectId: project.id,
  updatedAt: new Date().toISOString(),
  boundariesMs,
  track: project.track,
  sourceLocale: project.sourceLocale,
  script: project.script,
  cues: project.lines.map((sourceText, index) => ({
    id: `line-${String(index + 1).padStart(2, '0')}`,
    sourceText,
    romanization: {
      system: 'pinyin',
      text: project.romanizations[index] ?? '',
    },
    ...(boundariesMs[index] !== undefined ? { startMs: boundariesMs[index] } : {}),
    ...(boundariesMs[index + 1] !== undefined ? { endMs: boundariesMs[index + 1] } : {}),
  })),
})
