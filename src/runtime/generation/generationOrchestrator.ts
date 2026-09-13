import {
  isVisionUnsupportedError,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ModelProvider
} from '../../services/ai/provider'
import { saveVisionCapability } from '../../services/modelSettings'
import type { ModelSettings } from '../../types/modelSettings'
import { cloneChatRequest } from './generationContext'
import type { GenerationContext } from './generationContextBuilder'


function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : Boolean(error && typeof error === 'object' && 'name' in error && (error as { name?: string }).name === 'AbortError')
}

export interface GenerationTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  successfulCalls: number
}

export interface RunGenerationProviderOptions {
  context: GenerationContext
  provider: ModelProvider
  useStreaming: boolean
  usage?: GenerationTokenUsage
  onBeforeRequest?: (provider: ModelProvider, request: ChatRequest) => void | Promise<void>
  onDelta?: (chunk: ChatStreamChunk) => void | Promise<void>
  onVisionStage?: (stage: 'analyzing' | 'replying' | 'text-only') => void
  canRetryWithoutVision?: () => boolean
}

export interface GenerationProviderResult {
  response: ChatResponse
  providerId: string
  model: string
  modelSettings: ModelSettings
  providerNotice: string
  visionUsed: boolean
  visionFallback: boolean
  tokenUsage: GenerationTokenUsage
}

export function createGenerationTokenUsage(): GenerationTokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    successfulCalls: 0
  }
}

export function accumulateGenerationTokenUsage(
  usage: GenerationTokenUsage,
  result: ChatResponse
) {
  usage.successfulCalls += 1
  usage.promptTokens += result.usage?.promptTokens || 0
  usage.completionTokens += result.usage?.completionTokens || 0
  usage.totalTokens += result.usage?.totalTokens || (
    (result.usage?.promptTokens || 0) +
    (result.usage?.completionTokens || 0)
  )
  return usage
}

async function executeProviderRequest(options: {
  provider: ModelProvider
  request: ChatRequest
  useStreaming: boolean
  usage: GenerationTokenUsage
  onBeforeRequest?: RunGenerationProviderOptions['onBeforeRequest']
  onDelta?: RunGenerationProviderOptions['onDelta']
  onVisionStage?: RunGenerationProviderOptions['onVisionStage']
}) {
  const hasVisionPayload = options.request.messages.some(turn =>
    typeof turn.content !== 'string' && turn.content.some(part => part.type === 'image_url')
  )
  await options.onBeforeRequest?.(options.provider, options.request)
  if (hasVisionPayload) options.onVisionStage?.('analyzing')

  if (!options.useStreaming) {
    const result = await options.provider.chat(options.request)
    accumulateGenerationTokenUsage(options.usage, result)
    if (hasVisionPayload) options.onVisionStage?.('replying')
    return result
  }

  const result = await options.provider.chatStream(options.request, {
    onDelta: chunk => {
      if (hasVisionPayload) options.onVisionStage?.('replying')
      return options.onDelta?.(chunk)
    }
  })
  accumulateGenerationTokenUsage(options.usage, result)
  return result
}

/**
 * Provider/streaming orchestration for one immutable Generation Context.
 *
 * It is intentionally strict: real provider failures bubble to the caller;
 * the runtime never invents a local character reply as a fallback. The only
 * automatic retry is the existing vision-capability downgrade, and it reuses
 * the same frozen context with image payloads removed.
 */
export async function runGenerationProvider(
  options: RunGenerationProviderOptions
): Promise<GenerationProviderResult> {
  const { context, provider } = options
  const usage = options.usage ?? createGenerationTokenUsage()
  let modelSettings = context.modelSettings
  let visionUsed = context.mayUseVision
  let visionFallback = Boolean(context.visualMessage) && !context.mayUseVision
  let providerNotice = ''

  const run = (request: ChatRequest) => executeProviderRequest({
    provider,
    request: cloneChatRequest(request),
    useStreaming: options.useStreaming,
    usage,
    onBeforeRequest: options.onBeforeRequest,
    onDelta: options.onDelta,
    onVisionStage: options.onVisionStage
  })

  let response: ChatResponse
  try {
    try {
      response = await run(
        context.mayUseVision
          ? context.requests.withVision
          : context.requests.withoutVision
      )
      if (
        context.mayUseVision &&
        modelSettings.visionMode === 'auto'
      ) {
        modelSettings = await saveVisionCapability(modelSettings, true)
      }
    } catch (providerError) {
      if (isAbortError(providerError)) throw providerError
      const canRetryWithoutVision =
        context.mayUseVision &&
        modelSettings.visionMode === 'auto' &&
        isVisionUnsupportedError(providerError) &&
        (options.canRetryWithoutVision?.() ?? true)

      if (!canRetryWithoutVision) throw providerError

      visionUsed = false
      visionFallback = true
      response = await run(context.requests.withoutVision)
      modelSettings = await saveVisionCapability(modelSettings, false)
      options.onVisionStage?.('text-only')
      providerNotice = '当前模型不支持图片理解，本次只把文字部分交给同一 AI 继续处理；没有使用本地角色回复。'
    }
  } catch (providerError) {
    if (isAbortError(providerError)) throw providerError
    throw providerError
  }

  return {
    response,
    providerId: provider.id,
    model: modelSettings.model,
    modelSettings,
    providerNotice,
    visionUsed,
    visionFallback,
    tokenUsage: usage
  }
}
