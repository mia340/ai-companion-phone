import { describe, expect, it } from 'vitest'
import { deriveUserStatePatch } from './stateHistoryService'
import type { ConversationState } from '../types/domain'

const state: ConversationState = {
  id: 'c', summary: '', summaryMessageCount: 0, innerMood: '平静', innerActivity: '聊天', innerThought: '',
  unresolvedTopics: [], pendingEvents: [], shortTermGoals: [], stateVersion: 2,
  updatedAt: '2026-01-01T00:00:00.000Z'
}

describe('state protocol V2 helpers', () => {
  it('records future events and goals from user messages', () => {
    const patch = deriveUserStatePatch('我明天下午要参加面试，我准备今晚再练习一次。', state)
    expect(patch.pendingEvents?.length).toBe(1)
    expect(patch.shortTermGoals?.length).toBe(1)
  })

  it('marks completed events', () => {
    const patch = deriveUserStatePatch('面试已经结束，我通过了。', {
      ...state,
      pendingEvents: ['我明天下午要参加面试']
    })
    expect(patch.lastCompletedEvent).toContain('面试')
  })
})

it('V0.4.4.7 用户明确移动可切换当前 Presence，弱意图不提前切换', async () => {
  const { deriveUserSceneTransition } = await import('./stateHistoryService')
  expect(deriveUserSceneTransition('（没看你，回家）好久不见')?.presence).toBe('remote')
  expect(deriveUserSceneTransition('（上车）')?.presence).toBe('together')
  expect(deriveUserSceneTransition('我到家了')?.presence).toBe('remote')
  expect(deriveUserSceneTransition('来到你身边')?.presence).toBe('together')
  expect(deriveUserSceneTransition('我快到了')).toBeUndefined()
  expect(deriveUserSceneTransition('我想见你')).toBeUndefined()
})
