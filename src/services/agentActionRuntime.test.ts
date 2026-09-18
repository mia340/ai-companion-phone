import { describe, expect, it, vi } from 'vitest'
import { evaluateAgentAction, executeAgentAction, type AgentActionKind } from './agentActionRuntime'

const base = { kind: 'music.play' as const, actorCharacterId: 'c1', worldId: 'w1', payload: { trackId: 't1' } }

describe('Capability-Gated AgentAction Runtime', () => {
  it('没有能力授权时拒绝动作，而不是让模型文本直接改状态', () => {
    expect(evaluateAgentAction(base, { grantedKinds: new Set() }).status).toBe('denied')
  })

  it('按 kind 校验 payload，拒绝模型自造字段和错误参数', () => {
    const malformed = { ...base, payload: { trackId: 't1', deleteEverything: true } }
    expect(evaluateAgentAction(malformed, { grantedKinds: new Set<AgentActionKind>(['music.play']) })).toEqual({
      status: 'denied',
      reason: '动作结构无效，未执行。'
    })
  })

  it('高影响动作需要用户确认', () => {
    const action = { id: 'a1', kind: 'calendar.create', actorCharacterId: 'c1', worldId: 'w1', payload: { title: '见面' } } as const
    const granted = new Set<AgentActionKind>(['calendar.create'])
    expect(evaluateAgentAction(action, { grantedKinds: granted }).status).toBe('needs-confirmation')
    expect(evaluateAgentAction(action, { grantedKinds: granted, confirmedActionIds: new Set(['a1']) }).status).toBe('allowed')
  })

  it('只有 App 注册的 executor 才能产生副作用', async () => {
    const executor = vi.fn(async proposal => proposal.kind === 'music.play' ? proposal.payload.trackId : undefined)
    const result = await executeAgentAction(base, { grantedKinds: new Set<AgentActionKind>(['music.play']) }, { 'music.play': executor })
    expect(result.status).toBe('executed')
    expect(executor).toHaveBeenCalledTimes(1)
  })
})
