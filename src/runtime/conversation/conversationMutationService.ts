import { db } from '../../db/database'
import { createDefaultConversationState } from '../../services/chatSettings'
import type {
  CharacterMemory,
  ConversationStateHistory,
  Message,
  PromptDebugTrace
} from '../../types/domain'

export interface MemoryCleanupPatch {
  id: string
  sourceMessageId?: undefined
  mergedFrom?: string[]
  updatedAt: string
}

export interface ConversationMutationPlan {
  automaticMemoryIdsToDelete: string[]
  automaticMemoryPatches: MemoryCleanupPatch[]
  stateHistoryIdsToDelete: string[]
  replyReferenceMessageIdsToClear: string[]
}

export interface DeleteMessagesResult extends ConversationMutationPlan {
  deletedMessageIds: string[]
}

export interface ConversationTruncatePlan extends ConversationMutationPlan {
  anchorMessageId: string
  removedMessageIds: string[]
  promptDebugTraceIdsToDelete: string[]
}

function isAutomaticMemory(row: CharacterMemory) {
  return row.sourceType === 'automatic' || (!row.sourceType && Boolean(row.sourceMessageId))
}

/**
 * Build the derived-data cleanup plan for one or more removed messages.
 *
 * A memory that was created by the removed branch is deleted. If an older
 * automatic memory merely points at a removed message because it was merged
 * later, the memory is retained and its invalid source linkage is detached.
 * Manual/imported memories are never deleted here.
 */
export function buildConversationMutationPlan(options: {
  affectedMessageIds: Iterable<string>
  affectedCreatedAt: string
  memories: CharacterMemory[]
  stateHistory: ConversationStateHistory[]
  messages: Message[]
  now?: string
}): ConversationMutationPlan {
  const affectedIds = new Set(options.affectedMessageIds)
  const now = options.now ?? new Date().toISOString()
  const automaticMemoryIdsToDelete: string[] = []
  const automaticMemoryPatches: MemoryCleanupPatch[] = []

  for (const row of options.memories) {
    const mergedFrom = (row.mergedFrom || []).filter(id => !affectedIds.has(id))
    const sourceWasRemoved = Boolean(row.sourceMessageId && affectedIds.has(row.sourceMessageId))
    const mergedSourceWasRemoved = mergedFrom.length !== (row.mergedFrom || []).length

    if (!isAutomaticMemory(row)) continue

    if (sourceWasRemoved) {
      if (row.createdAt >= options.affectedCreatedAt) {
        automaticMemoryIdsToDelete.push(row.id)
        continue
      }
      automaticMemoryPatches.push({
        id: row.id,
        sourceMessageId: undefined,
        mergedFrom,
        updatedAt: now
      })
      continue
    }

    if (mergedSourceWasRemoved) {
      automaticMemoryPatches.push({
        id: row.id,
        ...(row.sourceMessageId ? {} : { sourceMessageId: undefined }),
        mergedFrom,
        updatedAt: now
      })
    }
  }

  const stateHistoryIdsToDelete = options.stateHistory
    .filter(row => row.sourceMessageId && affectedIds.has(row.sourceMessageId))
    .map(row => row.id)

  const replyReferenceMessageIdsToClear = options.messages
    .filter(row => row.replyTo?.messageId && affectedIds.has(row.replyTo.messageId) && !affectedIds.has(row.id))
    .map(row => row.id)

  return {
    automaticMemoryIdsToDelete,
    automaticMemoryPatches,
    stateHistoryIdsToDelete,
    replyReferenceMessageIdsToClear
  }
}

export function buildConversationTruncatePlan(options: {
  anchorMessageId: string
  messages: Message[]
  memories: CharacterMemory[]
  stateHistory: ConversationStateHistory[]
  promptDebugTraces: PromptDebugTrace[]
  now?: string
}): ConversationTruncatePlan {
  const anchorIndex = options.messages.findIndex(row => row.id === options.anchorMessageId)
  if (anchorIndex < 0) throw new Error('找不到要回退的用户消息。')
  const anchor = options.messages[anchorIndex]
  const descendants = options.messages.slice(anchorIndex + 1)
  const affectedMessageIds = [anchor.id, ...descendants.map(row => row.id)]
  const plan = buildConversationMutationPlan({
    affectedMessageIds,
    affectedCreatedAt: anchor.createdAt,
    memories: options.memories,
    stateHistory: options.stateHistory,
    messages: options.messages,
    now: options.now
  })
  plan.stateHistoryIdsToDelete = Array.from(new Set([
    ...plan.stateHistoryIdsToDelete,
    ...options.stateHistory
      .filter(row => !row.sourceMessageId && row.createdAt >= anchor.createdAt)
      .map(row => row.id)
  ]))
  const promptDebugTraceIdsToDelete = options.promptDebugTraces
    .filter(row => row.createdAt >= anchor.createdAt)
    .map(row => row.id)

  return {
    anchorMessageId: anchor.id,
    removedMessageIds: descendants.map(row => row.id),
    promptDebugTraceIdsToDelete,
    ...plan
  }
}

/**
 * Rewind the conversation to a retained user message. The anchor message stays
 * in storage, but all derived runtime effects from the old version of that
 * message and every descendant are invalidated so the caller can replay the
 * edited/current anchor and generate a fresh continuation.
 */
