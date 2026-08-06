import { describe, expect, it } from 'vitest'
import { selectMemoryHits } from './memoryService'
import type { CharacterMemory } from '../types/domain'

const make = (id: string, content: string, importance: CharacterMemory['importance']): CharacterMemory => ({
  id,
  conversationId: 'c',
  characterId: 'r',
  category: 'other',
  content,
  importance,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

describe('memory selection', () => {
  it('prefers a relevant memory over an unrelated one', () => {
    const hits = selectMemoryHits([
      make('1', '用户喜欢草莓蛋糕', 3),
      make('2', '用户明天参加面试', 3)
    ], '我面试结束了', 1)
    expect(hits[0].id).toBe('2')
  })
})
