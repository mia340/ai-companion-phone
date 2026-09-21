import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planProactiveMessage } from './proactiveMessageService'
import type { Character, Message } from '../types/domain'

const character: Character = {
  id: 'char-1',
  worldId: 'world-1',
  name: '小满',
  avatar: '🙂',
  persona: '温柔',
  relationship: '朋友',
  mood: '平静',
  activity: '看书',
  replySpeed: 'natural',
  createdAt: '2026-01-01T00:00:00.000Z'
}

const message: Message = {
  id: 'msg-1',
  worldId: 'world-1',
  conversationId: 'conv-1',
  senderId: 'user',
  type: 'text',
  content: '晚安',
  status: 'read',
  createdAt: '2026-09-19T00:00:00.000Z'
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-20T20:00:00.000Z'))
})

afterEach(() => vi.useRealTimers())

describe('proactiveMessageService timeline recall guard', () => {
  it('普通 daily-share 可以懒加载一条时光证据，并明确禁止扩写旧事', async () => {
    const load = vi.fn(async () => ({
      id: 'auto:event-1',
      evidenceIds: ['memory:m1', 'state:s1'],
      date: '2026-08-01',
      summary: '一起约好冬天去看雪。',
      sourceLabel: '聊天 · 记忆',
      sourceRoute: '/chat/conv-1?message=old',
      starred: true
    }))
    const plan = await planProactiveMessage({
      character,
      messages: [message],
      enabled: true,
      intervalHours: 1,
      quietHoursEnabled: false,
      allowedSources: ['daily-share'],
      loadSharedTimelineRecall: load
    })
    expect(load).toHaveBeenCalledTimes(1)
    expect(plan?.source).toBe('daily-share')
    expect(plan?.instruction).toContain('event id: auto:event-1')
    expect(plan?.instruction).toContain('evidence ids: memory:m1, state:s1')
    expect(plan?.instruction).toContain('不要补写')
    expect(plan?.instruction).toContain('没有发生过的情节')
  })

  it('有更高优先级的约定提醒时不会额外加载时光证据', async () => {
    const load = vi.fn(async () => undefined)
    const plan = await planProactiveMessage({
      character,
      messages: [message],
      enabled: true,
      intervalHours: 1,
      quietHoursEnabled: false,
      allowedSources: ['promise-reminder', 'daily-share'],
      memories: [{
        id: 'promise-1',
        conversationId: 'conv-1',
        characterId: 'char-1',
        category: 'promise',
        layer: 'promise',
        content: '明天记得提醒我交材料',
        importance: 5,
        dueAt: '2026-09-21T08:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z'
      }],
      loadSharedTimelineRecall: load
    })
    expect(plan?.source).toBe('promise-reminder')
    expect(load).not.toHaveBeenCalled()
  })


  it('时光证据读取失败只降级主动消息，不会让聊天加载失败', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const plan = await planProactiveMessage({
      character,
      messages: [message],
      enabled: true,
      intervalHours: 1,
      quietHoursEnabled: false,
      allowedSources: ['daily-share'],
      loadSharedTimelineRecall: async () => { throw new Error('timeline db unavailable') }
    })
    expect(plan?.source).toBe('daily-share')
    expect(plan?.instruction).toContain('不要凭空创造共同回忆')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('没有时光证据时仍明确禁止凭空制造共同回忆', async () => {
    const plan = await planProactiveMessage({
      character,
      messages: [message],
      enabled: true,
      intervalHours: 1,
      quietHoursEnabled: false,
      allowedSources: ['daily-share'],
      loadSharedTimelineRecall: async () => undefined
    })
    expect(plan?.instruction).toContain('不要凭空创造共同回忆')
  })
})
