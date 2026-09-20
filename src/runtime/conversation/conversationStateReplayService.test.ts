import { describe, expect, it } from 'vitest'

import { createDefaultConversationState } from '../../services/chatSettings'
import type { ConversationStateHistory, Message } from '../../types/domain'
import { buildConversationStateSnapshot } from './conversationStateReplayService'

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

function history(overrides: Partial<ConversationStateHistory>): ConversationStateHistory {
  return {
    id: 'h-1',
    conversationId: 'c-1',
    characterId: 'char-1',
    field: 'location',
    label: '地点变化',
    nextValue: '咖啡店',
    sourceMessageId: 'm-1',
    createdAt: '2026-09-01T10:00:01.000Z',
    ...overrides
  }
}

describe('conversation state replay', () => {
  it('replays only state history whose source message is still retained', () => {
    const retained = [message({ id: 'm-1' })]
    const state = buildConversationStateSnapshot({
      conversationId: 'c-1',
      retainedMessages: retained,
      stateHistory: [
        history({ id: 'h-keep', sourceMessageId: 'm-1', nextValue: '咖啡店' }),
        history({ id: 'h-drop', sourceMessageId: 'm-2', nextValue: '机场' })
      ],
      mode: 'rewind',
      now: '2026-09-01T11:00:00.000Z'
    })

    expect(state.location).toBe('咖啡店')
  })

  it('rewind clears ephemeral thought, active resource and lorebook timed effects', () => {
    const current = createDefaultConversationState('c-1')
    current.innerThought = '旧分支想法'
    current.thoughtUpdatedAt = '2026-09-01T10:00:01.000Z'
    current.activeResourceEntryId = 'resource-1'
    current.activeResourceUpdatedAt = '2026-09-01T10:00:01.000Z'
    current.lorebookRuntime = {
      entry: {
        entryUpdatedAt: '2026-09-01T09:00:00.000Z',
        activatedAt: '2026-09-01T10:00:00.000Z',
        activatedAtMessageId: 'm-1',
        activatedAtMessageCount: 1,
        stickyUntilMessageCount: 8,
        activationCount: 1
      }
    }

    const state = buildConversationStateSnapshot({
      conversationId: 'c-1',
      retainedMessages: [message({ id: 'm-1' })],
      stateHistory: [],
      currentState: current,
      mode: 'rewind'
    })

    expect(state.innerThought).toBe('')
    expect(state.activeResourceEntryId).toBeUndefined()
    expect(state.lorebookRuntime).toEqual({})
  })

  it('branch carries only ephemeral state that existed before the branch cutoff', () => {
    const current = createDefaultConversationState('c-1')
    current.innerThought = '节点前想法'
    current.thoughtUpdatedAt = '2026-09-01T10:00:01.000Z'
    current.activeResourceEntryId = 'resource-1'
    current.activeResourceTitle = '手机'
    current.activeResourceUpdatedAt = '2026-09-01T10:00:01.000Z'
    current.lorebookRuntime = {
      keep: {
        entryUpdatedAt: '2026-09-01T09:00:00.000Z',
        activatedAt: '2026-09-01T10:00:00.000Z',
        activatedAtMessageId: 'm-1',
        activatedAtMessageCount: 1,
        stickyUntilMessageCount: 5,
        activationCount: 1
      },
      drop: {
        entryUpdatedAt: '2026-09-01T09:00:00.000Z',
        activatedAt: '2026-09-01T10:30:00.000Z',
        activatedAtMessageId: 'm-after',
        activatedAtMessageCount: 3,
        stickyUntilMessageCount: 5,
        activationCount: 1
      }
    }

    const state = buildConversationStateSnapshot({
      conversationId: 'branch-1',
      retainedMessages: [message({ id: 'm-1' })],
      stateHistory: [],
      currentState: current,
      cutoffCreatedAt: '2026-09-01T10:10:00.000Z',
      messageIdMap: new Map([['m-1', 'branch-m-1']]),
      mode: 'branch'
    })

    expect(state.innerThought).toBe('节点前想法')
    expect(state.activeResourceEntryId).toBe('resource-1')
    expect(state.lorebookRuntime?.keep?.activatedAtMessageId).toBe('branch-m-1')
    expect(state.lorebookRuntime?.drop).toBeUndefined()
  })
})
