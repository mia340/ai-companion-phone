import type { Character } from '../types/domain'

const REPLY_HEAT_KEY = 'moments.replyHeat'

export type MomentReplyHeat = 'quiet' | 'mild' | 'lively' | 'party'

export interface ReplyHeatOption {
  key: MomentReplyHeat
  emoji: string
  label: string
  desc: string
}

export const REPLY_HEAT_OPTIONS: ReplyHeatOption[] = [
  { key: 'quiet', emoji: '🥶', label: '冷清', desc: '好友几乎不评论，安静为主' },
  { key: 'mild', emoji: '🍃', label: '偶尔', desc: '偶尔有一两位好友路过评论' },
  { key: 'lively', emoji: '🔥', label: '热闹', desc: '常态：通常 2～3 位好友来互动' },
  { key: 'party', emoji: '🎉', label: '爆棚', desc: '一发动态通常 3～5 位好友来互动' }
]

const REPLY_HEAT_RULES: Record<
  MomentReplyHeat,
  { chance: number; min: number; extraChance: number; max: number }
> = {
  quiet: { chance: 0.12, min: 1, extraChance: 0, max: 1 },
  mild: { chance: 0.68, min: 1, extraChance: 0.22, max: 2 },
  lively: { chance: 1, min: 2, extraChance: 0.45, max: 3 },
  party: { chance: 1, min: 3, extraChance: 0.7, max: 5 }
}

export function getReplyHeat(): MomentReplyHeat {
  if (typeof localStorage === 'undefined') return 'lively'
  const value = localStorage.getItem(REPLY_HEAT_KEY) as MomentReplyHeat | null
  return value && REPLY_HEAT_RULES[value] ? value : 'lively'
}

export function setReplyHeat(heat: MomentReplyHeat): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(REPLY_HEAT_KEY, heat)
}

export function planReplyCount(
  heat: MomentReplyHeat,
  candidateCount: number,
  rand: () => number = Math.random
): number {
  if (candidateCount <= 0) return 0
  const rule = REPLY_HEAT_RULES[heat]
  if (rule.chance < 1 && rand() >= rule.chance) return 0

  const cap = Math.min(rule.max, candidateCount)
  let count = Math.min(cap, Math.max(1, rule.min))
  while (count < cap && rand() < rule.extraChance) count += 1
  return count
}

/** 从候选里随机挑 count 位不重复角色。 */
export function pickUserPostReactionAuthors(
  candidates: Array<Pick<Character, 'id'>>,
  count: number,
  rand: () => number = Math.random
): Array<Pick<Character, 'id'>> {
  const list = [...candidates]
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rand() * (i + 1)))
    const swap = list[i]
    list[i] = list[j]
    list[j] = swap
  }
  const take = Math.max(0, Math.min(count, list.length))
  return list.slice(0, take)
}
