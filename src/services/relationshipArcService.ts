import {
  projectSharedTimelineEvents,
  resolveSharedTimelineEventSummary,
  type SharedTimelineEvent
} from './sharedTimelineEventService'
import type {
  SharedTimelineAcceptedRelationshipArcSummary,
  SharedTimelinePreferences,
  SharedTimelineRelationshipSignal
} from './sharedTimelineService'

export type RelationshipArcNodeKind = SharedTimelineRelationshipSignal

export interface RelationshipArcNode {
  id: string
  eventId: string
  evidenceKey: string
  evidenceIds: string[]
  characterId: string
  characterName?: string
  kind: RelationshipArcNodeKind
  occurredAt: string
  startedAt: string
  endedAt: string
  title: string
  summary: string
  relationshipBefore?: string
  relationshipAfter?: string
  sourceLabels: string[]
  primaryRoute: string
  conversationId?: string
  importance: number
  starred: boolean
}

export interface RelationshipArcPhase {
  id: string
  label: string
  relationshipState?: string
  startedAt: string
  endedAt: string
  nodes: RelationshipArcNode[]
}

export interface RelationshipArcInsightScope {
  arcFingerprint: string
  characterId: string
  nodeIds: string[]
  evidenceIds: string[]
  nodes: RelationshipArcNode[]
}

export interface RelationshipArc {
  characterId: string
  characterName?: string
  fingerprint: string
  nodes: RelationshipArcNode[]
  phases: RelationshipArcPhase[]
  evidenceIds: string[]
  currentRelationship?: string
  promiseCount: number
  relationshipChangeCount: number
  sharedEventCount: number
  starredCount: number
}

