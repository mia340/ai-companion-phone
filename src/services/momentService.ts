import { db } from '../db/database'
import { DEFAULT_WORLD_ID } from '../db/seed'

import type {
  MomentComment,
  MomentPost,
  MomentPostImage,
  MomentSource
} from '../types/domain'

/** “我”作为朋友圈作者时使用的固定 authorId。 */
export const MOMENT_USER_AUTHOR_ID = 'user'
export const MOMENT_MAX_CONTENT_LENGTH = 500
export const MOMENT_MAX_COMMENT_LENGTH = 200

export const MOMENT_MAX_IMAGES = 4

/** 朋友圈只存已经处理好的静态图片，最多 4 张；不接受脚本/任意 URL。 */
export function normalizeMomentImages(
  images: MomentPostImage[] | undefined,
  max = MOMENT_MAX_IMAGES
): MomentPostImage[] {
  if (!images?.length || max <= 0) return []
  return images
    .filter(image => typeof image.dataUrl === 'string' && /^data:image\//i.test(image.dataUrl))
    .slice(0, max)
    .map(image => ({
      dataUrl: image.dataUrl,
      name: image.name?.slice(0, 160),
      width: Number.isFinite(image.width) ? Math.max(0, Math.round(image.width || 0)) : undefined,
      height: Number.isFinite(image.height) ? Math.max(0, Math.round(image.height || 0)) : undefined,
      bytes: Number.isFinite(image.bytes) ? Math.max(0, Math.round(image.bytes || 0)) : undefined
    }))
}

export type MomentAuthor =
  | {
      type: 'character'
      id: string
      name: string
      avatar: string
    }
  | {
      type: 'user'
      id: 'user'
      name: string
      avatar: string
    }

export interface MomentCommentItem {
  comment: MomentComment
  author: MomentAuthor
  /** replyToCommentId 指向的原评论作者，用于“甲 回复 乙：...”展示。 */
  replyToAuthor?: MomentAuthor
}

export interface MomentFeedItem {
  post: MomentPost
  author: MomentAuthor
  comments: MomentCommentItem[]
}

/**
 * 归一化朋友圈正文 / 评论：折行与连续空白压成单空格，去首尾空白并限长。
 * 纯函数，供单测覆盖。
 */
export function normalizeMomentContent(
  value: string,
  max = MOMENT_MAX_CONTENT_LENGTH
): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[ 　]{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

export function isValidMomentContent(
  value: string,
  max = MOMENT_MAX_CONTENT_LENGTH
): boolean {
  const normalized = normalizeMomentContent(value, max)
  return normalized.length > 0
}

/**
 * 点赞翻转是确定性规则：未赞 → 赞（+1）；已赞 → 取消（-1），计数不低于 0。
 * 纯函数，返回新对象，不修改入参。
 */
export function applyLikeToggle(post: MomentPost): MomentPost {
  const nextLiked = !post.likedByMe
  return {
    ...post,
    likedByMe: nextLiked,
    likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1))
  }
}

/** 记录来自角色/外部参与者的点赞；不改变“我是否点赞”的状态。 */
export function applyExternalLike(post: MomentPost, amount = 1): MomentPost {
  return {
    ...post,
    likeCount: Math.max(0, post.likeCount + Math.max(0, Math.floor(amount)))
  }
}

