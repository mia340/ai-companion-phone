import { describe, expect, it } from 'vitest'

import type {
  Character,
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  UserPersona
} from '../../types/domain'
import type { ModelSettings } from '../../types/modelSettings'
import {
  createGenerationInputSnapshot,
  imagePromptContent,
  messagePromptText
} from './generationContext'

const now = '2026-09-11T12:00:00.000Z'

function baseMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    worldId: 'w-1',
    conversationId: 'c-1',
    senderId: 'user',
    type: 'text',
    content: '你好',
    status: 'delivered',
    createdAt: now,
    ...overrides
  }
}

function baseCharacter(): Character {
  return {
    id: 'char-1',
    worldId: 'w-1',
    name: '澄夏',
    avatar: '🌙',
    persona: '温柔但有主见',
    relationship: '朋友',
    mood: '平静',
    activity: '聊天',
    likes: ['散步'],
    dislikes: ['失约'],
    alternateGreetings: ['晚上好'],
    groupOnlyGreetings: [],
    exampleDialogues: [{ id: 'ex-1', user: '在吗', assistant: '在。' }],
    tags: ['测试'],
    replySpeed: 'natural',
    createdAt: now,
    updatedAt: now
  }
}

function baseConversation(): Conversation {
  return {
    id: 'c-1',
    worldId: 'w-1',
    type: 'single',
    title: '澄夏',
    memberIds: ['char-1'],
    pinned: false,
    muted: false,
    unread: 0,
    updatedAt: now
  }
}

function baseSettings(): ChatSettings {
  return {
    id: 'c-1',
    conversationId: 'c-1',
    memoryEnabled: true,
    memoryStrength: 'standard',
    recentMessageLimit: 20,
    replyLength: 'natural',
    multiBubble: true,
    streamResponse: true,
    showTyping: true,
    naturalDelay: false,
    innerThoughtVisibility: 'thoughts',
    proactiveEnabled: false,
    proactiveIntervalHours: 12,
    proactiveFrequency: 'natural',
    proactiveQuietHoursEnabled: true,
    proactiveQuietStart: '23:00',
    proactiveQuietEnd: '08:00',
    proactiveAllowedSources: ['daily-share'],
    autoReadAloud: false,
    voiceName: '',
    voiceRate: 1,
    roleplayMode: 'daily',
    lorebookEnabled: true,
    swipeRepliesEnabled: true,
    actionProtocolEnabled: true,
    messagePacing: 'natural',
    promptDebugEnabled: true,
    presenceMode: 'auto',
    actionVisibility: 'always',
    conversationPresentationMode: 'scene-merged',
    compatibilityMode: 'auto',
    updatedAt: now
  }
}

function baseState(): ConversationState {
  return {
    id: 'c-1',
    summary: '一起去过海边。',
    summaryMessageCount: 2,
    innerMood: '安心',
    innerActivity: '聊天',
    innerThought: '想继续聊',
    unresolvedTopics: ['旅行'],
    pendingEvents: ['周末见面'],
    shortTermGoals: ['订票'],
    lorebookRuntime: {
      'entry-1': {
        entryUpdatedAt: now,
        activatedAt: now,
        activatedAtMessageCount: 1,
        activationCount: 1
      }
    },
    updatedAt: now
  }
}

function baseModelSettings(): ModelSettings {
  return {
    id: 'default',
    provider: 'deepseek',
    baseUrl: 'https://example.invalid/v1',
    apiKey: 'secret',
    model: 'test-model',
    temperature: 0.8,
    maxTokens: 2048,
    visionMode: 'auto',
    updatedAt: now
  }
}

describe('Generation Context primitives', () => {
  it('freezes mutable turn inputs so later UI mutations cannot drift an in-flight generation', () => {
    const conversation = baseConversation()
    const character = baseCharacter()
    const settings = baseSettings()
    const state = baseState()
    const messages = [baseMessage({ alternatives: ['你好', '嗨'] })]
    const memories: CharacterMemory[] = [{
      id: 'mem-1',
      conversationId: 'c-1',
      characterId: 'char-1',
      scope: 'character',
      category: 'promise',
      content: '答应周末去看展',
      importance: 4,
      mergedFrom: ['m-0'],
      conflictWith: [],
      createdAt: now,
      updatedAt: now
    }]
    const persona: UserPersona = {
      id: 'p-1',
      name: '米娅',
      avatar: '🙂',
      identity: '学生',
      description: '喜欢摄影',
      isDefault: true,
      createdAt: now,
      updatedAt: now
    }

    const snapshot = createGenerationInputSnapshot({
      generationId: 'gen-1',
      now: new Date(now),
      conversation,
      character,
      settings,
      conversationState: state,
      messages,
      memories,
      activePersona: persona,
      modelSettings: baseModelSettings(),
      requestOptions: { sourceMessageId: 'm-1' }
    })

    conversation.memberIds[0] = 'char-mutated'
    character.likes?.push('后来添加')
    character.exampleDialogues?.[0] && (character.exampleDialogues[0].assistant = '被改了')
    settings.recentMessageLimit = 1
    state.unresolvedTopics?.push('临时话题')
    if (state.lorebookRuntime?.['entry-1']) state.lorebookRuntime['entry-1'].activationCount = 99
    messages[0].content = '发送后又被 UI 改掉'
    messages[0].alternatives?.push('第三版')
    memories[0].mergedFrom?.push('m-late')
    persona.name = '后来改名'

    expect(snapshot.generationId).toBe('gen-1')
    expect(snapshot.conversation.memberIds).toEqual(['char-1'])
    expect(snapshot.character.likes).toEqual(['散步'])
    expect(snapshot.character.exampleDialogues?.[0].assistant).toBe('在。')
    expect(snapshot.settings.recentMessageLimit).toBe(20)
    expect(snapshot.conversationState?.unresolvedTopics).toEqual(['旅行'])
    expect(snapshot.conversationState?.lorebookRuntime?.['entry-1'].activationCount).toBe(1)
    expect(snapshot.messages[0].content).toBe('你好')
    expect(snapshot.messages[0].alternatives).toEqual(['你好', '嗨'])
    expect(snapshot.memories[0].mergedFrom).toEqual(['m-0'])
    expect(snapshot.activePersona?.name).toBe('米娅')
  })

  it('formats reply references and director/OOC instructions before provider dispatch', () => {
    const text = messagePromptText(baseMessage({
      content: '/ooc 把时间推进到晚上',
      replyTo: {
        messageId: 'old-1',
        senderName: '澄夏',
        preview: '等你回来',
        type: 'text'
      }
    }))

    expect(text).toContain('这条消息是在回复澄夏的“等你回来”')
    expect(text).toContain('<director_instruction>把时间推进到晚上</director_instruction>')
  })

  it('keeps rich-message canonical text for future prompt context', () => {
    expect(messagePromptText(baseMessage({
      type: 'rich',
      content: '互动卡片',
      rawContent: '<state>{"mood":"happy"}</state>'
    }))).toBe('<state>{"mood":"happy"}</state>')
  })

  it('builds a multimodal turn without exposing image analysis instructions as a separate assistant turn', () => {
    const content = imagePromptContent(baseMessage({
      type: 'image',
      content: '看看这个',
      images: [{ dataUrl: 'data:image/png;base64,AAAA', name: 'photo.png' }]
    }))

    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) throw new Error('expected multimodal content')
    expect(content[0]).toMatchObject({ type: 'text' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA', detail: 'auto' }
    })
  })
})
