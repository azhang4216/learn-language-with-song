import { lanPianTimingProject } from './lanPianTimingProject'
import type { CatalogSong } from '../types/catalog'
import type { LyricCue, LyricToken } from '../types/song'

interface TokenDefinition {
  text: string
  pinyin: string
  gloss: string
  partOfSpeech?: string
}

interface LineDefinition {
  tokens: TokenDefinition[]
  natural: string
}

const t = (
  text: string,
  pinyin: string,
  gloss: string,
  partOfSpeech?: string,
): TokenDefinition => ({ text, pinyin, gloss, partOfSpeech })

const lines: LineDefinition[] = [
  {
    tokens: [t('打开', 'dǎkāi', 'turn on', 'verb'), t('电视', 'diànshì', 'television', 'noun'), t('却', 'què', 'yet; but', 'adverb'), t('找不到', 'zhǎo bu dào', 'cannot find', 'verb'), t('遥控', 'yáokòng', 'remote control', 'noun')],
    natural: "I turn on the TV but can't find the remote.",
  },
  {
    tokens: [t('找到', 'zhǎodào', 'find', 'verb'), t('遥控', 'yáokòng', 'remote control', 'noun'), t('翻到', 'fān dào', 'turn to; flip to', 'verb'), t('外卖', 'wàimài', 'takeout', 'noun'), t('变冷', 'biàn lěng', 'go cold', 'verb')],
    natural: 'I find the remote, then notice the takeout has gone cold.',
  },
  {
    tokens: [t('我们', 'wǒmen', 'we; us', 'pronoun'), t('分开', 'fēnkāi', 'separate; break up', 'verb'), t('后', 'hòu', 'after', 'noun')],
    natural: 'After we broke up.',
  },
  {
    tokens: [t('这个', 'zhège', 'this', 'determiner'), t('家', 'jiā', 'home', 'noun'), t('好像', 'hǎoxiàng', 'seems as if', 'adverb'), t('我', 'wǒ', 'I; me', 'pronoun'), t('是', 'shì', 'be', 'verb'), t('客人', 'kèrén', 'guest', 'noun'), t('般', 'bān', 'like; as', 'particle'), t('陌生', 'mòshēng', 'unfamiliar', 'adjective')],
    natural: 'This home feels unfamiliar, as if I were a guest.',
  },
  {
    tokens: [t('夜里', 'yèlǐ', 'at night', 'noun'), t('有', 'yǒu', 'have; there is', 'verb'), t('一些', 'yìxiē', 'some; a little', 'quantifier'), t('冷', 'lěng', 'cold', 'adjective')],
    natural: 'The nights are a little cold.',
  },
  {
    tokens: [t('我', 'wǒ', 'I; me', 'pronoun'), t('把', 'bǎ', 'marks the object affected', 'particle'), t('房间', 'fángjiān', 'room', 'noun'), t('关上', 'guān shàng', 'shut; turn off', 'verb'), t('了', 'le', 'completed-action marker', 'particle'), t('灯', 'dēng', 'light; lamp', 'noun')],
    natural: 'I turn off the light in the room.',
  },
  {
    tokens: [t('那部', 'nà bù', 'that (for a film)', 'determiner'), t('电影', 'diànyǐng', 'movie', 'noun'), t('放映', 'fàngyìng', 'screen; show', 'verb'), t('到', 'dào', 'until; to', 'preposition'), t('最终', 'zuìzhōng', 'the very end', 'noun')],
    natural: 'That movie plays all the way to the end.',
  },
  {
    tokens: [t('却', 'què', 'yet; but', 'adverb'), t('没', 'méi', 'did not', 'adverb'), t('记住', 'jìzhù', 'remember', 'verb'), t('故事', 'gùshi', 'story', 'noun'), t('的', 'de', 'possessive marker', 'particle'), t('半点', 'bàn diǎn', 'the slightest bit', 'quantifier'), t('过程', 'guòchéng', 'course; process', 'noun')],
    natural: "Yet I don't remember any part of the story.",
  },
  {
    tokens: [t('其实', 'qíshí', 'actually', 'adverb'), t('我', 'wǒ', 'I; me', 'pronoun'), t('会', 'huì', 'will', 'auxiliary'), t('变成', 'biànchéng', 'become', 'verb'), t('什么', 'shénme', 'what', 'pronoun'), t('样子', 'yàngzi', 'state; appearance', 'noun'), t('你', 'nǐ', 'you', 'pronoun'), t('都', 'dōu', 'entirely; all', 'adverb'), t('清楚', 'qīngchu', 'know clearly', 'adjective')],
    natural: "You know exactly what I'll become.",
  },
  {
    tokens: [t('分开', 'fēnkāi', 'separate; break up', 'verb'), t('时', 'shí', 'when; at the time', 'noun'), t('你', 'nǐ', 'you', 'pronoun'), t('那些', 'nàxiē', 'those', 'determiner'), t('叮嘱', 'dīngzhǔ', 'earnest reminders', 'noun')],
    natural: 'The reminders you gave me when we parted.',
  },
  {
    tokens: [t('可', 'kě', 'but', 'conjunction'), t('我', 'wǒ', 'I; me', 'pronoun'), t('是否', 'shìfǒu', 'whether or not', 'adverb'), t('会', 'huì', 'will', 'auxiliary'), t('履行', 'lǚxíng', 'carry out; fulfill', 'verb'), t('你', 'nǐ', 'you', 'pronoun'), t('已', 'yǐ', 'already', 'adverb'), t('不', 'bù', 'not', 'adverb'), t('在乎', 'zàihu', 'care about', 'verb')],
    natural: 'But you no longer care whether I follow them.',
  },
  {
    tokens: [t('说白了', 'shuōbái le', 'to put it plainly', 'phrase'), t('删掉', 'shāndiào', 'delete', 'verb'), t('拉黑', 'lāhēi', 'block someone', 'verb'), t('也', 'yě', 'also', 'adverb'), t('有', 'yǒu', 'have', 'verb'), t('好处', 'hǎochu', 'benefit; advantage', 'noun')],
    natural: 'Honestly, deleting and blocking me has its advantages.',
  },
  {
    tokens: [t('至少', 'zhìshǎo', 'at least', 'adverb'), t('你', 'nǐ', 'you', 'pronoun'), t('不会', 'bú huì', 'will not', 'auxiliary'), t('听到', 'tīngdào', 'hear', 'verb'), t('我', 'wǒ', 'I; me', 'pronoun'), t('无理取闹', 'wúlǐqǔnào', 'make an unreasonable scene', 'idiom'), t('般', 'bān', 'like; as', 'particle'), t('的', 'de', 'descriptive marker', 'particle'), t('诉苦', 'sùkǔ', 'pour out complaints', 'verb')],
    natural: "At least you won't hear me complain like I'm making an unreasonable scene.",
  },
  {
    tokens: [t('不用', 'búyòng', 'need not', 'auxiliary'), t('再', 'zài', 'any longer; again', 'adverb'), t('承受', 'chéngshòu', 'endure', 'verb'), t('我', 'wǒ', 'my; me', 'pronoun'), t('不稳定', 'bù wěndìng', 'unstable', 'adjective'), t('的', 'de', 'descriptive marker', 'particle'), t('情绪', 'qíngxù', 'emotions', 'noun')],
    natural: 'You no longer have to endure my unstable emotions.',
  },
  {
    tokens: [t('腾出', 'téngchū', 'free up', 'verb'), t('更多', 'gèng duō', 'more', 'quantifier'), t('时间', 'shíjiān', 'time', 'noun'), t('去', 'qù', 'go and; to', 'verb'), t('做', 'zuò', 'do', 'verb'), t('你', 'nǐ', 'you', 'pronoun'), t('一直', 'yìzhí', 'all along', 'adverb'), t('想', 'xiǎng', 'want', 'verb'), t('做', 'zuò', 'do', 'verb'), t('的', 'de', 'nominalizing marker', 'particle')],
    natural: "Make more time to do what you've always wanted.",
  },
  {
    tokens: [t('做回', 'zuò huí', 'go back to being', 'verb'), t('那个', 'nàge', 'that', 'determiner'), t('自己', 'zìjǐ', 'yourself', 'pronoun')],
    natural: 'Be yourself again.',
  },
  {
    tokens: [t('然后', 'ránhòu', 'then', 'conjunction'), t('遇见', 'yùjiàn', 'meet; encounter', 'verb'), t('一段', 'yí duàn', 'a period; a relationship', 'quantifier'), t('更好', 'gèng hǎo', 'better', 'adjective'), t('的', 'de', 'descriptive marker', 'particle'), t('感情', 'gǎnqíng', 'relationship; love', 'noun')],
    natural: 'Then find a better relationship.',
  },
  {
    tokens: [t('而', 'ér', 'while; and', 'conjunction'), t('我', 'wǒ', 'I; me', 'pronoun'), t('是', 'shì', 'be', 'verb'), t('那段', 'nà duàn', 'that chapter', 'determiner'), t('不堪', 'bùkān', 'painful; unbearable', 'adjective'), t('回忆', 'huíyì', 'memory', 'noun')],
    natural: 'And I am that painful memory.',
  },
  {
    tokens: [t('他', 'tā', 'he; him', 'pronoun'), t('一定', 'yídìng', 'certainly', 'adverb'), t('更', 'gèng', 'even more', 'adverb'), t('疼', 'téng', 'cherish; dote on', 'verb'), t('你', 'nǐ', 'you', 'pronoun')],
    natural: "He'll surely cherish you more.",
  },
  {
    tokens: [t('是', 'shì', 'is', 'verb'), t('我', 'wǒ', 'I; me', 'pronoun'), t('自编自导', 'zìbiān-zìdǎo', 'write and direct oneself', 'idiom'), t('的', 'de', 'possessive marker', 'particle'), t('烂片', 'lànpiàn', 'bad movie', 'noun'), t('剧情', 'jùqíng', 'plot', 'noun')],
    natural: 'This lousy movie plot was written and directed by me.',
  },
  {
    tokens: [t('请到', 'qǐng dào', 'manage to invite', 'verb'), t('你', 'nǐ', 'you', 'pronoun'), t('这种', 'zhè zhǒng', 'this kind of', 'determiner'), t('顶流', 'dǐngliú', 'top star', 'noun'), t('主演', 'zhǔyǎn', 'lead actor', 'noun'), t('来', 'lái', 'come to', 'verb'), t('撑戏', 'chēng xì', 'carry the show', 'verb')],
    natural: 'Somehow I got a star like you to carry the show.',
  },
  {
    tokens: [t('不般配', 'bù bānpèi', 'mismatched', 'adjective'), t('的', 'de', 'descriptive marker', 'particle'), t('故事', 'gùshi', 'story', 'noun'), t('哪有', 'nǎ yǒu', 'how could there be', 'phrase'), t('观众', 'guānzhòng', 'audience', 'noun'), t('期待', 'qīdài', 'look forward to', 'verb'), t('续集', 'xùjí', 'sequel', 'noun')],
    natural: 'Who would wait for a sequel to a mismatched story?',
  },
  {
    tokens: [t('你', 'nǐ', 'you', 'pronoun'), t('却', 'què', 'yet; but', 'adverb'), t('那么', 'nàme', 'so; that much', 'adverb'), t('用心', 'yòngxīn', 'wholeheartedly', 'adverb'), t('陪', 'péi', 'accompany; stay with', 'verb'), t('我', 'wǒ', 'me', 'pronoun'), t('到', 'dào', 'until', 'preposition'), t('结局', 'jiéjú', 'ending', 'noun')],
    natural: 'Yet you gave it your all and stayed with me to the end.',
  },
  {
    tokens: [t('可', 'kě', 'but', 'conjunction'), t('我', 'wǒ', 'I; me', 'pronoun'), t('自导自演', 'zìdǎo-zìyǎn', 'direct and act oneself', 'idiom'), t('的', 'de', 'possessive marker', 'particle'), t('烂片', 'lànpiàn', 'bad movie', 'noun'), t('剧情', 'jùqíng', 'plot', 'noun')],
    natural: 'But this lousy movie is one I directed and acted in myself.',
  },
  {
    tokens: [t('怎', 'zěn', 'how', 'adverb'), t('配', 'pèi', 'be worthy of', 'verb'), t('你', 'nǐ', 'your; you', 'pronoun'), t('的', 'de', 'possessive marker', 'particle'), t('期待', 'qīdài', 'hopes; expectations', 'noun'), t('还', 'hái', 'still', 'adverb'), t('不舍得', 'bù shěde', "can't bear to", 'verb'), t('杀青', 'shāqīng', 'wrap filming; call cut', 'verb')],
    natural: "How could it deserve your hopes when I still can't bear to call cut?",
  },
  {
    tokens: [t('如今', 'rújīn', 'nowadays; now', 'adverb'), t('我', 'wǒ', 'I; me', 'pronoun'), t('只敢', 'zhǐ gǎn', 'only dare to', 'verb'), t('在', 'zài', 'in', 'preposition'), t('致谢', 'zhìxiè', 'acknowledgments', 'noun'), t('中', 'zhōng', 'within', 'noun'), t('写', 'xiě', 'write', 'verb'), t('你', 'nǐ', 'your; you', 'pronoun'), t('姓名', 'xìngmíng', 'full name', 'noun')],
    natural: 'Now I only dare write your name in the acknowledgments.',
  },
  {
    tokens: [t('纪念', 'jìniàn', 'commemorate; remember', 'verb'), t('那些', 'nàxiē', 'those', 'determiner'), t('曾经', 'céngjīng', 'what once was', 'noun')],
    natural: 'To remember what we once had.',
  },
]

