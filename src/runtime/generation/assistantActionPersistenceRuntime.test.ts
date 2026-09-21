import { describe, expect, it, vi } from 'vitest'
import type { Character, ChatSettings, Conversation, Message } from '../../types/domain'
import {
  actionMessageType,
  createAssistantActionPersistenceRuntime,
  messagePacingDelay,
  resolveActionTarget
} from './assistantActionPersistenceRuntime'

const character = {
  id: 'char', worldId: 'world', name: '林川', avatar: '🙂', persona: '', relationship: '',
  mood: '', activity: '', groups: [], replySpeed: 'natural', createdAt: '2026-01-01T00:00:00.000Z'
} as Character

const settings = {
  naturalDelay: false,
  messagePacing: 'natural',
  multiBubble: true,
  conversationPresentationMode: 'scene-merged'
} as ChatSettings

const conversation = {
  id: 'conversation', worldId: 'world', memberIds: ['char'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'
} as Conversation

function row(id: string, senderId: string, content: string): Message {
  return {
    id, worldId: 'world', conversationId: conversation.id, senderId, type: 'text', content,
    status: 'delivered', createdAt: '2026-01-01T00:00:00.000Z'
  }
}

function createHarness(initial: Message[] = []) {
  let rows = initial.map(item => ({ ...item }))
  const persisted: any[] = []
  const removed: string[] = []
  const waits: number[] = []
  const runtime = createAssistantActionPersistenceRuntime({
    listMessages: async () => rows.map(item => ({ ...item })),
    updateMessage: async (id, patch) => {
      rows = rows.map(item => item.id === id ? { ...item, ...patch } : item)
    },
    removeGeneratedMessage: async id => {
      removed.push(id)
      rows = rows.filter(item => item.id !== id)
    },
    persistAssistantContentMessage: async options => {
      persisted.push(options)
      const message = {
        id: `new-${persisted.length}`,
        worldId: conversation.worldId,
        conversationId: conversation.id,
        senderId: options.senderId,
        type: options.type,
        content: options.content,
        rawContent: options.rawContent,
        modelOutput: options.modelOutput,
        displayContent: options.displayContent,
        regexApplied: options.regexApplied,
        roleCardUi: options.roleCardUi,
        placeholderImagePrompt: options.placeholderImagePrompt,
        voiceDurationSeconds: options.voiceDurationSeconds,
        replyGroupId: options.replyGroupId,
        replySequence: options.replySequence,
        status: 'delivered',
        createdAt: options.createdAt || '2026-01-01T00:00:00.000Z'
      } as Message
      rows.push(message)
      return message
    },
    wait: async ms => { waits.push(ms) },
    randomUUID: () => 'group-1',
    now: offset => `2026-01-01T00:00:00.${String(offset || 0).padStart(3, '0')}Z`
  })
  const onMessagesChanged = vi.fn()
  const onScrollRequested = vi.fn(async () => {})
  return { runtime, getRows: () => rows, persisted, removed, waits, onMessagesChanged, onScrollRequested }
}

describe('assistant action persistence runtime', () => {
  it('maps action kinds to stored message types', () => {
    expect(actionMessageType({ kind: 'scene_action', content: 'x' })).toBe('action')
    expect(actionMessageType({ kind: 'emoji', content: '🙂' })).toBe('emoji')
    expect(actionMessageType({ kind: 'voice', content: 'x' })).toBe('voice')
    expect(actionMessageType({ kind: 'image_placeholder', content: 'x' })).toBe('image')
    expect(actionMessageType({ kind: 'text', content: 'x' }, 'music')).toBe('music')
  })

  it('keeps explicit first-message delay even when natural pacing is disabled', () => {
    expect(messagePacingDelay({ kind: 'text', content: 'x', delayMs: 350 }, 0, settings, character)).toBe(350)
    expect(messagePacingDelay({ kind: 'typing_pause', content: '' }, 1, settings, character)).toBe(620)
  })

  it('resolves latest user/assistant targets without crossing sender ownership', () => {
    const rows = [row('u1', 'user', '一'), row('a1', 'char', '二'), row('u2', 'user', '三'), row('a2', 'char', '四')]
    expect(resolveActionTarget(rows, 'latest_user', 'user')?.id).toBe('u2')
    expect(resolveActionTarget(rows, 'latest_assistant', 'assistant')?.id).toBe('a2')
    expect(resolveActionTarget(rows, 'u1', 'assistant')?.id).toBe('u1')
  })

  it('removes streaming placeholder before persisting final actions', async () => {
    const harness = createHarness([row('placeholder', 'char', 'partial')])
    await harness.runtime.persistActions({
      conversation, character, settings, actions: [{ kind: 'text', content: '完成' }],
      provider: 'p', model: 'm', generationId: 'g', replaceMessageId: 'placeholder'
    }, harness)
    expect(harness.removed).toEqual(['placeholder'])
    expect(harness.getRows().some(item => item.id === 'placeholder')).toBe(false)
    expect(harness.getRows().at(-1)?.content).toBe('完成')
  })

  it('assigns raw/model/regex/card metadata only to the first persisted content message', async () => {
    const harness = createHarness()
    await harness.runtime.persistActions({
      conversation, character, settings,
      actions: [{ kind: 'text', content: '第一条' }, { kind: 'text', content: '第二条' }],
      provider: 'p', model: 'm', generationId: 'g', rawContent: 'raw', modelOutput: 'model',
      regexApplied: { storage: ['s'], display: [] }, roleCardUi: { date: '今天' } as any
    }, harness)
    expect(harness.persisted).toHaveLength(2)
    expect(harness.persisted[0].rawContent).toBe('raw')
    expect(harness.persisted[0].modelOutput).toBe('model')
    expect(harness.persisted[0].regexApplied).toEqual({ storage: ['s'], display: [] })
    expect(harness.persisted[0].replyGroupId).toBe('group-1')
    expect(harness.persisted[1].rawContent).toBeUndefined()
    expect(harness.persisted[1].modelOutput).toBeUndefined()
    expect(harness.persisted[1].regexApplied).toBeUndefined()
    expect(harness.persisted[1].replyGroupId).toBe('group-1')
  })

  it('recalls only an assistant message and preserves its original content', async () => {
    const harness = createHarness([row('u1', 'user', '用户'), row('a1', 'char', '角色')])
    await harness.runtime.persistActions({
      conversation, character, settings,
      actions: [{ kind: 'recall_message', content: '', targetMessageId: 'latest_assistant' }],
      provider: 'p', model: 'm', generationId: 'g'
    }, harness)
    const target = harness.getRows().find(item => item.id === 'a1')
    expect(target?.content).toBe('')
    expect(target?.recalledOriginalContent).toBe('角色')
    expect(harness.getRows().find(item => item.id === 'u1')?.content).toBe('用户')
  })

  it('reacts to the latest user message and truncates oversized emoji payload', async () => {
    const harness = createHarness([row('u1', 'user', '用户'), row('a1', 'char', '角色')])
    await harness.runtime.persistActions({
      conversation, character, settings,
      actions: [{ kind: 'react_to_message', content: '😀😀😀😀😀😀😀😀😀', targetMessageId: 'latest_user' }],
      provider: 'p', model: 'm', generationId: 'g'
    }, harness)
    expect(harness.getRows().find(item => item.id === 'u1')?.reactionToMessageId).toBe('u1')
    expect(harness.getRows().find(item => item.id === 'u1')?.reactionEmoji?.length).toBeLessThanOrEqual(8)
  })

  it('stores image placeholders without fake text and keeps the prompt separately', async () => {
    const harness = createHarness()
    await harness.runtime.persistActions({
      conversation, character, settings,
      actions: [{ kind: 'image_placeholder', content: '雨夜街道' }],
      provider: 'p', model: 'm', generationId: 'g'
    }, harness)
    expect(harness.persisted[0].type).toBe('image')
    expect(harness.persisted[0].content).toBe('')
    expect(harness.persisted[0].placeholderImagePrompt).toBe('雨夜街道')
  })
})
