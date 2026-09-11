import { db } from '../db/database'
import { getModelSettings } from './modelSettings'
import { createCharacterMoment, getActiveWorldId } from './momentService'
import { generateCharacterPost } from './momentGenerationService'
import { listCharacterSharedMemories } from './memoryService'
import type { Character, MomentPost } from '../types/domain'

/**
 * 角色自主发朋友圈（“偶尔自己会发”）。
 *
 * 节奏模型：
 * - 一次“上线活动”至少距上一次成功发布间隔 AUTO_MIN_INTERVAL_MS；
 * - 若这次间隔明显变长（> BACKFILL_WINDOW），视为“我离开了一段时间”，
 *   按每满一个窗口多补一条，最多补 AUTO_MAX_BACKFILL 条 —— 让离开归来时有新动态可看。
 * - 时间轴用 localStorage 按 worldId 记录 lastAutoAt，关掉 App 再打开也能接着算。
 *
 * 只生成当前活跃世界的、有人设的角色；App 设置页没配好 AI 时静默跳过（不打扰）。
 */
export const AUTO_TICK_MS = 60_000
export const AUTO_MIN_INTERVAL_MS = 30 * 60_000
export const AUTO_BACKFILL_WINDOW_MS = 3 * 60 * 60_000
export const AUTO_MAX_BACKFILL = 2
const FAILURE_RETRY_MS = 10 * 60_000

const ENABLED_KEY = 'moments.autoPoster.enabled'
const LAST_AT_PREFIX = 'moments.autoPoster.lastAt.'

export function isAutoMomentsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false
  // 主动 AI 调用可能产生费用，因此必须显式 opt-in；旧的未写入状态不默认开启。
  return localStorage.getItem(ENABLED_KEY) === '1'
}


export function setAutoMomentsEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

function readLastAutoAt(worldId: string): string | undefined {
  if (typeof localStorage === 'undefined') return undefined
  return localStorage.getItem(`${LAST_AT_PREFIX}${worldId}`) || undefined
}

function writeLastAutoAt(worldId: string, iso: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`${LAST_AT_PREFIX}${worldId}`, iso)
}

export interface AutoPostCountOptions {
  minIntervalMs?: number
  backfillWindowMs?: number
  maxBackfill?: number
}

/**
 * 这次“上线活动”应该补发几条：纯函数。
 * 没有历史标记（首次安装）不发；间隔太短不发；每满一个补发窗口加一条，受上限约束。
 */
export function autoPostCountDue(
  lastAutoAt: string | undefined,
  now: number,
  options?: AutoPostCountOptions
): number {
  const minInterval = options?.minIntervalMs ?? AUTO_MIN_INTERVAL_MS
  const backfillWindow = options?.backfillWindowMs ?? AUTO_BACKFILL_WINDOW_MS
  const maxBackfill = options?.maxBackfill ?? AUTO_MAX_BACKFILL

  if (!lastAutoAt) return 0
  const last = Date.parse(lastAutoAt)
  if (!Number.isFinite(last)) return 0

  const gap = now - last
  if (gap < minInterval) return 0

  // 第一条由 minInterval 控制；补发条数按“总离线时长”跨过的完整窗口计算。
  // 例如默认 30 分钟最小间隔 + 3 小时补发窗口：
  // 30m~<3h => 1 条，>=3h => 2 条（再受 maxBackfill 上限约束）。
  const extra = backfillWindow > 0
    ? Math.max(0, Math.floor(gap / backfillWindow))
    : 0
  return Math.min(Math.max(0, maxBackfill), 1 + extra)
}

/** 从候选里挑一位作者：尽量不连发同一个人；rand 可注入便于测试。 */
export function pickAutoAuthor(
  candidates: Array<Pick<Character, 'id'>>,
  avoidId?: string,
  rand: () => number = Math.random
): Pick<Character, 'id'> {
  const pool = avoidId
    ? candidates.filter(candidate => candidate.id !== avoidId)
    : candidates
  const list = pool.length ? pool : candidates
  const index = Math.min(
    list.length - 1,
    Math.max(0, Math.floor(rand() * list.length))
  )
  return list[index]
}

/**
 * 从候选里随机挑 count 位不重复的“来我动态下评论”的角色。纯函数。
 * rand 可注入便于测试；count 超过候选长度时全部返回。
 */
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

// ---------------------------------------------------------------------------
// 好友“回复热度”：我发动态后，来评论的热情/人数档位，可在朋友圈页前端调节。
// ---------------------------------------------------------------------------

const REPLY_HEAT_KEY = 'moments.replyHeat'

export type MomentReplyHeat = 'quiet' | 'mild' | 'lively' | 'party'

export interface ReplyHeatOption {
  key: MomentReplyHeat
  emoji: string
  label: string
  /** 给用户看的档位说明（tooltip / 选择后的 toast）。 */
  desc: string
}

/** 档位表：也直接驱动选择 UI。 */
export const REPLY_HEAT_OPTIONS: ReplyHeatOption[] = [
  { key: 'quiet', emoji: '🥶', label: '冷清', desc: '好友几乎不评论，安静为主' },
  { key: 'mild', emoji: '🍃', label: '偶尔', desc: '偶尔有一两位好友路过评论' },
  { key: 'lively', emoji: '🔥', label: '热闹', desc: '常态：常有人来、偶尔来俩' },
  { key: 'party', emoji: '🎉', label: '爆棚', desc: '一发动态就热闹刷屏' }
]

