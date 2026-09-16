import { describe, expect, it } from 'vitest'
import {
  cooldownFactor,
  defaultCharacterSocialProfile,
  pickWeightedSocialCandidates,
  profileAllows,
  relationshipFreshnessScore,
  scoreSocialCandidate,
  textRelevanceScore
} from './socialPresenceService'

const character = { id: 'c1', worldId: 'w1' }

describe('social presence settings', () => {
  it('默认允许朋友圈互动，但所有权限都能单独关闭', () => {
    const profile = defaultCharacterSocialProfile(character)
    expect(profileAllows(profile, 'comment')).toBe(true)
    expect(profileAllows({ ...profile, canViewMoments: false }, 'comment')).toBe(false)
    expect(profileAllows({ ...profile, canViewMoments: false, canPostMoments: true }, 'post')).toBe(true)
    expect(profileAllows({ ...profile, canReplyToComments: false }, 'reply')).toBe(false)
    expect(profileAllows({ ...profile, canPostMoments: false }, 'post')).toBe(false)
  })

  it('内容与角色资料/记忆有重合时相关性更高', () => {
    const relevant = textRelevanceScore('今天项目评审终于结束了，好累', [
      '负责游戏项目评审和预算',
      '记得用户最近一直在准备项目评审'
    ])
    const unrelated = textRelevanceScore('今天项目评审终于结束了，好累', [
      '喜欢烘焙和海边散步'
    ])
    expect(relevant).toBeGreaterThan(unrelated)
  })

  it('最近聊过且有共享记忆的角色，关系新鲜度更高', () => {
    const now = Date.parse('2026-09-16T12:00:00.000Z')
    const recent = relationshipFreshnessScore('2026-09-15T12:00:00.000Z', 4, now)
    const stale = relationshipFreshnessScore('2025-01-01T12:00:00.000Z', 0, now)
    expect(recent).toBeGreaterThan(stale)
  })

  it('冷却期会抑制连续刷屏，但不会永久归零', () => {
    const now = Date.parse('2026-09-16T12:00:00.000Z')
    const fresh = cooldownFactor('normal', '2026-09-16T11:59:00.000Z', now)
    const ready = cooldownFactor('normal', '2026-09-16T10:00:00.000Z', now)
    expect(fresh).toBeGreaterThan(0)
    expect(fresh).toBeLessThan(ready)
    expect(ready).toBe(1)
  })

  it('活跃角色在相同关系与相关性下权重更高', () => {
    const base = defaultCharacterSocialProfile(character)
    const quiet = scoreSocialCandidate({
      profile: { ...base, interactionLevel: 'quiet' },
      relationshipScore: 0.6,
      relevanceScore: 0.5,
      cooldownFactor: 1,
      rand: () => 0.5
    })
    const active = scoreSocialCandidate({
      profile: { ...base, interactionLevel: 'active' },
      relationshipScore: 0.6,
      relevanceScore: 0.5,
      cooldownFactor: 1,
      rand: () => 0.5
    })
    expect(active).toBeGreaterThan(quiet)
  })

  it('加权抽样不会重复选择同一候选', () => {
    const selected = pickWeightedSocialCandidates([
      { id: 'a', score: 10 },
      { id: 'b', score: 2 },
      { id: 'c', score: 1 }
    ], 3, () => 0)
    expect(selected).toHaveLength(3)
    expect(new Set(selected.map(item => item.id)).size).toBe(3)
  })
})
