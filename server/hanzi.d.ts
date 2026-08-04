declare module 'hanzi' {
  interface DictionaryEntry {
    traditional: string
    simplified: string
    pinyin: string
    definition: string
  }

  interface HanziApi {
    start(): void
    segment(value: string): string[]
    definitionLookup(value: string, script?: 's' | 't'): DictionaryEntry[]
  }

  const hanzi: HanziApi
  export default hanzi
}
