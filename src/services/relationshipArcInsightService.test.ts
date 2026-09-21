import { describe, expect, it } from 'vitest'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
import type { SharedTimelineItem, SharedTimelineRelationshipSignal } from './sharedTimelineService'
import { buildRelationshipArc, selectRelationshipArcInsightScope } from './relationshipArcService'
import {
  buildRelationshipArcInsightMessages,
  parseRelationshipArcInsight
} from './relationshipArcInsightService'

function item(id: string, signal: SharedTimelineRelationshipSignal, at: string): SharedTimelineItem {
  return {
    id, worldId: 'w', sourceKind: signal === 'relationship-change' ? 'state' : 'memory', sourceId: id,
    sourceMessageId: `m-${id}`, conversationId: 'c1', characterId: 'char-1', characterName: '小满',
    title: signal === 'promise' ? '一个约定' : signal === 'relationship-change' ? '关系发生变化' : '一起经历的事',
    summary: `${id} 的真实摘要`, occurredAt: at, sourceLabel: '聊天', sourceRoute: `/chat/c1?message=m-${id}`,
    importance: signal === 'shared-event' ? 3 : 5, relationshipSignal: signal,
    ...(signal === 'relationship-change' ? { relationshipPreviousValue: '朋友', relationshipNextValue: '更亲近' } : {}),
    starred: false, hidden: false
  }
}
function event(id: string, signal: SharedTimelineRelationshipSignal, at: string): SharedTimelineEvent {
  const row = item(`${id}-e`, signal, at)
  return {
    id, evidenceKey: `e:${id}`, worldId: 'w', characterId: 'char-1', characterName: '小满', title: row.title,
    summary: row.summary, occurredAt: at, startedAt: at, endedAt: at, itemIds: [row.id], items: [row],
    sourceKinds: [row.sourceKind], sourceLabels: [row.sourceLabel], mediaPreviewUrls: [], primaryRoute: row.sourceRoute,
    importance: row.importance, starred: false, hidden: false, manual: false
  }
}
const arc = buildRelationshipArc([
  event('r1', 'relationship-change', '2026-01-01T10:00:00Z'),
  event('p1', 'promise', '2026-02-01T10:00:00Z'),
  event('s1', 'shared-event', '2026-03-01T10:00:00Z')
], 'char-1')!
const scope = selectRelationshipArcInsightScope(arc)
function validPayload() {
  return {
    characterId: arc.characterId,
    arcFingerprint: arc.fingerprint,
    nodeIds: scope.nodeIds,
    evidenceIds: scope.evidenceIds,
    summary: '从有明确关系记录，到留下约定和共同经历；这里只概括现有证据。',
    turningPoints: [{ nodeId: 'arc-node:r1', reason: '出现明确的关系状态变化' }]
  }
}

describe('relationshipArcInsightService', () => {
  it('Prompt 携带完整 arc fingerprint、scope node ids 与 evidence ids', () => {
    const messages = buildRelationshipArcInsightMessages(arc)
    expect(messages[1].content).toContain(arc.fingerprint)
    for (const id of scope.nodeIds) expect(messages[1].content).toContain(id)
    for (const id of scope.evidenceIds) expect(messages[1].content).toContain(id)
  })

  it('Prompt 明确禁止猜测心理、冲突或和解', () => {
    expect(buildRelationshipArcInsightMessages(arc)[0].content).toContain('不要猜测没有证据的心理')
  })

  it('完全匹配 provenance 的 JSON 可以通过', () => {
    expect(parseRelationshipArcInsight(JSON.stringify(validPayload()), arc)).toMatchObject({
      characterId: 'char-1', arcFingerprint: arc.fingerprint
    })
  })

  it('错误 characterId 会被拒绝', () => {
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), characterId: 'char-fake' }), arc)).toBeUndefined()
  })

  it('错误 fingerprint 会被拒绝', () => {
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), arcFingerprint: 'arc:fake' }), arc)).toBeUndefined()
  })

  it('漏 node 或补造 node 都会被拒绝', () => {
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), nodeIds: scope.nodeIds.slice(1) }), arc)).toBeUndefined()
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), nodeIds: [...scope.nodeIds, 'arc-node:fake'] }), arc)).toBeUndefined()
  })

  it('漏 evidence 或补造 evidence 都会被拒绝', () => {
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), evidenceIds: scope.evidenceIds.slice(1) }), arc)).toBeUndefined()
    expect(parseRelationshipArcInsight(JSON.stringify({ ...validPayload(), evidenceIds: [...scope.evidenceIds, 'memory:fake'] }), arc)).toBeUndefined()
  })

  it('turningPoints 只能引用真实 scope node，并去重且最多四条', () => {
    const payload = validPayload()
    payload.turningPoints = [
      { nodeId: scope.nodeIds[0], reason: '第一条' },
      { nodeId: scope.nodeIds[0], reason: '重复' },
      { nodeId: 'arc-node:fake', reason: '伪造' },
      ...scope.nodeIds.slice(1).map((nodeId, index) => ({ nodeId, reason: `节点${index}` }))
    ]
    const parsed = parseRelationshipArcInsight(JSON.stringify(payload), arc)!
    expect(new Set(parsed.turningPoints.map(point => point.nodeId)).size).toBe(parsed.turningPoints.length)
    expect(parsed.turningPoints.every(point => scope.nodeIds.includes(point.nodeId))).toBe(true)
    expect(parsed.turningPoints.length).toBeLessThanOrEqual(4)
  })

  it('会清理展示标记并限制摘要和转折理由长度', () => {
    const parsed = parseRelationshipArcInsight(JSON.stringify({
      ...validPayload(),
      summary: '<b>摘要</b>'.repeat(100),
      turningPoints: [{ nodeId: scope.nodeIds[0], reason: '<i>理由</i>'.repeat(40) }]
    }), arc)!
    expect(parsed.summary).not.toContain('<b>')
    expect(parsed.summary.length).toBeLessThanOrEqual(160)
    expect(parsed.turningPoints[0].reason.length).toBeLessThanOrEqual(36)
  })
})
