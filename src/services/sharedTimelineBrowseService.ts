import type { SharedTimelineItem } from './sharedTimelineService'

export type SharedTimelineTimeFilter = 'all' | 'recent' | 'anniversary' | 'earliest'

export interface SharedTimelineFilterOptions {
  query?: string
  characterId?: string
  onlyStarred?: boolean
  showHidden?: boolean
  timeFilter?: SharedTimelineTimeFilter
  now?: Date
}

export interface SharedTimelineGroup {
  key: string
  label: string
  items: SharedTimelineItem[]
}

export interface SharedTimelineHighlights {
  recent: number
  anniversary: number
  media: number
  earliest: number
}

export interface SharedTimelineRecallEvidence {
  id: string
  date: string
  summary: string
  sourceLabel: string
  sourceRoute: string
  starred: boolean
}

function timeValue(value: string) {
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : 0
}

function localDateParts(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return undefined
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

function matchesAnniversary(item: SharedTimelineItem, now: Date) {
  const date = localDateParts(item.occurredAt)
  if (!date) return false
  return date.year < now.getFullYear() && date.month === now.getMonth() && date.day === now.getDate()
}

function earliestIds(items: readonly SharedTimelineItem[]) {
  const earliest = new Map<string, SharedTimelineItem>()
  for (const item of items) {
    const key = item.characterId || '__shared__'
    const current = earliest.get(key)
    if (!current || timeValue(item.occurredAt) < timeValue(current.occurredAt)) earliest.set(key, item)
  }
  return new Set(Array.from(earliest.values(), item => item.id))
}

export function normalizeSharedTimelineSearch(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function filterSharedTimelineItems(
  items: readonly SharedTimelineItem[],
  options: SharedTimelineFilterOptions = {}
): SharedTimelineItem[] {
  const now = options.now ?? new Date()
  const query = normalizeSharedTimelineSearch(options.query).toLocaleLowerCase('zh-CN')
  const prefiltered = items.filter(item => {
    if (!options.showHidden && item.hidden) return false
    if (options.onlyStarred && !item.starred) return false
    if (options.characterId && item.characterId !== options.characterId) return false
    return true
  })
  const earliest = options.timeFilter === 'earliest' ? earliestIds(prefiltered) : undefined
  const recentThreshold = now.getTime() - 30 * 86400000

  return prefiltered.filter(item => {
    if (options.timeFilter === 'recent' && timeValue(item.occurredAt) < recentThreshold) return false
    if (options.timeFilter === 'anniversary' && !matchesAnniversary(item, now)) return false
    if (options.timeFilter === 'earliest' && !earliest?.has(item.id)) return false
    if (query) {
      const haystack = [
        item.customTitle,
        item.title,
        item.summary,
        item.characterName,
        item.sourceLabel,
        item.sourceExcerpt,
        item.mediaLabel
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN')
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export function groupSharedTimelineItems(items: readonly SharedTimelineItem[]): SharedTimelineGroup[] {
  const groups = new Map<string, SharedTimelineGroup>()
  for (const item of items) {
    const date = new Date(item.occurredAt)
    const valid = Number.isFinite(date.getTime())
    const key = valid
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      : 'unknown'
    const label = valid ? `${date.getFullYear()}年${date.getMonth() + 1}月` : '时间未知'
    const group = groups.get(key) || { key, label, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return Array.from(groups.values())
}

export function buildSharedTimelineHighlights(
  items: readonly SharedTimelineItem[],
  now = new Date()
): SharedTimelineHighlights {
  const visible = items.filter(item => !item.hidden)
  const recentThreshold = now.getTime() - 30 * 86400000
  return {
    recent: visible.filter(item => timeValue(item.occurredAt) >= recentThreshold).length,
    anniversary: visible.filter(item => matchesAnniversary(item, now)).length,
    media: visible.filter(item => item.mediaKind === 'image' || item.mediaKind === 'music').length,
    earliest: earliestIds(visible).size
  }
}

export function selectSharedTimelineRecallEvidence(
  items: readonly SharedTimelineItem[],
  options: { characterId: string; now?: Date; minAgeDays?: number }
): SharedTimelineRecallEvidence | undefined {
  const now = options.now ?? new Date()
  const minAge = Math.max(1, options.minAgeDays ?? 7) * 86400000
  const candidates = items
    .filter(item => !item.hidden && item.characterId === options.characterId)
    .filter(item => {
      const time = timeValue(item.occurredAt)
      return time > 0 && now.getTime() - time >= minAge
    })
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1
      if (a.importance !== b.importance) return b.importance - a.importance
      return timeValue(b.occurredAt) - timeValue(a.occurredAt)
    })
  const item = candidates[0]
  if (!item) return undefined
  return {
    id: item.id,
    date: item.occurredAt.slice(0, 10),
    summary: item.summary.slice(0, 180),
    sourceLabel: item.sourceLabel,
    sourceRoute: item.sourceRoute,
    starred: item.starred
  }
}
