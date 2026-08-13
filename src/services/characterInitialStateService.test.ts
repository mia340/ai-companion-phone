import { describe, expect, it } from 'vitest'
import { inferCardInitialActivity, inferCardInitialRelationship, normalizeLegacyCharacterInitialState } from './characterInitialStateService'
import type { Character } from '../types/domain'

describe('character initial state compatibility', () => {
  it('从 Tavo 开场提取真实活动与关系', () => {
    const opening = '📆太初历3824年7月18｜7:00｜晨光熹微 <br>🗺天枢山后山菜园<br>😶墨清尘:素衣<br>💛负手立于田埂.<br>▪关系:师徒<br>正文'
    expect(inferCardInitialActivity(opening)).toBe('负手立于田埂')
    expect(inferCardInitialRelationship(opening)).toBe('师徒')
  })

  it('清理旧版“刚刚来到这个世界/期待认识你”占位状态', () => {
    const character = {
      id: 'c', worldId: 'w', name: '墨清尘', avatar: '🍓', persona: '设定', relationship: '朋友',
      mood: '期待认识你', activity: '刚刚来到这个世界', groups: [], replySpeed: 'natural',
      firstMessage: '💛负手立于田埂<br>▪关系:师徒', createdAt: '', updatedAt: ''
    } as Character
    expect(normalizeLegacyCharacterInitialState(character)).toMatchObject({ mood: '平静', activity: '负手立于田埂', relationship: '师徒' })
  })
})
