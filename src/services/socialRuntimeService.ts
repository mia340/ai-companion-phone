import { db } from '../db/database'
import { listCharacterSharedMemories } from './memoryService'
import {
  addMomentComment,
  addMomentExternalLike,
  resolveSelfDisplay
} from './momentService'
import {
  generateCharacterReactionToPost,
  generateCharacterThreadReply,
  MomentAiUnconfiguredError
} from './momentGenerationService'
import {
  getReplyHeat,
  pickUserPostReactionAuthors,
  planReplyCount,
  type MomentReplyHeat
} from './momentSocialSettings'
import {
  buildSocialCandidateSignals,
  getCharacterSocialProfile,
  pickWeightedSocialCandidates,
  profileAllows
} from './socialPresenceService'
import { addSocialNotification } from './socialNotificationService'
import { loadCompanionSpaceSettings } from './companionSpaceSettings'

import type {
  Character,
  MomentComment,
  MomentPost,
  SocialActivity
} from '../types/domain'

export const SOCIAL_RUNTIME_TICK_MS = 2_500
export const SOCIAL_RUNTIME_MAX_BATCH = 2
export const SOCIAL_RUNTIME_MAX_THREAD_DEPTH = 2
const STALE_RUNNING_MS = 2 * 60_000
const RETRY_BASE_MS = 30_000
const MAX_ATTEMPTS = 3
const TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60_000

export interface SocialPlanItem {
  actorCharacterId: string
  delayMs: number
}

/**
 * 我发动态后的首轮评论计划。纯函数：用于测试“热闹/爆棚”人数与错峰。
 */
export function planUserPostSocialComments(
  candidates: Array<Pick<Character, 'id'>>,
  heat: MomentReplyHeat,
  rand: () => number = Math.random
): SocialPlanItem[] {
  const count = planReplyCount(heat, candidates.length, rand)
  if (!count) return []
  const actors = pickUserPostReactionAuthors(candidates, count, rand)
  let delayMs = 2_500 + Math.floor(rand() * 3_500)
  return actors.map(actor => {
    const item = { actorCharacterId: actor.id, delayMs }
    delayMs += 4_500 + Math.floor(rand() * 3_500)
    return item
  })
}

/**
 * 角色自己发动态后，其他角色自然路过。不会使用“保证多人”的最低人数，避免机器刷屏。
 */
export function planCharacterPostSocialComments(
  candidates: Array<Pick<Character, 'id'>>,
  authorId: string,
  rand: () => number = Math.random
): SocialPlanItem[] {
  const others = candidates.filter(item => item.id !== authorId)
  if (!others.length || rand() >= 0.72) return []
  const count = Math.min(others.length, rand() < 0.3 ? 2 : 1)
  const actors = pickUserPostReactionAuthors(others, count, rand)
  let delayMs = 5_000 + Math.floor(rand() * 8_000)
  return actors.map(actor => {
    const item = { actorCharacterId: actor.id, delayMs }
    delayMs += 6_000 + Math.floor(rand() * 8_000)
    return item
  })
}

/** 评论串里是否再让另一角色接一句。纯函数，线程越深越保守。 */
export function shouldSchedulePeerReply(
  threadDepth: number,
  heat: MomentReplyHeat,
  rand: () => number = Math.random
): boolean {
  if (threadDepth >= SOCIAL_RUNTIME_MAX_THREAD_DEPTH) return false
  const base: Record<MomentReplyHeat, number> = {
    quiet: 0.04,
    mild: 0.18,
    lively: 0.38,
    party: 0.58
  }
  const depthPenalty = threadDepth * 0.14
  return rand() < Math.max(0, base[heat] - depthPenalty)
}

function isoAfter(delayMs: number, now = Date.now()): string {
  return new Date(now + Math.max(0, delayMs)).toISOString()
}

async function enqueueActivity(input: Omit<SocialActivity, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): Promise<SocialActivity> {
  if (input.dedupeKey) {
    const duplicate = await db.socialActivities
      .where('status')
      .anyOf(['pending', 'running'])
      .filter(row => row.dedupeKey === input.dedupeKey)
      .first()
    if (duplicate) return duplicate
  }

  const now = new Date().toISOString()
  const activity: SocialActivity = {
    ...input,
    id: crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now
  }
  await db.socialActivities.add(activity)
  return activity
}

