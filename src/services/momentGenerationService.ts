import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import { normalizeMomentContent } from './momentService'
import { NATIVE_APP_TEXT_ONLY_RULE, sanitizeNativeAppText } from './appPresentationPolicy'
import type { ChatTurn } from './ai/provider'
import type { Character } from '../types/domain'

/** 生成动态正文的目标长度（字）。微信朋友圈正文观感紧凑。 */
export const MOMENT_POST_MAX_CHARS = 140
export const MOMENT_COMMENT_MAX_CHARS = 120

/** 角色人设画像：prompt 构建只依赖这些字段，测试可直接给字面量。 */
export interface MomentCharacterProfile {
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

/** 未配置可用 AI 时抛出的错误：朋友圈页据此提示去“API 与模型”补配置。 */
export class MomentAiUnconfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MomentAiUnconfiguredError'
  }
}

export function momentProfileFromCharacter(
  character: Character
): MomentCharacterProfile {
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

function describeCharacter(profile: MomentCharacterProfile): string {
  const lines: string[] = []
  lines.push(`名字：${profile.name || '（无名角色）'}`)
  if (profile.age !== undefined) {
    lines.push(`年龄：${profile.age}`)
  }
  if (profile.identity) {
    lines.push(`身份：${profile.identity}`)
  }
  if (profile.persona) {
    lines.push(`性格与设定：${profile.persona}`)
  }
  if (profile.speakingStyle) {
    lines.push(`说话风格：${profile.speakingStyle}`)
  }
  if (profile.relationship) {
    lines.push(`与我的关系：${profile.relationship}`)
  }
  if (profile.mood) {
    lines.push(`此刻心情：${profile.mood}`)
  }
  if (profile.activity) {
    lines.push(`此刻在做什么：${profile.activity}`)
  }
  if (profile.likes?.length) {
    lines.push(`喜欢：${profile.likes.join('、')}`)
  }
  if (profile.dislikes?.length) {
    lines.push(`不喜欢：${profile.dislikes.join('、')}`)
  }
  return lines.join('\n')
}

export const MOMENT_POST_SYSTEM_RULES = [
  '你是一个人在玩一款“陪伴世界”App，正在刷朋友圈（一个类似微信朋友圈的动态广场）。',
  '请扮演上面描述的角色，以 TA 的第一人称，发一条简短、真实、有人味的朋友圈动态。',
  '要求：',
  '1. 内容贴合角色此刻的心情、正在做的事和与“我”的关系，像真人随手发的动态，不要写成小作文。',
  '2. 一条只讲一件事或一种心情，40～100 字之间。',
  '3. 语言风格贴合角色性格；可以带一点点口语或 emoji，但别堆砌。',
  '4. 直接输出动态正文即可。不要加引号、括号备注、星号动作、@谁、日期或“TA 说”这类旁白。',
  `5. ${NATIVE_APP_TEXT_ONLY_RULE}`
].join('\n')

/**
 * 构建“角色发朋友圈”的 messages。纯函数，供单测覆盖。
 * @param contextLabel 可选时间语境，例如“周六晚上 10 点”，让动态更有当下感。
 */
export function buildCharacterPostMessages(
  profile: MomentCharacterProfile,
  contextLabel?: string,
  memoryHints?: string[]
): ChatTurn[] {
  const userLines = [
    `你是：\n${describeCharacter(profile)}`
  ]
  if (contextLabel?.trim()) {
    userLines.push(`现在是：${contextLabel.trim()}`)
  }
  if (memoryHints?.length) {
    userLines.push(`可参考的角色长期记忆（只使用与当前动态自然相关的内容，不要逐条复述）：\n${memoryHints.slice(0, 8).map(item => `- ${item}`).join('\n')}`)
  }
  userLines.push('请发一条朋友圈动态。')

  return [
    {
      role: 'system',
      content: MOMENT_POST_SYSTEM_RULES
    },
    {
      role: 'user',
      content: userLines.join('\n\n')
    }
  ]
}

/**
 * 构建“我评论了某角色动态、角色回评”的 messages。纯函数。
 * @param targetPost 被评论的那条动态原文。
 * @param myDisplayName “我”在朋友圈显示的名字。
 * @param myComment 我的评论原文。
 */
export function buildCharacterCommentMessages(
  profile: MomentCharacterProfile,
  targetPost: string,
  myDisplayName: string,
  myComment: string,
  memoryHints?: string[],
  replyContext?: { characterComment: string }
): ChatTurn[] {
  const rules = replyContext?.characterComment?.trim()
    ? [
        `你正在扮演上面描述的角色，在朋友圈的一条评论串里继续和「${myDisplayName}」说话。`,
        `动态正文：${targetPost}`,
        `你刚才的评论：${replyContext.characterComment.trim()}`,
        `「${myDisplayName}」回复你：${myComment}`,
        '',
        '请继续以角色口吻回复对方这句，像真实朋友圈评论区里的接话，不要重新评论整条动态。',
        `20～70 字。直接输出回复内容即可，不要加引号、括号、动作描述或“${profile.name}说”之类的旁白。`
      ].join('\n')
    : [
        `你正在扮演上面描述的角色，在朋友圈动态下看到「${myDisplayName}」给你的评论：`,
        `我的动态：${targetPost}`,
        `我的评论：${myComment}`,
        '',
        '请以角色的口吻回这条评论：像刷到熟人消息那样自然接话，贴合角色性格与你们的关系。',
        `20～70 字。直接输出回复内容即可，不要加引号、括号、动作描述或“${profile.name}说”之类的旁白，也不要回复我的动态原文本身。`
      ].join('\n')

  return [
    {
      role: 'system',
      content: MOMENT_POST_SYSTEM_RULES
    },
    {
      role: 'user',
      content: [
        `你是：\n${describeCharacter(profile)}`,
        rules,
        memoryHints?.length ? `角色长期记忆参考：\n${memoryHints.slice(0, 8).map(item => `- ${item}`).join('\n')}` : ''
      ].filter(Boolean).join('\n\n')
    }
  ]
}

/** 最大字数后截断并去掉剩余半句，优先在标点处断句。 */
export function truncateBySentence(
  value: string,
  max = MOMENT_POST_MAX_CHARS
): string {
  if (value.length <= max) {
    return value
  }

  const head = value.slice(0, max)
  const match = head.match(/.*[。！？!?…～~]/)
  if (match && match[0].length > max * 0.5) {
    return match[0]
  }
  return head.replace(/[，、；:,，\s]+$/, '')
}

/**
 * 净化模型输出为可入库的朋友圈正文：去掉代码围栏 / 尖括号旁白标记 / 外层引号 / markdown 装饰，
 * 折行与连续空白压平，再按最大字数限长。
 */
export function sanitizeMomentText(
  raw: string,
  max = MOMENT_POST_MAX_CHARS
): string {
  let text = sanitizeNativeAppText(raw)

  // 去掉包裹整段的外层引号（「」『』“”等）或括号旁白
  text = text.trim()
  text = text
    .replace(/^[「『“‘“""''【（(]+/, '')
    .replace(/[」』””""''】）)]+$/, '')

  const normalized = normalizeMomentContent(text, 4096)
  return truncateBySentence(normalized, max)
}

function clampTemperature(value: number): number {
  return Math.min(1.5, Math.max(0.5, value))
}

async function requireConfigured() {
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new MomentAiUnconfiguredError(
      '还没配好可用的 AI。请先到「设置 → API 与模型」填好 API 地址、Key 和模型，再来发朋友圈。'
    )
  }
  return settings
}

