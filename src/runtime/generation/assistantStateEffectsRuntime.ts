import { db } from '../../db/database'
import { patchConversationState } from '../../services/chatSettings'
import { rememberCharacterObservation } from '../../services/memoryService'
import { mergeStatusIntoConversationState, type ParsedCompanionOutput } from '../../services/interactionProtocol'
import { recordConversationStateChanges } from '../../services/stateHistoryService'
import type {
  Character,
  ChatSettings,
  ConversationState,
  LorebookRuntimeState
} from '../../types/domain'

export interface AssistantResourceSessionState {
  entryId?: string
  title?: string
  continued: boolean
  exitRequested: boolean
}

export interface AssistantStateEffectsOptions {
  conversationId: string
  character: Character
  settings: ChatSettings
  beforeState?: ConversationState
  parsedOutput: ParsedCompanionOutput
  resourceSession: AssistantResourceSessionState
  nextLorebookRuntimeState: LorebookRuntimeState
  sourceMessageId?: string
  alternativeTargetId?: string
}

export interface AssistantStateEffectsResult {
  state?: ConversationState
  character: Character
  stateChanged: boolean
  memoryChanged: boolean
  characterChanged: boolean
}

export interface AssistantStateEffectsHooks {
  onMemoryChanged?(): Promise<void> | void
}

export interface AssistantStateEffectsDependencies {
  patchConversationState(conversationId: string, patch: Partial<ConversationState>): Promise<ConversationState>
  recordConversationStateChanges: typeof recordConversationStateChanges
  rememberCharacterObservation: typeof rememberCharacterObservation
  updateCharacter(characterId: string, patch: Partial<Character>): Promise<void>
  now(): string
}

const defaultDependencies: AssistantStateEffectsDependencies = {
  patchConversationState,
  recordConversationStateChanges,
  rememberCharacterObservation,
  updateCharacter: async (characterId, patch) => { await db.characters.update(characterId, patch) },
  now: () => new Date().toISOString()
}

export function buildAssistantResourceSessionPatch(
  resourceSession: AssistantResourceSessionState,
  now: string
): Partial<ConversationState> {
  if (resourceSession.exitRequested) {
    return {
      activeResourceEntryId: undefined,
      activeResourceTitle: undefined,
      activeResourceUpdatedAt: now
    }
  }
  if (resourceSession.entryId) {
    return {
      activeResourceEntryId: resourceSession.entryId,
      activeResourceTitle: resourceSession.title,
      activeResourceUpdatedAt: now
    }
  }
  return {}
}

export function buildAssistantConversationStatePatch(options: {
  beforeState: ConversationState
  parsedOutput: ParsedCompanionOutput
  resourceSession: AssistantResourceSessionState
  lorebookEnabled: boolean
  nextLorebookRuntimeState: LorebookRuntimeState
  now: string
}): { patch: Partial<ConversationState>; shouldPersist: boolean } {
  const resourceSessionPatch = buildAssistantResourceSessionPatch(options.resourceSession, options.now)
  const lorebookRuntimePatch: Partial<ConversationState> = options.lorebookEnabled
    ? { lorebookRuntime: options.nextLorebookRuntimeState }
    : {}
  const shouldPersist = Boolean(options.parsedOutput.status)
    || Object.keys(resourceSessionPatch).length > 0
    || Object.keys(lorebookRuntimePatch).length > 0

  if (!shouldPersist) return { patch: {}, shouldPersist: false }

  return {
    shouldPersist: true,
    patch: {
      ...(options.parsedOutput.status
        ? mergeStatusIntoConversationState(
            options.beforeState,
            options.parsedOutput.status,
            options.parsedOutput.presenceResolution
          )
        : {}),
      ...resourceSessionPatch,
      ...lorebookRuntimePatch,
      lastActionSummary: options.parsedOutput.actionSummary
    }
  }
}

export function buildAssistantObservation(options: {
  parsedOutput: ParsedCompanionOutput
  memoryEnabled: boolean
}): { content: string; importance: 3 | 4 } | undefined {
  const status = options.parsedOutput.status
  if (!options.memoryEnabled || !status || (!status.relationshipNote && !status.innerThought)) return undefined
  const observation = [status.relationshipNote, status.innerThought]
    .filter(Boolean)
    .join('；')
  return {
    content: `角色主观感受：${observation}`,
    importance: status.relationshipNote ? 4 : 3
  }
}

export function createAssistantStateEffectsRuntime(
  overrides: Partial<AssistantStateEffectsDependencies> = {}
) {
  const dependencies: AssistantStateEffectsDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function apply(
    options: AssistantStateEffectsOptions,
    hooks: AssistantStateEffectsHooks = {}
  ): Promise<AssistantStateEffectsResult> {
    const result: AssistantStateEffectsResult = {
      state: options.beforeState,
      character: options.character,
      stateChanged: false,
      memoryChanged: false,
      characterChanged: false
    }

    // 候选回复只扩展目标消息，不允许顺带改会话事实、角色状态或长期记忆。
    if (options.alternativeTargetId || !options.beforeState) return result

    const now = dependencies.now()
    const statePlan = buildAssistantConversationStatePatch({
      beforeState: options.beforeState,
      parsedOutput: options.parsedOutput,
      resourceSession: options.resourceSession,
      lorebookEnabled: options.settings.lorebookEnabled,
      nextLorebookRuntimeState: options.nextLorebookRuntimeState,
      now
    })

    if (!statePlan.shouldPersist) return result

    const nextState = await dependencies.patchConversationState(options.conversationId, statePlan.patch)
    await dependencies.recordConversationStateChanges({
      conversationId: options.conversationId,
      characterId: options.character.id,
      before: options.beforeState,
      after: nextState,
      sourceMessageId: options.sourceMessageId
    })
    result.state = nextState
    result.stateChanged = true

    const observation = buildAssistantObservation({
      parsedOutput: options.parsedOutput,
      memoryEnabled: options.settings.memoryEnabled
    })
    if (observation) {
      await dependencies.rememberCharacterObservation({
        conversationId: options.conversationId,
        characterId: options.character.id,
        content: observation.content,
        sourceMessageId: options.sourceMessageId,
        importance: observation.importance
      })
      result.memoryChanged = true
      await hooks.onMemoryChanged?.()
    }

    if (options.parsedOutput.status) {
      const characterPatch: Partial<Character> = {
        mood: options.parsedOutput.status.mood || options.character.mood,
        activity: options.parsedOutput.status.activity || options.character.activity,
        updatedAt: now
      }
      await dependencies.updateCharacter(options.character.id, characterPatch)
      result.character = { ...options.character, ...characterPatch }
      result.characterChanged = true
    }

    return result
  }

  return { apply }
}
