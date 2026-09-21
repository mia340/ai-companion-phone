import type { SharedTimelineAcceptedRelationshipArcSummary } from './sharedTimelineService'
import { selectRelationshipArcInsightScope, type RelationshipArc } from './relationshipArcService'

export interface RelationshipArcChatShare {
  conversationId: string
  draft: string
  arcFingerprint: string
  nodeIds: string[]
  evidenceIds: string[]
}

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max)
}

function sameSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return set.size === left.length && right.every(value => set.has(value))
}

export function buildRelationshipArcChatShare(
  arc: RelationshipArc,
  accepted?: SharedTimelineAcceptedRelationshipArcSummary
): RelationshipArcChatShare | undefined {
  const conversationId = [...arc.nodes].reverse().find(node => node.conversationId)?.conversationId
  if (!conversationId) return undefined
  const scope = selectRelationshipArcInsightScope(arc)
  const acceptedValid = accepted?.characterId === arc.characterId &&
    sameSet(accepted.nodeIds, scope.nodeIds) && sameSet(accepted.evidenceIds, scope.evidenceIds)
  const nodeIds = acceptedValid ? [...scope.nodeIds] : arc.nodes.map(node => node.id)
  const evidenceIds = acceptedValid ? [...scope.evidenceIds] : [...arc.evidenceIds]
  const acceptedSummary = acceptedValid ? clean(accepted?.summary, 360) : ''
  const fallbackTitles = arc.nodes
    .filter(node => node.kind === 'relationship-change' || node.kind === 'promise' || node.starred)
    .slice(-4)
    .map(node => `「${clean(node.title, 36)}」`)
  const body = acceptedSummary || (fallbackTitles.length
    ? `我想从这些有真实来源的节点聊起：${fallbackTitles.join('、')}。`
    : '我想从我们时光里有真实来源的共同经历聊起。')
  return {
    conversationId,
    arcFingerprint: arc.fingerprint,
    nodeIds,
    evidenceIds,
    draft: [
      body,
      `[关系脉络引用 arc:${arc.fingerprint}; nodes:${nodeIds.join(', ')}; evidence:${evidenceIds.join(', ')}]`
    ].join('\n')
  }
}

export function mergeRelationshipArcShareIntoDraft(existing: string, share: RelationshipArcChatShare) {
  const current = existing.trim()
  if (!current) return share.draft
  if (current.includes(`[关系脉络引用 arc:${share.arcFingerprint}`)) return current
  return `${current}\n\n${share.draft}`
}
