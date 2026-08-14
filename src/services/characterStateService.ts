import type {
  Character,
  InnerThoughtVisibility,
  Message,
  UserProfile
} from '../types/domain'
import type {
  ChatRequest,
  ModelProvider
} from './ai/provider'

export interface VisibleCharacterState {
  mood: string
  activity: string
  thought: string
}

function parseState(text: string): VisibleCharacterState | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      if (
        typeof parsed.mood === 'string' &&
        typeof parsed.activity === 'string' &&
        typeof parsed.thought === 'string'
      ) {
        return {
          mood: parsed.mood.trim().slice(0, 40),
          activity: parsed.activity.trim().slice(0, 60),
          thought: parsed.thought.trim().slice(0, 280)
        }
      }
    } catch {
      // 继续尝试按行解析。
    }
  }

  const mood = text.match(/心情[：:]\s*(.+)/)?.[1]?.trim()
  const activity = text.match(/状态[：:]\s*(.+)/)?.[1]?.trim()
  const thought = text.match(/(?:内心|想法)[：:]\s*([\s\S]+)/)?.[1]?.trim()

  if (mood && activity && thought) {
    return {
      mood: mood.slice(0, 40),
      activity: activity.slice(0, 60),
      thought: thought.slice(0, 280)
    }
  }

  return null
}

export async function generateVisibleCharacterState(options: {
  provider: ModelProvider
  model: string
  character: Character
  profile?: UserProfile
  messages: Message[]
  visibility: InnerThoughtVisibility
  signal?: AbortSignal
}): Promise<VisibleCharacterState> {
  if (options.visibility === 'off') {
    return { mood: '', activity: '', thought: '' }
  }

  const recent = options.messages
    .filter(item => item.type === 'text')
    .slice(-10)
    .map(item => ({
      role: item.senderId === 'user'
        ? ('user' as const)
        : ('assistant' as const),
      content: item.content
    }))

  const detailRule = options.visibility === 'simple'
    ? '想法只写一句非常简短的话。'
    : options.visibility === 'detailed'
      ? '想法可以细腻一些，但不要写分析步骤。'
      : '想法写一到两句自然的角色内心独白。'

  const request: ChatRequest = {
    model: options.model,
    temperature: 0.75,
    signal: options.signal,
    messages: [
      {
        role: 'system',
        content: [
          '你要生成“面向用户展示的虚构角色心理状态”。',
          '内容必须由角色卡与聊天上下文推导；没有依据的字段留空字符串，不要由应用默认值补全。',
          `角色：${options.character.name}`,
          options.character.persona ? `人设：${options.character.persona}` : '',
          options.character.speakingStyle ? `说话方式：${options.character.speakingStyle}` : '',
          options.character.relationship ? `原卡关系：${options.character.relationship}` : '',
          options.profile?.name ? `用户称呼：${options.profile.name}` : '',
          detailRule,
          '严格输出 JSON，不要代码块：',
          '{"mood":"","activity":"","thought":""}'
        ].filter(Boolean).join('\n')
      },
      ...recent
    ]
  }

  const response = await options.provider.chat(request)
  const parsed = parseState(response.text)
  if (!parsed) {
    throw new Error('AI 没有返回可解析的角色状态。本地不会补写心理或状态内容。')
  }
  return parsed
}