function timeValue(value: string) {
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : 0
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function clean(value: unknown, max = 220) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[ \u3000]{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

function hashText(value: string) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return set.size === left.length && right.every(id => set.has(id))
}

function nodeKind(event: SharedTimelineEvent): RelationshipArcNodeKind {
  const signals = new Set(event.items.map(item => item.relationshipSignal).filter(Boolean))
  if (signals.has('relationship-change')) return 'relationship-change'
  if (signals.has('promise')) return 'promise'
  if (signals.has('goal')) return 'goal'
  if (signals.has('story')) return 'story'
  return 'shared-event'
}

function relationshipTransition(event: SharedTimelineEvent) {
  const rows = event.items
    .filter(item => item.relationshipSignal === 'relationship-change' && item.relationshipNextValue)
    .sort((a, b) => timeValue(a.occurredAt) - timeValue(b.occurredAt))
  const row = rows.at(-1)
  return row
    ? {
        before: clean(row.relationshipPreviousValue, 120) || undefined,
        after: clean(row.relationshipNextValue, 120) || undefined
      }
    : undefined
}

function eventConversationId(event: SharedTimelineEvent) {
  return event.items.find(item => item.conversationId)?.conversationId
}

function buildNode(event: SharedTimelineEvent, preferences?: SharedTimelinePreferences): RelationshipArcNode | undefined {
  if (!event.characterId || !event.items.length || event.hidden) return undefined
  const accepted = preferences ? resolveSharedTimelineEventSummary(event, preferences) : undefined
  const transition = relationshipTransition(event)
  return {
    id: `arc-node:${event.id}`,
    eventId: event.id,
    evidenceKey: event.evidenceKey,
    evidenceIds: [...event.itemIds],
    characterId: event.characterId,
    characterName: event.characterName,
    kind: nodeKind(event),
    occurredAt: event.occurredAt,
    startedAt: event.startedAt,
    endedAt: event.endedAt,
    title: clean(event.title, 48) || '共同事件',
    summary: clean(accepted?.summary || event.summary, 280),
    ...(transition?.before ? { relationshipBefore: transition.before } : {}),
    ...(transition?.after ? { relationshipAfter: transition.after } : {}),
    sourceLabels: [...event.sourceLabels],
    primaryRoute: event.primaryRoute,
    ...(eventConversationId(event) ? { conversationId: eventConversationId(event) } : {}),
    importance: event.importance,
    starred: event.starred
  }
}

function arcFingerprint(characterId: string, nodes: readonly RelationshipArcNode[]) {
  const payload = nodes
    .map(node => `${node.id}:${[...node.evidenceIds].sort().join(',')}`)
    .join('|')
  return `arc:${characterId}:${hashText(payload)}`
}

function buildPhases(nodes: readonly RelationshipArcNode[]): RelationshipArcPhase[] {
  if (!nodes.length) return []
  const phases: RelationshipArcPhase[] = []
  let current: RelationshipArcNode[] = []
  let currentRelationship: string | undefined
  let phaseSeed = 'origin'

  const flush = () => {
    if (!current.length) return
    phases.push({
      id: `arc-phase:${phaseSeed}:${current[0].id}`,
      label: currentRelationship ? `关系记录：${currentRelationship}` : '有证据的共同经历',
      ...(currentRelationship ? { relationshipState: currentRelationship } : {}),
      startedAt: current[0].startedAt,
      endedAt: current.at(-1)?.endedAt || current[0].endedAt,
      nodes: current
    })
    current = []
  }

  for (const node of nodes) {
    if (node.kind === 'relationship-change' && node.relationshipAfter) {
      flush()
      currentRelationship = node.relationshipAfter
      phaseSeed = node.id
    }
    current.push(node)
  }
  flush()
  return phases
}

export function buildRelationshipArc(
  events: readonly SharedTimelineEvent[],
  characterId: string,
  preferences?: SharedTimelinePreferences
): RelationshipArc | undefined {
  if (!characterId) return undefined
  // Scope by the event owner before projection, then scope evidence by the same character.
  // This keeps a stale or malformed event wrapper from re-projecting another character's
  // evidence into the requested arc. Events without an owner may still be recovered from
  // their evidence rows, but mixed-character evidence is never admitted.
  const scopedEvents = events.filter(event =>
    event.characterId === characterId
    || (!event.characterId && event.items.some(item => item.characterId === characterId))
  )
  const visibleItems = scopedEvents
    .flatMap(event => event.items)
    .filter(item => !item.hidden && item.characterId === characterId)
  const projectedEvents = projectSharedTimelineEvents(scopedEvents, visibleItems)
  const nodes = projectedEvents
    .filter(event => event.characterId === characterId && !event.hidden)
    .map(event => buildNode(event, preferences))
    .filter((node): node is RelationshipArcNode => Boolean(node))
    .sort((a, b) => timeValue(a.startedAt) - timeValue(b.startedAt) || a.id.localeCompare(b.id))
  if (!nodes.length) return undefined
  const evidenceIds = unique(nodes.flatMap(node => node.evidenceIds))
  const latestRelationshipNode = [...nodes].reverse().find(node => node.relationshipAfter)
  return {
    characterId,
    characterName: nodes.find(node => node.characterName)?.characterName,
    fingerprint: arcFingerprint(characterId, nodes),
    nodes,
    phases: buildPhases(nodes),
    evidenceIds,
    ...(latestRelationshipNode?.relationshipAfter ? { currentRelationship: latestRelationshipNode.relationshipAfter } : {}),
    promiseCount: nodes.filter(node => node.kind === 'promise').length,
    relationshipChangeCount: nodes.filter(node => node.kind === 'relationship-change').length,
    sharedEventCount: nodes.filter(node => node.kind === 'shared-event' || node.kind === 'story').length,
    starredCount: nodes.filter(node => node.starred).length
  }
}

export function buildRelationshipArcs(
  events: readonly SharedTimelineEvent[],
  characterIds: readonly string[],
  preferences?: SharedTimelinePreferences
) {
  return unique(characterIds)
    .map(characterId => buildRelationshipArc(events, characterId, preferences))
    .filter((arc): arc is RelationshipArc => Boolean(arc))
    .sort((a, b) => {
      const left = timeValue(a.nodes.at(-1)?.occurredAt || '')
      const right = timeValue(b.nodes.at(-1)?.occurredAt || '')
      return right - left
    })
}

export function selectRelationshipArcInsightScope(arc: RelationshipArc, maxNodes = 18): RelationshipArcInsightScope {
  const limit = Math.max(4, Math.min(30, Math.floor(maxNodes)))
  const selected = new Map<string, RelationshipArcNode>()
  const add = (node: RelationshipArcNode | undefined) => {
    if (node && selected.size < limit) selected.set(node.id, node)
  }

  add(arc.nodes[0])
  add(arc.nodes.at(-1))
  for (const node of arc.nodes) {
    if (node.kind === 'relationship-change' || node.kind === 'promise') add(node)
  }
  for (const node of [...arc.nodes].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    if (a.importance !== b.importance) return b.importance - a.importance
    return timeValue(b.occurredAt) - timeValue(a.occurredAt)
  })) add(node)

  const nodes = [...selected.values()].sort((a, b) => timeValue(a.startedAt) - timeValue(b.startedAt))
  return {
    arcFingerprint: arc.fingerprint,
    characterId: arc.characterId,
    nodeIds: nodes.map(node => node.id),
    evidenceIds: unique(nodes.flatMap(node => node.evidenceIds)),
    nodes
  }
}

export function resolveRelationshipArcSummary(
  arc: RelationshipArc,
  preferences?: Pick<SharedTimelinePreferences, 'relationshipArcSummaries'>
): SharedTimelineAcceptedRelationshipArcSummary | undefined {
  const stored = preferences?.relationshipArcSummaries?.[arc.fingerprint]
  if (!stored || stored.characterId !== arc.characterId) return undefined
  const scope = selectRelationshipArcInsightScope(arc)
  if (!sameStringSet(stored.nodeIds, scope.nodeIds) || !sameStringSet(stored.evidenceIds, scope.evidenceIds)) return undefined
  const turningPointNodeIds = (stored.turningPointNodeIds || []).filter(id => scope.nodeIds.includes(id))
  return {
    ...stored,
    ...(turningPointNodeIds.length ? { turningPointNodeIds } : { turningPointNodeIds: undefined })
  }
}

export function relationshipArcNodeKindLabel(kind: RelationshipArcNodeKind) {
  if (kind === 'relationship-change') return '关系变化'
  if (kind === 'promise') return '约定'
  if (kind === 'goal') return '共同目标'
  if (kind === 'story') return '剧情节点'
  return '共同经历'
}