/** 每档的概率参数：chance=会不会来人，extraChance=要不要再多一位，max=上限。 */
const REPLY_HEAT_RULES: Record<
  MomentReplyHeat,
  { chance: number; extraChance: number; max: number }
> = {
  quiet: { chance: 0.12, extraChance: 0, max: 1 },
  mild: { chance: 0.68, extraChance: 0.15, max: 2 },
  // 默认档：用户主动发朋友圈时至少有一位好友回应，避免‘功能像坏了’。
  lively: { chance: 1, extraChance: 0.35, max: 2 },
  party: { chance: 1, extraChance: 0.8, max: 3 }
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

/**
 * 按热度档位决定“这次会有几位好友来评论”。纯函数，rand 可注入便于测试。
 * 返回 0 表示这次没人来（冷场），其余在 [1, min(max, 候选数)]。
 */
export function planReplyCount(
  heat: MomentReplyHeat,
  candidateCount: number,
  rand: () => number = Math.random
): number {
  if (candidateCount <= 0) return 0
  const rule = REPLY_HEAT_RULES[heat]
  // chance === 1 表示产品语义上的“保证至少一位回应”。
  // Math.random() 本身不会返回 1，但测试/自定义随机源可能返回边界值 1；
  // 因此只在概率小于 1 时进行冷场判定，避免把“必来”误判成 0 人。
  if (rule.chance < 1 && rand() >= rule.chance) return 0

  const cap = Math.min(rule.max, candidateCount)
  let count = 1
  if (cap >= 2 && rand() < rule.extraChance) count = 2
  if (count === 2 && cap >= 3 && rand() < 0.5) count = 3
  return count
}

function formatNowLabel(): string {
  const now = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const hour = now.getHours()
  const part = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上'
  return `${weekdays[now.getDay()]}${part} ${now.getHours()} 点多`
}

export interface AutoActivityOutcome {
  worldId: string
  posts: MomentPost[]
}

let lastFailureAt = 0

/** 角色是否有“声口”（人设/身份/说话风格任一写了）——决定能否生成有个人味的文案。 */
export function characterHasVoice(character: Pick<Character, 'persona' | 'identity' | 'speakingStyle'>): boolean {
  return Boolean(
    character.persona?.trim() ||
      character.identity?.trim() ||
      character.speakingStyle?.trim()
  )
}

/**
 * 执行一次“自主上线活动”：按间隔/补发窗口决定发几条并落库。
 * 返回 null 表示这次没有可发的（关闭 / 暂停 / 未配 AI / 没人设角色 / 未到时间 / 刚失败过）。
 * 单条生成失败会中断本次、稍后（FAILURE_RETRY_MS 后）再试，避免高频重试。
 */
export async function runAutoActivityOnce(): Promise<AutoActivityOutcome | null> {
  if (!isAutoMomentsEnabled()) return null

  const worldId = await getActiveWorldId()
  const world = await db.worlds.get(worldId)
  if (world?.paused) return null

  const now = Date.now()
  if (now - lastFailureAt < FAILURE_RETRY_MS) return null

  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    return null
  }

  const characters = await db.characters
    .where('worldId')
    .equals(worldId)
    .toArray()
  const posters = characters.filter(characterHasVoice)
  if (!posters.length) return null

  // 首发预热：第一次跑时只记录基准时间，不凭空补发历史；
  // 之后每次（含关掉重开）都以该标记计算“距上次自演”的间隔。
  const lastAutoAt = readLastAutoAt(worldId)
  if (!lastAutoAt) {
    writeLastAutoAt(worldId, new Date(now).toISOString())
    return null
  }

  const count = autoPostCountDue(lastAutoAt, now)
  if (!count) return null

  const posts: MomentPost[] = []
  let avoidId: string | undefined

  for (let i = 0; i < count; i += 1) {
    const author = pickAutoAuthor(posters, avoidId)
    try {
      const sharedMemories = await listCharacterSharedMemories(author.id)
      const generated = await generateCharacterPost(
        author as Character,
        {
          contextLabel: formatNowLabel(),
          memoryHints: sharedMemories.map(memory => memory.content)
        }
      )
      const post = await createCharacterMoment({
        characterId: author.id,
        worldId,
        content: generated.text,
        source: 'ai',
        aiModel: generated.model
      })
      posts.push(post)
      avoidId = author.id
    } catch (error) {
      // 未配置在开头已拦截；这里多半是瞬时网络/网关问题，别高频重试。
      console.warn('角色自主发朋友圈失败，稍后重试：', error)
      lastFailureAt = Date.now()
      break
    }
  }

  if (posts.length) {
    writeLastAutoAt(worldId, posts[posts.length - 1].createdAt)
  }

  return { worldId, posts }
}

let timer: number | undefined
let loopRun: Promise<AutoActivityOutcome | null> | undefined

function canRunAutoActivityInForeground(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  return true
}

function scheduleAutoActivityTick(): void {
  if (!canRunAutoActivityInForeground() || loopRun) return
  loopRun = runAutoActivityOnce()
    .catch(() => null)
    .finally(() => {
      loopRun = undefined
    })
}

export function startAutoActivityLoop(): void {
  if (timer !== undefined) return
  // 只在前台巡逻；同一时刻最多一个 AI 请求链，避免慢网关导致定时器重入。
  scheduleAutoActivityTick()
  timer = window.setInterval(scheduleAutoActivityTick, AUTO_TICK_MS)
}

export function stopAutoActivityLoop(): void {
  if (timer === undefined) return
  window.clearInterval(timer)
  timer = undefined
}
