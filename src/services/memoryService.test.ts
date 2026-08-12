import { describe, expect, it } from 'vitest'
import {
  extractMemoryCandidates,
  selectMemoryHits,
  selectMemoryHitsDetailed
} from './memoryService'
import type { CharacterMemory } from '../types/domain'

const make = (
  id: string,
  content: string,
  importance: CharacterMemory['importance'],
  patch: Partial<CharacterMemory> = {}
): CharacterMemory => ({
  id,
  conversationId: 'c',
  characterId: 'r',
  category: 'other',
  layer: 'fact',
  status: 'active',
  content,
  importance,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch
})

describe('multi-layer memory', () => {
  it('extracts explicit facts and promises into different layers', () => {
    const rows = extractMemoryCandidates(
      '请记住我对花生过敏。明天面试，记得提醒我。',
      'standard'
    )
    expect(rows.some(item => item.layer === 'fact')).toBe(true)
    expect(rows.some(item => item.layer === 'promise')).toBe(true)
  })


  it('stores a future interview as a fact instead of a shared experience', () => {
    const rows = extractMemoryCandidates('请记住，我下周三有面试', 'standard')
    const interview = rows.find(item => item.content.includes('面试'))
    expect(interview?.layer).toBe('fact')
    expect(interview?.category).toBe('event')
  })

  it('creates both fact and reminder promise when user asks for a reminder', () => {
    const rows = extractMemoryCandidates('明天面试，记得提醒我。', 'standard')
    expect(rows.some(item => item.layer === 'fact')).toBe(true)
    expect(rows.some(item => item.layer === 'promise')).toBe(true)
  })

  it('prefers a relevant promise over an unrelated fact', () => {
    const hits = selectMemoryHits([
      make('1', '用户喜欢草莓蛋糕', 4),
      make('2', '用户明天参加面试，需要提醒', 4, { category: 'promise', layer: 'promise' })
    ], '我面试结束了', 1)
    expect(hits[0].id).toBe('2')
  })

  it('lowers conflicted memories and explains why a memory was selected', () => {
    const hits = selectMemoryHitsDetailed([
      make('1', '用户住在上海', 5, { status: 'conflict' }),
      make('2', '用户住在杭州', 5, { locked: true })
    ], '你还记得我住在哪里吗', 2)
    expect(hits[0].memory.id).toBe('2')
    expect(hits[0].reasons.join('')).toContain('锁定')
  })
})
