import type { Message } from '../types/domain'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import type { SharedTimelineEvent } from './sharedTimelineEventService'

export interface SharedTimelineContextMessage {
  id: string
  senderId: string
  type: Message['type']
  text: string
  createdAt: string
  isSource: boolean
}

export interface SharedTimelineEvidenceContext {
  sourceMessageId: string
  conversationId: string
  itemIds: string[]
  messages: SharedTimelineContextMessage[]
}

function timeValue(value: string) {
  const result = new Date(value).getTime()
  return Number.isFinite(result) ? result : 0
}

function messageText(message: Message) {
  const raw = message.displayContent || message.content || message.rawContent || ''
  return sanitizeNativeAppText(raw, { singleLine: true }).slice(0, 220)
}

export function buildSharedTimelineEvidenceContexts(
  event: Pick<SharedTimelineEvent, 'items'>,
  messages: readonly Message[],
  options?: { radius?: number }
): SharedTimelineEvidenceContext[] {
  const radius = Math.max(0, Math.min(3, Math.floor(options?.radius ?? 1)))
  const byConversation = new Map<string, Message[]>()
  for (const message of messages) {
    const rows = byConversation.get(message.conversationId) || []
    rows.push(message)
    byConversation.set(message.conversationId, rows)
  }
  for (const rows of byConversation.values()) {
    rows.sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt))
  }

  const sourceMap = new Map<string, { conversationId: string; itemIds: string[] }>()
  for (const item of event.items) {
    if (!item.sourceMessageId || !item.conversationId) continue
    const existing = sourceMap.get(item.sourceMessageId)
    if (existing) {
      if (!existing.itemIds.includes(item.id)) existing.itemIds.push(item.id)
      continue
    }
    sourceMap.set(item.sourceMessageId, {
      conversationId: item.conversationId,
      itemIds: [item.id]
    })
  }

  const contexts: SharedTimelineEvidenceContext[] = []
  for (const [sourceMessageId, source] of sourceMap) {
    const rows = byConversation.get(source.conversationId) || []
    const index = rows.findIndex(message => message.id === sourceMessageId)
    if (index < 0) continue
    const start = Math.max(0, index - radius)
    const end = Math.min(rows.length, index + radius + 1)
    const contextMessages = rows.slice(start, end)
      .filter(message => !message.recalledAt)
      .map(message => ({
        id: message.id,
        senderId: message.senderId,
        type: message.type,
        text: messageText(message),
        createdAt: message.createdAt,
        isSource: message.id === sourceMessageId
      }))
    if (!contextMessages.some(message => message.isSource)) continue
    contexts.push({
      sourceMessageId,
      conversationId: source.conversationId,
      itemIds: source.itemIds,
      messages: contextMessages
    })
  }

  return contexts.sort((a, b) => {
    const left = a.messages.find(message => message.isSource)?.createdAt || ''
    const right = b.messages.find(message => message.isSource)?.createdAt || ''
    return timeValue(left) - timeValue(right)
  })
}

export async function loadSharedTimelineEventContexts(
  event: SharedTimelineEvent,
  options?: { radius?: number }
): Promise<SharedTimelineEvidenceContext[]> {
  const conversationIds = new Set(event.items.map(item => item.conversationId).filter((value): value is string => Boolean(value)))
  if (!conversationIds.size) return []
  const { db } = await import('../db/database')
  const messages = await db.messages.where('worldId').equals(event.worldId).toArray()
  return buildSharedTimelineEvidenceContexts(
    event,
    messages.filter(message => conversationIds.has(message.conversationId)),
    options
  )
}
