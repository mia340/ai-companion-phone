import { describe, expect, it } from 'vitest'
import {
  COUPLE_BOARD_CELLS,
  attachCoupleBoardGeneratedPrompt,
  buildCoupleBoardChatShare,
  buildCoupleBoardHighlights,
  coupleBoardChallengeFingerprint,
  createCoupleBoardCustomPrompt,
  createCoupleBoardGame,
  drawCoupleBoardPrompt,
  getCoupleBoardGamePrompt,
  getCoupleBoardPrompt,
  mergeCoupleBoardShareIntoDraft,
  parseCoupleBoardGame,
  parseCoupleBoardPreferences,
  promptsFor,
  promptsForGame,
  replaceCoupleBoardPrompt,
  resolveCoupleBoardChallenge,
  resolveCoupleBoardEvent,
  rollCoupleBoard,
  validateCoupleBoardAdultMode,
  type CoupleBoardPrompt,
  type CoupleBoardSettings
} from './coupleBoardGameService'

const baseSettings: CoupleBoardSettings = {
  characterId: 'char-1',
  characterName: '阿澈',
  characterAge: 24,
  intensity: 2,
  mode: 'chat',
  adultConfirmed: false
}

function gameAt(position: number) {
  const game = createCoupleBoardGame(baseSettings, new Date('2026-09-21T00:00:00.000Z'))
  game.players.user.position = position
  return game
}