/** 按发布时间倒序，不修改入参数组。 */
export function sortMomentPostsDesc(posts: MomentPost[]): MomentPost[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getActiveWorldId(): Promise<string> {
  const world = await db.worlds.limit(1).first()
  return world?.id || DEFAULT_WORLD_ID
}

/**
 * 解析“我”在朋友圈里的显示身份：优先默认 Persona，其次全局用户档案，最后通用占位。
 */
export async function resolveSelfDisplay(): Promise<{
  name: string
  avatar: string
}> {
  const personas = await db.personas.toArray()
  const defaultPersona = personas.find(item => item.isDefault)
    ?? personas.find(item => item.personaScope !== 'character')
  if (defaultPersona) {
    return {
      name: defaultPersona.name || '我',
      avatar: defaultPersona.avatar || '🙂'
    }
  }

  const profile = await db.userProfiles.limit(1).first()
  if (profile) {
    return {
      name: profile.name || '我',
      avatar: profile.avatar || '🙂'
    }
  }

  return { name: '我', avatar: '🙂' }
}

async function resolveAuthor(
  authorType: MomentPost['authorType'],
  authorId: MomentPost['authorId'],
  self: { name: string; avatar: string }
): Promise<MomentAuthor | undefined> {
  if (authorType === 'user') {
    return {
      type: 'user',
      id: MOMENT_USER_AUTHOR_ID,
      name: self.name,
      avatar: self.avatar
    }
  }

  const character = await db.characters.get(authorId)
  if (!character) return undefined

  return {
    type: 'character',
    id: character.id,
    name: character.name,
    avatar: character.avatar
  }
}

/**
 * 组装当前世界的朋友圈信息流（按时间倒序，附带作者与评论）。
 * 评论按发生顺序正序排在每条动态下。
 */
export async function loadMomentFeed(
  worldId: string
): Promise<MomentFeedItem[]> {
  const [posts, comments, self] = await Promise.all([
    db.momentPosts.where('worldId').equals(worldId).toArray(),
    db.momentComments.where('worldId').equals(worldId).toArray(),
    resolveSelfDisplay()
  ])

  const commentByMoment = new Map<string, MomentComment[]>()
  const commentById = new Map<string, MomentComment>()
  for (const comment of comments) {
    const list = commentByMoment.get(comment.momentId) ?? []
    list.push(comment)
    commentByMoment.set(comment.momentId, list)
    commentById.set(comment.id, comment)
  }
  for (const list of commentByMoment.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  const authorCache = new Map<string, Promise<MomentAuthor | undefined>>()
  const authorFor = (
    authorType: MomentPost['authorType'],
    authorId: MomentPost['authorId']
  ) => {
    const key = `${authorType}:${authorId}`
    if (!authorCache.has(key)) {
      authorCache.set(key, resolveAuthor(authorType, authorId, self))
    }
    return authorCache.get(key) as Promise<MomentAuthor | undefined>
  }

  const items: MomentFeedItem[] = []
  for (const post of sortMomentPostsDesc(posts)) {
    const author = await authorFor(post.authorType, post.authorId)
    if (!author) continue

    const commentItems: MomentCommentItem[] = []
    for (const comment of commentByMoment.get(post.id) ?? []) {
      const commentAuthor = await authorFor(comment.authorType, comment.authorId)
      if (!commentAuthor) continue
      const replyTarget = comment.replyToCommentId
        ? commentById.get(comment.replyToCommentId)
        : undefined
      const replyToAuthor = replyTarget && replyTarget.momentId === post.id
        ? await authorFor(replyTarget.authorType, replyTarget.authorId)
        : undefined
      commentItems.push({ comment, author: commentAuthor, replyToAuthor })
    }

    items.push({ post, author, comments: commentItems })
  }

  return items
}

export async function createCharacterMoment(input: {
  characterId: string
  worldId: string
  content: string
  source: MomentSource
  conversationId?: string
  aiModel?: string
  images?: MomentPostImage[]
}): Promise<MomentPost> {
  const character = await db.characters.get(input.characterId)
  if (!character) {
    throw new Error('角色不存在，无法发布动态。')
  }

  const content = normalizeMomentContent(input.content)
  const images = normalizeMomentImages(input.images)
  if (!content && !images.length) {
    throw new Error('动态内容和图片不能同时为空。')
  }

  const now = new Date().toISOString()
  const post: MomentPost = {
    id: crypto.randomUUID(),
    worldId: input.worldId,
    authorType: 'character',
    authorId: character.id,
    content,
    images: images.length ? images : undefined,
    likeCount: 0,
    likedByMe: false,
    conversationId: input.conversationId,
    source: input.source,
    aiModel: input.aiModel,
    createdAt: now,
    updatedAt: now
  }
  await db.momentPosts.add(post)
  return post
}

export async function createUserMoment(input: {
  worldId: string
  content: string
  images?: MomentPostImage[]
}): Promise<MomentPost> {
  const content = normalizeMomentContent(input.content)
  const images = normalizeMomentImages(input.images)
  if (!content && !images.length) {
    throw new Error('动态内容和图片不能同时为空。')
  }

  const now = new Date().toISOString()
  const post: MomentPost = {
    id: crypto.randomUUID(),
    worldId: input.worldId,
    authorType: 'user',
    authorId: MOMENT_USER_AUTHOR_ID,
    content,
    images: images.length ? images : undefined,
    likeCount: 0,
    likedByMe: false,
    source: 'manual',
    createdAt: now,
    updatedAt: now
  }
  await db.momentPosts.add(post)
  return post
}

export async function toggleMomentLike(postId: string): Promise<MomentPost> {
  const post = await db.momentPosts.get(postId)
  if (!post) {
    throw new Error('这条动态已经不存在。')
  }

  const next = applyLikeToggle(post)
  await db.momentPosts.update(postId, {
    likedByMe: next.likedByMe,
    likeCount: next.likeCount,
    updatedAt: new Date().toISOString()
  })
  return next
}

export async function addMomentExternalLike(postId: string, amount = 1): Promise<MomentPost> {
  const post = await db.momentPosts.get(postId)
  if (!post) throw new Error('这条动态已经不存在。')
  const next = applyExternalLike(post, amount)
  await db.momentPosts.update(postId, {
    likeCount: next.likeCount,
    updatedAt: new Date().toISOString()
  })
  return next
}

export async function addMomentComment(input: {
  momentId: string
  worldId: string
  authorType: MomentPost['authorType']
  authorId: MomentPost['authorId']
  replyToCommentId?: string
  content: string
  source: MomentSource
}): Promise<MomentComment> {
  const content = normalizeMomentContent(input.content, MOMENT_MAX_COMMENT_LENGTH)
  if (!content) {
    throw new Error('评论内容不能为空。')
  }

  const post = await db.momentPosts.get(input.momentId)
  if (!post) {
    throw new Error('这条动态已经不存在。')
  }

  if (input.replyToCommentId) {
    const target = await db.momentComments.get(input.replyToCommentId)
    if (!target || target.momentId !== input.momentId) {
      throw new Error('要回复的评论已经不存在。')
    }
  }

  const comment: MomentComment = {
    id: crypto.randomUUID(),
    worldId: input.worldId,
    momentId: input.momentId,
    authorType: input.authorType,
    authorId: input.authorId,
    replyToCommentId: input.replyToCommentId,
    content,
    source: input.source,
    createdAt: new Date().toISOString()
  }
  await db.momentComments.add(comment)
  return comment
}

/** 删除动态时同步删除它下面的全部评论。 */
export async function deleteMomentPost(postId: string): Promise<void> {
  const post = await db.momentPosts.get(postId)
  if (!post) return

  await db.transaction('rw', db.momentPosts, db.momentComments, async () => {
    await db.momentComments.where('momentId').equals(postId).delete()
    await db.momentPosts.delete(postId)
  })
}

export async function deleteMomentComment(commentId: string): Promise<void> {
  await db.momentComments.delete(commentId)
}

/**
 * 删除角色时清理它发布过 / 评论过的朋友圈内容，避免作者孤儿记录。
 * 在 characterService 的删除事务内调用。
 */
export async function deleteMomentsByAuthor(characterId: string): Promise<void> {
  const postIds = (await db.momentPosts.where('authorId').equals(characterId).toArray())
    .map(post => post.id)
  if (postIds.length) {
    await db.momentComments.toCollection().filter(comment =>
      comment.authorId === characterId ||
      postIds.includes(comment.momentId)
    ).delete()
    await db.momentPosts.bulkDelete(postIds)
  } else {
    await db.momentComments.toCollection().filter(comment =>
      comment.authorId === characterId
    ).delete()
  }
}
