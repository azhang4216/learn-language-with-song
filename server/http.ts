export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export const assertString = (
  value: unknown,
  name: string,
  maxLength = 10_000,
): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${name} is required.`)
  }
  const result = value.trim()
  if (result.length > maxLength) throw new HttpError(400, `${name} is too long.`)
  return result
}