export async function truncateConversationAfterMessage(options: {
  conversationId: string
  anchorMessageId: string
}): Promise<ConversationTruncatePlan & { updatedAt: string }> {
  const [messages, memories, stateHistory, promptDebugTraces] = await Promise.all([
    db.messages.where('conversationId').equals(options.conversationId).sortBy('createdAt'),
    db.memories.where('conversationId').equals(options.conversationId).toArray(),
    db.conversationStateHistory.where('conversationId').equals(options.conversationId).toArray(),
    db.promptDebugTraces.where('conversationId').equals(options.conversationId).toArray()
  ])
  const updatedAt = new Date().toISOString()
  const plan = buildConversationTruncatePlan({
    anchorMessageId: options.anchorMessageId,
    messages,
    memories,
    stateHistory,
    promptDebugTraces,
    now: updatedAt
  })

  await db.transaction(
    'rw',
    [db.messages, db.memories, db.conversationStateHistory, db.promptDebugTraces, db.conversations],
    async () => {
      if (plan.removedMessageIds.length) await db.messages.bulkDelete(plan.removedMessageIds)
      if (plan.automaticMemoryIdsToDelete.length) await db.memories.bulkDelete(plan.automaticMemoryIdsToDelete)
      for (const { id, ...changes } of plan.automaticMemoryPatches) await db.memories.update(id, changes)
      if (plan.stateHistoryIdsToDelete.length) await db.conversationStateHistory.bulkDelete(plan.stateHistoryIdsToDelete)
      if (plan.promptDebugTraceIdsToDelete.length) await db.promptDebugTraces.bulkDelete(plan.promptDebugTraceIdsToDelete)
      for (const id of plan.replyReferenceMessageIdsToClear) await db.messages.update(id, { replyTo: undefined })
      await db.conversations.update(options.conversationId, { updatedAt })
    }
  )

  return { ...plan, updatedAt }
}

/**
 * Delete selected message records and the runtime data directly derived from
 * those messages in one IndexedDB transaction.
 */
export async function deleteConversationMessagesConsistently(options: {
  conversationId: string
  messageIds: string[]
  affectedCreatedAt: string
}): Promise<DeleteMessagesResult> {
  const deletedMessageIds = Array.from(new Set(options.messageIds)).filter(Boolean)
  if (!deletedMessageIds.length) {
    return {
      deletedMessageIds: [],
      automaticMemoryIdsToDelete: [],
      automaticMemoryPatches: [],
      stateHistoryIdsToDelete: [],
      replyReferenceMessageIdsToClear: []
    }
  }

  const [memoryRows, historyRows, messageRows] = await Promise.all([
    db.memories.where('conversationId').equals(options.conversationId).toArray(),
    db.conversationStateHistory.where('conversationId').equals(options.conversationId).toArray(),
    db.messages.where('conversationId').equals(options.conversationId).toArray()
  ])

  const plan = buildConversationMutationPlan({
    affectedMessageIds: deletedMessageIds,
    affectedCreatedAt: options.affectedCreatedAt,
    memories: memoryRows,
    stateHistory: historyRows,
    messages: messageRows
  })

  const now = new Date().toISOString()
  await db.transaction(
    'rw',
    [db.messages, db.memories, db.conversationStateHistory, db.conversations],
    async () => {
      await db.messages.bulkDelete(deletedMessageIds)
      if (plan.automaticMemoryIdsToDelete.length) {
        await db.memories.bulkDelete(plan.automaticMemoryIdsToDelete)
      }
      for (const { id, ...changes } of plan.automaticMemoryPatches) {
        await db.memories.update(id, changes)
      }
      if (plan.stateHistoryIdsToDelete.length) {
        await db.conversationStateHistory.bulkDelete(plan.stateHistoryIdsToDelete)
      }
      for (const id of plan.replyReferenceMessageIdsToClear) {
        await db.messages.update(id, { replyTo: undefined })
      }
      await db.conversations.update(options.conversationId, { updatedAt: now })
    }
  )

  return { deletedMessageIds, ...plan }
}

/**
 * Restart the current story runtime while preserving hand-written/imported
 * memories by default. Character cards, Persona and resource bindings are not
 * touched.
 */
export async function resetConversationRuntime(options: {
  conversationId: string
  openingMode: 'pending' | 'free' | 'greeting'
  greetingIndex?: number
  memoryPolicy?: 'automatic' | 'all'
}) {
  const memoryRows = await db.memories.where('conversationId').equals(options.conversationId).toArray()
  const memoryIds = options.memoryPolicy === 'all'
    ? memoryRows.map(row => row.id)
    : memoryRows.filter(isAutomaticMemory).map(row => row.id)
  const now = new Date().toISOString()
  const state = createDefaultConversationState(options.conversationId)
  state.updatedAt = now

  await db.transaction(
    'rw',
    [
      db.messages,
      db.memories,
      db.conversationStateHistory,
      db.promptDebugTraces,
      db.conversationStates,
      db.conversations
    ],
    async () => {
      await db.messages.where('conversationId').equals(options.conversationId).delete()
      if (memoryIds.length) await db.memories.bulkDelete(memoryIds)
      await db.conversationStateHistory.where('conversationId').equals(options.conversationId).delete()
      await db.promptDebugTraces.where('conversationId').equals(options.conversationId).delete()
      await db.conversationStates.put(state)
      await db.conversations.update(options.conversationId, {
        openingMode: options.openingMode,
        greetingIndex: options.greetingIndex,
        updatedAt: now
      })
    }
  )

  return {
    state,
    deletedMemoryIds: memoryIds,
    preservedMemoryIds: memoryRows.filter(row => !memoryIds.includes(row.id)).map(row => row.id),
    updatedAt: now
  }
}
