import { db } from '../../db/database'
import { sanitizeCommunityUiText } from '../../services/communityUiRuntime'
import type { Character, ChatSettings, Conversation, Message, ProactiveSource } from '../../types/domain'
import {
  patchGeneratedMessage,
  persistAlternativeReply,
  persistRichAssistantMessage,
  removeGeneratedMessage
} from './responsePersistenceService'
import {
  createAssistantActionPersistenceRuntime,
  type AssistantActionPersistenceHooks,
  type PersistAssistantActionsOptions
} from './assistantActionPersistenceRuntime'
import type { AssistantReplyFinalizationResult } from './assistantReplyFinalizationRuntime'
import type { StreamingReplySession } from './streamingReplyRuntime'

export interface AssistantReplyPersistenceOptions {
  conversation: Conversation
  character: Character
  settings: ChatSettings
  finalization: AssistantReplyFinalizationResult
  provider: string
  model: string
  generationId: string
  type?: Message['type']
  signal?: AbortSignal
  streamSession: StreamingReplySession
  proactiveSource?: ProactiveSource
  alternativeTargetId?: string
  richReplyHtml: string
  richSource?: Message['richSource']
  canonicalText: string
  modelOutput: string
  communityUiActive: boolean
  communityUiText: string
  regexDisplayText: string
}

export interface AssistantReplyPersistenceHooks extends AssistantActionPersistenceHooks {
  onStreamingMessageChanged(messageId: string): void
  onClearStreamTimers(): void
  onNotice(message: string): void
}

