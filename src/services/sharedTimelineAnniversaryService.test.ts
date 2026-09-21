import { describe, expect, it } from 'vitest'
import { buildSharedTimelineAnniversaries, nextSharedTimelineAnniversary } from './sharedTimelineAnniversaryService'
import type { SharedTimelineEvent } from './sharedTimelineEventService'
const event = (date: string): SharedTimelineEvent => ({ id:'e1', evidenceKey:'k1', worldId:'w', characterId:'c', title:'初见', summary:'第一次见面', occurredAt:date, startedAt:date, endedAt:date, itemIds:['i1'], items:[], sourceKinds:['memory'], sourceLabels:['记忆'], mediaPreviewUrls:[], primaryRoute:'', importance:3, starred:false, hidden:false, manual:false })
describe('sharedTimelineAnniversaryService', () => {
  it('计算下一次周年', () => expect(nextSharedTimelineAnniversary(event('2024-09-25T10:00:00Z'), new Date('2026-09-20T12:00:00'))?.daysUntil).toBe(5))
  it('当天标记 today', () => expect(nextSharedTimelineAnniversary(event('2024-09-20T10:00:00Z'), new Date('2026-09-20T12:00:00'))?.isToday).toBe(true))
  it('过去日期滚到下一年', () => expect(nextSharedTimelineAnniversary(event('2024-09-01T10:00:00Z'), new Date('2026-09-20T12:00:00'))?.years).toBe(3))
  it('未满一年不生成周年', () => expect(nextSharedTimelineAnniversary(event('2026-09-25T10:00:00Z'), new Date('2026-09-20T12:00:00'))).toBeUndefined())
  it('只返回窗口内周年', () => expect(buildSharedTimelineAnniversaries([event('2024-09-25T10:00:00Z')], new Date('2026-09-20T12:00:00'), 3)).toHaveLength(0))
  it('周年列表按临近程度排序', () => { const a=event('2024-09-28T10:00:00Z'); a.id='a'; const b=event('2024-09-22T10:00:00Z'); b.id='b'; expect(buildSharedTimelineAnniversaries([a,b], new Date('2026-09-20T12:00:00'))[0].eventId).toBe('b') })
})
