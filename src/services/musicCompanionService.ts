import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import { NATIVE_APP_TEXT_ONLY_RULE, sanitizeNativeAppText } from './appPresentationPolicy'
import type { ChatTurn } from './ai/provider'
import type { Character } from '../types/domain'

/**
 * 🎵 一起听 —— 音乐陪伴。
 *
 * 播放来源：网易云已把“免登录站内播放”全部焊死（官方外链 iframe 半下线、直链 mp3 接口
 * 一律 404、点播/搜索 API 强制登录）。因此这里**不做站内播放**：网易云链接只用来
 * 解析出歌曲元数据（歌名/歌手/网易云 id）+ 给一个「去网易云听」跳转真实播放页的地址，
 * 由用户在自己登录过的网易云网页/App 里播放。
 *
 * 陪伴：选一位好友，TA 用人设口吻和你聊当前这首歌（不依赖真的在页面上出声）。
 *
 * 纯函数部分（解析链接 / 构建消息）单独导出便于单测；联网部分抛
 * MusicAiUnconfiguredError（没配好 AI）或 provider 的既有错误。
 */

/** 角色陪伴聊歌用的画像：prompt 构建只依赖这些字段。 */
export interface MusicCharacterProfile {
  name: string
  persona?: string
  speakingStyle?: string
  relationship?: string
  mood?: string
  activity?: string
  likes?: string[]
  dislikes?: string[]
  identity?: string
  age?: number
}

export class MusicAiUnconfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MusicAiUnconfiguredError'
  }
}

export const MUSIC_MAX_TALK_CHARS = 300
export const MUSIC_HISTORY_TURNS = 16

export function musicProfileFromCharacter(
  character: Character
): MusicCharacterProfile {
  return {
    name: character.name,
    persona: character.persona,
    speakingStyle: character.speakingStyle,
    relationship: character.relationship,
    mood: character.mood,
    activity: character.activity,
    likes: character.likes,
    dislikes: character.dislikes,
    identity: character.identity,
    age: character.age
  }
}

function describeCharacter(profile: MusicCharacterProfile): string {
  const lines: string[] = [`名字：${profile.name || '（无名角色）'}`]
  if (profile.age !== undefined) lines.push(`年龄：${profile.age}`)
  if (profile.identity) lines.push(`身份：${profile.identity}`)
  if (profile.persona) lines.push(`性格与设定：${profile.persona}`)
  if (profile.speakingStyle) lines.push(`说话风格：${profile.speakingStyle}`)
  if (profile.relationship) lines.push(`与“我”的关系：${profile.relationship}`)
  if (profile.mood) lines.push(`此刻心情：${profile.mood}`)
  if (profile.activity) lines.push(`此刻在做什么：${profile.activity}`)
  if (profile.likes?.length) lines.push(`喜欢：${profile.likes.join('、')}`)
  if (profile.dislikes?.length) lines.push(`不喜欢：${profile.dislikes.join('、')}`)
  return lines.join('\n')
}

function buildMusicSystem(
  profile: MusicCharacterProfile,
  songLabel: string
): string {
  return [
    '你正在玩一款“陪伴世界”小手机 App，正和「我」一起听歌（网易云外链播放器，本机边播边聊）。',
    `现在播放：${songLabel}`,
    `你的人设：\n${describeCharacter(profile)}`,
    '聊天要求：',
    '1. 始终以这个人设第一人称说话，像朋友陪着听歌那样自然。',
    '2. 就着这首歌聊：可以聊喜不喜欢、哪一句戳中、让你想起什么，也可以好奇地反问我。听不到具体音频没关系，凭歌名和我聊的内容接话，别硬编歌词。',
    '3. 每条回复 1～3 句，别写小作文；可带一点口语或 emoji，但别堆砌；不要出现“一起听/陪伴/助手”这类介绍词。',
    `4. ${NATIVE_APP_TEXT_ONLY_RULE}`
  ].join('\n')
}

/** 自动开场：好友听到这首歌的第一句反应。纯函数。 */
export function buildMusicGreetingMessages(
  profile: MusicCharacterProfile,
  songLabel: string
): ChatTurn[] {
  return [
    { role: 'system', content: buildMusicSystem(profile, songLabel) },
    {
      role: 'user',
      content: '（歌开始放了。请以角色的口吻，对现在播放的这首歌说一句自然的开场，1~2 句。）'
    }
  ]
}

export interface MusicTalkTurn {
  role: 'user' | 'assistant'
  text: string
}

/** 我发一句话，好友接着聊。纯函数。 */
export function buildMusicReplyMessages(
  profile: MusicCharacterProfile,
  songLabel: string,
  history: MusicTalkTurn[],
  userText: string
): ChatTurn[] {
  const historyTurns: ChatTurn[] = history
    .slice(-MUSIC_HISTORY_TURNS)
    .map(turn => ({ role: turn.role, content: turn.text }))

  return [
    { role: 'system', content: buildMusicSystem(profile, songLabel) },
    ...historyTurns,
    { role: 'user', content: `「我」说：${userText}` }
  ]
}

