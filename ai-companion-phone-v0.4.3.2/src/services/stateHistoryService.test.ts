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
