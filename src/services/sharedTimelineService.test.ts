import { describe, expect, it } from 'vitest'
import {
  applySharedTimelinePreferences,
  buildSharedTimelineItems,
  normalizeSharedTimelinePreferences
} from './sharedTimelineService'
import type {
  Character,
  CharacterMemory,
  Conversation,
  ConversationStateHistory,
  Message,
  MomentPost
} from '../types/domain'

const character: Character = {
  id: 'char-1',
  worldId: 'world-1',
  name: '小满',
  avatar: '🙂',
  persona: '温柔',
  relationship: '朋友',
  mood: '平静',
  activity: '散步',
  replySpeed: 'natural',
  createdAt: '2026-09-01T00:00:00.000Z'
}

const conversation: Conversation = {
  id: 'conv-1',
  worldId: 'world-1',
  type: 'single',
  title: '和小满',
  memberIds: ['char-1'],
  pinned: false,
  muted: false,
  unread: 0,
  updatedAt: '2026-09-20T00:00:00.000Z'
}

const message: Message = {
  id: 'msg-1',
  worldId: 'world-1',
  conversationId: 'conv-1',
  senderId: 'user',
  type: 'text',
  content: '我们说好了冬天一起去看雪。',
  status: 'read',
  createdAt: '2026-09-18T12:00:00.000Z'
}

const memory: CharacterMemory = {
  id: 'memory-1',
  conversationId: 'conv-1',
  characterId: 'char-1',
  category: 'promise',
  layer: 'promise',
  content: '冬天一起去看雪。',
  importance: 5,
  sourceMessageId: 'msg-1',
  status: 'active',
  createdAt: '2026-09-18T12:00:01.000Z',
  updatedAt: '2026-09-18T12:00:01.000Z'
}

function build(overrides?: Partial<{
  memories: CharacterMemory[]
  moments: MomentPost[]
  stateHistory: ConversationStateHistory[]
}>) {
  return buildSharedTimelineItems({
    worldId: 'world-1',
    characters: [character],
    conversations: [conversation],
    messages: [message],
    memories: overrides?.memories ?? [memory],
    moments: overrides?.moments ?? [],
    stateHistory: overrides?.stateHistory ?? []
  })
}

describe('sharedTimelineService', () => {
  it('把有来源消息的承诺记忆整理成可追溯时间线，并深链到原消息', () => {
    const item = build()[0]
    expect(item.id).toBe('memory:memory-1')
    expect(item.title).toBe('一个约定')
    expect(item.sourceExcerpt).toContain('看雪')
    expect(item.sourceRoute).toBe('/chat/conv-1?message=msg-1')
  })

  it('低重要度普通事实不会被当成共同回忆', () => {
    const lowFact: CharacterMemory = {
      ...memory,
      id: 'fact-low',
      category: 'other',
      layer: 'fact',
      importance: 2,
      content: '用户喜欢喝水'
    }
    expect(build({ memories: [lowFact] })).toHaveLength(0)
  })

  it('invalid 记忆不会进入时间线', () => {
    expect(build({ memories: [{ ...memory, status: 'invalid' }] })).toHaveLength(0)
  })

  it('角色朋友圈动态以动态本身作为真实来源', () => {
    const post: MomentPost = {
      id: 'moment-1',
      worldId: 'world-1',
      authorType: 'character',
      authorId: 'char-1',
      content: '今天风很好。',
      likeCount: 0,
      likedByMe: false,
      source: 'manual',
      createdAt: '2026-09-19T08:00:00.000Z',
      updatedAt: '2026-09-19T08:00:00.000Z'
    }
    const item = build({ memories: [], moments: [post] })[0]
    expect(item.characterId).toBe('char-1')
    expect(item.sourceRoute).toContain('moment=moment-1')
  })

  it('用户动态只有绑定单聊时才归入某个角色的共同时间线', () => {
    const linked: MomentPost = {
      id: 'moment-user',
      worldId: 'world-1',
      authorType: 'user',
      authorId: 'user',
      content: '一起看完电影。',
      likeCount: 0,
      likedByMe: false,
      conversationId: 'conv-1',
      source: 'manual',
      createdAt: '2026-09-19T09:00:00.000Z',
      updatedAt: '2026-09-19T09:00:00.000Z'
    }
    const unlinked = { ...linked, id: 'moment-unlinked', conversationId: undefined }
    const items = build({ memories: [], moments: [linked, unlinked] })
    expect(items.map(item => item.id)).toEqual(['moment:moment-user'])
    expect(items[0].characterId).toBe('char-1')
  })

  it('只有 event / relationship / goal 且有 sourceMessageId 的状态历史进入时光', () => {
    const base: ConversationStateHistory = {
      id: 'state-1',
      conversationId: 'conv-1',
      characterId: 'char-1',
      field: 'relationship',
      label: '关系更亲近了',
      nextValue: '亲近',
      sourceMessageId: 'msg-1',
      createdAt: '2026-09-20T00:00:00.000Z'
    }
    const location: ConversationStateHistory = { ...base, id: 'state-2', field: 'location', label: '到了公园' }
    const noSource: ConversationStateHistory = { ...base, id: 'state-3', sourceMessageId: undefined }
    const items = build({ memories: [], stateHistory: [base, location, noSource] })
    expect(items.map(item => item.id)).toEqual(['state:state-1'])
  })

  it('用户收藏、隐藏和自定义标题只改变展示偏好，不改变来源正文', () => {
    const item = build()[0]
    const result = applySharedTimelinePreferences([item], {
      starredIds: [item.id],
      hiddenIds: [item.id],
      customTitles: { [item.id]: '第一场雪的约定' }
    })[0]
    expect(result.starred).toBe(true)
    expect(result.hidden).toBe(true)
    expect(result.customTitle).toBe('第一场雪的约定')
    expect(result.summary).toBe('冬天一起去看雪。')
  })

  it('偏好归一化会去重并清理空标题', () => {
    const result = normalizeSharedTimelinePreferences({
      starredIds: ['memory:1', 'memory:1', ''],
      hiddenIds: ['moment:1', 'moment:1'],
      customTitles: { 'memory:1': '  一次旅行  ', bad: '   ' }
    })
    expect(result.starredIds).toEqual(['memory:1'])
    expect(result.hiddenIds).toEqual(['moment:1'])
    expect(result.customTitles).toEqual({ 'memory:1': '一次旅行' })
  })

  it('时间线按发生时间倒序排列', () => {
    const post: MomentPost = {
      id: 'moment-new',
      worldId: 'world-1',
      authorType: 'character',
      authorId: 'char-1',
      content: '新的动态',
      likeCount: 0,
      likedByMe: false,
      source: 'manual',
      createdAt: '2026-09-20T12:00:00.000Z',
      updatedAt: '2026-09-20T12:00:00.000Z'
    }
    expect(build({ moments: [post] }).map(item => item.id)).toEqual(['moment:moment-new', 'memory:memory-1'])
  })
})