/** 净化模型输出为可展示的话：去掉围栏/星号/外层引号，压平空白，限长。 */
export function sanitizeMusicText(raw: string): string {
  let text = sanitizeNativeAppText(raw, { singleLine: true })
  text = text
    .replace(/^[「『“‘“""''【（(]+/, '')
    .replace(/[」』””""''】）)]+$/, '')
  const flat = text.replace(/\s+/g, ' ')
  if (flat.length > MUSIC_MAX_TALK_CHARS) {
    const cut = flat.slice(0, MUSIC_MAX_TALK_CHARS)
    const match = cut.match(/.*[。！？!?…～~]/)
    return match && match[0].length > cut.length * 0.5 ? match[0] : cut.replace(/[，、；:,，\s]+$/, '')
  }
  return flat
}

// ---------------------------------------------------------------------------
// 链接解析：把网易云歌曲链接 / 分享文案 / 纯 id 解析成可嵌入的单曲。
// ---------------------------------------------------------------------------

export interface ParsedMusicLink {
  id: string
  title?: string
  artist?: string
}

/** 识别网易云歌曲 id（{id=} 或整串纯数字），并尽力捞标题与歌手。纯函数。 */
export function parseMusicLink(raw: string): ParsedMusicLink | null {
  const text = String(raw ?? '').trim()
  if (!text) return null

  let id = ''
  const urlId = text.match(/[?&]id=(\d{5,20})/i)
  if (urlId) {
    id = urlId[1]
  } else {
    const numberOnly = text.match(/^\d{5,20}$/)
    if (numberOnly) {
      id = numberOnly[0]
    } else {
      // 网易云客户端分享链接常见 /song/<id> 这类路径式 id。
      const pathSong = text.match(/(?:song|play)\/(\d{5,20})/i)
      if (pathSong) id = pathSong[1]
    }
  }
  if (!id) return null

  const result: ParsedMusicLink = { id }

  const titleMatch = text.match(/《([^《》]{1,80})》/)
  if (titleMatch) result.title = titleMatch[1].trim()

  const artistMatch = text.match(/分享(.{1,40}?)(?:的单曲|的歌曲)/)
  if (artistMatch) {
    const artist = artistMatch[1].trim()
    if (artist) result.artist = artist
  }
  if (!result.artist) {
    const dashArtist = text.match(/[—-]\s*([一-龥A-Za-z0-9·]{1,20})\s*$/)
    if (dashArtist) result.artist = dashArtist[1].trim()
  }

  return result
}

/** 网易云网页版播放页地址（真播放需在网易云登录，纯函数）。 */
export function neteaseOpenUrl(id: string): string {
  const safe = String(id ?? '').replace(/[^\d]/g, '')
  return `https://music.163.com/m/song?id=${safe}`
}

/** “现在播放”的展示名，也喂给聊歌 prompt。纯函数。 */
export function songDisplayLabel(parsed: ParsedMusicLink): string {
  const parts: string[] = []
  if (parsed.title) parts.push(`《${parsed.title}》`)
  if (parsed.artist) parts.push(parsed.artist)
  if (parts.length) return parts.join(' · ')
  return `网易云歌曲 ${parsed.id}`
}

// ---------------------------------------------------------------------------
// 联网部分
// ---------------------------------------------------------------------------

function clampTemperature(value: number): number {
  return Math.min(1.5, Math.max(0.5, value))
}

async function requireConfigured() {
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new MusicAiUnconfiguredError(
      '还没配好可用的 AI。请先到「设置 → API 与模型」填好 API 地址、Key 和模型，才能让好友陪你聊歌。'
    )
  }
  return settings
}

async function chatOnce(messages: ChatTurn[], temperature: number): Promise<string> {
  const settings = await requireConfigured()
  const provider = createProvider(settings)
  const response = await provider.chat({
    model: settings.model,
    temperature: clampTemperature(temperature ?? settings.temperature ?? 0.9),
    messages
  })
  return String(response?.text ?? '').trim()
}

/** 好友听到这首歌的第一句反应。 */
export async function musicCompanionGreeting(
  character: Character,
  songLabel: string
): Promise<string> {
  const profile = musicProfileFromCharacter(character)
  const raw = await chatOnce(buildMusicGreetingMessages(profile, songLabel), 0.9)
  return sanitizeMusicText(raw)
}

/** 我说一句，好友继续聊这首歌。history 由上层按 好友=assistant / 我=user 排好。 */
export async function musicCompanionReply(
  character: Character,
  songLabel: string,
  history: MusicTalkTurn[],
  userText: string
): Promise<string> {
  const profile = musicProfileFromCharacter(character)
  const raw = await chatOnce(
    buildMusicReplyMessages(profile, songLabel, history, userText),
    0.9
  )
  return sanitizeMusicText(raw)
}
