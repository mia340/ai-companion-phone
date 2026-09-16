import { db } from '../db/database'

import type { MomentComment, MomentPost, SocialNotification, SocialNotificationType } from '../types/domain'

export async function addSocialNotification(input: {
  post: Pick<MomentPost, 'id' | 'worldId'>
  comment: Pick<MomentComment, 'id' | 'content'>
  actorCharacterId: string
  type: SocialNotificationType
}): Promise<SocialNotification> {
  const existing = await db.socialNotifications
    .where('momentId')
    .equals(input.post.id)
    .filter(row => row.commentId === input.comment.id)
    .first()
  if (existing) return existing

  const notification: SocialNotification = {
    id: crypto.randomUUID(),
    worldId: input.post.worldId,
    channel: 'moments',
    type: input.type,
    actorCharacterId: input.actorCharacterId,
    momentId: input.post.id,
    commentId: input.comment.id,
    preview: input.comment.content.trim().slice(0, 80),
    read: false,
    createdAt: new Date().toISOString()
  }
  await db.socialNotifications.add(notification)
  return notification
}

export async function markSocialNotificationRead(id: string): Promise<void> {
  await db.socialNotifications.update(id, { read: true })
}

export async function markAllSocialNotificationsRead(worldId: string): Promise<number> {
  const rows = await db.socialNotifications
    .where('worldId')
    .equals(worldId)
    .filter(row => !row.read)
    .toArray()
  await Promise.all(rows.map(row => db.socialNotifications.update(row.id, { read: true })))
  return rows.length
}

export async function clearSocialNotifications(worldId: string): Promise<void> {
  const ids = (await db.socialNotifications.where('worldId').equals(worldId).toArray()).map(row => row.id)
  if (ids.length) await db.socialNotifications.bulkDelete(ids)
}
