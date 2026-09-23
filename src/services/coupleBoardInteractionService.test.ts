import { describe, expect, it } from 'vitest'
import {
  appendCoupleBoardInteractionMessage,
  buildCoupleBoardPartnerReplyMessages,
  buildCoupleBoardReplyAuditMessages,
  createCoupleBoardInteraction,
  parseCoupleBoardInteractionLedger,
  parseCoupleBoardPartnerReply,
  parseCoupleBoardReplyAudit,
  setCoupleBoardInteractionStatus,
  type CoupleBoardCharacterContext
} from './coupleBoardInteractionService'
import { createCoupleBoardGame, rollCoupleBoard, getCoupleBoardGamePrompt, renderCoupleBoardPrompt } from './coupleBoardGameService'

const settings = {
  characterId: 'char-1', characterName: '阿澈', characterAge: 24,
  intensity: 2 as const, mode: 'chat' as const, adultConfirmed: false, visualMode: 'pixel' as const
}

function pendingGame() {
  return rollCoupleBoard(createCoupleBoardGame(settings), 1, 0)
}

const context: CoupleBoardCharacterContext = {
  character: {
    id: 'char-1', name: '阿澈', identity: '摄影师', persona: '克制、嘴硬，但会认真听用户说话。',
    description: '', personality: '不爱套话。', speakingStyle: '短句，自然。', background: '', values: '', habits: '',
    likes: [], dislikes: [], boundaries: '不替用户做决定。', relationship: '恋人', scenario: '', systemPrompt: '', postHistoryInstructions: ''
  },
  memories: [{ id: 'mem-1', text: '用户喜欢晚饭后散步。', layer: 'fact', importance: 4, locked: true }],
  timeline: [{ id: 'timeline:one', text: '两人一起看过一次午夜电影。', occurredAt: '2026-09-01T00:00:00.000Z' }]
}

describe('coupleBoardInteractionService', () => {
  it('creates a resumable interaction and preserves both sides of a long exchange', () => {
    const game = pendingGame()
    const prompt = getCoupleBoardGamePrompt(game, game.pending!.promptId)!
    let interaction = createCoupleBoardInteraction({ game, prompt, questionText: renderCoupleBoardPrompt(prompt, '我', '阿澈'), conversationId: 'conv-1' })
    interaction = appendCoupleBoardInteractionMessage(interaction, 'user', '我会想先去散步。')
    interaction = appendCoupleBoardInteractionMessage(interaction, 'partner', '你每次说散步，最后都会越走越久。', { evidenceIds: ['mem-1'] })
    interaction = setCoupleBoardInteractionStatus(interaction, 'closing')
    const parsed = parseCoupleBoardInteractionLedger({ version: 1, gameId: game.id, interactions: [interaction], updatedAt: interaction.updatedAt })
    expect(parsed?.interactions[0].messages).toHaveLength(2)
    expect(parsed?.interactions[0].status).toBe('closing')
  })

  it('puts role card and real memories ahead of game mood in the character prompt', () => {
    const game = pendingGame()
    const prompt = getCoupleBoardGamePrompt(game, game.pending!.promptId)!
    const interaction = createCoupleBoardInteraction({ game, prompt, questionText: '最近最想一起做什么？', conversationId: 'conv-1' })
    const messages = buildCoupleBoardPartnerReplyMessages({ game, prompt, interaction, context, intent: 'react' })
    expect(messages[0].content).toContain('角色一致性是最高优先级')
    expect(messages[0].content).toContain('游戏氛围不能覆盖原角色设定')
    expect(messages[1].content).toContain('用户喜欢晚饭后散步')
  })


  it('audits role continuity without imposing a canned romance reaction', () => {
    const game = pendingGame()
    const prompt = getCoupleBoardGamePrompt(game, game.pending!.promptId)!
    const interaction = createCoupleBoardInteraction({ game, prompt, questionText: '最近最想一起做什么？', conversationId: 'conv-1' })
    const messages = buildCoupleBoardReplyAuditMessages({
      interaction,
      context,
      candidate: { reply: '那就走一会。', endInteraction: false, memoryEvidenceIds: [] }
    })
    expect(messages[0].content).toContain('不规定角色应该害羞、吃醋或反撩')
    expect(messages[0].content).toContain('角色卡')
    expect(messages[1].content).toContain('克制、嘴硬')
  })

  it('parses the role-continuity audit contract strictly', () => {
    expect(parseCoupleBoardReplyAudit('{"pass":true,"reason":""}')).toEqual({ pass: true, reason: '' })
    expect(parseCoupleBoardReplyAudit('{"pass":false,"reason":"突然改成完全相反的人设"}')).toEqual({ pass: false, reason: '突然改成完全相反的人设' })
    expect(parseCoupleBoardReplyAudit('{"reason":"missing pass"}')).toBeUndefined()
  })

  it('rejects fabricated memory ids returned by the model', () => {
    expect(parseCoupleBoardPartnerReply('{"reply":"记得那次散步。","endInteraction":false,"memoryEvidenceIds":["fake"]}', ['mem-1'])).toBeUndefined()
    expect(parseCoupleBoardPartnerReply('{"reply":"我记得。","endInteraction":false,"memoryEvidenceIds":["mem-1"]}', ['mem-1'])?.memoryEvidenceIds).toEqual(['mem-1'])
  })
})
