import { describe, expect, it } from 'vitest'
import {
  buildSharedTimelineEvents,
  createManualTimelineEventGroup,
  projectSharedTimelineEvents,
  removeManualTimelineEventGroup,
  selectSharedTimelineRecallEvent,
  upsertManualTimelineEventGroup
} from './sharedTimelineEventService'
import type { SharedTimelineItem } from './sharedTimelineService'

function item(overrides: Partial<SharedTimelineItem> = {}): SharedTimelineItem {
  return {
    id: 'memory:1',
    worldId: 'w',
    sourceKind: 'memory',
    sourceId: '1',
    sourceMessageId: 'm1',
    conversationId: 'c1',
    characterId: 'char-1',
    characterName: '小满',
    title: '一起经历的事',
    summary: '我们一起去海边看了日落',
    occurredAt: '2026-09-01T12:00:00.000Z',
    sourceLabel: '聊天 · 记忆',
    sourceRoute: '/chat/c1?message=m1',
    importance: 5,
    starred: false,
    hidden: false,
    ...overrides
  }
}

const emptyPrefs = { eventGroups: [] }

describe('sharedTimelineEventService', () => {
  it('同一 sourceMessageId 的记忆与状态会合并成一个事件', () => {
    const events = buildSharedTimelineEvents([
      item(),
      item({ id: 'state:1', sourceKind: 'state', sourceId: 'state-1', title: '关系发生变化', summary: '关系更亲近了' })
    ], emptyPrefs)
    expect(events).toHaveLength(1)
    expect(events[0].itemIds).toEqual(['memory:1', 'state:1'])
  })

  it('同一会话短时间内的图片与记忆可以组成多证据事件', () => {
    const events = buildSharedTimelineEvents([
      item(),
      item({
        id: 'media:1',
        sourceKind: 'media',
        sourceId: 'image-1',
        sourceMessageId: 'image-1',
        mediaKind: 'image',
        mediaPreviewUrl: 'data:image/jpeg;base64,abc',
        title: 'TA 分享的一张图片',
        summary: '海边的晚霞',
        occurredAt: '2026-09-01T12:40:00.000Z'
      })
    ], emptyPrefs)
    expect(events).toHaveLength(1)
    expect(events[0].mediaPreviewUrls).toEqual(['data:image/jpeg;base64,abc'])
  })

  it('不同角色不会被自动合并', () => {
    const events = buildSharedTimelineEvents([
      item(),
      item({ id: 'other', characterId: 'char-2', characterName: '阿澄' })
    ], emptyPrefs)
    expect(events).toHaveLength(2)
  })

  it('相隔过远的证据不会仅因为文本相似而合并', () => {
    const events = buildSharedTimelineEvents([
      item(),
      item({ id: 'later', sourceMessageId: 'm2', occurredAt: '2026-09-03T12:00:00.000Z' })
    ], emptyPrefs)
    expect(events).toHaveLength(2)
  })

  it('人工事件分组优先于自动聚类并保留标题', () => {
    const rows = [item(), item({ id: 'moment:1', sourceKind: 'moment', sourceId: 'moment-1', sourceMessageId: undefined, occurredAt: '2026-09-02T12:00:00.000Z' })]
    const events = buildSharedTimelineEvents(rows, {
      eventGroups: [{ id: 'trip', itemIds: ['memory:1', 'moment:1'], title: '海边的一天' }]
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: 'manual:trip', manual: true, title: '海边的一天' })
  })

  it('筛选投影保留稳定 event id，同时不会泄露被隐藏或搜索排除的证据', () => {
    const rows = [item(), item({ id: 'state:1', sourceKind: 'state', sourceId: 's1', summary: '关系更亲近了' })]
    const full = buildSharedTimelineEvents(rows, emptyPrefs)
    const projected = projectSharedTimelineEvents(full, [rows[0]])
    expect(projected).toHaveLength(1)
    expect(projected[0].id).toBe(full[0].id)
    expect(projected[0].itemIds).toEqual(['memory:1'])
    expect(projected[0].summary).not.toContain('关系更亲近')
  })

  it('创建人工事件至少需要两条证据并限制成员去重', () => {
    expect(createManualTimelineEventGroup(['a'])).toBeUndefined()
    expect(createManualTimelineEventGroup(['a', 'a', 'b'], '旅行', new Date('2026-09-20T00:00:00.000Z'))).toMatchObject({
      itemIds: ['a', 'b'],
      title: '旅行'
    })
  })

  it('upsert 会避免一条证据同时属于两个人工事件', () => {
    const result = upsertManualTimelineEventGroup(
      [{ id: 'old', itemIds: ['a', 'b'] }],
      { id: 'new', itemIds: ['b', 'c'] }
    )
    expect(result).toEqual([{ id: 'new', itemIds: ['b', 'c'] }])
  })

  it('可以拆分人工事件', () => {
    expect(removeManualTimelineEventGroup([{ id: 'one', itemIds: ['a', 'b'] }], 'one')).toEqual([])
  })

  it('主动旧事优先收藏且多证据事件会携带 evidenceIds', () => {
    const rows = [
      item({ occurredAt: '2026-07-01T00:00:00.000Z', starred: true }),
      item({ id: 'state:1', sourceKind: 'state', sourceId: 's1', occurredAt: '2026-07-01T00:10:00.000Z', starred: true }),
      item({ id: 'newer', sourceMessageId: 'm2', occurredAt: '2026-08-01T00:00:00.000Z', importance: 5 })
    ]
    const recall = selectSharedTimelineRecallEvent(rows, emptyPrefs, {
      characterId: 'char-1',
      now: new Date('2026-09-20T00:00:00.000Z')
    })
    expect(recall?.evidenceIds).toEqual(['memory:1', 'state:1'])
    expect(recall?.starred).toBe(true)
  })

  it('隐藏事件不会成为主动旧事来源', () => {
    const recall = selectSharedTimelineRecallEvent([
      item({ hidden: true, occurredAt: '2026-07-01T00:00:00.000Z' })
    ], emptyPrefs, {
      characterId: 'char-1',
      now: new Date('2026-09-20T00:00:00.000Z')
    })
    expect(recall).toBeUndefined()
  })
})
