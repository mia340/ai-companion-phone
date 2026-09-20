import { db } from '../../db/database'
import type {
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  ConversationStateHistory,
  Message,
  MusicState
} from '../../types/domain'
import { buildConversationStateSnapshot } from './conversationStateReplayService'
import { memoryScopeFor } from '../../services/memoryService'

export interface ConversationBranchPlan {
  conversation: Conversation
  messages: Message[]
  settings?: ChatSettings
  state: ConversationState
  memories: CharacterMemory[]
  stateHistory: ConversationStateHistory[]
  musicState?: MusicState
  sourceMessageIdMap: Map<string, string>
}

function byCreatedAt<T extends { createdAt?: string; id: string }>(a: T, b: T) {
  const time = String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  return time || a.id.localeCompare(b.id)
}

export function buildConversationBranchPlan(options: {
  sourceConversation: Conversation
  sourceMessages: Message[]
  selectedMessageId: string
  sourceMemories: CharacterMemory[]
  sourceHistory: ConversationStateHistory[]
  sourceSettings?: ChatSettings
  sourceState?: ConversationState
  sourceMusic?: MusicState
  personaName?: string
  now?: string
  idFactory?: () => string
}): ConversationBranchPlan {
  const now = options.now ?? new Date().toISOString()
  const idFactory = options.idFactory ?? (() => crypto.randomUUID())
  const orderedMessages = [...options.sourceMessages].sort(byCreatedAt)
  const selectedIndex = orderedMessages.findIndex(item => item.id === options.selectedMessageId)
  if (selectedIndex < 0) throw new Error('找不到要创建分支的消息。')

  const selectedMessage = orderedMessages[selectedIndex]
  const sourceRows = orderedMessages.slice(0, selectedIndex + 1)
  const newConversationId = idFactory()
  const messageIdMap = new Map<string, string>()
  const replyGroupIdMap = new Map<string, string>()
  for (const row of sourceRows) messageIdMap.set(row.id, idFactory())

  const copiedMessages: Message[] = sourceRows.map(row => {
    let replyGroupId: string | undefined
    if (row.replyGroupId) {
      replyGroupId = replyGroupIdMap.get(row.replyGroupId)
      if (!replyGroupId) {
        replyGroupId = idFactory()
        replyGroupIdMap.set(row.replyGroupId, replyGroupId)
      }
    }
    return {
      ...row,
      id: messageIdMap.get(row.id) || idFactory(),
      conversationId: newConversationId,
      replyGroupId,
      replyTo: row.replyTo && messageIdMap.has(row.replyTo.messageId)
        ? {
          ...row.replyTo,
          messageId: messageIdMap.get(row.replyTo.messageId) || row.replyTo.messageId
        }
        : undefined
    }
  })

  const copiedMemories = options.sourceMemories
    .filter(row => memoryScopeFor(row) === 'conversation')
    .filter(row => {
      if (row.sourceMessageId) return messageIdMap.has(row.sourceMessageId)
      if (row.sourceType === 'automatic') return row.createdAt <= selectedMessage.createdAt
      return true
    })
    .map(row => ({
      ...row,
      id: idFactory(),
      conversationId: newConversationId,
      sourceMessageId: row.sourceMessageId ? messageIdMap.get(row.sourceMessageId) : undefined,
      mergedFrom: row.mergedFrom
        ?.filter(id => messageIdMap.has(id))
        .map(id => messageIdMap.get(id) || id),
      updatedAt: now
    }))

  const copiedHistory = options.sourceHistory
    .filter(row => row.sourceMessageId
      ? messageIdMap.has(row.sourceMessageId)
      : row.createdAt <= selectedMessage.createdAt)
    .map(row => ({
      ...row,
      id: idFactory(),
      conversationId: newConversationId,
      sourceMessageId: row.sourceMessageId ? messageIdMap.get(row.sourceMessageId) : undefined
    }))

  const branchState = buildConversationStateSnapshot({
    conversationId: newConversationId,
    retainedMessages: sourceRows,
    stateHistory: options.sourceHistory,
    personaName: options.personaName,
    mode: 'branch',
    currentState: options.sourceState,
    cutoffCreatedAt: selectedMessage.createdAt,
    messageIdMap,
    now
  })

  const rootConversationId = options.sourceConversation.rootConversationId || options.sourceConversation.id
  const branchConversation: Conversation = {
    ...options.sourceConversation,
    id: newConversationId,
    title: `${options.sourceConversation.title.replace(/ · 分支(?: \d+)?$/, '')} · 分支`,
    pinned: false,
    unread: 0,
    parentConversationId: options.sourceConversation.id,
    rootConversationId,
    branchFromMessageId: selectedMessage.id,
    createdAt: now,
    updatedAt: now
  }

  const settings = options.sourceSettings
    ? {
      ...options.sourceSettings,
      id: newConversationId,
      conversationId: newConversationId,
      updatedAt: now
    }
    : undefined

  const musicState = options.sourceMusic && options.sourceMusic.updatedAt <= selectedMessage.createdAt
    ? { ...options.sourceMusic, id: newConversationId, isPlaying: false, updatedAt: now }
    : undefined

  return {
    conversation: branchConversation,
    messages: copiedMessages,
    settings,
    state: branchState,
    memories: copiedMemories,
    stateHistory: copiedHistory,
    musicState,
    sourceMessageIdMap: messageIdMap
  }
}

export async function createConversationBranch(options: {
  conversationId: string
  selectedMessageId: string
  personaName?: string
}) {
  const sourceConversation = await db.conversations.get(options.conversationId)
  if (!sourceConversation) throw new Error('当前聊天不存在，无法创建分支。')

  const [sourceMessages, sourceMemories, sourceHistory, sourceSettings, sourceState, sourceMusic] = await Promise.all([
    db.messages.where('conversationId').equals(options.conversationId).toArray(),
    db.memories.where('conversationId').equals(options.conversationId).toArray(),
    db.conversationStateHistory.where('conversationId').equals(options.conversationId).toArray(),
    db.chatSettings.get(options.conversationId),
    db.conversationStates.get(options.conversationId),
    db.musicStates.get(options.conversationId)
  ])

  const plan = buildConversationBranchPlan({
    sourceConversation,
    sourceMessages,
    selectedMessageId: options.selectedMessageId,
    sourceMemories,
    sourceHistory,
    sourceSettings,
    sourceState,
    sourceMusic,
    personaName: options.personaName
  })

  await db.transaction(
    'rw',
    [db.conversations, db.messages, db.chatSettings, db.conversationStates, db.memories, db.conversationStateHistory, db.musicStates],
    async () => {
      await db.conversations.add(plan.conversation)
      if (plan.messages.length) await db.messages.bulkAdd(plan.messages)
      if (plan.settings) await db.chatSettings.put(plan.settings)
      await db.conversationStates.put(plan.state)
      if (plan.memories.length) await db.memories.bulkAdd(plan.memories)
      if (plan.stateHistory.length) await db.conversationStateHistory.bulkAdd(plan.stateHistory)
      if (plan.musicState) await db.musicStates.put(plan.musicState)
    }
  )

  return plan
}
