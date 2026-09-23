import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  COUPLE_BOARD_CELLS,
  COUPLE_BOARD_EVENT_CARDS,
  COUPLE_BOARD_PROMPTS,
  attachCoupleBoardGeneratedPrompt,
  buildCoupleBoardArchiveEntry,
  buildCoupleBoardChatShare,
  buildCoupleBoardHighlights,
  buildCoupleBoardResultChatShare,
  coupleBoardChallengeFingerprint,
  cloneCoupleBoardGame,
  createCoupleBoardCustomEventCard,
  createCoupleBoardCustomPrompt,
  createCoupleBoardGame,
  drawCoupleBoardGameEventCard,
  drawCoupleBoardGamePrompt,
  drawCoupleBoardPrompt,
  exportCoupleBoardLibrary,
  getCoupleBoardGameEventCard,
  getCoupleBoardGamePrompt,
  getCoupleBoardPrompt,
  importCoupleBoardLibrary,
  mergeCoupleBoardResultShareIntoDraft,
  mergeCoupleBoardShareIntoDraft,
  parseCoupleBoardArchive,
  parseCoupleBoardGame,
  parseCoupleBoardPreferences,
  promptsFor,
  promptsForGame,
  replaceCoupleBoardPrompt,
  resolveCoupleBoardChallenge,
  resolveCoupleBoardEvent,
  rollCoupleBoard,
  updateCoupleBoardCustomEventCard,
  updateCoupleBoardCustomPrompt,
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

  it('ships a substantial built-in question bank with unique ids across every intensity and type', () => {
    expect(COUPLE_BOARD_PROMPTS).toHaveLength(160)
    expect(new Set(COUPLE_BOARD_PROMPTS.map(prompt => prompt.id)).size).toBe(COUPLE_BOARD_PROMPTS.length)
    for (const intensity of [1, 2, 3, 4, 5] as const) {
      expect(COUPLE_BOARD_PROMPTS.filter(prompt => prompt.intensity === intensity && prompt.type === 'truth')).toHaveLength(16)
      expect(COUPLE_BOARD_PROMPTS.filter(prompt => prompt.intensity === intensity && prompt.type === 'dare')).toHaveLength(16)
    }
    expect(COUPLE_BOARD_PROMPTS.every(prompt => Boolean(prompt.theme))).toBe(true)
    expect(new Set(COUPLE_BOARD_PROMPTS.map(prompt => prompt.theme)).size).toBeGreaterThanOrEqual(9)
  })

  it('keeps reality dares physically interactive across every level', () => {
    for (const intensity of [1, 2, 3, 4, 5] as const) {
      const realityDares = COUPLE_BOARD_PROMPTS.filter(prompt => prompt.intensity === intensity && prompt.type === 'dare' && prompt.modes.includes('reality'))
      expect(realityDares.length).toBeGreaterThanOrEqual(8)
    }
  })

  it('rotates away from recently used prompt themes when alternatives exist', () => {
    const game = createCoupleBoardGame({ ...baseSettings, intensity: 4, adultConfirmed: true })
    game.history = [
      { id: 'h1', actor: 'user', dice: 1, from: 0, to: 1, cellType: 'truth', promptId: 't1-01', createdAt: '2026-09-21T00:00:00.000Z' },
      { id: 'h2', actor: 'partner', dice: 1, from: 0, to: 1, cellType: 'truth', promptId: 't1-02', createdAt: '2026-09-21T00:01:00.000Z' }
    ]
    const drawn = drawCoupleBoardGamePrompt(game, 'truth', 0)
    expect(drawn.id).not.toBe('t1-01')
    expect(drawn.id).not.toBe('t1-02')
    expect(['daily', 'memory']).not.toContain(drawn.theme)
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

  it('clones Vue reactive game snapshots without structuredClone DataCloneError', () => {
    const reactiveGame = reactive(createCoupleBoardGame(baseSettings))
    const cloned = cloneCoupleBoardGame(reactiveGame)
    expect(cloned).not.toBe(reactiveGame)
    expect(cloned).toEqual(reactiveGame)
    expect(() => rollCoupleBoard(reactiveGame, 1, 0)).not.toThrow()
  })

  it('archives a Vue reactive finished game as a plain snapshot', () => {
    const reactiveGame = reactive(gameAt(27))
    const finished = reactive(rollCoupleBoard(reactiveGame, 6, 0))
    const entry = buildCoupleBoardArchiveEntry(finished)
    expect(entry.game).not.toBe(finished)
    expect(entry.game.status).toBe('finished')
    expect(entry.game.winner).toBe('user')
  })

  it('blocks adult/private mode for an explicitly underage character', () => {
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, characterAge: 17, adultConfirmed: true })).toContain('小于 18')
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 5, characterAge: 17, adultConfirmed: true })).toContain('小于 18')
  })

  it('requires explicit adult confirmation for levels 4 and 5', () => {
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, adultConfirmed: false })).toContain('确认')
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 4, adultConfirmed: true })).toBeUndefined()
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 5, adultConfirmed: false })).toContain('确认')
    expect(validateCoupleBoardAdultMode({ ...baseSettings, intensity: 5, adultConfirmed: true })).toBeUndefined()
  })

  it('never exposes adult-only prompts below level 4 and includes private prompts at level 5', () => {
    expect(promptsFor('truth', 3, 'chat').some(prompt => prompt.adultOnly)).toBe(false)
    expect(promptsFor('truth', 4, 'chat').some(prompt => prompt.adultOnly)).toBe(true)
    expect(promptsFor('truth', 5, 'chat').some(prompt => prompt.id.startsWith('t5-'))).toBe(true)
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

  it('sanitizes custom prompts and forces level-4/5 entries behind the adult gate', () => {
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
    const privatePrompt = createCoupleBoardCustomPrompt({ type: 'dare', intensity: 5, modes: ['reality'], text: '靠近一点' })
    expect(privatePrompt.adultOnly).toBe(true)
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
    expect(() => attachCoupleBoardGeneratedPrompt(rolled, prompt)).toThrow('真实证据')
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

  it('migrates V1 preferences to the V1.2 library shape without losing custom prompts', () => {
    const custom = createCoupleBoardCustomPrompt({ type: 'truth', intensity: 2, modes: ['chat'], text: '迁移题' })
    const parsed = parseCoupleBoardPreferences({ version: 1, customPrompts: [custom], updatedAt: '2026-09-20T00:00:00.000Z' })
    expect(parsed?.version).toBe(2)
    expect(parsed?.customPrompts.map(row => row.id)).toEqual([custom.id])
    expect(parsed?.customEventCards).toEqual([])
    expect(parsed?.disabledBuiltinPromptIds).toEqual([])
  })

  it('creates and edits custom event cards while sanitizing native-app text', () => {
    const created = createCoupleBoardCustomEventCard({
      title: '<b>交换一下</b>', text: '<i>换个位置，再靠近一点</i>', emoji: '🔁',
      heartDeltaActor: 1, heartDeltaOther: 0, swapPositions: true
    }, new Date('2026-09-21T04:00:00.000Z'))
    expect(created.source).toBe('custom')
    expect(created.title).not.toContain('<b>')
    expect(created.swapPositions).toBe(true)
    const edited = updateCoupleBoardCustomEventCard(created, {
      title: '再来一次', text: '这一回合由当前玩家再掷一次。', emoji: '🎲',
      heartDeltaActor: 0, heartDeltaOther: 0, extraTurn: true
    })
    expect(edited.id).toBe(created.id)
    expect(edited.extraTurn).toBe(true)
    expect(edited.swapPositions).toBeUndefined()
  })

  it('rejects a custom event card with no game effect', () => {
    expect(() => createCoupleBoardCustomEventCard({
      title: '空事件', text: '什么都不发生', emoji: '·', heartDeltaActor: 0, heartDeltaOther: 0
    })).toThrow('至少要有一个效果')
  })

  it('freezes custom event cards and disabled built-ins into a new session', () => {
    const customEvent = createCoupleBoardCustomEventCard({
      title: '只抽我', text: '自定义事件', emoji: '💫', heartDeltaActor: 2, heartDeltaOther: 0
    })
    const game = createCoupleBoardGame(baseSettings, new Date(), [], {
      customEventCards: [customEvent],
      disabledBuiltinEventCardIds: COUPLE_BOARD_EVENT_CARDS.map(card => card.id),
      disabledBuiltinPromptIds: [COUPLE_BOARD_PROMPTS[0].id]
    })
    expect(game.sessionEventCards?.map(card => card.id)).toEqual([customEvent.id])
    expect(drawCoupleBoardGameEventCard(game, 0).id).toBe(customEvent.id)
    expect(game.disabledPromptIds).toContain(COUPLE_BOARD_PROMPTS[0].id)
  })

  it('treats disabled-all challenge/event decks as safe pass-through cells instead of crashing', () => {
    const truthIds = COUPLE_BOARD_PROMPTS.filter(row => row.type === 'truth').map(row => row.id)
    const game = createCoupleBoardGame(baseSettings, new Date(), [], {
      disabledBuiltinPromptIds: truthIds,
      disabledBuiltinEventCardIds: COUPLE_BOARD_EVENT_CARDS.map(card => card.id)
    })
    game.players.user.position = 0
    const truthPass = rollCoupleBoard(game, 1, 0)
    expect(truthPass.pending).toBeUndefined()
    expect(truthPass.currentPlayer).toBe('partner')

    truthPass.players.partner.position = 3
    const eventPass = rollCoupleBoard(truthPass, 1, 0)
    expect(eventPass.pendingEvent).toBeUndefined()
    expect(eventPass.currentPlayer).toBe('user')
  })

  it('keeps a disabled built-in prompt out of the current session pool', () => {
    const disabled = promptsFor('truth', 2, 'chat')[0]
    const game = createCoupleBoardGame(baseSettings, new Date(), [], { disabledBuiltinPromptIds: [disabled.id] })
    expect(promptsForGame(game, 'truth').some(row => row.id === disabled.id)).toBe(false)
  })

  it('resolves swap-position custom events against the frozen event deck', () => {
    const swap = createCoupleBoardCustomEventCard({
      title: '交换', text: '交换双方位置', emoji: '🔁', heartDeltaActor: 0, heartDeltaOther: 0, swapPositions: true
    })
    const game = createCoupleBoardGame(baseSettings, new Date(), [], {
      customEventCards: [swap], disabledBuiltinEventCardIds: COUPLE_BOARD_EVENT_CARDS.map(card => card.id)
    })
    game.players.user.position = 3
    game.players.partner.position = 12
    const rolled = rollCoupleBoard(game, 1, 0)
    expect(getCoupleBoardGameEventCard(rolled, rolled.pendingEvent?.eventCardId || '')?.id).toBe(swap.id)
    const resolved = resolveCoupleBoardEvent(rolled)
    expect(resolved.players.user.position).toBe(12)
    expect(resolved.players.partner.position).toBe(4)
  })

  it('lets an extra-turn custom event keep the same player after resolution', () => {
    const extra = createCoupleBoardCustomEventCard({
      title: '再来一次', text: '当前玩家再掷一次', emoji: '🎲', heartDeltaActor: 0, heartDeltaOther: 0, extraTurn: true
    })
    const game = createCoupleBoardGame(baseSettings, new Date(), [], {
      customEventCards: [extra], disabledBuiltinEventCardIds: COUPLE_BOARD_EVENT_CARDS.map(card => card.id)
    })
    game.players.user.position = 3
    const rolled = rollCoupleBoard(game, 1, 0)
    const resolved = resolveCoupleBoardEvent(rolled)
    expect(resolved.currentPlayer).toBe('user')
    expect(resolved.pendingEvent).toBeUndefined()
  })

  it('round-trips the portable V1.2 library JSON and ignores unknown disabled ids', () => {
    const custom = createCoupleBoardCustomPrompt({ type: 'truth', intensity: 1, modes: ['chat'], text: '导出题' })
    const event = createCoupleBoardCustomEventCard({ title: '导出卡', text: '双方加一', emoji: '💞', heartDeltaActor: 1, heartDeltaOther: 1 })
    const text = exportCoupleBoardLibrary({
      version: 2, customPrompts: [custom], customEventCards: [event],
      disabledBuiltinPromptIds: [COUPLE_BOARD_PROMPTS[0].id], disabledBuiltinEventCardIds: [COUPLE_BOARD_EVENT_CARDS[0].id],
      updatedAt: '2026-09-21T00:00:00.000Z'
    })
    const imported = importCoupleBoardLibrary(text)
    expect(imported.customPrompts[0].text).toBe('导出题')
    expect(imported.customEventCards[0].title).toBe('导出卡')
    expect(imported.disabledBuiltinPromptIds).toEqual([COUPLE_BOARD_PROMPTS[0].id])
  })

  it('builds an idempotent archive entry for a finished game with highlights', () => {
    const game = gameAt(27)
    const finished = rollCoupleBoard(game, 6, 0, new Date('2026-09-21T05:00:00.000Z'))
    const entry = buildCoupleBoardArchiveEntry(finished)
    expect(entry.id).toBe(`archive:${finished.id}`)
    expect(entry.gameId).toBe(finished.id)
    expect(entry.totalHearts).toBeGreaterThanOrEqual(3)
    const parsed = parseCoupleBoardArchive({ version: 1, entries: [entry], updatedAt: entry.finishedAt })
    expect(parsed?.entries[0].gameId).toBe(finished.id)
  })

  it('builds a final result draft only after a game finishes and never auto-sends it', () => {
    const finished = rollCoupleBoard(gameAt(27), 6, 0)
    const share = buildCoupleBoardResultChatShare(finished, 'conv-1')!
    expect(share.draft).toContain('心跳飞行棋结算')
    expect(share.draft).toContain('不要替我补写')
    expect(mergeCoupleBoardResultShareIntoDraft('', share)).toBe(share.draft)
    expect(mergeCoupleBoardResultShareIntoDraft(share.draft, share)).toBe(share.draft)
    expect(buildCoupleBoardResultChatShare(createCoupleBoardGame(baseSettings), 'conv-1')).toBeUndefined()
  })


  it('round-trips the V2 visual mode while legacy saves remain compatible', () => {
    const pixel = createCoupleBoardGame({ ...baseSettings, visualMode: 'pixel' })
    expect(parseCoupleBoardGame(pixel)?.settings.visualMode).toBe('pixel')

    const legacy = structuredClone(pixel) as any
    delete legacy.settings.visualMode
    expect(parseCoupleBoardGame(legacy)?.settings.visualMode).toBeUndefined()
  })

  it('edits custom prompts without changing their stable ids', () => {
    const prompt = createCoupleBoardCustomPrompt({ type: 'truth', intensity: 1, modes: ['chat'], text: '旧题' })
    const edited = updateCoupleBoardCustomPrompt(prompt, { type: 'dare', intensity: 2, modes: ['reality'], text: '新题' })
    expect(edited.id).toBe(prompt.id)
    expect(edited.type).toBe('dare')
    expect(edited.text).toBe('新题')
  })

})
