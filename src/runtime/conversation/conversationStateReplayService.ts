import { db } from '../../db/database'
import { createDefaultConversationState } from '../../services/chatSettings'
import { inferCardInitialActivity, inferCardInitialRelationship } from '../../services/characterInitialStateService'
import { normalizeCommunityPlainText } from '../../services/regexRuntime'
import { extractRoleCardUiHints, resolvePresenceFromRoleCardScene, roleCardUiToConversationPatch } from '../../services/roleCardUiService'
import type {
  ConversationState,
  ConversationStateHistory,
  LorebookRuntimeState,
  Message
} from '../../types/domain'

export type ConversationStateReplayMode = 'rewind' | 'branch'

function applyHistoryRow(state: ConversationState, row: ConversationStateHistory) {
  if (row.field === 'location') state.location = row.nextValue
  else if (row.field === 'presence' && (row.nextValue === 'together' || row.nextValue === 'remote')) state.presence = row.nextValue
  else if (row.field === 'timePeriod') state.timePeriod = row.nextValue
  else if (row.field === 'energy') state.energy = row.nextValue
  else if (row.field === 'mood') state.innerMood = row.nextValue
  else if (row.field === 'activity') state.innerActivity = row.nextValue
  else if (row.field === 'relationship') state.relationshipNote = row.nextValue
  else if (row.field === 'topic') state.unresolvedTopics = Array.from(new Set([...(state.unresolvedTopics || []), row.nextValue])).slice(-6)
  else if (row.field === 'goal') state.shortTermGoals = Array.from(new Set([...(state.shortTermGoals || []), row.nextValue])).slice(-6)
  else if (row.field === 'event' && row.label === '等待中的事件') state.pendingEvents = Array.from(new Set([...(state.pendingEvents || []), row.nextValue])).slice(-6)
  else if (row.field === 'event') state.lastCompletedEvent = row.nextValue
}

function rebuildLorebookRuntime(options: {
  currentState?: ConversationState
  retainedMessages: Message[]
  cutoffCreatedAt: string
  messageIdMap?: Map<string, string>
}): LorebookRuntimeState {
  const runtime = options.currentState?.lorebookRuntime
  if (!runtime) return {}
  const retainedIds = new Set(options.retainedMessages.map(item => item.id))
  const activeMessageCount = options.retainedMessages.filter(row => !row.recalledAt).length

  return Object.fromEntries(Object.entries(runtime).flatMap(([entryId, state]) => {
    const sourceId = state.activatedAtMessageId
    const retainedSource = sourceId ? retainedIds.has(sourceId) : state.activatedAt <= options.cutoffCreatedAt
    const effectUntil = Math.max(state.stickyUntilMessageCount ?? -1, state.cooldownUntilMessageCount ?? -1)
    if (!retainedSource || effectUntil < activeMessageCount) return []
    return [[entryId, {
      ...state,
      activatedAtMessageId: sourceId ? (options.messageIdMap?.get(sourceId) || sourceId) : undefined
    }]]
  }))
}

/**
 * Rebuild one point-in-time ConversationState from retained messages + state history.
 *
 * `rewind` deliberately clears ephemeral thought/resource/lorebook runtime so a
 * regenerated branch cannot inherit state produced after the rewind point.
 * `branch` may carry time-stamped ephemeral data only when it was already valid
 * at the branch cutoff.
 */
export function buildConversationStateSnapshot(options: {
  conversationId: string
  retainedMessages: Message[]
  stateHistory: ConversationStateHistory[]
  personaName?: string
  mode: ConversationStateReplayMode
  currentState?: ConversationState
  cutoffCreatedAt?: string
  messageIdMap?: Map<string, string>
  now?: string
}): ConversationState {
  const now = options.now ?? new Date().toISOString()
  const personaName = options.personaName?.trim() || '你'
  const retainedIds = new Set(options.retainedMessages.map(item => item.id))
  const state = createDefaultConversationState(options.conversationId)

  const greeting = options.retainedMessages.find(item => item.isGreetingSeed && item.senderId !== 'user')
  if (greeting) {
    const source = greeting.rawContent || greeting.content
    const plain = normalizeCommunityPlainText(source)
    const ui = greeting.roleCardUi || extractRoleCardUiHints(plain)
    const patch = roleCardUiToConversationPatch(plain, ui, [personaName])
    const presence = resolvePresenceFromRoleCardScene(source, ui, undefined, [personaName]).resolvedPresence
    Object.assign(state, patch)
    if (presence) state.presence = presence
    state.innerActivity = inferCardInitialActivity(source) || state.innerActivity
    state.relationshipNote = inferCardInitialRelationship(source) || state.relationshipNote
  }

  const cutoffCreatedAt = options.cutoffCreatedAt
    || options.retainedMessages.at(-1)?.createdAt
    || now
  const relevantHistory = options.stateHistory
    .filter(row => row.sourceMessageId
      ? retainedIds.has(row.sourceMessageId)
      : row.createdAt <= cutoffCreatedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const row of relevantHistory) applyHistoryRow(state, row)

  if (options.mode === 'branch' && options.currentState) {
    if (options.currentState.activeResourceEntryId
      && options.currentState.activeResourceUpdatedAt
      && options.currentState.activeResourceUpdatedAt <= cutoffCreatedAt) {
      state.activeResourceEntryId = options.currentState.activeResourceEntryId
      state.activeResourceTitle = options.currentState.activeResourceTitle
      state.activeResourceUpdatedAt = options.currentState.activeResourceUpdatedAt
    }
    if (options.currentState.thoughtUpdatedAt && options.currentState.thoughtUpdatedAt <= cutoffCreatedAt) {
      state.innerThought = options.currentState.innerThought
      state.thoughtUpdatedAt = options.currentState.thoughtUpdatedAt
    }
    state.lorebookRuntime = rebuildLorebookRuntime({
      currentState: options.currentState,
      retainedMessages: options.retainedMessages,
      cutoffCreatedAt,
      messageIdMap: options.messageIdMap
    })
  } else {
    state.innerThought = ''
    state.thoughtUpdatedAt = undefined
    state.activeResourceEntryId = undefined
    state.activeResourceTitle = undefined
    state.activeResourceUpdatedAt = undefined
    state.lorebookRuntime = {}
  }

  state.summary = ''
  state.summaryMessageCount = 0
  state.lastActionSummary = ''
  state.lastTechnicalError = ''
  state.lastProviderNotice = ''
  state.presenceResolutionSource = 'unknown'
  state.presenceResolutionReason = options.mode === 'branch'
    ? '由分支节点之前的消息与状态历史重建；后续场景从该节点继续判断。'
    : '由当前保留消息与状态历史重建；已移除分支不会继续影响当前场景。'
  state.updatedAt = now
  return state
}

export async function rebuildAndPersistConversationState(options: {
  conversationId: string
  retainedMessages: Message[]
  personaName?: string
  mode?: ConversationStateReplayMode
  currentState?: ConversationState
  cutoffCreatedAt?: string
}) {
  const history = await db.conversationStateHistory.where('conversationId').equals(options.conversationId).toArray()
  const state = buildConversationStateSnapshot({
    conversationId: options.conversationId,
    retainedMessages: options.retainedMessages,
    stateHistory: history,
    personaName: options.personaName,
    mode: options.mode ?? 'rewind',
    currentState: options.currentState,
    cutoffCreatedAt: options.cutoffCreatedAt
  })
  await db.conversationStates.put(state)
  return state
}
