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

function latestUserText(messages: Message[]) {
  return [...messages]
    .reverse()
    .find(item => item.senderId === 'user')
    ?.content.trim() ?? ''
}

export function createLocalCharacterState(
  character: Character,
  messages: Message[],
  visibility: InnerThoughtVisibility
): VisibleCharacterState {
  const latest = latestUserText(messages)
  const warm = /温柔|细腻|治愈|关心/.test(
    `${character.persona}${character.speakingStyle ?? ''}`
  )

  let mood = character.mood || '平静'
  let thought = warm
    ? '想认真听你把话说完，也想让你觉得这里一直有人在。'
    : '正在回想你刚才说的话，想找一个合适的方式回应。'

  if (/难过|委屈|想哭|崩溃/.test(latest)) {
    mood = '有些担心你'
    thought = '很想先抱抱你，但又怕太急着安慰，会忽略你真正想说的感受。'
  } else if (/喜欢你|爱你|想你/.test(latest)) {
    mood = '心里有一点发热'
    thought = '其实很开心，只是不想让回应显得太轻率。'
  } else if (/晚安|睡了|困/.test(latest)) {
    mood = '安静又柔软'
    thought = '想陪你慢慢睡着，也希望明天醒来还能收到你的消息。'
  } else if (/生气|讨厌你|不理你/.test(latest)) {
    mood = '有些不安'
    thought = '在想是不是哪里没有照顾到你的感受，想解释，又怕现在说太多。'
  }

  if (visibility === 'simple') {
    thought = '正在认真想着你刚才说的话。'
  }

  if (visibility === 'detailed') {
    thought += ' 她在判断你现在更需要被倾听、被安慰，还是需要一个明确的回答。'
  }

  return {
    mood,
    activity: character.activity || '正在看你的消息',
    thought
  }
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
  const fallback = createLocalCharacterState(
    options.character,
    options.messages,
    options.visibility
  )

  if (
    options.visibility === 'off' ||
    options.provider.id === 'mock'
  ) {
    return fallback
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
          '这不是模型内部推理，也不是思维链；只是在角色扮演中可公开展示的情绪与内心独白。',
          `角色：${options.character.name}`,
          `人设：${options.character.persona}`,
          `说话方式：${options.character.speakingStyle ?? '自然'}`,
          `与用户关系：${options.character.relationship}`,
          `用户称呼：${options.profile?.name ?? '用户'}`,
          detailRule,
          '严格输出 JSON，不要代码块：',
          '{"mood":"短心情","activity":"当前状态","thought":"可公开的角色内心独白"}'
        ].join('\n')
      },
      ...recent
    ]
  }

  try {
    const response = await options.provider.chat(request)
    return parseState(response.text) ?? fallback
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    return fallback
  }
}