export async function scheduleSocialForUserPost(
  post: MomentPost,
  candidates?: Character[],
  heat: MomentReplyHeat = getReplyHeat()
): Promise<SocialActivity[]> {
  const spaceSettings = await loadCompanionSpaceSettings(post.worldId)
  if (spaceSettings.visibility === 'private') return []
  const characters = candidates ?? await db.characters.where('worldId').equals(post.worldId).toArray()
  const commentSignals = await buildSocialCandidateSignals({
    post,
    characters,
    capability: 'comment'
  })
  const count = planReplyCount(heat, commentSignals.length)
  const selected = pickWeightedSocialCandidates(commentSignals, count)
  const activities: SocialActivity[] = []
  let delayMs = 2_500 + Math.floor(Math.random() * 3_500)
  for (const signal of selected) {
    activities.push(await enqueueActivity({
      worldId: post.worldId,
      channel: 'moments',
      kind: 'moment-comment',
      actorCharacterId: signal.character.id,
      momentId: post.id,
      threadDepth: 0,
      dueAt: isoAfter(delayMs),
      dedupeKey: `post-comment:${post.id}:${signal.character.id}`
    }))
    delayMs += 4_500 + Math.floor(Math.random() * 3_500)
  }

  // 点赞不需要 AI 请求：评论之外再挑少量“只路过”的角色，让朋友圈更像真实社交。
  const selectedIds = new Set(selected.map(item => item.character.id))
  const likeSignals = (await buildSocialCandidateSignals({ post, characters, capability: 'like' }))
    .filter(item => !selectedIds.has(item.character.id))
  const likeCount = heat === 'quiet' ? 0 : heat === 'mild' ? Math.min(1, likeSignals.length) : Math.min(2, likeSignals.length)
  const likeActors = pickWeightedSocialCandidates(likeSignals, likeCount)
  for (const signal of likeActors) {
    activities.push(await enqueueActivity({
      worldId: post.worldId,
      channel: 'moments',
      kind: 'moment-like',
      actorCharacterId: signal.character.id,
      momentId: post.id,
      threadDepth: 0,
      dueAt: isoAfter(1_600 + Math.floor(Math.random() * 7_000)),
      dedupeKey: `post-like:${post.id}:${signal.character.id}`
    }))
  }
  return activities
}

export async function scheduleSocialForCharacterPost(
  post: MomentPost,
  candidates?: Character[]
): Promise<SocialActivity[]> {
  if (post.authorType !== 'character') return []
  const characters = (candidates ?? await db.characters.where('worldId').equals(post.worldId).toArray())
    .filter(character => character.id !== post.authorId)
  if (!characters.length || Math.random() >= 0.72) return []

  const signals = await buildSocialCandidateSignals({ post, characters, capability: 'comment' })
  const count = Math.min(signals.length, Math.random() < 0.3 ? 2 : 1)
  const selected = pickWeightedSocialCandidates(signals, count)
  const activities: SocialActivity[] = []
  let delayMs = 5_000 + Math.floor(Math.random() * 8_000)
  for (const signal of selected) {
    activities.push(await enqueueActivity({
      worldId: post.worldId,
      channel: 'moments',
      kind: 'moment-comment',
      actorCharacterId: signal.character.id,
      momentId: post.id,
      threadDepth: 0,
      dueAt: isoAfter(delayMs),
      dedupeKey: `post-comment:${post.id}:${signal.character.id}`
    }))
    delayMs += 6_000 + Math.floor(Math.random() * 8_000)
  }
  return activities
}

/**
 * 用户点某条角色评论并回复后，保证被回复角色继续接话；队列持久化，离开朋友圈页也不会丢。
 */
export async function scheduleCharacterReplyToUserComment(input: {
  post: MomentPost
  userComment: MomentComment
  characterId: string
  threadDepth?: number
}): Promise<SocialActivity | undefined> {
  const character = await db.characters.get(input.characterId)
  if (!character) return undefined
  const [profile, spaceSettings] = await Promise.all([
    getCharacterSocialProfile(character),
    loadCompanionSpaceSettings(input.post.worldId)
  ])
  if (spaceSettings.visibility === 'private' || spaceSettings.blacklistCharacterIds.includes(character.id)) return undefined
  if (!profileAllows(profile, 'reply')) return undefined

  return enqueueActivity({
    worldId: input.post.worldId,
    channel: 'moments',
    kind: 'moment-reply',
    actorCharacterId: input.characterId,
    momentId: input.post.id,
    targetCommentId: input.userComment.id,
    threadDepth: Math.max(0, input.threadDepth ?? 1),
    dueAt: isoAfter(1_800 + Math.floor(Math.random() * 3_800)),
    dedupeKey: `reply:${input.userComment.id}:${input.characterId}`
  })
}

async function resolveMomentAuthorName(post: MomentPost): Promise<string> {
  if (post.authorType === 'user') return (await resolveSelfDisplay()).name
  return (await db.characters.get(post.authorId))?.name || '好友'
}

async function resolveCommentAuthorName(comment: MomentComment): Promise<string> {
  if (comment.authorType === 'user') return (await resolveSelfDisplay()).name
  return (await db.characters.get(comment.authorId))?.name || '好友'
}

