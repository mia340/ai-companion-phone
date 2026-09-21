import { db } from '../db/database'
import type {
  AppCustomization,
  Character,
  CharacterMemory,
  Conversation,
  ConversationStateHistory,
  Message,
  MomentPost
} from '../types/domain'

export type SharedTimelineSourceKind = 'memory' | 'moment' | 'state'

export interface SharedTimelineItem {
  id: string
  worldId: string
  sourceKind: SharedTimelineSourceKind
  sourceId: string
  sourceMessageId?: string
  conversationId?: string
  characterId?: string
  characterName?: string
  title: string
  summary: string
  occurredAt: string
  sourceLabel: string
  sourceRoute: string
  importance: number
  sourceExcerpt?: string
  starred: boolean
  hidden: boolean
  customTitle?: string
}

export interface SharedTimelinePreferences {
  starredIds: string[]
  hiddenIds: string[]
  customTitles: Record<string, string>
}

export interface SharedTimelineBuildInput {
  worldId: string
  characters: readonly Character[]
  conversations: readonly Conversation[]
  messages: readonly Message[]
  memories: readonly CharacterMemory[]
  moments: readonly MomentPost[]
  stateHistory: readonly ConversationStateHistory[]
}

const TIMELINE_CUSTOMIZATION_KEY = '__shared-timeline-state__'
const MAX_TITLE_LENGTH = 32
const MAX_SUMMARY_LENGTH = 220
const MAX_PREFERENCE_IDS = 1200

export const EMPTY_SHARED_TIMELINE_PREFERENCES: SharedTimelinePreferences = {
  starredIds: [],
  hiddenIds: [],
  customTitles: {}
}

function timelineCustomizationId(worldId: string) {
  return `${worldId}:${TIMELINE_CUSTOMIZATION_KEY}`
}

function normalizedText(value: unknown, max = MAX_SUMMARY_LENGTH) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[ \u3000]{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

function normalizedTitle(value: unknown) {
  return normalizedText(value, MAX_TITLE_LENGTH)
}

function uniqueStrings(value: unknown, max = MAX_PREFERENCE_IDS): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item)) continue
    seen.add(item)
    result.push(item)
    if (result.length >= max) break
  }
  return result
}

export function normalizeSharedTimelinePreferences(value: unknown): SharedTimelinePreferences {
  if (!value || typeof value !== 'object') return { ...EMPTY_SHARED_TIMELINE_PREFERENCES, customTitles: {} }
  const row = value as Record<string, unknown>
  const rawTitles = row.customTitles && typeof row.customTitles === 'object'
    ? row.customTitles as Record<string, unknown>
    : {}
  const customTitles: Record<string, string> = {}
  for (const [id, raw] of Object.entries(rawTitles)) {
    const title = normalizedTitle(raw)
    if (!id || !title) continue
    customTitles[id] = title
    if (Object.keys(customTitles).length >= MAX_PREFERENCE_IDS) break
  }
  return {
    starredIds: uniqueStrings(row.starredIds),
    hiddenIds: uniqueStrings(row.hiddenIds),
    customTitles
  }
}

function conversationWorldMatches(conversation: Conversation | undefined, worldId: string) {
  return Boolean(conversation && conversation.worldId === worldId)
}

function characterForConversation(conversation: Conversation | undefined) {
  return conversation?.type === 'single' ? conversation.memberIds[0] : undefined
}

function memoryIsTimelineWorthy(memory: CharacterMemory) {
  if (memory.status === 'invalid') return false
  if (memory.category === 'event' || memory.category === 'promise' || memory.category === 'relationship') return true
  if (memory.layer === 'shared' || memory.layer === 'promise' || memory.layer === 'relationship' || memory.layer === 'story') return true
  return memory.importance >= 4
}

function titleForMemory(memory: CharacterMemory) {
  if (memory.category === 'promise' || memory.layer === 'promise') return '一个约定'
  if (memory.category === 'relationship' || memory.layer === 'relationship') return '关系里的变化'
  if (memory.category === 'event' || memory.layer === 'shared') return '一起经历的事'
  if (memory.layer === 'story') return '剧情节点'
  return '重要记忆'
}

function titleForState(field: ConversationStateHistory['field']) {
  if (field === 'relationship') return '关系发生变化'
  if (field === 'goal') return '有了新的目标'
  return '发生了一件事'
}

function stateIsTimelineWorthy(row: ConversationStateHistory) {
  return (row.field === 'event' || row.field === 'relationship' || row.field === 'goal') && Boolean(row.sourceMessageId)
}

