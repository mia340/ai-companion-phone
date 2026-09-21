import type { SharedTimelineEvent } from './sharedTimelineEventService'

export interface SharedTimelineAnniversary {
  eventId: string
  evidenceKey: string
  title: string
  originalDate: string
  nextDate: string
  years: number
  daysUntil: number
  isToday: boolean
}

const DAY = 86400000

function validDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function nextSharedTimelineAnniversary(event: SharedTimelineEvent, now = new Date()): SharedTimelineAnniversary | undefined {
  const occurred = validDate(event.startedAt || event.occurredAt)
  if (!occurred) return undefined
  const today = dateOnly(now)
  let year = today.getFullYear()
  let next = new Date(year, occurred.getMonth(), occurred.getDate())
  if (next.getTime() < today.getTime()) {
    year += 1
    next = new Date(year, occurred.getMonth(), occurred.getDate())
  }
  const years = year - occurred.getFullYear()
  if (years < 1) return undefined
  const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY)
  return {
    eventId: event.id,
    evidenceKey: event.evidenceKey,
    title: event.title,
    originalDate: event.startedAt.slice(0, 10),
    nextDate: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`,
    years,
    daysUntil,
    isToday: daysUntil === 0
  }
}

export function buildSharedTimelineAnniversaries(events: readonly SharedTimelineEvent[], now = new Date(), withinDays = 30) {
  return events
    .map(event => nextSharedTimelineAnniversary(event, now))
    .filter((row): row is SharedTimelineAnniversary => Boolean(row && row.daysUntil <= withinDays))
    .sort((a, b) => a.daysUntil - b.daysUntil || b.years - a.years)
}