async function loadThreadContext(target: MomentComment): Promise<Array<{ authorName: string; content: string }>> {
  const chain: MomentComment[] = []
  let cursor: MomentComment | undefined = target
  const seen = new Set<string>()
  while (cursor && chain.length < 5 && !seen.has(cursor.id)) {
    seen.add(cursor.id)
    chain.unshift(cursor)
    cursor = cursor.replyToCommentId
      ? await db.momentComments.get(cursor.replyToCommentId)
      : undefined
  }
  return Promise.all(chain.map(async comment => ({
    authorName: await resolveCommentAuthorName(comment),
    content: comment.content
  })))
}

async function maybeSchedulePeerReply(
  post: MomentPost,
  newComment: MomentComment,
  actorId: string,
  threadDepth: number
): Promise<void> {
  const heat = getReplyHeat()
  if (!shouldSchedulePeerReply(threadDepth, heat)) return

  const characters = await db.characters.where('worldId').equals(post.worldId).toArray()
  const excluded = new Set<string>([actorId])
  if (newComment.authorType === 'character') excluded.add(newComment.authorId)
  const candidates = characters.filter(character => !excluded.has(character.id))
  if (!candidates.length) return

  const signals = await buildSocialCandidateSignals({ post, characters: candidates, capability: 'reply' })
  const selected = pickWeightedSocialCandidates(signals, 1)[0]
  if (!selected) return
  await enqueueActivity({
    worldId: post.worldId,
    channel: 'moments',
    kind: 'moment-reply',
    actorCharacterId: selected.character.id,
    momentId: post.id,
    targetCommentId: newComment.id,
    threadDepth: threadDepth + 1,
    dueAt: isoAfter(6_000 + Math.floor(Math.random() * 12_000)),
    dedupeKey: `peer-reply:${newComment.id}:${selected.character.id}`
  })
}

async function processMomentComment(activity: SocialActivity, post: MomentPost, actor: Character): Promise<void> {
  const postAuthorName = await resolveMomentAuthorName(post)
  const generated = await generateCharacterReactionToPost(
    actor,
    postAuthorName,
    post.content || (post.images?.length ? '（发了一组图片，没有配文字。）' : '')
  )

  const comment = await addMomentComment({
    momentId: post.id,
    worldId: post.worldId,
    authorType: 'character',
    authorId: actor.id,
    content: generated.text,
    source: 'ai'
  })
  if (post.authorType === 'user') {
    await addSocialNotification({
      post,
      comment,
      actorCharacterId: actor.id,
      type: 'moment-comment'
    }).catch(() => undefined)
  }
  await maybeSchedulePeerReply(post, comment, actor.id, activity.threadDepth ?? 0)
}

async function processMomentReply(activity: SocialActivity, post: MomentPost, actor: Character): Promise<void> {
  if (!activity.targetCommentId) throw new Error('评论回复活动缺少 targetCommentId。')
  const target = await db.momentComments.get(activity.targetCommentId)
  if (!target || target.momentId !== post.id) throw new Error('目标评论已经不存在。')
  if (target.authorType === 'character' && target.authorId === actor.id) return

  const [targetAuthorName, postAuthorName, memoryHints, threadContext] = await Promise.all([
    resolveCommentAuthorName(target),
    resolveMomentAuthorName(post),
    listCharacterSharedMemories(actor.id).then(rows => rows.map(row => row.content)),
    loadThreadContext(target)
  ])

  const generated = await generateCharacterThreadReply(actor, {
    postAuthorName,
    postText: post.content || (post.images?.length ? '（图片动态）' : ''),
    targetAuthorName,
    targetComment: target.content,
    threadContext,
    memoryHints
  })

  const comment = await addMomentComment({
    momentId: post.id,
    worldId: post.worldId,
    authorType: 'character',
    authorId: actor.id,
    replyToCommentId: target.id,
    content: generated.text,
    source: 'ai'
  })
  if (target.authorType === 'user' || post.authorType === 'user') {
    await addSocialNotification({
      post,
      comment,
      actorCharacterId: actor.id,
      type: target.authorType === 'user' ? 'moment-reply' : 'moment-comment'
    }).catch(() => undefined)
  }
  await maybeSchedulePeerReply(post, comment, actor.id, activity.threadDepth ?? 1)
}

async function markCancelled(activity: SocialActivity, reason: string): Promise<void> {
  await db.socialActivities.update(activity.id, {
    status: 'cancelled',
    lastError: reason,
    updatedAt: new Date().toISOString()
  })
}