export interface AssistantReplyPersistenceDependencies {
  listMessages(conversationId: string): Promise<Message[]>
  patchGeneratedMessage: typeof patchGeneratedMessage
  persistAlternativeReply: typeof persistAlternativeReply
  persistRichAssistantMessage: typeof persistRichAssistantMessage
  removeGeneratedMessage: typeof removeGeneratedMessage
  persistActions(options: PersistAssistantActionsOptions, hooks: AssistantActionPersistenceHooks): Promise<Message[]>
  wait(ms: number, signal?: AbortSignal): Promise<void>
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

const actionPersistenceRuntime = createAssistantActionPersistenceRuntime()

const defaultDependencies: AssistantReplyPersistenceDependencies = {
  listMessages: conversationId => db.messages.where('conversationId').equals(conversationId).sortBy('createdAt'),
  patchGeneratedMessage,
  persistAlternativeReply,
  persistRichAssistantMessage,
  removeGeneratedMessage,
  persistActions: (options, hooks) => actionPersistenceRuntime.persistActions(options, hooks),
  wait: abortableWait
}

export function canReuseStreamingPlaceholder(
  session: StreamingReplySession,
  finalization: AssistantReplyFinalizationResult
) {
  const actions = finalization.projectedActions
  return Boolean(session.messageId)
    && actions.length === 1
    && actions[0]?.kind === 'text'
    && session.type !== 'voice'
    && session.type !== 'emoji'
}

export function createAssistantReplyPersistenceRuntime(
  overrides: Partial<AssistantReplyPersistenceDependencies> = {}
) {
  const dependencies: AssistantReplyPersistenceDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function refreshMessages(conversationId: string, hooks: AssistantReplyPersistenceHooks) {
    const next = await dependencies.listMessages(conversationId)
    hooks.onMessagesChanged(next)
    return next
  }

  async function persist(options: AssistantReplyPersistenceOptions, hooks: AssistantReplyPersistenceHooks) {
    const { finalization, streamSession, conversation, character, settings } = options

    switch (finalization.persistenceMode) {
      case 'alternative': {
        const currentMessages = await dependencies.listMessages(conversation.id)
        const target = currentMessages.find(item => item.id === options.alternativeTargetId)
        if (!target) throw new Error('没有找到需要添加候选回复的消息。')
        const { activeAlternativeIndex } = await dependencies.persistAlternativeReply({
          target,
          content: finalization.finalVisibleOutput,
          provider: options.provider,
          model: options.model,
          generationId: options.generationId
        })
        await refreshMessages(conversation.id, hooks)
        hooks.onNotice(`已生成第 ${activeAlternativeIndex + 1} 个候选回复。`)
        break
      }

      case 'rich': {
        if (streamSession.messageId) {
          await dependencies.removeGeneratedMessage(streamSession.messageId)
        }
        await dependencies.persistRichAssistantMessage({
          conversation,
          senderId: character.id,
          html: options.richReplyHtml,
          rawContent: options.canonicalText,
          modelOutput: options.modelOutput,
          provider: options.provider,
          model: options.model,
          generationId: options.generationId,
          source: options.richSource,
          proactiveSource: options.proactiveSource,
          regexApplied: finalization.regexApplied
        })
        streamSession.messageId = undefined
        await refreshMessages(conversation.id, hooks)
        hooks.onStreamingMessageChanged('')
        hooks.onClearStreamTimers()
        await hooks.onScrollRequested()
        break
      }

      case 'canonical-display': {
        const displayContent = options.communityUiActive
          ? (options.communityUiText || sanitizeCommunityUiText(options.regexDisplayText))
          : finalization.finalVisibleOutput
        await dependencies.persistActions({
          conversation,
          character,
          settings,
          actions: [{ kind: 'text', content: options.canonicalText }],
          provider: options.provider,
          model: options.model,
          generationId: options.generationId,
          type: options.type,
          signal: options.signal,
          replaceMessageId: streamSession.messageId,
          roleCardUi: finalization.visibleRoleCardUi,
          proactiveSource: options.proactiveSource,
          rawContent: options.canonicalText,
          modelOutput: options.modelOutput,
          displayContent: displayContent !== options.canonicalText ? displayContent : undefined,
          regexApplied: finalization.regexApplied
        }, hooks)
        streamSession.messageId = undefined
        break
      }

      case 'streaming': {
        const actions = finalization.projectedActions
        const output = finalization.parsedOutput
        if (!actions.length) throw new Error('模型没有返回有效回复。')
        streamSession.text = actions.map(item => item.content).join('\n\n')
        if (canReuseStreamingPlaceholder(streamSession, finalization) && streamSession.messageId) {
          await dependencies.patchGeneratedMessage(streamSession.messageId, {
            content: actions[0]?.content || '',
            rawContent: streamSession.canonicalText || streamSession.rawText || undefined,
            modelOutput: streamSession.rawText || undefined,
            regexPipelineVersion: 2,
            regexApplied: finalization.regexApplied,
            status: 'delivered',
            provider: streamSession.provider,
            model: streamSession.model,
            generationId: streamSession.generationId,
            errorText: undefined,
            protocolVersion: output.rawPacket ? 2 : undefined,
            roleCardUi: finalization.visibleRoleCardUi,
            proactiveSource: streamSession.proactiveSource
          })
        } else {
          await dependencies.persistActions({
            conversation: streamSession.conversation,
            character,
            settings,
            actions,
            provider: streamSession.provider,
            model: streamSession.model,
            generationId: streamSession.generationId,
            type: streamSession.type,
            replaceMessageId: streamSession.messageId,
            roleCardUi: finalization.visibleRoleCardUi,
            proactiveSource: streamSession.proactiveSource,
            rawContent: streamSession.canonicalText || streamSession.rawText || undefined,
            modelOutput: streamSession.rawText || undefined,
            regexApplied: finalization.regexApplied
          }, hooks)
        }
        streamSession.messageId = undefined
        await refreshMessages(conversation.id, hooks)
        hooks.onStreamingMessageChanged('')
        hooks.onClearStreamTimers()
        await hooks.onScrollRequested()
        break
      }

      case 'actions': {
        if (settings.naturalDelay) {
          await dependencies.wait(240 + Math.min(900, finalization.parsedOutput.visibleText.length * 9), options.signal)
        }
        await dependencies.persistActions({
          conversation,
          character,
          settings,
          actions: finalization.projectedActions,
          provider: options.provider,
          model: options.model,
          generationId: options.generationId,
          type: options.type,
          signal: options.signal,
          roleCardUi: finalization.visibleRoleCardUi,
          proactiveSource: options.proactiveSource,
          rawContent: options.canonicalText,
          modelOutput: options.modelOutput,
          regexApplied: finalization.regexApplied
        }, hooks)
        break
      }
    }
  }

  return { persist }
}
