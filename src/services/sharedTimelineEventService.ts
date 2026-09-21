import type {
  SharedTimelineAcceptedEventSummary,
  SharedTimelineItem,
  SharedTimelineManualEventGroup,
  SharedTimelinePreferences
} from './sharedTimelineService'

export interface SharedTimelineEvent {
  id: string
  /** Stable across auto/manual conversion and evidence reordering. */
  evidenceKey: string
  worldId: string
  characterId?: string
  characterName?: string
  title: string
  summary: string
  occurredAt: string
  startedAt: string
  endedAt: string
  itemIds: string[]
  items: SharedTimelineItem[]
  sourceKinds: SharedTimelineItem['sourceKind'][]
  sourceLabels: string[]
  mediaPreviewUrls: string[]
  primaryRoute: string
  importance: number
  starred: boolean
  hidden: boolean
  manual: boolean
  manualGroupId?: string
}

export interface SharedTimelineRecallEvent {
  id: string
  evidenceIds: string[]
  date: string
  summary: string
  sourceLabel: string
  sourceRoute: string
  starred: boolean
}

const HOUR = 3600000
const AUTO_EVENT_MAX_SPAN = 8 * HOUR
const CONVERSATION_NEARBY_WINDOW = 90 * 60000
const TEXT_NEARBY_WINDOW = 6 * HOUR

function timeValue(value: string) {
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : 0
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function normalizeEventText(value: unknown, max = 260) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[ \u3000]{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

function tokenSet(value: string) {
  const normalized = value
    .toLocaleLowerCase('zh-CN')
    .replace(/[，。！？、；：,.!?;:()[\]{}<>“”‘’"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = new Set<string>()
  for (const word of normalized.split(' ')) {
    if (word.length >= 2) tokens.add(word)
    if (/^[\u3400-\u9fff]+$/.test(word)) {
      for (let index = 0; index < word.length - 1; index += 1) tokens.add(word.slice(index, index + 2))
    }
  }
  return tokens
}

function overlapScore(left: SharedTimelineItem, right: SharedTimelineItem) {
  const leftTokens = tokenSet(`${left.customTitle || left.title} ${left.summary} ${left.sourceExcerpt || ''}`)
  const rightTokens = tokenSet(`${right.customTitle || right.title} ${right.summary} ${right.sourceExcerpt || ''}`)
  if (!leftTokens.size || !rightTokens.size) return 0
  let overlap = 0
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1
  return overlap / Math.min(leftTokens.size, rightTokens.size)
}

function sameCharacter(left: SharedTimelineItem, right: SharedTimelineItem) {
  return Boolean(left.characterId && left.characterId === right.characterId)
}

function autoLink(left: SharedTimelineItem, right: SharedTimelineItem) {
  if (!sameCharacter(left, right)) return false
  if (left.sourceMessageId && right.sourceMessageId && left.sourceMessageId === right.sourceMessageId) return true
  const delta = Math.abs(timeValue(left.occurredAt) - timeValue(right.occurredAt))
  if (!Number.isFinite(delta) || delta > AUTO_EVENT_MAX_SPAN) return false
  if (
    left.conversationId &&
    left.conversationId === right.conversationId &&
    delta <= CONVERSATION_NEARBY_WINDOW &&
    (left.sourceKind !== right.sourceKind || left.sourceKind === 'media')
  ) return true
  return delta <= TEXT_NEARBY_WINDOW && overlapScore(left, right) >= 0.34
}

function hashIds(ids: readonly string[]) {
  let hash = 2166136261
  for (const char of [...ids].sort().join('|')) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function sharedTimelineEventEvidenceKey(itemIds: readonly string[]) {
  return `evidence:${hashIds(unique(itemIds.filter(Boolean)))}`
}

function sameEvidenceSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return set.size === left.length && right.every(id => set.has(id))
}

function eventTitle(items: readonly SharedTimelineItem[], preferred?: string) {
  const manual = normalizeEventText(preferred, 32)
  if (manual) return manual
  const ranked = [...items].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    if (a.importance !== b.importance) return b.importance - a.importance
    return timeValue(a.occurredAt) - timeValue(b.occurredAt)
  })
  return normalizeEventText(ranked[0]?.customTitle || ranked[0]?.title || '共同事件', 32) || '共同事件'
}

function eventSummary(items: readonly SharedTimelineItem[]) {
  const summaries: string[] = []
  for (const item of [...items].sort((a, b) => timeValue(a.occurredAt) - timeValue(b.occurredAt))) {
    const summary = normalizeEventText(item.summary, 150)
    if (!summary || summaries.some(existing => existing === summary)) continue
    summaries.push(summary)
    if (summaries.length >= 3) break
  }
  return normalizeEventText(summaries.join(' · '), 280)
}

function rankedPrimaryItem(items: readonly SharedTimelineItem[]) {
  return [...items].sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    if (a.importance !== b.importance) return b.importance - a.importance
    return timeValue(b.occurredAt) - timeValue(a.occurredAt)
  })[0]
}