const lineOrder = [
  ...lines.keys(),
  ...Array.from({ length: 19 }, (_, index) => index + 8),
]

const cueFromLine = (lineIndex: number, cueIndex: number): LyricCue => {
  const definition = lines[lineIndex]!
  const cueId = `line-${String(cueIndex + 1).padStart(2, '0')}`
  const tokens: LyricToken[] = definition.tokens.map((token, tokenIndex) => ({
    id: `${cueId}-token-${tokenIndex + 1}`,
    text: token.text,
    romanization: { system: 'pinyin', text: token.pinyin },
    glosses: { en: token.gloss },
    ...(token.partOfSpeech ? { partOfSpeech: token.partOfSpeech } : {}),
  }))

  return {
    id: cueId,
    startMs: lanPianTimingProject.defaultBoundariesMs![cueIndex]!,
    endMs: lanPianTimingProject.defaultBoundariesMs![cueIndex + 1]!,
    sourceText: tokens.map((token) => token.text).join(''),
    romanization: {
      system: 'pinyin',
      text: tokens.map((token) => token.romanization!.text).join(' '),
    },
    translations: { natural: definition.natural },
    tokens,
  }
}

const youtubeVideoId = lanPianTimingProject.track.youtubeVideoId

export const lanPianSong: CatalogSong = {
  schemaVersion: 1,
  id: lanPianTimingProject.id,
  title: lanPianTimingProject.track.title,
  artist: lanPianTimingProject.track.artist,
  artworkUrl: `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
  sourceLocale: 'zh-Hans',
  translationLocale: 'en',
  audio: { durationMs: lanPianTimingProject.track.durationMs },
  youtube: {
    url: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
    videoId: youtubeVideoId,
    thumbnailUrl: `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`,
  },
  cues: lineOrder.map(cueFromLine),
  ownerId: 'verse-curated',
  likeCount: 0,
  isLiked: false,
  createdAt: lanPianTimingProject.preparedTimingUpdatedAt!,
  updatedAt: lanPianTimingProject.preparedTimingUpdatedAt!,
}
