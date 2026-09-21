import { describe, expect, it } from 'vitest'
import {
  buildRelationshipArc,
  buildRelationshipArcs,
  relationshipArcNodeKindLabel,
  resolveRelationshipArcSummary,
  selectRelationshipArcInsightScope
} from './relationshipArcService'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
import type { SharedTimelineItem, SharedTimelinePreferences, SharedTimelineRelationshipSignal } from './sharedTimelineService'

function item(id: string, at: string, signal: SharedTimelineRelationshipSignal, overrides: Partial<SharedTimelineItem> = {}): SharedTimelineItem {
  return {
    id,
    worldId: 'w',
    sourceKind: signal === 'relationship-change' ? 'state' : 'memory',
    sourceId: id,
    sourceMessageId: `msg-${id}`,
    conversationId: 'conv-1',
    characterId: 'char-1',
    characterName: '小满',
    title: signal === 'promise' ? '一个约定' : signal === 'relationship-change' ? '关系发生变化' : '一起经历的事',
    summary: `${signal}-${id}`,
    occurredAt: at,
    sourceLabel: signal === 'relationship-change' ? '状态历史' : '聊天 · 记忆',
    sourceRoute: `/chat/conv-1?message=msg-${id}`,
    importance: signal === 'relationship-change' || signal === 'promise' ? 5 : 3,
    relationshipSignal: signal,
    starred: false,
    hidden: false,
    ...overrides
  }
}

function event(id: string, at: string, signal: SharedTimelineRelationshipSignal, overrides: Partial<SharedTimelineEvent> = {}): SharedTimelineEvent {
  const base = item(`${id}-e1`, at, signal, overrides.items?.[0])
  return {
    id,
    evidenceKey: `evidence:${id}`,
    worldId: 'w',
    characterId: base.characterId,
    characterName: base.characterName,
    title: base.title,
    summary: base.summary,
    occurredAt: at,
    startedAt: at,
    endedAt: at,
    itemIds: [base.id],
    items: [base],
    sourceKinds: [base.sourceKind],
    sourceLabels: [base.sourceLabel],
    mediaPreviewUrls: [],
    primaryRoute: base.sourceRoute,
    importance: base.importance,
    starred: false,
    hidden: false,
    manual: false,
    ...overrides
  }
}

const relation1 = event('event-r1', '2026-01-02T10:00:00.000Z', 'relationship-change', {
  items: [item('state-r1', '2026-01-02T10:00:00.000Z', 'relationship-change', {
    relationshipPreviousValue: '刚认识', relationshipNextValue: '开始信任'
  })],
  itemIds: ['state-r1']
})
const promise = event('event-p1', '2026-02-03T10:00:00.000Z', 'promise')
const shared = event('event-s1', '2026-03-04T10:00:00.000Z', 'shared-event')
const relation2 = event('event-r2', '2026-04-05T10:00:00.000Z', 'relationship-change', {
  items: [item('state-r2', '2026-04-05T10:00:00.000Z', 'relationship-change', {
    relationshipPreviousValue: '开始信任', relationshipNextValue: '重要的人'
  })],
  itemIds: ['state-r2']
})

const events = [relation2, shared, promise, relation1]