function buildEvent(
  items: SharedTimelineItem[],
  options: { id: string; manual: boolean; group?: SharedTimelineManualEventGroup; preserveOrder?: boolean }
): SharedTimelineEvent {
  const chronological = [...items].sort((a, b) => timeValue(a.occurredAt) - timeValue(b.occurredAt))
  const displayed = options.preserveOrder ? [...items] : chronological
  const first = chronological[0]
  const last = chronological.at(-1) || first
  const mediaPreviewUrls = unique(chronological.map(item => item.mediaPreviewUrl).filter((value): value is string => Boolean(value))).slice(0, 3)
  const sourceKinds = unique(chronological.map(item => item.sourceKind))
  const sourceLabels = unique(chronological.map(item => item.sourceLabel))
  return {
    id: options.id,
    evidenceKey: sharedTimelineEventEvidenceKey(displayed.map(item => item.id)),
    worldId: first?.worldId || '',
    characterId: first?.characterId,
    characterName: first?.characterName,
    title: eventTitle(chronological, options.group?.title),
    summary: eventSummary(chronological),
    occurredAt: last?.occurredAt || first?.occurredAt || '',
    startedAt: first?.occurredAt || '',
    endedAt: last?.occurredAt || first?.occurredAt || '',
    itemIds: displayed.map(item => item.id),
    items: displayed,
    sourceKinds,
    sourceLabels,
    mediaPreviewUrls,
    primaryRoute: rankedPrimaryItem(chronological)?.sourceRoute || '',
    importance: Math.max(0, ...chronological.map(item => item.importance || 0)),
    starred: chronological.some(item => item.starred),
    hidden: chronological.every(item => item.hidden),
    manual: options.manual,
    ...(options.group ? { manualGroupId: options.group.id } : {})
  }
}

export function buildSharedTimelineEvents(
  items: readonly SharedTimelineItem[],
  preferences?: Pick<SharedTimelinePreferences, 'eventGroups'>
): SharedTimelineEvent[] {
  const byId = new Map(items.map(item => [item.id, item]))
  const claimed = new Set<string>()
  const events: SharedTimelineEvent[] = []

  for (const group of preferences?.eventGroups || []) {
    const groupedItems = group.itemIds
      .map(id => byId.get(id))
      .filter((item): item is SharedTimelineItem => item !== undefined && !claimed.has(item.id))
    if (groupedItems.length < 2) continue
    groupedItems.forEach(item => claimed.add(item.id))
    events.push(buildEvent(groupedItems, {
      id: `manual:${group.id}`,
      manual: true,
      group,
      preserveOrder: true
    }))
  }

  const candidates = items
    .filter(item => !claimed.has(item.id))
    .sort((a, b) => timeValue(a.occurredAt) - timeValue(b.occurredAt))

  while (candidates.length) {
    const seed = candidates.shift()
    if (!seed) break
    const cluster = [seed]
    let changed = true
    while (changed) {
      changed = false
      const clusterStart = Math.min(...cluster.map(item => timeValue(item.occurredAt)))
      const clusterEnd = Math.max(...cluster.map(item => timeValue(item.occurredAt)))
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index]
        const candidateTime = timeValue(candidate.occurredAt)
        if (Math.max(clusterEnd, candidateTime) - Math.min(clusterStart, candidateTime) > AUTO_EVENT_MAX_SPAN) continue
        if (!cluster.some(item => autoLink(item, candidate))) continue
        cluster.push(candidate)
        candidates.splice(index, 1)
        changed = true
      }
    }
    const ids = cluster.map(item => item.id)
    events.push(buildEvent(cluster, {
      id: cluster.length > 1 ? `auto:${hashIds(ids)}` : `single:${seed.id}`,
      manual: false
    }))
  }

  return events.sort((a, b) => timeValue(b.occurredAt) - timeValue(a.occurredAt))
}

