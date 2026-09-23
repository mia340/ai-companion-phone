import { describe, expect, it } from 'vitest'
import { buildCoupleBoardMemoryEventText, parseCoupleBoardMemoryCandidates } from './coupleBoardMemoryBridge'
import type { CoupleBoardInteraction } from './coupleBoardInteractionService'

const interaction: CoupleBoardInteraction = {
  id: 'i1', gameId: 'g1', promptId: 'p1', actor: 'user', characterId: 'c1', conversationId: 'conv-1',
  questionText: '你最喜欢怎么被抱？', locationName: '沙发边', status: 'closed', memorySyncedIds: [],
  messages: [
    { id: 'm1', speaker: 'user', text: '我喜欢你从后面抱我。', createdAt: '2026-09-23T00:00:00.000Z' },
    { id: 'm2', speaker: 'partner', text: '好，我会记住。', createdAt: '2026-09-23T00:00:01.000Z' }
  ],
  createdAt: '2026-09-23T00:00:00.000Z', updatedAt: '2026-09-23T00:00:01.000Z'
}

describe('coupleBoardMemoryBridge', () => {
  it('stores the game interaction as what was actually said, not an invented fact', () => {
    const text = buildCoupleBoardMemoryEventText(interaction, '阿澈')
    expect(text).toContain('心跳飞行棋 · 沙发边')
    expect(text).toContain('用户：「我喜欢你从后面抱我。」')
    expect(text).toContain('阿澈：「好，我会记住。」')
  })

  it('only accepts stable extracted memories and drops hypothetical/transient candidates', () => {
    const parsed = parseCoupleBoardMemoryCandidates(JSON.stringify([
      { kind: 'stable', content: '用户喜欢伴侣从背后拥抱自己。', category: 'preference', layer: 'fact', importance: 4 },
      { kind: 'hypothetical', content: '用户已经和角色住在一起。', category: 'event', layer: 'shared', importance: 5 },
      { kind: 'transient', content: '用户这一秒有点害羞。', category: 'other', layer: 'fact', importance: 1 }
    ]))
    expect(parsed).toHaveLength(1)
    expect(parsed[0].content).toContain('从背后拥抱')
  })
})
