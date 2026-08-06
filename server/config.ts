import 'dotenv/config'

const required = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

export const config = {
  get databaseUrl() { return required('DATABASE_URL') },
  port: Number(process.env.PORT ?? 10000),
  frontendOrigins: (process.env.FRONTEND_ORIGINS ?? 'http://localhost:4173')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean),
  sessionDays: Math.max(1, Number(process.env.SESSION_DAYS ?? 30)),
  groqApiKey: process.env.GROQ_API_KEY?.trim() || null,
  groqMetadataModel: process.env.GROQ_METADATA_MODEL?.trim() || 'qwen/qwen3.6-27b',
  groqLyricsModel: process.env.GROQ_LYRICS_MODEL?.trim() || 'qwen/qwen3.6-27b',
  openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
  openAiMetadataModel: process.env.OPENAI_METADATA_MODEL?.trim() || 'gpt-5.6-luna',
  openAiLyricsModel: process.env.OPENAI_LYRICS_MODEL?.trim() || 'gpt-5.6-terra',
}
