import { describe, expect, it } from 'vitest'

import { createDefaultConversationState } from '../../services/chatSettings'
import type { CharacterMemory, Conversation, ConversationStateHistory, Message } from '../../types/domain'
import { buildConversationBranchPlan } from './conversationBranchService'

function message(overrides: Partial<Message>): Message {
  return {
    id: 'm-1',
    worldId: 'w-1',
    conversationId: 'c-1',
    senderId: 'user',
    type: 'text',
    content: 'hello',
    status: 'delivered',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides
  }
}

function memory(overrides: Partial<CharacterMemory>): CharacterMemory {
  return {
    id: 'mem-1',
    conversationId: 'c-1',
    characterId: 'char-1',
    category: 'event',
    content: '记忆',
    importance: 3,
    sourceType: 'automatic',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides
  }
}

function history(overrides: Partial<ConversationStateHistory>): ConversationStateHistory {
  return {
    id: 'h-1',
    conversationId: 'c-1',
    characterId: 'char-1',
    field: 'location',
    label: '地点变化',
    nextValue: '咖啡店',
    createdAt: '2026-09-01T10:00:01.000Z',
    ...overrides
  }
}

const conversation: Conversation = {
  id: 'c-1',
  worldId: 'w-1',
  type: 'single',
  title: '测试聊天',
  memberIds: ['char-1'],
  pinned: true,
  muted: false,
  unread: 2,
  openingMode: 'free',
  updatedAt: '2026-09-01T10:00:00.000Z'
}

describe('conversation branch plan', () => {
  it('copies only messages and derived data up to the selected node', () => {
    let seq = 0
    const idFactory = () => `new-${++seq}`
    const sourceState = createDefaultConversationState('c-1')
    const plan = buildConversationBranchPlan({
      sourceConversation: conversation,
      sourceMessages: [
        message({ id: 'm-1' }),
        message({ id: 'm-2', senderId: 'char-1', createdAt: '2026-09-01T10:01:00.000Z', replyGroupId: 'group-a' }),
        message({ id: 'm-3', createdAt: '2026-09-01T10:02:00.000Z' })
      ],
      selectedMessageId: 'm-2',
      sourceMemories: [
        memory({ id: 'mem-before', sourceMessageId: 'm-1', mergedFrom: ['m-1', 'm-3'] }),
        memory({ id: 'mem-after', sourceMessageId: 'm-3' }),
        memory({ id: 'mem-future-auto', sourceMessageId: undefined, createdAt: '2026-09-01T10:03:00.000Z' }),
        memory({ id: 'mem-manual', sourceType: 'manual', sourceMessageId: undefined })
      ],
      sourceHistory: [
        history({ id: 'h-before', sourceMessageId: 'm-1' }),
        history({ id: 'h-after', sourceMessageId: 'm-3', nextValue: '机场' }),
        history({ id: 'h-future-unbound', sourceMessageId: undefined, createdAt: '2026-09-01T10:03:00.000Z', nextValue: '酒店' })
      ],
      sourceState,
      now: '2026-09-01T12:00:00.000Z',
      idFactory
    })

    expect(plan.messages).toHaveLength(2)
    expect(plan.memories).toHaveLength(2)
    expect(plan.memories.filter(row => row.sourceType === 'automatic')).toHaveLength(1)
    expect(plan.memories.filter(row => row.sourceType === 'manual')).toHaveLength(1)
    expect(plan.memories.find(row => row.sourceType === 'automatic')?.mergedFrom).toHaveLength(1)
    expect(plan.stateHistory).toHaveLength(1)
    expect(plan.state.location).toBe('咖啡店')
    expect(plan.conversation.parentConversationId).toBe('c-1')
    expect(plan.conversation.branchFromMessageId).toBe('m-2')
    expect(plan.conversation.pinned).toBe(false)
    expect(plan.conversation.unread).toBe(0)
  })

  it('does not copy character-shared memories into a new story branch', () => {
    let seq = 0
    const plan = buildConversationBranchPlan({
      sourceConversation: conversation,
      sourceMessages: [message({ id: 'm-1' })],
      selectedMessageId: 'm-1',
      sourceMemories: [
        memory({ id: 'shared', scope: 'character', sourceMessageId: 'm-1' }),
        memory({ id: 'local', scope: 'conversation', sourceMessageId: 'm-1' })
      ],
      sourceHistory: [],
      sourceState: createDefaultConversationState('c-1'),
      idFactory: () => `new-${++seq}`
    })

    expect(plan.memories.map(row => row.id)).not.toContain('shared')
    expect(plan.memories).toHaveLength(1)
  })

  it('remaps reply references that point inside the copied branch', () => {
    let seq = 0
    const plan = buildConversationBranchPlan({
      sourceConversation: conversation,
      sourceMessages: [
        message({ id: 'm-1' }),
        message({
          id: 'm-2',
          senderId: 'char-1',
          createdAt: '2026-09-01T10:01:00.000Z',
          replyTo: { messageId: 'm-1', senderName: '你', preview: 'hello', type: 'text' }
        })
      ],
      selectedMessageId: 'm-2',
      sourceMemories: [],
      sourceHistory: [],
      idFactory: () => `id-${++seq}`
    })

    expect(plan.messages[1].replyTo?.messageId).toBe(plan.messages[0].id)
  })
})
