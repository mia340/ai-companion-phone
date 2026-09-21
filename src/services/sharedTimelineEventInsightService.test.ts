import { describe, expect, it } from 'vitest'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
import type { SharedTimelineItem } from './sharedTimelineService'
import {
  buildSharedTimelineEventInsightMessages,
  parseSharedTimelineEventInsight
} from './sharedTimelineEventInsightService'

function item(id: string, summary: string): SharedTimelineItem {
  return {
    id,
    worldId: 'w',
    sourceKind: id.startsWith('state') ? 'state' : 'memory',
    sourceId: id,
    sourceMessageId: 'm1',
    conversationId: 'c1',
    characterId: 'char-1',
    characterName: '小满',
    title: '共同事件',
    summary,
    occurredAt: '2026-09-01T12:00:00.000Z',
    sourceLabel: '聊天',
    sourceRoute: '/chat/c1?message=m1',
    importance: 5,
    starred: false,
    hidden: false
  }
}

const items = [item('memory:1', '一起约好冬天去看雪'), item('state:1', '关系更亲近了')]
const event: SharedTimelineEvent = {
  id: 'auto:event-1',
  evidenceKey: 'evidence:x',
  worldId: 'w',
  characterId: 'char-1',
  characterName: '小满',
  title: '一个约定',
  summary: '一起约好冬天去看雪 · 关系更亲近了',
  occurredAt: '2026-09-01T12:00:00.000Z',
  startedAt: '2026-09-01T12:00:00.000Z',
  endedAt: '2026-09-01T12:00:00.000Z',
  itemIds: items.map(row => row.id),
  items,
  sourceKinds: ['memory', 'state'],
  sourceLabels: ['聊天'],
  mediaPreviewUrls: [],
  primaryRoute: '/chat/c1?message=m1',
  importance: 5,
  starred: false,
  hidden: false,
  manual: false
}

describe('sharedTimelineEventInsightService', () => {
  it('Prompt 会把完整 event id 与全部 evidence id 交给模型', () => {
    const messages = buildSharedTimelineEventInsightMessages(event)
    expect(messages[1].content).toContain('auto:event-1')
    expect(messages[1].content).toContain('memory:1')
    expect(messages[1].content).toContain('state:1')
  })

  it('只接受 event id 与完整 evidence 集合都匹配的 JSON', () => {
    expect(parseSharedTimelineEventInsight(JSON.stringify({
      eventId: 'auto:event-1',
      evidenceIds: ['memory:1', 'state:1'],
      title: '看雪的约定',
      summary: '我们约好冬天去看雪，这件事也让关系更亲近。'
    }), event)).toMatchObject({ title: '看雪的约定' })
  })

  it('evidence 顺序不同仍视为同一完整集合', () => {
    expect(parseSharedTimelineEventInsight(JSON.stringify({
      eventId: 'auto:event-1',
      evidenceIds: ['state:1', 'memory:1'],
      title: '看雪的约定',
      summary: '有真实证据支持的摘要。'
    }), event)?.evidenceIds).toEqual(['state:1', 'memory:1'])
  })

  it('错误 event id 会被拒绝', () => {
    expect(parseSharedTimelineEventInsight(JSON.stringify({
      eventId: 'auto:invented', evidenceIds: event.itemIds, title: '标题', summary: '摘要'
    }), event)).toBeUndefined()
  })

  it('漏掉任意 evidence 会被拒绝', () => {
    expect(parseSharedTimelineEventInsight(JSON.stringify({
      eventId: event.id, evidenceIds: ['memory:1'], title: '标题', summary: '摘要'
    }), event)).toBeUndefined()
  })

  it('模型补造不存在的 evidence 会被拒绝', () => {
    expect(parseSharedTimelineEventInsight(JSON.stringify({
      eventId: event.id, evidenceIds: [...event.itemIds, 'memory:fake'], title: '标题', summary: '摘要'
    }), event)).toBeUndefined()
  })

  it('会清理展示标记并限制标题和摘要长度', () => {
    const insight = parseSharedTimelineEventInsight(JSON.stringify({
      eventId: event.id,
      evidenceIds: event.itemIds,
      title: '<b>这是一个非常非常非常非常非常非常长的标题</b>',
      summary: '**摘要** '.repeat(40)
    }), event)
    expect(insight?.title).not.toContain('<b>')
    expect(insight?.title.length).toBeLessThanOrEqual(18)
    expect(insight?.summary.length).toBeLessThanOrEqual(90)
  })
})
