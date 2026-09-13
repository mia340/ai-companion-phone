import { getMessageImages } from '../../services/messageImageService'
import type { ChatRequest, ChatTurn } from '../../services/ai/provider'
import type {
  Character,
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  ProactiveSource,
  UserPersona
} from '../../types/domain'
import type { ModelSettings } from '../../types/modelSettings'

export interface GenerationRequestOptions {
  musicPrompt?: string
  type?: Message['type']
  sourceMessageId?: string
  visualMessageId?: string
  alternativeTargetId?: string
  memoryWriteNotice?: string
  proactivePrompt?: string
  proactiveSource?: ProactiveSource
}

export interface GenerationInputSnapshot {
  generationId: string
  createdAt: string
  conversation: Conversation
  character: Character
  settings: ChatSettings
  conversationState?: ConversationState
  messages: Message[]
  memories: CharacterMemory[]
  activePersona?: UserPersona
  modelSettings: ModelSettings
  options: GenerationRequestOptions
}

export interface GenerationRequestPair {
  withVision: ChatRequest
  withoutVision: ChatRequest
}

export function cloneGenerationMessage(message: Message): Message {
  return {
    ...message,
    images: message.images?.map(image => ({ ...image })),
    replyTo: message.replyTo ? { ...message.replyTo } : undefined,
    alternatives: message.alternatives?.slice(),
    roleCardUi: message.roleCardUi
      ? { ...message.roleCardUi, todos: message.roleCardUi.todos?.slice() }
      : undefined,
    regexApplied: message.regexApplied
      ? {
        storage: message.regexApplied.storage?.slice(),
        display: message.regexApplied.display?.slice()
      }
      : undefined
  }
}

export function cloneGenerationState(state?: ConversationState): ConversationState | undefined {
  if (!state) return undefined
  return {
    ...state,
    unresolvedTopics: state.unresolvedTopics?.slice(),
    pendingEvents: state.pendingEvents?.slice(),
    shortTermGoals: state.shortTermGoals?.slice(),
    lorebookRuntime: state.lorebookRuntime
      ? Object.fromEntries(Object.entries(state.lorebookRuntime).map(([key, value]) => [key, { ...value }]))
      : undefined
  }
}

export function createGenerationInputSnapshot(options: {
  generationId?: string
  now?: Date
  conversation: Conversation
  character: Character
  settings: ChatSettings
  conversationState?: ConversationState
  messages: Message[]
  memories: CharacterMemory[]
  activePersona?: UserPersona
  modelSettings: ModelSettings
  requestOptions?: GenerationRequestOptions
}): GenerationInputSnapshot {
  const now = options.now ?? new Date()
  return {
    generationId: options.generationId || crypto.randomUUID(),
    createdAt: now.toISOString(),
    conversation: {
      ...options.conversation,
      memberIds: options.conversation.memberIds.slice()
    },
    character: {
      ...options.character,
      likes: options.character.likes?.slice(),
      dislikes: options.character.dislikes?.slice(),
      tags: options.character.tags?.slice(),
      alternateGreetings: options.character.alternateGreetings?.slice(),
      groupOnlyGreetings: options.character.groupOnlyGreetings?.slice(),
      exampleDialogues: options.character.exampleDialogues?.map(item => ({ ...item })),
      depthPrompt: options.character.depthPrompt ? { ...options.character.depthPrompt } : undefined,
      rawCardExtensions: options.character.rawCardExtensions ? { ...options.character.rawCardExtensions } : undefined
    },
    settings: {
      ...options.settings,
      proactiveAllowedSources: options.settings.proactiveAllowedSources?.slice() || []
    },
    conversationState: cloneGenerationState(options.conversationState),
    messages: options.messages.map(cloneGenerationMessage),
    memories: options.memories.map(memory => ({
      ...memory,
      mergedFrom: memory.mergedFrom?.slice(),
      conflictWith: memory.conflictWith?.slice()
    })),
    activePersona: options.activePersona
      ? {
        ...options.activePersona,
        tags: options.activePersona.tags?.slice(),
        extraFields: options.activePersona.extraFields ? { ...options.activePersona.extraFields } : undefined
      }
      : undefined,
    modelSettings: {
      ...options.modelSettings,
      availableModels: options.modelSettings.availableModels?.slice()
    },
    options: { ...(options.requestOptions || {}) }
  }
}