/**
 * 让角色发一条朋友圈动态。返回净化后的正文与所用模型名。
 * 未配置 AI / 配置错误会抛 MomentAiUnconfiguredError 或 provider 的既有错误。
 */
export async function generateCharacterPost(
  character: Character,
  options?: { contextLabel?: string; topicHint?: string; memoryHints?: string[] }
): Promise<{ text: string; model: string }> {
  const settings = await requireConfigured()
  const provider = createProvider(settings)
  const profile = momentProfileFromCharacter(character)

  const messages = buildCharacterPostMessages(profile, options?.contextLabel, options?.memoryHints)

  if (options?.topicHint?.trim()) {
    const last = messages[messages.length - 1]
    messages[messages.length - 1] = {
      ...last,
      content: `${last.content}\n\n如果实在没想好话题，可以从这个方向找灵感：${options.topicHint.trim()}`
    }
  }

  const response = await provider.chat({
    model: settings.model,
    temperature: clampTemperature(settings.temperature ?? 0.9),
    messages
  })

  const text = sanitizeMomentText(response.text, MOMENT_POST_MAX_CHARS)
  if (!text) {
    throw new Error('模型没有给出可用的动态内容，请再试一次。')
  }

  return { text, model: settings.model }
}

/**
 * 让我评论的某角色动态，由角色本人 AI 回评一条。
 */
