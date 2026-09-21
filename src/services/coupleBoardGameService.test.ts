import { describe, expect, it } from 'vitest'
import {
  COUPLE_BOARD_CELLS,
  buildCoupleBoardChatShare,
  createCoupleBoardGame,
  drawCoupleBoardPrompt,
  getCoupleBoardPrompt,
  mergeCoupleBoardShareIntoDraft,
  parseCoupleBoardGame,
  promptsFor,
  replaceCoupleBoardPrompt,
  resolveCoupleBoardChallenge,
  rollCoupleBoard,
  validateCoupleBoardAdultMode,
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
})