export function messagePromptText(message: Message) {
  const promptContent = message.type === 'rich' ? (message.rawContent || message.content) : message.content
  const caption = promptContent.trim()
  const imageCount = getMessageImages(message).length
  const base = message.type === 'image' && message.placeholderImagePrompt
    ? `<shared_image_description>${message.placeholderImagePrompt}</shared_image_description>`
    : message.type === 'image'
      ? [
        `<image_share count="${imageCount || 1}" details="unavailable">`,
        caption ? `用户附言：${caption}` : '用户没有附言。',
        '图片细节当前不可用。只回应用户的附言、分享行为和关系语境；不要猜测细节，也不要解释技术原因。',
        '</image_share>'
      ].join('\n')
      : message.type === 'voice'
        ? `<voice_message>${message.content}</voice_message>`
        : message.type === 'action'
          ? `<scene_action>${message.content}</scene_action>`
          : message.type === 'emoji'
            ? `<emoji_message>${message.content}</emoji_message>`
            : /^(?:\/ooc\b|ooc\s*[：:])/i.test(promptContent.trim())
              ? `<director_instruction>${promptContent.trim().replace(/^(?:\/ooc\b|ooc\s*[：:])\s*/i, '')}</director_instruction>`
              : promptContent

  if (!message.replyTo) return base
  return `这条消息是在回复${message.replyTo.senderName}的“${message.replyTo.preview}”。\n${base}`
}

export function imagePromptContent(message: Message): ChatTurn['content'] {
  const images = getMessageImages(message).filter(image => Boolean(image.dataUrl))
  const caption = message.content.trim()
  const text = [
    `<visual_input count="${images.length}">`,
    caption ? `用户附言：${caption}` : '用户没有附言。',
    '请在内部按顺序观察图片。最终只输出角色会自然发出的消息，不要先汇报图片数量、文件名、构图或分析过程。',
    '</visual_input>'
  ].join('\n')

  return [
    {
      type: 'text',
      text: message.replyTo
        ? `这条消息是在回复${message.replyTo.senderName}的“${message.replyTo.preview}”。\n${text}`
        : text
    },
    ...images.map(image => ({
      type: 'image_url' as const,
      image_url: { url: image.dataUrl || '', detail: 'auto' as const }
    }))
  ]
}

export function chatTurnContentText(content: ChatTurn['content']) {
  if (typeof content === 'string') return content
  return content.filter(part => part.type === 'text').map(part => part.text).join('\n')
}

export function buildDeviceTimeContext(now = new Date()) {
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const offsetMinutes = -now.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
  return [
    `设备本地日期时间：${date} ${weekday} ${time}（UTC${offset}）`,
    '所有“现在、今天、明天、几点、还有多久、几小时后”等时间判断都以这条设备时间为准。',
    '如果要说“还有 X 小时/分钟”，必须按当前时间精确计算；不确定时只说具体时间，不要估算一个数字。'
  ].join('\n')
}

export function includeVisionCount(request: ChatRequest) {
  return request.messages.reduce(
    (total, turn) => typeof turn.content === 'string'
      ? total
      : total + turn.content.filter(part => part.type === 'image_url').length,
    0
  )
}

export function cloneChatRequest(request: ChatRequest): ChatRequest {
  return {
    ...request,
    character: request.character ? { ...request.character } : undefined,
    messages: request.messages.map(turn => ({
      ...turn,
      content: typeof turn.content === 'string'
        ? turn.content
        : turn.content.map(part => part.type === 'text'
          ? { ...part }
          : { ...part, image_url: { ...part.image_url } })
    }))
  }
}