async function markRetry(activity: SocialActivity, error: unknown): Promise<void> {
  const attempts = activity.attempts + 1
  const isUnconfigured = error instanceof MomentAiUnconfiguredError
  const terminal = !isUnconfigured && attempts >= MAX_ATTEMPTS
  await db.socialActivities.update(activity.id, {
    status: terminal ? 'failed' : 'pending',
    attempts,
    lastError: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    dueAt: terminal
      ? activity.dueAt
      : isoAfter(isUnconfigured ? 10 * 60_000 : RETRY_BASE_MS * Math.max(1, attempts)),
    updatedAt: new Date().toISOString()
  })
}

export async function processSocialActivity(activity: SocialActivity): Promise<'done' | 'cancelled' | 'retry'> {
  const [post, actor] = await Promise.all([
    db.momentPosts.get(activity.momentId),
    db.characters.get(activity.actorCharacterId)
  ])
  if (!post) {
    await markCancelled(activity, '动态已删除。')
    return 'cancelled'
  }
  if (!actor || actor.worldId !== post.worldId) {
    await markCancelled(activity, '角色已删除或不在同一世界。')
    return 'cancelled'
  }

  const [profile, spaceSettings] = await Promise.all([
    getCharacterSocialProfile(actor),
    loadCompanionSpaceSettings(post.worldId)
  ])
  if (spaceSettings.blacklistCharacterIds.includes(actor.id)) {
    await markCancelled(activity, '角色已加入知间空间黑名单。')
    return 'cancelled'
  }
  if (post.authorType === 'user' && spaceSettings.visibility === 'private') {
    await markCancelled(activity, '当前动态仅自己可见。')
    return 'cancelled'
  }
  const capability = activity.kind === 'moment-like'
    ? 'like'
    : activity.kind === 'moment-reply'
      ? 'reply'
      : 'comment'
  if (!profileAllows(profile, capability)) {
    await markCancelled(activity, '角色的朋友圈互动权限已关闭。')
    return 'cancelled'
  }

  await db.socialActivities.update(activity.id, {
    status: 'running',
    updatedAt: new Date().toISOString()
  })

  try {
    if (activity.kind === 'moment-comment') {
      await processMomentComment(activity, post, actor)
    } else if (activity.kind === 'moment-reply') {
      await processMomentReply(activity, post, actor)
    } else if (activity.kind === 'moment-like') {
      await addMomentExternalLike(post.id)
    }
    await db.socialActivities.update(activity.id, {
      status: 'done',
      updatedAt: new Date().toISOString()
    })
    return 'done'
  } catch (error) {
    if (error instanceof Error && /不存在|缺少 targetCommentId/.test(error.message)) {
      await markCancelled(activity, error.message)
      return 'cancelled'
    }
    await markRetry(activity, error)
    return 'retry'
  }
}

/** App 启动/恢复时把异常中断的 running 活动放回队列。 */
export async function recoverStaleSocialActivities(now = Date.now()): Promise<number> {
  const stale = await db.socialActivities.where('status').equals('running').toArray()
  const ids = stale
    .filter(item => {
      const updated = Date.parse(item.updatedAt)
      return !Number.isFinite(updated) || now - updated >= STALE_RUNNING_MS
    })
    .map(item => item.id)
  if (!ids.length) return 0
  await Promise.all(ids.map(id => db.socialActivities.update(id, {
    status: 'pending',
    dueAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  })))
  return ids.length
}

export async function pruneSocialActivities(now = Date.now()): Promise<number> {
  const cutoff = now - TERMINAL_RETENTION_MS
  const terminal = await db.socialActivities
    .where('status')
    .anyOf(['done', 'cancelled', 'failed'])
    .toArray()
  const ids = terminal
    .filter(item => {
      const updated = Date.parse(item.updatedAt)
      return Number.isFinite(updated) && updated < cutoff
    })
    .map(item => item.id)
  if (ids.length) await db.socialActivities.bulkDelete(ids)
  return ids.length
}

export async function runSocialRuntimeOnce(now = Date.now()): Promise<number> {
  const due = (await db.socialActivities.where('status').equals('pending').toArray())
    .filter(item => Date.parse(item.dueAt) <= now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, SOCIAL_RUNTIME_MAX_BATCH)

  for (const activity of due) await processSocialActivity(activity)
  return due.length
}

let timer: number | undefined
let loopRun: Promise<number> | undefined

function canRun(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  return true
}

function tick(): void {
  if (!canRun() || loopRun) return
  loopRun = runSocialRuntimeOnce()
    .catch(error => {
      console.warn('Social Runtime 执行失败：', error)
      return 0
    })
    .finally(() => {
      loopRun = undefined
    })
}

export async function startSocialRuntimeLoop(): Promise<void> {
  if (timer !== undefined) return
  await recoverStaleSocialActivities().catch(() => 0)
  await pruneSocialActivities().catch(() => 0)
  tick()
  timer = window.setInterval(tick, SOCIAL_RUNTIME_TICK_MS)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', tick)
  }
}

export function stopSocialRuntimeLoop(): void {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', tick)
  }
}