export async function generateCharacterComment(
  character: Character,
  targetPost: string,
  myDisplayName: string,
  myComment: string,
  options?: { memoryHints?: string[]; replyToComment?: string }
): Promise<{ text: string; model: string }> {
  const settings = await requireConfigured()
  const provider = createProvider(settings)
  const profile = momentProfileFromCharacter(character)

  const messages = buildCharacterCommentMessages(
    profile,
    targetPost,
    myDisplayName,
    myComment,
    options?.memoryHints,
    options?.replyToComment ? { characterComment: options.replyToComment } : undefined
  )

  const response = await provider.chat({
    model: settings.model,
    temperature: clampTemperature(settings.temperature ?? 0.9),
    messages
  })

  const text = sanitizeMomentText(response.text, MOMENT_COMMENT_MAX_CHARS)
  if (!text) {
    throw new Error('模型没有给出可用的回复，请再试一次。')
  }

  return { text, model: settings.model }
}

/**
 * 构建“我发了一条朋友圈、角色刷到来评论”的 messages。纯函数。
 * @param userName “我”在朋友圈显示的名字。
 * @param userPost 我发的动态原文。
 */
export function buildCharacterReactToUserPostMessages(
  profile: MomentCharacterProfile,
  userName: string,
  userPost: string
): ChatTurn[] {
  const rules = [
    `你正在扮演上面描述的角色，正在朋友圈里刷到「${userName}」新发的一条动态：`,
    `${userName}的动态：${userPost}`,
    '',
    '请以角色的口吻评论这条动态：像刷到熟人的近况那样自然接话，贴合角色性格与你们的关系。',
    '10～60 字。直接输出评论内容即可，不要加引号、括号、动作描述或“XX说”之类的旁白。'
  ].join('\n')

  return [
    {
      role: 'system',
      content: MOMENT_POST_SYSTEM_RULES
    },
    {
      role: 'user',
      content: [
        `你是：\n${describeCharacter(profile)}`,
        rules
      ].join('\n\n')
    }
  ]
}

/**
 * 让我发的一条朋友圈，由某角色 AI 评论一条。返回净化后的评论与所用模型名。
 */
export async function generateCharacterReactionToUserPost(
  character: Character,
  userName: string,
  userPost: string
): Promise<{ text: string; model: string }> {
  const settings = await requireConfigured()
  const provider = createProvider(settings)
  const profile = momentProfileFromCharacter(character)

  const messages = buildCharacterReactToUserPostMessages(
    profile,
    userName,
    userPost
  )

  const response = await provider.chat({
    model: settings.model,
    temperature: clampTemperature(settings.temperature ?? 0.9),
    messages
  })

  const text = sanitizeMomentText(response.text, MOMENT_COMMENT_MAX_CHARS)
  if (!text) {
    throw new Error('模型没有给出可用的评论，请再试一次。')
  }

  return { text, model: settings.model }
}
