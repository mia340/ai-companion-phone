import { describe, expect, it } from 'vitest'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
import type { SharedTimelineItem } from './sharedTimelineService'
import { buildRelationshipArc } from './relationshipArcService'
import { buildRelationshipArcChatShare, mergeRelationshipArcShareIntoDraft } from './relationshipArcShareService'

const row: SharedTimelineItem = {
  id: 'memory:1', worldId: 'w', sourceKind: 'memory', sourceId: '1', sourceMessageId: 'm1', conversationId: 'c1',
  characterId: 'char-1', characterName: '小满', title: '一个约定', summary: '冬天一起看雪', occurredAt: '2026-01-01T10:00:00Z',
  sourceLabel: '聊天 · 记忆', sourceRoute: '/chat/c1?message=m1', importance: 5, relationshipSignal: 'promise', starred: false, hidden: false
}
const event: SharedTimelineEvent = {
  id: 'event-1', evidenceKey: 'e:1', worldId: 'w', characterId: 'char-1', characterName: '小满', title: '一个约定', summary: row.summary,
  occurredAt: row.occurredAt, startedAt: row.occurredAt, endedAt: row.occurredAt, itemIds: [row.id], items: [row], sourceKinds: ['memory'],
  sourceLabels: ['聊天 · 记忆'], mediaPreviewUrls: [], primaryRoute: row.sourceRoute, importance: 5, starred: true, hidden: false, manual: false
}
const arc = buildRelationshipArc([event], 'char-1')!

describe('relationshipArcShareService', () => {
  it('带回聊天只生成草稿并携带 arc/node/evidence provenance', () => {
    const share = buildRelationshipArcChatShare(arc)!
    expect(share.conversationId).toBe('c1')
    expect(share.draft).toContain(`arc:${arc.fingerprint}`)
    expect(share.draft).toContain('arc-node:event-1')
    expect(share.draft).toContain('memory:1')
  })

  it('有用户确认的 arc 摘要时使用该摘要', () => {
    const share = buildRelationshipArcChatShare(arc, {
      characterId: 'char-1', summary: '这是我确认过的关系脉络摘要。', nodeIds: arc.nodes.map(node => node.id),
      evidenceIds: arc.evidenceIds, updatedAt: '2026-09-20T00:00:00Z'
    })!
    expect(share.draft).toContain('这是我确认过的关系脉络摘要')
  })

  it('没有确认摘要时只列已有节点标题，不生成关系结论', () => {
    const share = buildRelationshipArcChatShare(arc)!
    expect(share.draft).toContain('「一个约定」')
    expect(share.draft).not.toContain('关系已经')
  })

  it('没有可定位聊天会话时不会生成 share', () => {
    const noConversation = buildRelationshipArc([{ ...event, items: [{ ...row, conversationId: undefined }] }], 'char-1')!
    expect(buildRelationshipArcChatShare(noConversation)).toBeUndefined()
  })

  it('同一 arc 已在草稿中时不会重复注入', () => {
    const share = buildRelationshipArcChatShare(arc)!
    expect(mergeRelationshipArcShareIntoDraft(share.draft, share)).toBe(share.draft)
  })

  it('已有普通草稿时在末尾追加关系脉络引用', () => {
    const share = buildRelationshipArcChatShare(arc)!
    expect(mergeRelationshipArcShareIntoDraft('先说别的', share)).toContain('先说别的\n\n')
  })
})
