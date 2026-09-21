import { db } from '../../db/database'
import { estimateVoiceDuration, type CompanionActionMessage } from '../../services/interactionProtocol'
import type {
  Character,
  ChatSettings,
  Conversation,
  Message,
  ProactiveSource
} from '../../types/domain'
import {
  persistAssistantContentMessage,
  removeGeneratedMessage
} from './responsePersistenceService'

export interface PersistAssistantActionsOptions {
  conversation: Conversation
  character: Character
  settings: ChatSettings
  actions: CompanionActionMessage[]
  provider: string
  model: string
  generationId: string
  type?: Message['type']
  signal?: AbortSignal
  replaceMessageId?: string
  roleCardUi?: Message['roleCardUi']
  proactiveSource?: ProactiveSource
  rawContent?: string
  modelOutput?: string
  displayContent?: string
  regexApplied?: Message['regexApplied']
}

export interface AssistantActionPersistenceHooks {
  onMessagesChanged(messages: Message[]): void
  onScrollRequested(): Promise<void> | void
}

export interface AssistantActionPersistenceDependencies {
  listMessages(conversationId: string): Promise<Message[]>
  updateMessage(messageId: string, patch: Partial<Message>): Promise<void>
  removeGeneratedMessage(messageId: string): Promise<void>
  persistAssistantContentMessage: typeof persistAssistantContentMessage
  wait(ms: number, signal?: AbortSignal): Promise<void>
  randomUUID(): string
  now(offsetMs?: number): string
}

function abortableWait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('请求已取消', 'AbortError'))
    }, { once: true })
  })
}

const defaultDependencies: AssistantActionPersistenceDependencies = {
  listMessages: conversationId => db.messages.where('conversationId').equals(conversationId).sortBy('createdAt'),
  updateMessage: async (messageId, patch) => { await db.messages.update(messageId, patch) },
  removeGeneratedMessage,
  persistAssistantContentMessage,
  wait: abortableWait,
  randomUUID: () => crypto.randomUUID(),
  now: offsetMs => new Date(Date.now() + (offsetMs || 0)).toISOString()
}

export function actionMessageType(action: CompanionActionMessage, baseType?: Message['type']): Message['type'] {
  if (action.kind === 'scene_action') return 'action'
  if (action.kind === 'emoji') return 'emoji'
  if (action.kind === 'voice') return 'voice'
  if (action.kind === 'image_placeholder') return 'image'
  return baseType === 'music' ? 'music' : 'text'
}

export function messagePacingDelay(
  action: CompanionActionMessage,
  index: number,
  settings: ChatSettings,
  activeCharacter: Character
) {
  if (action.kind === 'typing_pause') return action.delayMs ?? 620
  if (index === 0 || !settings.naturalDelay) return action.delayMs ?? 0
  const pacing = settings.messagePacing ?? 'natural'
  if (pacing === 'off') return action.delayMs ?? 0
  const speedFactor = activeCharacter.replySpeed === 'slow' ? 1.35 : activeCharacter.replySpeed === 'instant' ? .65 : 1
  const base = pacing === 'quick' ? 260 : pacing === 'slow' ? 760 : 430
  const perCharacter = action.kind === 'emoji' ? 0 : pacing === 'slow' ? 17 : 11
  return Math.max(action.delayMs ?? 0, Math.round((base + Math.min(1400, action.content.length * perCharacter)) * speedFactor))
}

export function resolveActionTarget(
  conversationMessages: Message[],
  targetMessageId: string | undefined,
  sender: 'user' | 'assistant'
) {
  if (targetMessageId && targetMessageId !== 'latest_user' && targetMessageId !== 'latest_assistant') {
    return conversationMessages.find(item => item.id === targetMessageId)
  }
  const wantUser = targetMessageId === 'latest_user' || sender === 'user'
  return [...conversationMessages].reverse().find(item => wantUser ? item.senderId === 'user' : item.senderId !== 'user')
}

export function createAssistantActionPersistenceRuntime(
  overrides: Partial<AssistantActionPersistenceDependencies> = {}
) {
  const dependencies: AssistantActionPersistenceDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function persistActions(
    options: PersistAssistantActionsOptions,
    hooks: AssistantActionPersistenceHooks
  ) {
    if (!options.actions.length) return [] as Message[]
    const activeConversation = options.conversation
    const groupId = dependencies.randomUUID()
    let roleCardUiAssigned = false
    let rawContentAssigned = false
    let modelOutputAssigned = false
    let displayContentAssigned = false
    let conversationMessages = await dependencies.listMessages(activeConversation.id)

    const refreshMessages = async () => {
      conversationMessages = await dependencies.listMessages(activeConversation.id)
      hooks.onMessagesChanged(conversationMessages)
    }

    if (options.replaceMessageId) {
      await dependencies.removeGeneratedMessage(options.replaceMessageId)
      await refreshMessages()
    }

    for (let index = 0; index < options.actions.length; index += 1) {
      if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError')
      const action = options.actions[index]
      const delay = messagePacingDelay(action, index, options.settings, options.character)
      if (delay > 0) await dependencies.wait(delay, options.signal)

      if (action.kind === 'typing_pause') continue

      if (action.kind === 'recall_message') {
        const target = resolveActionTarget(conversationMessages, action.targetMessageId, 'assistant')
        if (target && target.senderId !== 'user' && !target.recalledAt) {
          const recalledAt = dependencies.now()
          await dependencies.updateMessage(target.id, {
            recalledAt,
            recalledOriginalContent: target.content,
            content: '',
            alternatives: undefined,
            activeAlternativeIndex: undefined,
            protocolVersion: 2
          })
          await refreshMessages()
        }
        continue
      }

      if (action.kind === 'react_to_message') {
        const target = resolveActionTarget(conversationMessages, action.targetMessageId || 'latest_user', 'user')
        if (target && action.content) {
          await dependencies.updateMessage(target.id, {
            reactionEmoji: action.content.slice(0, 8),
            reactionToMessageId: target.id,
            protocolVersion: 2
          })
          await refreshMessages()
        }
        continue
      }

      const type = actionMessageType(action, options.type)
      const message = await dependencies.persistAssistantContentMessage({
        conversation: activeConversation,
        senderId: activeConversation.memberIds[0],
        type,
        content: action.kind === 'image_placeholder' ? '' : action.content,
        generationId: options.generationId,
        provider: options.provider,
        model: options.model,
        proactiveSource: options.proactiveSource,
        replyGroupId: groupId,
        replySequence: index,
        rawContent: !rawContentAssigned && options.rawContent ? options.rawContent : undefined,
        modelOutput: !modelOutputAssigned && options.modelOutput ? options.modelOutput : undefined,
        displayContent: options.actions.length === 1 && !displayContentAssigned && options.displayContent ? options.displayContent : undefined,
        regexApplied: !rawContentAssigned && options.regexApplied ? options.regexApplied : undefined,
        roleCardUi: !roleCardUiAssigned && options.roleCardUi ? options.roleCardUi : undefined,
        voiceDurationSeconds: type === 'voice' ? estimateVoiceDuration(action.content) : undefined,
        placeholderImagePrompt: action.kind === 'image_placeholder' ? action.content : undefined,
        protocolVersion: 2,
        createdAt: dependencies.now(index)
      })
      if (message.roleCardUi) roleCardUiAssigned = true
      if (message.rawContent) rawContentAssigned = true
      if (message.modelOutput) modelOutputAssigned = true
      if (message.displayContent) displayContentAssigned = true
      await refreshMessages()
      await hooks.onScrollRequested()
    }

    return conversationMessages
  }

  return { persistActions }
}