describe('relationshipArcService', () => {
  it('只按指定角色构建按时间排序的 evidence-backed 节点', () => {
    const other = event('other', '2026-05-01T10:00:00.000Z', 'shared-event', { characterId: 'char-2' })
    const arc = buildRelationshipArc([...events, other], 'char-1')!
    expect(arc.nodes.map(node => node.eventId)).toEqual(['event-r1', 'event-p1', 'event-s1', 'event-r2'])
    expect(arc.nodes.every(node => node.characterId === 'char-1')).toBe(true)
  })

  it('关系状态只来自明确 relationship state evidence，不从普通文案猜测', () => {
    const arc = buildRelationshipArc(events, 'char-1')!
    expect(arc.currentRelationship).toBe('重要的人')
    expect(arc.nodes.find(node => node.eventId === 'event-r1')).toMatchObject({
      relationshipBefore: '刚认识', relationshipAfter: '开始信任'
    })
    expect(arc.nodes.find(node => node.eventId === 'event-s1')?.relationshipAfter).toBeUndefined()
  })

  it('relationship-change 会切分关系阶段', () => {
    const arc = buildRelationshipArc(events, 'char-1')!
    expect(arc.phases).toHaveLength(2)
    expect(arc.phases[0].relationshipState).toBe('开始信任')
    expect(arc.phases[1].relationshipState).toBe('重要的人')
  })

  it('约定、关系变化和共同经历分别计数', () => {
    const arc = buildRelationshipArc(events, 'char-1')!
    expect(arc.promiseCount).toBe(1)
    expect(arc.relationshipChangeCount).toBe(2)
    expect(arc.sharedEventCount).toBe(1)
  })

  it('隐藏 evidence 不会通过原事件重新进入关系脉络', () => {
    const hiddenRelation = {
      ...relation1,
      items: relation1.items.map(row => ({ ...row, hidden: true }))
    }
    const arc = buildRelationshipArc([hiddenRelation, promise], 'char-1')!
    expect(arc.nodes.map(node => node.eventId)).toEqual(['event-p1'])
  })

  it('事件确认摘要会作为节点摘要，但不改变 provenance', () => {
    const preferences: SharedTimelinePreferences = {
      starredIds: [], hiddenIds: [], customTitles: {}, eventGroups: [], eventNotes: [],
      eventSummaries: { [promise.evidenceKey]: { summary: '确认过的看雪约定', evidenceIds: promise.itemIds, updatedAt: '2026-09-01T00:00:00Z' } }
    } as unknown as SharedTimelinePreferences
    const arc = buildRelationshipArc([promise], 'char-1', preferences)!
    expect(arc.nodes[0].summary).toBe('确认过的看雪约定')
    expect(arc.nodes[0].evidenceIds).toEqual(promise.itemIds)
  })

  it('AI scope 总会保留首尾、关系变化和约定节点', () => {
    const many = [relation1, ...Array.from({ length: 24 }, (_, index) => event(`mid-${index}`, `2026-03-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`, 'shared-event')), promise, relation2]
    const scope = selectRelationshipArcInsightScope(buildRelationshipArc(many, 'char-1')!, 8)
    expect(scope.nodeIds).toContain('arc-node:event-r1')
    expect(scope.nodeIds).toContain('arc-node:event-r2')
    expect(scope.nodeIds).toContain('arc-node:event-p1')
    expect(scope.nodeIds.length).toBeLessThanOrEqual(8)
  })

  it('fingerprint 会随着 evidence 集合变化而变化', () => {
    const first = buildRelationshipArc([promise], 'char-1')!
    const extraItem = item('promise-extra', promise.startedAt, 'promise')
    const second = buildRelationshipArc([{ ...promise, items: [...promise.items, extraItem], itemIds: [...promise.itemIds, extraItem.id] }], 'char-1')!
    expect(first.fingerprint).not.toBe(second.fingerprint)
  })

  it('已确认关系摘要只有当前 scope 完整一致时才有效', () => {
    const arc = buildRelationshipArc(events, 'char-1')!
    const scope = selectRelationshipArcInsightScope(arc)
    const prefs: SharedTimelinePreferences = {
      starredIds: [], hiddenIds: [], customTitles: {}, relationshipArcSummaries: {
        [arc.fingerprint]: {
          characterId: arc.characterId,
          summary: '从开始信任到成为重要的人。',
          nodeIds: scope.nodeIds,
          evidenceIds: scope.evidenceIds,
          updatedAt: '2026-09-20T00:00:00Z'
        }
      }
    }
    expect(resolveRelationshipArcSummary(arc, prefs)?.summary).toContain('开始信任')
    prefs.relationshipArcSummaries![arc.fingerprint].evidenceIds = scope.evidenceIds.slice(1)
    expect(resolveRelationshipArcSummary(arc, prefs)).toBeUndefined()
  })

  it('可一次为多个角色构建 arc 且按最近节点排序', () => {
    const other = event('other', '2026-09-01T10:00:00.000Z', 'shared-event', {
      characterId: 'char-2',
      characterName: '阿屿',
      items: [item('other-e', '2026-09-01T10:00:00.000Z', 'shared-event', { characterId: 'char-2', characterName: '阿屿' })],
      itemIds: ['other-e']
    })
    expect(buildRelationshipArcs([...events, other], ['char-1', 'char-2']).map(arc => arc.characterId)).toEqual(['char-2', 'char-1'])
  })

  it('节点类型标签不会把共同经历包装成关系变化', () => {
    expect(relationshipArcNodeKindLabel('shared-event')).toBe('共同经历')
    expect(relationshipArcNodeKindLabel('relationship-change')).toBe('关系变化')
  })
})
