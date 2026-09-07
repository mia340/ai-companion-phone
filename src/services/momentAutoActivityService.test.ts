import { describe, expect, it } from 'vitest'
import {
  AUTO_BACKFILL_WINDOW_MS,
  AUTO_MIN_INTERVAL_MS,
  autoPostCountDue,
  pickAutoAuthor,
  pickUserPostReactionAuthors,
  planReplyCount
} from './momentAutoActivityService'

describe('autoPostCountDue', () => {
  const now = Date.parse('2026-09-04T08:00:00.000Z')

  it('首次安装（无历史标记）不凭空补发', () => {
    expect(autoPostCountDue(undefined, now)).toBe(0)
  })

  it('坏标记当作从未发过', () => {
    expect(autoPostCountDue('not-a-date', now)).toBe(0)
  })

  it('间隔太短（<30 分钟）不补发', () => {
    const last = new Date(now - 29 * 60_000).toISOString()
    expect(autoPostCountDue(last, now)).toBe(0)
  })

  it('刚过最小间隔只补 1 条', () => {
    const last = new Date(now - AUTO_MIN_INTERVAL_MS - 1000).toISOString()
    expect(autoPostCountDue(last, now)).toBe(1)
  })

  it('离开超过一个补发窗口补 2 条', () => {
    const last = new Date(now - AUTO_MIN_INTERVAL_MS - AUTO_BACKFILL_WINDOW_MS - 1000).toISOString()
    expect(autoPostCountDue(last, now)).toBe(2)
  })

  it('到达一个完整补发窗口时补 2 条（默认最多 2）', () => {
    const last = new Date(now - AUTO_BACKFILL_WINDOW_MS).toISOString()
    expect(autoPostCountDue(last, now)).toBe(2)
  })

  it('长时间离线仍受默认上限 2 约束', () => {
    const last = new Date(now - 12 * 60 * 60_000).toISOString()
    expect(autoPostCountDue(last, now)).toBe(2)
  })

  it('可用参数覆盖阈值与上限', () => {
    const last = new Date(now - 10 * 60_000).toISOString()
    expect(
      autoPostCountDue(last, now, {
        minIntervalMs: 60_000,
        backfillWindowMs: 2 * 60_000,
        maxBackfill: 4
      })
    ).toBe(4)
  })
})

describe('pickAutoAuthor', () => {
  const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('rand=0 选第一个', () => {
    expect(pickAutoAuthor(candidates, undefined, () => 0).id).toBe('a')
  })

  it('避免连发同一位作者', () => {
    const picked = pickAutoAuthor(candidates, 'a', () => 0)
    expect(picked.id).not.toBe('a')
  })

  it('只有一位候选时仍回落到该候选', () => {
    const single = [{ id: 'solo' }]
    expect(pickAutoAuthor(single, 'solo', () => 0).id).toBe('solo')
  })

  it('空候选集安全返回（调用方先判空）', () => {
    expect(pickAutoAuthor([], undefined, () => 0)).toBeUndefined()
  })
})

describe('pickUserPostReactionAuthors', () => {
  const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('count=0 挑不出人', () => {
    expect(pickUserPostReactionAuthors(candidates, 0, () => 0)).toEqual([])
  })

  it('count 超过候选数时全部返回', () => {
    const picked = pickUserPostReactionAuthors(candidates, 99, () => 0)
    expect(picked).toHaveLength(4)
  })

  it('返回的角色不重复', () => {
    const picked = pickUserPostReactionAuthors(candidates, 3, () => 0)
    const ids = picked.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('被挑中的集合只来自候选', () => {
    const picked = pickUserPostReactionAuthors(candidates, 2, () => 0)
    const ids = new Set(candidates.map(item => item.id))
    expect(picked.every(item => ids.has(item.id))).toBe(true)
  })

  it('空候选集返回空数组', () => {
    expect(pickUserPostReactionAuthors([], 2, () => 0)).toEqual([])
  })

  it('负 count 视为 0', () => {
    expect(pickUserPostReactionAuthors(candidates, -1, () => 0)).toEqual([])
  })
})

describe('planReplyCount', () => {
  it('没有候选就不来人', () => {
    expect(planReplyCount('party', 0, () => 0)).toBe(0)
  })

  it('rand 恒 1（都往坏里掷）时各档都冷场', () => {
    expect(planReplyCount('lively', 6, () => 1)).toBe(0)
    expect(planReplyCount('party', 6, () => 1)).toBe(0)
  })

  it('rand 恒 0（都往好里掷）时按档位冲到上限', () => {
    expect(planReplyCount('quiet', 6, () => 0)).toBe(1)
    expect(planReplyCount('mild', 6, () => 0)).toBe(2)
    expect(planReplyCount('lively', 6, () => 0)).toBe(2)
    expect(planReplyCount('party', 6, () => 0)).toBe(3)
  })

  it('人数不能超过候选数', () => {
    expect(planReplyCount('party', 2, () => 0)).toBe(2)
    expect(planReplyCount('mild', 1, () => 0)).toBe(1)
    expect(planReplyCount('lively', 0, () => 0)).toBe(0)
  })

  it('低热度档即使好运气也最多一位', () => {
    expect(planReplyCount('quiet', 10, () => 0)).toBeLessThanOrEqual(1)
  })
})
