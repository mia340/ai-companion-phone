import { describe, expect, it } from 'vitest'
import {
  planCharacterPostSocialComments,
  planUserPostSocialComments,
  shouldSchedulePeerReply,
  SOCIAL_RUNTIME_MAX_THREAD_DEPTH
} from './socialRuntimeService'

describe('planUserPostSocialComments', () => {
  const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('lively 至少安排两位不同角色并错峰', () => {
    const plan = planUserPostSocialComments(candidates, 'lively', () => 0.99)
    expect(plan).toHaveLength(2)
    expect(new Set(plan.map(item => item.actorCharacterId)).size).toBe(2)
    expect(plan[1].delayMs).toBeGreaterThan(plan[0].delayMs)
  })

  it('party 不会超过候选人数', () => {
    const plan = planUserPostSocialComments(candidates.slice(0, 2), 'party', () => 0)
    expect(plan).toHaveLength(2)
  })
})

describe('planCharacterPostSocialComments', () => {
  const candidates = [{ id: 'author' }, { id: 'b' }, { id: 'c' }]

  it('不会让动态作者自己评论自己', () => {
    const plan = planCharacterPostSocialComments(candidates, 'author', () => 0)
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every(item => item.actorCharacterId !== 'author')).toBe(true)
  })

  it('随机落在冷场区间时允许无人串门', () => {
    expect(planCharacterPostSocialComments(candidates, 'author', () => 0.99)).toEqual([])
  })
})

describe('shouldSchedulePeerReply', () => {
  it('热闹档可以让另一角色继续接评论', () => {
    expect(shouldSchedulePeerReply(0, 'lively', () => 0)).toBe(true)
  })

  it('冷清档大多数时候不追加角色互聊', () => {
    expect(shouldSchedulePeerReply(0, 'quiet', () => 0.5)).toBe(false)
  })

  it('达到线程深度上限后强制停止，避免无限互聊', () => {
    expect(shouldSchedulePeerReply(SOCIAL_RUNTIME_MAX_THREAD_DEPTH, 'party', () => 0)).toBe(false)
  })
})
