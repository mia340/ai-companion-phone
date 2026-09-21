import type { SharedTimelineEvent } from './sharedTimelineEventService'

export interface SharedTimelineChatShare { conversationId: string; draft: string; evidenceIds: string[] }

function clean(value: string, max: number) { return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max) }

export function buildSharedTimelineChatShare(event: SharedTimelineEvent, summary?: string): SharedTimelineChatShare | undefined {
  const conversationId = event.items.find(item => item.conversationId)?.conversationId
  if (!conversationId) return undefined
  const evidenceIds = [...event.itemIds]
  const title = clean(event.title, 48) || '共同事件'
  const body = clean(summary || event.summary, 240)
  return {
    conversationId,
    evidenceIds,
    draft: `我想和你聊聊时光里的「${title}」。${body ? `\n${body}\n` : '\n'}[时光事件引用 event:${event.id}; evidence:${evidenceIds.join(', ')}]`
  }
}

export function mergeTimelineShareIntoDraft(existing: string, share: SharedTimelineChatShare) {
  const current = existing.trim()
  if (!current) return share.draft
  if (current.includes(`[时光事件引用 event:`)) return current
  return `${current}\n\n${share.draft}`
}
