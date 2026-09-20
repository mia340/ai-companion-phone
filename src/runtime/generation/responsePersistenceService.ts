import { db } from '../../db/database'
import type {
  Conversation,
  Message,
  ProactiveSource
} from '../../types/domain'

export async function persistStreamingPlaceholder(options: {
  conversation: Conversation
  senderId: string
  type: Message['type']
  content: string
  provider: string
  model: string
  generationId: string
  proactiveSource?: ProactiveSource
}): Promise<Message> {
  const now = new Date().toISOString()
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: options.conversation.worldId,
    conversationId: options.conversation.id,
    senderId: options.senderId,
    type: options.type,
    content: options.content,
    status: 'pending',
    createdAt: now,
    provider: options.provider,
    model: options.model,
    generationId: options.generationId,
    proactiveSource: options.proactiveSource,
    replyGroupId: crypto.randomUUID()
  }
  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.add(message)
    await db.conversations.update(options.conversation.id, { updatedAt: now })
  })
  return message
}

export async function patchGeneratedMessage(
  messageId: string,
  patch: Partial<Message>
) {
  await db.messages.update(messageId, patch)
}

export async function removeGeneratedMessage(messageId: string) {
  await db.messages.delete(messageId)
}

export async function persistAssistantContentMessage(options: {
  conversation: Conversation
  senderId: string
  type: Message['type']
  content: string
  generationId: string
  provider: string
  model: string
  proactiveSource?: ProactiveSource
  replyGroupId?: string
  replySequence?: number
  rawContent?: string
  modelOutput?: string
  displayContent?: string
  regexApplied?: Message['regexApplied']
  roleCardUi?: Message['roleCardUi']
  voiceDurationSeconds?: number
  placeholderImagePrompt?: string
  protocolVersion?: Message['protocolVersion']
  createdAt?: string
}): Promise<Message> {
  const createdAt = options.createdAt || new Date().toISOString()
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: options.conversation.worldId,
    conversationId: options.conversation.id,
    senderId: options.senderId,
    type: options.type,
    content: options.content,
    rawContent: options.rawContent,
    modelOutput: options.modelOutput,
    displayContent: options.displayContent,
    regexPipelineVersion: options.rawContent || options.modelOutput || options.displayContent || options.regexApplied
      ? 2
      : undefined,
    regexApplied: options.regexApplied,
    status: 'delivered',
    createdAt,
    roleCardUi: options.roleCardUi,
    provider: options.provider,
    model: options.model,
    generationId: options.generationId,
    proactiveSource: options.proactiveSource,
    replyGroupId: options.replyGroupId,
    replySequence: options.replySequence,
    voiceDurationSeconds: options.voiceDurationSeconds,
    placeholderImagePrompt: options.placeholderImagePrompt,
    protocolVersion: options.protocolVersion
  }
  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.add(message)
    await db.conversations.update(options.conversation.id, { updatedAt: createdAt })
  })
  return message
}

export async function persistRichAssistantMessage(options: {
  conversation: Conversation
  senderId: string
  html: string
  rawContent: string
  modelOutput?: string
  provider: string
  model: string
  generationId: string
  source?: Message['richSource']
  proactiveSource?: ProactiveSource
  regexApplied?: Message['regexApplied']
}): Promise<Message> {
  const now = new Date().toISOString()
  const preview = options.html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: options.conversation.worldId,
    conversationId: options.conversation.id,
    senderId: options.senderId,
    type: 'rich',
    content: preview || '互动卡片',
    rawContent: options.rawContent,
    modelOutput: options.modelOutput,
    regexPipelineVersion: 2,
    regexApplied: options.regexApplied,
    richHtml: options.html,
    richSource: options.source || 'regex',
    status: 'delivered',
    provider: options.provider,
    model: options.model,
    generationId: options.generationId,
    proactiveSource: options.proactiveSource,
    createdAt: now
  }
  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.add(message)
    await db.conversations.update(options.conversation.id, { updatedAt: now })
  })
  return message
}

export async function persistAlternativeReply(options: {
  target: Message
  content: string
  provider: string
  model: string
  generationId: string
}) {
  const candidate = options.content.trim()
  const baseAlternatives = options.target.alternatives?.length
    ? options.target.alternatives.slice()
    : [options.target.content]
  const alternatives = baseAlternatives.includes(candidate)
    ? baseAlternatives
    : [...baseAlternatives, candidate]
  const activeAlternativeIndex = Math.max(0, alternatives.indexOf(candidate))
  const patch: Partial<Message> = {
    content: candidate,
    alternatives,
    activeAlternativeIndex,
    provider: options.provider,
    model: options.model,
    generationId: options.generationId,
    status: 'delivered'
  }
  await db.messages.update(options.target.id, patch)
  return { patch, activeAlternativeIndex }
}
