import { describe, expect, it } from 'vitest'
import {
  buildSharedTimelineHighlights,
  filterSharedTimelineItems,
  groupSharedTimelineItems,
  selectSharedTimelineRecallEvidence
} from './sharedTimelineBrowseService'
import type { SharedTimelineItem } from './sharedTimelineService'

function item(overrides: Partial<SharedTimelineItem> = {}): SharedTimelineItem {
  return {
    id: 'memory:1',
    worldId: 'w',
    sourceKind: 'memory',
    sourceId: '1',
    characterId: 'c1',
    characterName: '小满',
    title: '一个约定',
    summary: '冬天一起去看雪',
    occurredAt: '2026-09-01T00:00:00.000Z',
    sourceLabel: '聊天 · 记忆',
    sourceRoute: '/chat/c?message=m',
    importance: 5,
    starred: false,
    hidden: false,
    ...overrides
  }
}

const now = new Date('2026-09-20T12:00:00.000Z')

describe('sharedTimelineBrowseService', () => {
  it('搜索会匹配标题、摘要、角色、来源与媒体标签', () => {
    const rows = [
      item(),
      item({ id: 'media:2', title: '一起听歌的片段', summary: '雨天', mediaKind: 'music', mediaLabel: '一起听歌' })
    ]
    expect(filterSharedTimelineItems(rows, { query: '看雪' }).map(row => row.id)).toEqual(['memory:1'])
    expect(filterSharedTimelineItems(rows, { query: '听歌' }).map(row => row.id)).toEqual(['media:2'])
  })

  it('最近筛选只保留 30 天内记录', () => {
    const rows = [item(), item({ id: 'old', occurredAt: '2026-07-01T00:00:00.000Z' })]
    expect(filterSharedTimelineItems(rows, { timeFilter: 'recent', now }).map(row => row.id)).toEqual(['memory:1'])
  })

  it('往年今天只命中同月同日且年份更早的证据', () => {
    const rows = [
      item({ id: 'anniversary', occurredAt: '2025-09-20T06:00:00.000Z' }),
      item({ id: 'same-year', occurredAt: '2026-09-20T06:00:00.000Z' }),
      item({ id: 'other-day', occurredAt: '2025-09-19T06:00:00.000Z' })
    ]
    expect(filterSharedTimelineItems(rows, { timeFilter: 'anniversary', now }).map(row => row.id)).toEqual(['anniversary'])
  })

  it('最初记录按角色各保留最早一条，而不是把不同角色混在一起', () => {
    const rows = [
      item({ id: 'c1-old', occurredAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'c1-new', occurredAt: '2026-02-01T00:00:00.000Z' }),
      item({ id: 'c2-old', characterId: 'c2', occurredAt: '2026-03-01T00:00:00.000Z' })
    ]
    expect(filterSharedTimelineItems(rows, { timeFilter: 'earliest' }).map(row => row.id)).toEqual(['c1-old', 'c2-old'])
  })

  it('隐藏/收藏/角色筛选与时间筛选可以组合', () => {
    const rows = [
      item({ id: 'keep', starred: true }),
      item({ id: 'hidden', starred: true, hidden: true }),
      item({ id: 'other', characterId: 'c2', starred: true })
    ]
    expect(filterSharedTimelineItems(rows, { characterId: 'c1', onlyStarred: true, now }).map(row => row.id)).toEqual(['keep'])
  })

  it('按年月分组并保持输入顺序', () => {
    const groups = groupSharedTimelineItems([
      item({ id: 'sep-2', occurredAt: '2026-09-18T00:00:00.000Z' }),
      item({ id: 'sep-1', occurredAt: '2026-09-01T00:00:00.000Z' }),
      item({ id: 'aug', occurredAt: '2026-08-20T00:00:00.000Z' })
    ])
    expect(groups.map(group => [group.label, group.items.length])).toEqual([['2026年9月', 2], ['2026年8月', 1]])
  })

  it('高亮统计包含最近、往年今天、媒体和每角色最初记录', () => {
    const highlights = buildSharedTimelineHighlights([
      item({ id: 'recent' }),
      item({ id: 'anniversary', occurredAt: '2025-09-20T00:00:00.000Z' }),
      item({ id: 'music', mediaKind: 'music', occurredAt: '2026-09-10T00:00:00.000Z' }),
      item({ id: 'c2', characterId: 'c2', occurredAt: '2026-08-01T00:00:00.000Z' })
    ], now)
    expect(highlights).toEqual({ recent: 2, anniversary: 1, media: 1, earliest: 2 })
  })

  it('旧事回忆证据优先收藏，其次重要度，并要求至少达到年龄门槛', () => {
    const rows = [
      item({ id: 'fresh-star', starred: true, occurredAt: '2026-09-19T00:00:00.000Z' }),
      item({ id: 'important', importance: 5, occurredAt: '2026-08-01T00:00:00.000Z' }),
      item({ id: 'starred', starred: true, importance: 3, occurredAt: '2026-07-01T00:00:00.000Z' })
    ]
    expect(selectSharedTimelineRecallEvidence(rows, { characterId: 'c1', now, minAgeDays: 7 })?.id).toBe('starred')
  })

  it('旧事回忆证据不会使用隐藏条目或其它角色', () => {
    const rows = [
      item({ id: 'hidden', hidden: true, starred: true, occurredAt: '2026-07-01T00:00:00.000Z' }),
      item({ id: 'other', characterId: 'c2', starred: true, occurredAt: '2026-07-01T00:00:00.000Z' })
    ]
    expect(selectSharedTimelineRecallEvidence(rows, { characterId: 'c1', now })).toBeUndefined()
  })
})
