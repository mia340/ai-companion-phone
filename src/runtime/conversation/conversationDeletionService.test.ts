import { describe, expect, it } from 'vitest'

import type {
  CharacterMemory,
  Conversation,
  Message,
  MomentPost,
  ResourceBinding
} from '../../types/domain'
import { buildConversationDeletionPlan } from './conversationMutationService'

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c-root',
    worldId: 'w-1',
    type: 'single',
    title: '聊天',
    memberIds: ['char-1'],
    pinned: false,
    muted: false,
    unread: 0,
    updatedAt: '2026-09-11T10:00:00.000Z',
    ...overrides
  }
}

function message(id: string, conversationId = 'c-root'): Message {
  return {
    id,
    worldId: 'w-1',
    conversationId,
    senderId: 'user',
    type: 'text',
    content: id,
    status: 'delivered',
    createdAt: '2026-09-11T10:00:00.000Z'
  }
}

function memory(overrides: Partial<CharacterMemory>): CharacterMemory {
  return {
    id: 'mem-1',
    conversationId: 'c-root',
    characterId: 'char-1',
    category: 'event',
    content: '记忆',
    importance: 3,
    scope: 'conversation',
    createdAt: '2026-09-11T10:00:00.000Z',
    updatedAt: '2026-09-11T10:00:00.000Z',
    ...overrides
  }
}

describe('conversation deletion plan', () => {
  it('deletes local runtime data but preserves and rehomes character memory', () => {
    const root = conversation()
    const sibling = conversation({ id: 'c-new', updatedAt: '2026-09-11T12:00:00.000Z' })
    const binding: ResourceBinding = {
      id: 'binding-conv',
      worldId: 'w-1',
      scope: 'conversation',
      scopeId: root.id,
      resourceType: 'lorebook',
      resourceId: 'book-1',
      enabled: true,
      order: 1,
      createdAt: root.updatedAt,
      updatedAt: root.updatedAt
    }
    const moment: MomentPost = {
      id: 'moment-1',
      worldId: 'w-1',
      authorType: 'character',
      authorId: 'char-1',
      content: '动态',
      likeCount: 0,
      likedByMe: false,
      conversationId: root.id,
      source: 'ai',
      createdAt: root.updatedAt,
      updatedAt: root.updatedAt
    }
    const plan = buildConversationDeletionPlan({
      conversation: root,
      allConversations: [root, sibling],
      messages: [message('m-1'), message('m-2')],
      memories: [
        memory({ id: 'local', scope: 'conversation' }),
        memory({ id: 'shared', scope: 'character' })
      ],
      stateHistory: [],
      promptDebugTraces: [],
      resourceBindings: [binding],
      momentPosts: [moment],
      now: '2026-09-11T13:00:00.000Z'
    })

    expect(plan.messageIdsToDelete).toEqual(['m-1', 'm-2'])
    expect(plan.localMemoryIdsToDelete).toEqual(['local'])
    expect(plan.preservedCharacterMemoryIds).toEqual(['shared'])
    expect(plan.sharedMemoryConversationPatches).toEqual([
      {
        id: 'shared',
        conversationId: 'c-new',
        updatedAt: '2026-09-11T13:00:00.000Z'
      }
    ])
    expect(plan.conversationBindingIdsToDelete).toEqual(['binding-conv'])
    expect(plan.momentPostIdsToDetach).toEqual(['moment-1'])
  })

  it('turns child branches into independent roots when deleting the root chat', () => {
    const root = conversation()
    const childA = conversation({
      id: 'c-a',
      parentConversationId: root.id,
      rootConversationId: root.id,
      branchFromMessageId: 'm-a'
    })
    const grandchildA = conversation({
      id: 'c-a-2',
      parentConversationId: childA.id,
      rootConversationId: root.id,
      branchFromMessageId: 'm-a-2'
    })
    const childB = conversation({
      id: 'c-b',
      parentConversationId: root.id,
      rootConversationId: root.id,
      branchFromMessageId: 'm-b'
    })
    const plan = buildConversationDeletionPlan({
      conversation: root,
      allConversations: [root, childA, grandchildA, childB],
      messages: [],
      memories: [],
      stateHistory: [],
      promptDebugTraces: [],
      resourceBindings: [],
      momentPosts: [],
      now: '2026-09-11T13:00:00.000Z'
    })
    const patches = new Map(plan.branchPatches.map(row => [row.id, row]))

    expect(patches.get('c-a')?.parentConversationId).toBeUndefined()
    expect(patches.get('c-a')?.rootConversationId).toBeUndefined()
    expect(patches.get('c-a')?.branchFromMessageId).toBeUndefined()
    expect(patches.get('c-a-2')?.parentConversationId).toBe('c-a')
    expect(patches.get('c-a-2')?.rootConversationId).toBe('c-a')
    expect(patches.get('c-b')?.rootConversationId).toBeUndefined()
  })

  it('bridges child branches to the surviving parent when deleting a middle branch', () => {
    const root = conversation({ id: 'c-root' })
    const middle = conversation({
      id: 'c-middle',
      parentConversationId: root.id,
      rootConversationId: root.id,
      branchFromMessageId: 'm-root'
    })
    const child = conversation({
      id: 'c-child',
      parentConversationId: middle.id,
      rootConversationId: root.id,
      branchFromMessageId: 'm-middle'
    })
    const plan = buildConversationDeletionPlan({
      conversation: middle,
      allConversations: [root, middle, child],
      messages: [],
      memories: [],
      stateHistory: [],
      promptDebugTraces: [],
      resourceBindings: [],
      momentPosts: []
    })
    const patch = plan.branchPatches.find(row => row.id === child.id)

    expect(patch?.parentConversationId).toBe(root.id)
    expect(patch?.rootConversationId).toBe(root.id)
    expect(patch?.branchFromMessageId).toBeUndefined()
  })
})
