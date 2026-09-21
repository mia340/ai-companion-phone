import type { SharedTimelineEvent } from './sharedTimelineEventService'

export type SharedTimelineRelationKind = 'same-day' | 'same-character' | 'continuation'
export interface SharedTimelineEventRelation { fromId: string; toId: string; kind: SharedTimelineRelationKind; score: number; label: string }

const DAY = 86400000
function time(value: string) { const n = new Date(value).getTime(); return Number.isFinite(n) ? n : 0 }

export function relateSharedTimelineEvents(events: readonly SharedTimelineEvent[]): SharedTimelineEventRelation[] {
  const relations: SharedTimelineEventRelation[] = []
  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const left = events[i]; const right = events[j]
      if (!left.characterId || left.characterId !== right.characterId) continue
      const delta = Math.abs(time(left.startedAt) - time(right.startedAt))
      let kind: SharedTimelineRelationKind = 'same-character'; let score = 0.35; let label = '同一角色的另一段共同经历'
      if (delta <= DAY) { kind = 'same-day'; score = 0.9; label = '同一天发生' }
      else if (delta <= 14 * DAY && left.sourceKinds.some(kindValue => right.sourceKinds.includes(kindValue))) {
        kind = 'continuation'; score = 0.65; label = '时间接近且来源类型相连'
      }
      if (score >= 0.6) relations.push({ fromId: left.id, toId: right.id, kind, score, label })
    }
  }
  return relations.sort((a, b) => b.score - a.score)
}

export function relatedSharedTimelineEvents(eventId: string, events: readonly SharedTimelineEvent[], limit = 4) {
  const byId = new Map(events.map(event => [event.id, event]))
  return relateSharedTimelineEvents(events)
    .filter(row => row.fromId === eventId || row.toId === eventId)
    .slice(0, Math.max(0, limit))
    .flatMap(row => {
      const event = byId.get(row.fromId === eventId ? row.toId : row.fromId)
      return event ? [{ relation: row, event }] : []
    })
}
