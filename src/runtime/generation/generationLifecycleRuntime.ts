import { patchConversationState } from '../../services/chatSettings'
import { isTokenLimitError } from '../../services/ai/provider'
import { createLocalSummary } from '../../services/memoryService'
import type {
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  ProactiveSource
} from '../../types/domain'

export interface GenerationLifecycleDependencies {
  patchConversationState: typeof patchConversationState
  createLocalSummary: typeof createLocalSummary
}

const defaultDependencies: GenerationLifecycleDependencies = {
  patchConversationState,
  createLocalSummary
}

export interface GenerationLifecycleMessageHooks {
  updateUserMessageState(
    messageId: string | undefined,
    status: Message['status'],
    patch?: Partial<Message>
  ): Promise<void>
}

export interface GenerationSuccessOptions {
  conversation: Conversation
  settings: ChatSettings
  currentState?: ConversationState
  messages: Message[]
  sourceMessageId?: string
  proactiveSource?: ProactiveSource
  providerNotice: string
  visualMessagePresent: boolean
  visionUsed: boolean
  visionFallback: boolean
}

export interface GenerationFailureOptions {
  error: unknown
  manualStopRequested: boolean
  conversation: Conversation
  sourceMessageId?: string
  visualMessagePresent: boolean
  visionUsed: boolean
  visionFallback: boolean
}

export interface GenerationFailureHooks extends GenerationLifecycleMessageHooks {
  preserveInterrupted(): Promise<boolean>
  discardStream(): Promise<void>
}

export interface GenerationFailureResult {
  aborted: boolean
  errorMessage?: string
  noticeMessage?: string
  state?: ConversationState
  technicalError?: string
}

export function isGenerationAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  )
}

function visionPatch(options: { visualMessagePresent: boolean; visionUsed: boolean; visionFallback: boolean }) {
  return {
    visionUsed: options.visualMessagePresent ? options.visionUsed : undefined,
    visionFallback: options.visualMessagePresent ? options.visionFallback : undefined
  }
}

export function shouldRefreshLocalSummary(options: {
  settings: ChatSettings
  state?: ConversationState
  messages: Message[]
}) {
  if (!options.settings.memoryEnabled) return false
  const count = options.messages.length
  const previousCount = options.state?.summaryMessageCount ?? 0
  return count >= 28 && count - previousCount >= 12
}

export function createGenerationLifecycleRuntime(
  overrides: Partial<GenerationLifecycleDependencies> = {}
) {
  const dependencies: GenerationLifecycleDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function complete(
    options: GenerationSuccessOptions,
    hooks: GenerationLifecycleMessageHooks
  ) {
    await hooks.updateUserMessageState(
      options.sourceMessageId,
      'read',
      visionPatch(options)
    )

    const statePatch: Partial<ConversationState> = {
      lastTechnicalError: '',
      lastProviderNotice: options.providerNotice
    }
    if (options.proactiveSource) statePatch.lastProactiveAt = new Date().toISOString()

    let state = await dependencies.patchConversationState(options.conversation.id, statePatch)

    if (shouldRefreshLocalSummary({ settings: options.settings, state, messages: options.messages })) {
      const summary = dependencies.createLocalSummary(options.messages)
      if (summary) {
        state = await dependencies.patchConversationState(options.conversation.id, {
          summary,
          summaryMessageCount: options.messages.length
        })
      }
    }

    return state
  }

  async function fail(
    options: GenerationFailureOptions,
    hooks: GenerationFailureHooks
  ): Promise<GenerationFailureResult> {
    const messagePatch = visionPatch(options)

    if (isGenerationAbortError(options.error)) {
      if (options.manualStopRequested) {
        const preserved = await hooks.preserveInterrupted()
        await hooks.updateUserMessageState(
          options.sourceMessageId,
          preserved ? 'read' : 'cancelled',
          messagePatch
        )
        return {
          aborted: true,
          noticeMessage: preserved
            ? '已按你的操作停止生成，已经出现的真实 AI 内容已保留。'
            : '已停止等待回复，可长按消息重新发送。'
        }
      }

      await hooks.discardStream()
      await hooks.updateUserMessageState(options.sourceMessageId, 'cancelled', messagePatch)
      return { aborted: true }
    }

    const technical = options.error instanceof Error
      ? options.error.message
      : '未知错误'

    await hooks.discardStream()
    await hooks.updateUserMessageState(options.sourceMessageId, 'failed', {
      errorText: technical,
      ...messagePatch
    })

    const state = await dependencies.patchConversationState(options.conversation.id, {
      lastTechnicalError: technical,
      lastProviderNotice: ''
    })

    if (isTokenLimitError(options.error)) {
      return {
        aborted: false,
        technicalError: technical,
        errorMessage: technical,
        noticeMessage: '本轮已停止，未保存任何不完整的角色回复。',
        state
      }
    }

    return {
      aborted: false,
      technicalError: technical,
      errorMessage: `AI 请求失败：${technical}`,
      noticeMessage: '本轮已停止，未保存中断或不完整的角色回复；小手机不会使用本地内容续写。',
      state
    }
  }

  return { complete, fail }
}
