import type { ChatTurn } from './ai/provider'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import {
  relationshipArcNodeKindLabel,
  selectRelationshipArcInsightScope,
  type RelationshipArc
} from './relationshipArcService'

export interface RelationshipArcTurningPoint {
  nodeId: string
  reason: string
}

export interface RelationshipArcInsight {
  characterId: string
  arcFingerprint: string
  nodeIds: string[]
  evidenceIds: string[]
  summary: string
  turningPoints: RelationshipArcTurningPoint[]
}

export class RelationshipArcInsightAiUnconfiguredError extends Error {
  constructor() {
    super('还没配好可用的 AI。请先到「设置 → API 与模型」完成配置。')
    this.name = 'RelationshipArcInsightAiUnconfiguredError'
  }
}

function clean(value: unknown, max: number) {
  return sanitizeNativeAppText(String(value ?? ''), { singleLine: true }).slice(0, max).trim()
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string' || !item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function sameSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return set.size === left.length && right.every(value => set.has(value))
}

export function buildRelationshipArcInsightMessages(arc: RelationshipArc): ChatTurn[] {
  const scope = selectRelationshipArcInsightScope(arc)
  const nodes = scope.nodes.map(node => ({
    id: node.id,
    eventId: node.eventId,
    evidenceIds: node.evidenceIds,
    date: node.startedAt.slice(0, 10),
    kind: node.kind,
    kindLabel: relationshipArcNodeKindLabel(node.kind),
    title: node.title,
    summary: node.summary.slice(0, 220),
    relationshipBefore: node.relationshipBefore,
    relationshipAfter: node.relationshipAfter,
    sources: node.sourceLabels
  }))
  return [
    {
      role: 'system',
      content: [
        '你在整理一条由 Runtime 从真实 evidence 编译出的 Relationship Arc（关系脉络）。',
        '不要判断谁对谁错，不要猜测没有证据的心理、关系程度、冲突或和解，也不要补写任何共同经历。',
        '只能总结输入 nodes 已经支持的变化。relationshipBefore/relationshipAfter 只有存在时才能作为明确关系状态引用。',
        '必须原样返回 characterId、arcFingerprint、全部 nodeIds 和全部 evidenceIds；漏一条、多一条或伪造都无效。',
        'summary 最多 160 个汉字。turningPoints 最多 4 个，只能引用输入 nodeId；reason 最多 36 个汉字。',
        '严格返回 JSON：{"characterId":"...","arcFingerprint":"...","nodeIds":["..."],"evidenceIds":["..."],"summary":"...","turningPoints":[{"nodeId":"...","reason":"..."}]}。',
        '不要输出 Markdown、HTML、XML、代码围栏或额外解释。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        characterId: scope.characterId,
        arcFingerprint: scope.arcFingerprint,
        nodeIds: scope.nodeIds,
        evidenceIds: scope.evidenceIds,
        currentRelationship: arc.currentRelationship,
        nodes
      })
    }
  ]
}

export function parseRelationshipArcInsight(raw: string, arc: RelationshipArc): RelationshipArcInsight | undefined {
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const row = parsed as Record<string, unknown>
  const scope = selectRelationshipArcInsightScope(arc)
  const characterId = typeof row.characterId === 'string' ? row.characterId : ''
  const arcFingerprint = typeof row.arcFingerprint === 'string' ? row.arcFingerprint : ''
  const nodeIds = uniqueStrings(row.nodeIds)
  const evidenceIds = uniqueStrings(row.evidenceIds)
  if (characterId !== scope.characterId || arcFingerprint !== scope.arcFingerprint) return undefined
  if (!sameSet(nodeIds, scope.nodeIds) || !sameSet(evidenceIds, scope.evidenceIds)) return undefined
  const summary = clean(row.summary, 160)
  if (!summary) return undefined
  const allowedNodes = new Set(scope.nodeIds)
  const turningPoints: RelationshipArcTurningPoint[] = []
  const seen = new Set<string>()
  if (Array.isArray(row.turningPoints)) {
    for (const rawPoint of row.turningPoints) {
      if (!rawPoint || typeof rawPoint !== 'object') continue
      const point = rawPoint as Record<string, unknown>
      const nodeId = typeof point.nodeId === 'string' ? point.nodeId : ''
      const reason = clean(point.reason, 36)
      if (!allowedNodes.has(nodeId) || seen.has(nodeId) || !reason) continue
      seen.add(nodeId)
      turningPoints.push({ nodeId, reason })
      if (turningPoints.length >= 4) break
    }
  }
  return { characterId, arcFingerprint, nodeIds, evidenceIds, summary, turningPoints }
}

export async function proposeRelationshipArcInsight(
  arc: RelationshipArc
): Promise<{ insight?: RelationshipArcInsight; model: string }> {
  if (!arc.nodes.length) return { model: '' }
  const [{ createProvider }, { getModelSettings }] = await Promise.all([
    import('./ai/providerFactory'),
    import('./modelSettings')
  ])
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new RelationshipArcInsightAiUnconfiguredError()
  }
  const provider = createProvider(settings)
  const response = await provider.chat({
    model: settings.model,
    temperature: Math.min(0.35, Math.max(0, settings.temperature ?? 0.2)),
    messages: buildRelationshipArcInsightMessages(arc)
  })
  return {
    insight: parseRelationshipArcInsight(response.text, arc),
    model: settings.model
  }
}
