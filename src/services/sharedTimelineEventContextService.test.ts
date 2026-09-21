import { describe, expect, it } from 'vitest'
import type { Message } from '../types/domain'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
import type { SharedTimelineItem } from './sharedTimelineService'
import { buildSharedTimelineEvidenceContexts } from './sharedTimelineEventContextService'

function timelineItem(overrides: Partial<SharedTimelineItem> = {}): SharedTimelineItem {
  return {
    id: 'memory:1',
    worldId: 'w',
    sourceKind: 'memory',
    sourceId: 'mem-1',
    sourceMessageId: 'm2',
    conversationId: 'c1',
    characterId: 'char-1',
    characterName: '小满',
    title: '一起经历的事',
    summary: '一起去看海',
    occurredAt: '2026-09-01T12:00:00.000Z',
    sourceLabel: '聊天 · 记忆',
    sourceRoute: '/chat/c1?message=m2',
    importance: 5,
    starred: false,
    hidden: false,
    ...overrides
  }
}

function event(items: SharedTimelineItem[]): SharedTimelineEvent {
  return {
    id: 'auto:e',
    evidenceKey: 'evidence:e',
    worldId: 'w',
    characterId: 'char-1',
    characterName: '小满',
    title: '海边',
    summary: '一起去看海',
    occurredAt: '2026-09-01T12:00:00.000Z',
    startedAt: '2026-09-01T12:00:00.000Z',
    endedAt: '2026-09-01T12:00:00.000Z',
    itemIds: items.map(item => item.id),
    items,
    sourceKinds: ['memory'],
    sourceLabels: ['聊天 · 记忆'],
    mediaPreviewUrls: [],
    primaryRoute: '/chat/c1?message=m2',
    importance: 5,
    starred: false,
    hidden: false,
    manual: false
  }
}

function message(id: string, createdAt: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    worldId: 'w',
    conversationId: 'c1',
    senderId: id === 'm2' ? 'char-1' : 'user',
    type: 'text',
    content: id,
    status: 'read',
    createdAt,
    ...overrides
  }
}

const messages = [
  message('m1', '2026-09-01T11:59:00.000Z'),
  message('m2', '2026-09-01T12:00:00.000Z'),
  message('m3', '2026-09-01T12:01:00.000Z'),
  message('m4', '2026-09-01T12:02:00.000Z')
]

describe('sharedTimelineEventContextService', () => {
  it('默认返回来源消息前后各一条上下文', () => {
    const result = buildSharedTimelineEvidenceContexts(event([timelineItem()]), messages)
    expect(result[0].messages.map(row => row.id)).toEqual(['m1', 'm2', 'm3'])
    expect(result[0].messages.find(row => row.id === 'm2')?.isSource).toBe(true)
  })

  it('radius 可以扩到两侧更多消息', () => {
    const result = buildSharedTimelineEvidenceContexts(event([timelineItem()]), messages, { radius: 2 })
    expect(result[0].messages.map(row => row.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
  })

  it('不会把其它会话的消息混入上下文', () => {
    const result = buildSharedTimelineEvidenceContexts(event([timelineItem()]), [
      ...messages,
      message('other', '2026-09-01T12:00:30.000Z', { conversationId: 'c2' })
    ])
    expect(result[0].messages.some(row => row.id === 'other')).toBe(false)
  })

  it('多个 evidence 指向同一 source message 时只生成一个上下文窗口', () => {
    const result = buildSharedTimelineEvidenceContexts(event([
      timelineItem(),
      timelineItem({ id: 'state:1', sourceKind: 'state', sourceId: 's1' })
    ]), messages)
    expect(result).toHaveLength(1)
    expect(result[0].itemIds).toEqual(['memory:1', 'state:1'])
  })

  it('找不到 source message 的 evidence 不伪造上下文', () => {
    const result = buildSharedTimelineEvidenceContexts(event([
      timelineItem({ sourceMessageId: 'missing' })
    ]), messages)
    expect(result).toEqual([])
  })

  it('displayContent 优先于存储原文且会清理展示标记', () => {
    const result = buildSharedTimelineEvidenceContexts(event([timelineItem()]), [
      message('m2', '2026-09-01T12:00:00.000Z', {
        content: '**原文**',
        displayContent: '<div>可见文本</div>'
      })
    ], { radius: 0 })
    expect(result[0].messages[0].text).toContain('可见文本')
    expect(result[0].messages[0].text).not.toContain('<div>')
  })

  it('已撤回的邻居不会展示，来源自身被撤回时整个窗口不成立', () => {
    const neighbors = buildSharedTimelineEvidenceContexts(event([timelineItem()]), [
      message('m1', '2026-09-01T11:59:00.000Z', { recalledAt: '2026-09-01T12:10:00.000Z' }),
      message('m2', '2026-09-01T12:00:00.000Z'),
      message('m3', '2026-09-01T12:01:00.000Z')
    ])
    const sourceRecalled = buildSharedTimelineEvidenceContexts(event([timelineItem()]), [
      message('m2', '2026-09-01T12:00:00.000Z', { recalledAt: '2026-09-01T12:10:00.000Z' })
    ])
    expect(neighbors[0].messages.map(row => row.id)).toEqual(['m2', 'm3'])
    expect(sourceRecalled).toEqual([])
  })
})