export function projectSharedTimelineEvents(
  events: readonly SharedTimelineEvent[],
  visibleItems: readonly SharedTimelineItem[]
): SharedTimelineEvent[] {
  const visibleIds = new Set(visibleItems.map(item => item.id))
  const result: SharedTimelineEvent[] = []
  for (const event of events) {
    const projectedItems = event.items.filter(item => visibleIds.has(item.id))
    if (!projectedItems.length) continue
    const projected = buildEvent(projectedItems, {
      id: event.id,
      manual: event.manual,
      preserveOrder: event.manual
    })
    const keepsCompleteEvidence = projectedItems.length === event.items.length
      && projectedItems.every(item => event.itemIds.includes(item.id))
    result.push({
      ...projected,
      id: event.id,
      // Preserve the original stable key when projection keeps the complete evidence set.
      // If any evidence is filtered out (for example hidden), the rebuilt key intentionally
      // changes so accepted summaries cannot leak across a different provenance set.
      evidenceKey: keepsCompleteEvidence ? event.evidenceKey : projected.evidenceKey,
      manual: event.manual,
      ...(event.manualGroupId ? { manualGroupId: event.manualGroupId } : {}),
      ...(event.manual ? { title: event.title } : {})
    })
  }
  return result.sort((a, b) => timeValue(b.occurredAt) - timeValue(a.occurredAt))
}

export function createManualTimelineEventGroup(
  itemIds: readonly string[],
  title?: string,
  now = new Date()
): SharedTimelineManualEventGroup | undefined {
  const uniqueIds = unique(itemIds.filter(Boolean)).slice(0, 24)
  if (uniqueIds.length < 2) return undefined
  const normalizedTitle = normalizeEventText(title, 32)
  const nonce = `${now.getTime().toString(36)}-${hashIds(uniqueIds)}`
  return {
    id: `event-${nonce}`,
    itemIds: uniqueIds,
    ...(normalizedTitle ? { title: normalizedTitle } : {}),
    createdAt: now.toISOString()
  }
}

export function upsertManualTimelineEventGroup(
  groups: readonly SharedTimelineManualEventGroup[],
  group: SharedTimelineManualEventGroup
): SharedTimelineManualEventGroup[] {
  const next = groups.filter(item => item.id !== group.id && !item.itemIds.some(id => group.itemIds.includes(id)))
  return [...next, group]
}

export function removeManualTimelineEventGroup(
  groups: readonly SharedTimelineManualEventGroup[],
  groupId: string
) {
  return groups.filter(group => group.id !== groupId)
}

export function reorderManualTimelineEventGroup(
  groups: readonly SharedTimelineManualEventGroup[],
  groupId: string,
  itemId: string,
  direction: -1 | 1
): SharedTimelineManualEventGroup[] {
  return groups.map(group => {
    if (group.id !== groupId) return group
    const index = group.itemIds.indexOf(itemId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= group.itemIds.length) return group
    const itemIds = [...group.itemIds]
    const [moved] = itemIds.splice(index, 1)
    itemIds.splice(target, 0, moved)
    return { ...group, itemIds }
  })
}

export function resolveSharedTimelineEventSummary(
  event: SharedTimelineEvent,
  preferences: Pick<SharedTimelinePreferences, 'eventSummaries'> | undefined
): SharedTimelineAcceptedEventSummary | undefined {
  const stored = preferences?.eventSummaries?.[event.evidenceKey]
  if (!stored || !sameEvidenceSet(stored.evidenceIds, event.itemIds)) return undefined
  return stored
}

export function selectSharedTimelineRecallEvent(
  items: readonly SharedTimelineItem[],
  preferences: Pick<SharedTimelinePreferences, 'eventGroups' | 'eventSummaries'> | undefined,
  options: { characterId: string; now?: Date; minAgeDays?: number }
): SharedTimelineRecallEvent | undefined {
  const now = options.now ?? new Date()
  const minAge = Math.max(1, options.minAgeDays ?? 7) * 86400000
  const allEvents = buildSharedTimelineEvents(items, preferences)
  const events = projectSharedTimelineEvents(allEvents, items.filter(item => !item.hidden))
  const event = events
    .filter(row => row.characterId === options.characterId)
    .filter(row => {
      const time = timeValue(row.endedAt)
      return time > 0 && now.getTime() - time >= minAge
    })
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1
      if (a.items.length !== b.items.length) return b.items.length - a.items.length
      if (a.importance !== b.importance) return b.importance - a.importance
      return timeValue(b.endedAt) - timeValue(a.endedAt)
    })[0]
  if (!event) return undefined
  const acceptedSummary = resolveSharedTimelineEventSummary(event, preferences)
  return {
    id: event.id,
    evidenceIds: event.itemIds,
    date: event.startedAt.slice(0, 10),
    summary: (acceptedSummary?.summary || event.summary).slice(0, 220),
    sourceLabel: event.sourceLabels.join(' + ').slice(0, 100),
    sourceRoute: event.primaryRoute,
    starred: event.starred
  }
}