describe('coupleBoardGameService', () => {
  it('builds a fixed 30-cell board with stable start and finish', () => {
    expect(COUPLE_BOARD_CELLS).toHaveLength(30)
    expect(COUPLE_BOARD_CELLS[0].type).toBe('start')
    expect(COUPLE_BOARD_CELLS[29].type).toBe('finish')
  })

  it('starts a game with the user turn and isolated player state', () => {
    const game = createCoupleBoardGame(baseSettings)
    expect(game.currentPlayer).toBe('user')
    expect(game.players.user.position).toBe(0)
    expect(game.players.partner.name).toBe('阿澈')
    expect(game.pending).toBeUndefined()
    expect(game.pendingEvent).toBeUndefined()
    expect(game.sessionPrompts).toEqual([])
  })

  it('blocks adult mode for an explicitly underage character', () => {
    const error = validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, characterAge: 17, adultConfirmed: true })
    expect(error).toContain('小于 18')
  })

  it('requires explicit adult confirmation for level 4', () => {
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, adultConfirmed: false })).toContain('确认')
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, adultConfirmed: true })).toBeUndefined()
  })

  it('never exposes adult-only prompts below level 4', () => {
    expect(promptsFor('truth', 3, 'chat').some(prompt => prompt.adultOnly)).toBe(false)
    expect(promptsFor('truth', 4, 'chat').some(prompt => prompt.adultOnly)).toBe(true)
  })

  it('creates an evidence-free local challenge when landing on a truth cell', () => {
    const next = rollCoupleBoard(gameAt(0), 1, 0)
    expect(next.players.user.position).toBe(1)
    expect(next.pending?.promptType).toBe('truth')
    expect(getCoupleBoardPrompt(next.pending?.promptId || '')?.type).toBe('truth')
  })

  it('completing a challenge adds hearts, records completion and switches turns', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const next = resolveCoupleBoardChallenge(rolled, 'completed')
    expect(next.players.user.hearts).toBe(2)
    expect(next.players.user.completed).toBe(1)
    expect(next.currentPlayer).toBe('partner')
    expect(next.pending).toBeUndefined()
    expect(next.history.at(-1)?.resolution).toBe('completed')
  })

  it('skipping is always available and cannot make heart score negative', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const next = resolveCoupleBoardChallenge(rolled, 'skipped')
    expect(next.players.user.hearts).toBe(0)
    expect(next.players.user.skipped).toBe(1)
    expect(next.currentPlayer).toBe('partner')
  })

  it('replaces a prompt without ending the current turn', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const firstId = rolled.pending?.promptId
    const next = replaceCoupleBoardPrompt(rolled, 0.99)
    expect(next.pending?.promptId).not.toBe(firstId)
    expect(next.currentPlayer).toBe('user')
    expect(next.pending?.replacementCount).toBe(1)
  })

  it('changes the async challenge fingerprint when the pending card changes', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const before = coupleBoardChallengeFingerprint(rolled)
    const replaced = replaceCoupleBoardPrompt(rolled, 0.99)
    expect(coupleBoardChallengeFingerprint(replaced)).not.toBe(before)
    expect(coupleBoardChallengeFingerprint(resolveCoupleBoardChallenge(replaced, 'skipped'))).toBe('')
  })

  it('applies board movement effects before resolving the final cell', () => {
    const boosted = rollCoupleBoard(gameAt(4), 1, 0)
    expect(boosted.players.user.position).toBe(7)
    expect(boosted.players.user.hearts).toBe(1)
    expect(boosted.currentPlayer).toBe('partner')

    const rewound = rollCoupleBoard(gameAt(8), 4, 0)
    expect(rewound.players.user.position).toBe(10)
  })

  it('clamps overshoot to the finish and records the winner', () => {
    const next = rollCoupleBoard(gameAt(27), 6, 0)
    expect(next.players.user.position).toBe(29)
    expect(next.status).toBe('finished')
    expect(next.winner).toBe('user')
  })

  it('can persist-parse a valid game and rejects malformed snapshots', () => {
    const game = createCoupleBoardGame(baseSettings)
    expect(parseCoupleBoardGame(game)?.id).toBe(game.id)
    expect(parseCoupleBoardGame({ ...game, players: null })).toBeUndefined()
  })

  it('keeps parsing V1 snapshots that predate session prompts and event cards', () => {
    const game = createCoupleBoardGame(baseSettings)
    const legacy = { ...game } as Record<string, unknown>
    delete legacy.sessionPrompts
    delete legacy.pendingEvent
    expect(parseCoupleBoardGame(legacy)?.id).toBe(game.id)
  })

  it('builds a chat draft without auto-sending or deciding consent for the user', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const share = buildCoupleBoardChatShare(rolled, 'conv-1')!
    expect(share.conversationId).toBe('conv-1')
    expect(share.draft).toContain('心跳飞行棋')
    expect(share.draft).toContain('不要替我')
    expect(share.draft).toContain('[心跳飞行棋 game:')
    expect(mergeCoupleBoardShareIntoDraft('', share)).toBe(share.draft)
    expect(mergeCoupleBoardShareIntoDraft(share.draft, share)).toBe(share.draft)
  })

  it('keeps mode-specific prompts out of the wrong mode pool', () => {
    const chat = promptsFor('dare', 4, 'chat')
    const reality = promptsFor('dare', 4, 'reality')
    expect(chat.some(prompt => prompt.id === 'd4-03')).toBe(true)
    expect(reality.some(prompt => prompt.id === 'd4-03')).toBe(false)
    expect(drawCoupleBoardPrompt('dare', 1, 'chat', 0).type).toBe('dare')
  })

  it('sanitizes custom prompts and forces level-4 entries behind the adult gate', () => {
    const prompt = createCoupleBoardCustomPrompt({
      type: 'truth',
      intensity: 4,
      modes: ['chat', 'chat'],
      text: '<b>说出一个只想让我知道的小秘密</b>'
    }, new Date('2026-09-21T01:00:00.000Z'))
    expect(prompt.source).toBe('custom')
    expect(prompt.adultOnly).toBe(true)
    expect(prompt.modes).toEqual(['chat'])
    expect(prompt.text).not.toContain('<b>')
  })

  it('freezes eligible custom prompts into a game and filters them by mode and intensity', () => {
    const customChat = createCoupleBoardCustomPrompt({
      type: 'truth', intensity: 2, modes: ['chat'], text: '我们的自定义真心话'
    })
    const customReality = createCoupleBoardCustomPrompt({
      type: 'truth', intensity: 2, modes: ['reality'], text: '现实模式题'
    })
    const tooStrong = createCoupleBoardCustomPrompt({
      type: 'truth', intensity: 3, modes: ['chat'], text: '更高强度题'
    })
    const game = createCoupleBoardGame(baseSettings, new Date(), [customChat, customReality, tooStrong])
    const pool = promptsForGame(game, 'truth')
    expect(pool.some(row => row.id === customChat.id)).toBe(true)
    expect(pool.some(row => row.id === customReality.id)).toBe(false)
    expect(pool.some(row => row.id === tooStrong.id)).toBe(false)
  })

  it('persists only valid custom prompts in preferences', () => {
    const custom = createCoupleBoardCustomPrompt({
      type: 'dare', intensity: 1, modes: ['chat'], text: '发一个你现在最想发的表情'
    })
    const parsed = parseCoupleBoardPreferences({
      version: 1,
      customPrompts: [custom, { ...custom, id: 'fake-built-in', source: 'builtin' }],
      updatedAt: '2026-09-21T00:00:00.000Z'
    })
    expect(parsed?.customPrompts).toHaveLength(1)
    expect(parsed?.customPrompts[0].id).toBe(custom.id)
  })

  it('turns surprise cells into resolvable event cards with explicit heart deltas', () => {
    const rolled = rollCoupleBoard(gameAt(3), 1, 0, new Date('2026-09-21T02:00:00.000Z'))
    expect(rolled.players.user.position).toBe(4)
    expect(rolled.pending).toBeUndefined()
    expect(rolled.pendingEvent?.eventCardId).toBe('event-sync')
    expect(rolled.currentPlayer).toBe('user')

    const resolved = resolveCoupleBoardEvent(rolled, new Date('2026-09-21T02:01:00.000Z'))
    expect(resolved.players.user.hearts).toBe(1)
    expect(resolved.players.partner.hearts).toBe(1)
    expect(resolved.pendingEvent).toBeUndefined()
    expect(resolved.currentPlayer).toBe('partner')
  })

  it('attaches an evidence-backed memory AI prompt only to the current challenge', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const memoryPrompt: CoupleBoardPrompt = {
      id: 'memory-proof-1',
      type: 'truth',
      intensity: 2,
      modes: ['chat'],
      text: '还记得我们第一次一起熬夜聊到很晚吗？那晚最让你心动的一句话是什么？',
      adultOnly: false,
      source: 'memory-ai',
      memoryEvidenceIds: ['mem-1']
    }
    const attached = attachCoupleBoardGeneratedPrompt(rolled, memoryPrompt)
    expect(attached.pending?.promptId).toBe(memoryPrompt.id)
    expect(getCoupleBoardGamePrompt(attached, memoryPrompt.id)?.memoryEvidenceIds).toEqual(['mem-1'])
    expect(attached.sessionPrompts?.some(row => row.id === memoryPrompt.id)).toBe(true)
  })

  it('rejects generated prompts that do not carry memory evidence', () => {
    const rolled = rollCoupleBoard(gameAt(0), 1, 0)
    const prompt: CoupleBoardPrompt = {
      id: 'memory-unproven', type: 'truth', intensity: 2, modes: ['chat'],
      text: '一个没有证据的问题', adultOnly: false, source: 'memory-ai'
    }
    expect(() => attachCoupleBoardGeneratedPrompt(rolled, prompt)).toThrow('真实记忆证据')
  })

  it('builds heartbeat highlights from completed prompts, memory proof and events', () => {
    let game = rollCoupleBoard(gameAt(0), 1, 0)
    const memoryPrompt: CoupleBoardPrompt = {
      id: 'memory-highlight', type: 'truth', intensity: 2, modes: ['chat'],
      text: '关于那次一起看海，你最想留住哪个瞬间？', adultOnly: false,
      source: 'memory-ai', memoryEvidenceIds: ['mem-sea']
    }
    game = attachCoupleBoardGeneratedPrompt(game, memoryPrompt)
    game = resolveCoupleBoardChallenge(game, 'completed')
    const highlights = buildCoupleBoardHighlights(game)
    expect(highlights.some(row => row.id === 'heartbeat-total')).toBe(true)
    expect(highlights.some(row => row.id === 'memory-challenge')).toBe(true)
  })
})
