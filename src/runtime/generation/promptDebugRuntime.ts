import { diagnoseApiHttpError, diagnoseApiResponse } from '../../services/ai/apiResponseDiagnostics'
import type { ChatRequest, ChatResponse } from '../../services/ai/provider'
import { ProviderHttpError } from '../../services/ai/provider'
import { getMessageImageUrls } from '../../services/messageImageService'
import {
  naturalnessWarnings,
  scoreNaturalness,
  type ParsedCompanionOutput
} from '../../services/interactionProtocol'
import {
  analyzePromptSections,
  buildRuleInfluences,
  buildTruncationNotes,
  estimatePromptCharacters,
  patchPromptDebugTrace,
  savePromptDebugTrace
} from '../../services/promptDebugService'
import type { Message, PromptDebugTrace } from '../../types/domain'
import { chatTurnContentText } from './generationContext'
import type { GenerationContext } from './generationContextBuilder'
import { buildRegexPipelineDebug } from './assistantReplyFinalizationRuntime'

export interface PromptDebugRuntimeDependencies {
  saveTrace: typeof savePromptDebugTrace
  patchTrace: typeof patchPromptDebugTrace
  warn(message: string, error: unknown): void
}

const defaultDependencies: PromptDebugRuntimeDependencies = {
  saveTrace: savePromptDebugTrace,
  patchTrace: patchPromptDebugTrace,
  warn: (message, error) => console.warn(message, error)
}

export interface PromptDebugBeginOptions {
  enabled: boolean
  context: GenerationContext
  request: ChatRequest
  providerId: string
  sourceMessageId?: string
}

export interface PromptDebugCompleteOptions {
  traceId?: string
  context: GenerationContext
  providerId: string
  model: string
  response: ChatResponse
  tokenUsage: NonNullable<PromptDebugTrace['tokenUsage']>
  finalVisibleOutput: string
  parsedOutput: ParsedCompanionOutput
  visualMessage?: Message
}

export function buildPromptDebugBeginPayload(options: PromptDebugBeginOptions): Omit<PromptDebugTrace, 'id' | 'createdAt'> {
  const { context, request, providerId, sourceMessageId } = options
  const systemPrompt = chatTurnContentText(request.messages[0]?.content || '')
  const recentMessages = request.messages.slice(1).map(turn => ({
    role: turn.role,
    content: chatTurnContentText(turn.content)
  }))
  const promptSections = analyzePromptSections(systemPrompt, recentMessages)
  const cardRuntime = context.cardRuntime
  const lorebook = context.lorebook

  return {
    conversationId: context.conversation.id,
    characterId: context.character.id,
    generationId: context.generationId,
    sourceMessageId,
    contextCreatedAt: context.contextCreatedAt,
    provider: providerId,
    model: request.model,
    roleplayMode: context.settings.roleplayMode,
    personaName: context.persona.name,
    systemPrompt,
    recentMessages,
    activatedLorebook: lorebook.activated.map(item => ({
      id: item.id,
      title: item.title,
      reason: item.activationReason
    })),
    resourceRouting: lorebook.routingDecisions,
    estimatedSavedCharacters: lorebook.estimatedSavedCharacters,
    characterCardRuntime: {
      family: cardRuntime.family,
      sourceLabel: cardRuntime.sourceLabel,
      macroCharacterName: cardRuntime.macroCharacterName,
      systemPromptMode: cardRuntime.systemPromptMode,
      postHistoryMode: cardRuntime.postHistoryMode,
      creatorNotesInPrompt: false,
      greetingCount: cardRuntime.greetings.length,
      notes: cardRuntime.notes
    },
    lorebookEngine: lorebook.engineDebug,
    memoryHits: context.memoryHitDetails.map(item => ({
      id: item.memory.id,
      content: item.memory.content,
      importance: item.memory.importance,
      layer: item.memory.layer,
      score: item.score,
      reason: item.reasons.join('；')
    })),
    imageCount: request.messages.reduce((total, turn) => {
      if (typeof turn.content === 'string') return total
      return total + turn.content.filter(part => part.type === 'image_url').length
    }, 0),
    estimatedCharacters: estimatePromptCharacters(systemPrompt, recentMessages),
    protocolEnabled: context.runtimeProfile.useNativeInteractionProtocol,
    promptSections,
    truncations: buildTruncationNotes({
      allMessageCount: context.messages.length,
      includedMessageCount: recentMessages.length,
      systemPrompt,
      sections: promptSections
    }),
    ruleInfluences: buildRuleInfluences(systemPrompt)
  }
}

export function buildPromptDebugCompletionPatch(options: PromptDebugCompleteOptions): Partial<PromptDebugTrace> {
  const { context, providerId, model, response, tokenUsage, finalVisibleOutput, parsedOutput, visualMessage } = options
  const regexPipeline = buildRegexPipelineDebug({
    traces: context.regexExecutionTraces,
    activeScriptIds: [
      ...context.activeAssistantRegex,
      ...context.activeUserRegex,
      ...context.activeWorldRegex
    ].map(item => item.id)
  })

  return {
    regexPipeline,
    provider: providerId,
    model,
    tokenUsage: { ...tokenUsage },
    apiResponseDiagnostics: diagnoseApiResponse(response),
    rawOutput: response.text,
    visibleOutput: finalVisibleOutput,
    actionSummary: parsedOutput.actionSummary,
    presenceResolution: parsedOutput.presenceResolution,
    naturalnessWarnings: [...parsedOutput.warnings, ...naturalnessWarnings(finalVisibleOutput)],
    naturalnessScore: scoreNaturalness({
      text: finalVisibleOutput,
      character: context.character,
      latestUserText: context.latestUserText,
      relationshipNote: context.conversationState?.relationshipNote,
      imageCount: visualMessage ? getMessageImageUrls(visualMessage).length : 0,
      recentAssistantMessages: context.messages.filter(item => item.senderId !== 'user')
    })
  }
}

export function createPromptDebugRuntime(overrides: Partial<PromptDebugRuntimeDependencies> = {}) {
  const dependencies: PromptDebugRuntimeDependencies = {
    ...defaultDependencies,
    ...overrides
  }

  async function begin(options: PromptDebugBeginOptions): Promise<string | undefined> {
    if (!options.enabled) return undefined
    try {
      const trace = await dependencies.saveTrace(buildPromptDebugBeginPayload(options))
      return trace.id
    } catch (error) {
      dependencies.warn('保存 Prompt 调试记录失败：', error)
      return undefined
    }
  }

  async function complete(options: PromptDebugCompleteOptions) {
    if (!options.traceId) return
    try {
      await dependencies.patchTrace(options.traceId, buildPromptDebugCompletionPatch(options))
    } catch (error) {
      dependencies.warn('更新 Prompt 调试记录失败：', error)
    }
  }

  async function recordHttpError(traceId: string | undefined, error: unknown) {
    if (!traceId || !(error instanceof ProviderHttpError)) return
    try {
      await dependencies.patchTrace(traceId, {
        apiResponseDiagnostics: diagnoseApiHttpError(error.status)
      })
    } catch {
      // 调试失败不能掩盖原始 API 错误。
    }
  }

  return { begin, complete, recordHttpError }
}
