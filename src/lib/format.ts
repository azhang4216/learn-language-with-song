export const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainder = wholeSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export const localeName = (locale: string): string => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? locale
  } catch {
    return locale
  }
}