export function buildSharedTimelineItems(input: SharedTimelineBuildInput): SharedTimelineItem[] {
  const conversations = new Map(input.conversations.map(item => [item.id, item]))
  const messages = new Map(input.messages.map(item => [item.id, item]))
  const characters = new Map(input.characters.map(item => [item.id, item]))
  const items: SharedTimelineItem[] = []

  for (const memory of input.memories) {
    const conversation = conversations.get(memory.conversationId)
    if (!conversationWorldMatches(conversation, input.worldId) || !memoryIsTimelineWorthy(memory)) continue
    const character = characters.get(memory.characterId)
    if (!character) continue
    const rawSourceMessage = memory.sourceMessageId ? messages.get(memory.sourceMessageId) : undefined
    const sourceMessage = rawSourceMessage?.conversationId === memory.conversationId ? rawSourceMessage : undefined
    const route = sourceMessage
      ? `/chat/${encodeURIComponent(memory.conversationId)}?message=${encodeURIComponent(sourceMessage.id)}`
      : `/chat/${encodeURIComponent(memory.conversationId)}/memory`
    items.push({
      id: `memory:${memory.id}`,
      worldId: input.worldId,
      sourceKind: 'memory',
      sourceId: memory.id,
      sourceMessageId: sourceMessage?.id,
      conversationId: memory.conversationId,
      characterId: memory.characterId,
      characterName: character?.name,
      title: titleForMemory(memory),
      summary: normalizedText(memory.content),
      occurredAt: memory.createdAt || memory.updatedAt,
      sourceLabel: sourceMessage ? '聊天 · 记忆' : '记忆',
      sourceRoute: route,
      importance: memory.importance,
      sourceExcerpt: sourceMessage ? normalizedText(sourceMessage.displayContent || sourceMessage.content, 100) : undefined,
      starred: false,
      hidden: false
    })
  }

  for (const post of input.moments) {
    if (post.worldId !== input.worldId) continue
    const conversation = post.conversationId ? conversations.get(post.conversationId) : undefined
    const characterId = post.authorType === 'character'
      ? post.authorId
      : conversationWorldMatches(conversation, input.worldId) ? characterForConversation(conversation) : undefined
    if (!characterId) continue
    const character = characters.get(characterId)
    if (!character) continue
    items.push({
      id: `moment:${post.id}`,
      worldId: input.worldId,
      sourceKind: 'moment',
      sourceId: post.id,
      conversationId: post.conversationId,
      characterId,
      characterName: character?.name,
      title: post.authorType === 'character' ? 'TA 发过的一条动态' : '你发过的一条动态',
      summary: normalizedText(post.content || (post.images?.length ? '一条带图片的动态' : '')),
      occurredAt: post.createdAt,
      sourceLabel: '朋友圈',
      sourceRoute: `/app/朋友圈?moment=${encodeURIComponent(post.id)}`,
      importance: post.pinned ? 4 : 3,
      starred: false,
      hidden: false
    })
  }

  for (const history of input.stateHistory) {
    if (!stateIsTimelineWorthy(history)) continue
    const conversation = conversations.get(history.conversationId)
    if (!conversationWorldMatches(conversation, input.worldId)) continue
    const sourceMessage = history.sourceMessageId ? messages.get(history.sourceMessageId) : undefined
    if (!sourceMessage || sourceMessage.conversationId !== history.conversationId) continue
    const character = characters.get(history.characterId)
    if (!character) continue
    items.push({
      id: `state:${history.id}`,
      worldId: input.worldId,
      sourceKind: 'state',
      sourceId: history.id,
      sourceMessageId: sourceMessage.id,
      conversationId: history.conversationId,
      characterId: history.characterId,
      characterName: character?.name,
      title: titleForState(history.field),
      summary: normalizedText(history.label || history.nextValue),
      occurredAt: history.createdAt,
      sourceLabel: '状态历史',
      sourceRoute: `/chat/${encodeURIComponent(history.conversationId)}?message=${encodeURIComponent(sourceMessage.id)}`,
      importance: history.field === 'relationship' || history.field === 'event' ? 4 : 3,
      starred: false,
      hidden: false
    })
  }

  return items
    .filter(item => item.summary)
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
}

export function applySharedTimelinePreferences(
  items: readonly SharedTimelineItem[],
  preferences: SharedTimelinePreferences
): SharedTimelineItem[] {
  const normalized = normalizeSharedTimelinePreferences(preferences)
  const starred = new Set(normalized.starredIds)
  const hidden = new Set(normalized.hiddenIds)
  return items.map(item => ({
    ...item,
    starred: starred.has(item.id),
    hidden: hidden.has(item.id),
    customTitle: normalized.customTitles[item.id]
  }))
}

export async function loadSharedTimelinePreferences(worldId: string): Promise<SharedTimelinePreferences> {
  const row = await db.appCustomizations.get(timelineCustomizationId(worldId))
  return normalizeSharedTimelinePreferences(row?.sharedTimelineState)
}

export async function saveSharedTimelinePreferences(
  worldId: string,
  preferences: SharedTimelinePreferences
): Promise<SharedTimelinePreferences> {
  const normalized = normalizeSharedTimelinePreferences(preferences)
  const existing = await db.appCustomizations.get(timelineCustomizationId(worldId))
  const row: AppCustomization = {
    ...(existing ?? {}),
    id: timelineCustomizationId(worldId),
    worldId,
    appKey: TIMELINE_CUSTOMIZATION_KEY,
    sharedTimelineState: normalized,
    updatedAt: new Date().toISOString()
  }
  await db.appCustomizations.put(row)
  return normalized
}

export async function loadSharedTimeline(worldId: string): Promise<SharedTimelineItem[]> {
  const [characters, conversations, messages, memories, moments, stateHistory, preferences] = await Promise.all([
    db.characters.where('worldId').equals(worldId).toArray(),
    db.conversations.where('worldId').equals(worldId).toArray(),
    db.messages.where('worldId').equals(worldId).toArray(),
    db.memories.toArray(),
    db.momentPosts.where('worldId').equals(worldId).toArray(),
    db.conversationStateHistory.toArray(),
    loadSharedTimelinePreferences(worldId)
  ])
  return applySharedTimelinePreferences(buildSharedTimelineItems({
    worldId,
    characters,
    conversations,
    messages,
    memories,
    moments,
    stateHistory
  }), preferences)
}
