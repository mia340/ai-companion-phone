import type { ChatStreamChunk } from '../../services/ai/provider'
import { visibleStreamingText } from '../../services/interactionProtocol'
import type {
  Conversation,
  Message,
  ProactiveSource
} from '../../types/domain'
import {
  patchGeneratedMessage,
  persistStreamingPlaceholder,
  removeGeneratedMessage
} from './responsePersistenceService'

export interface StreamingReplySession {
  messageId?: string
  generationId: string
  rawText: string
  canonicalText?: string
  text: string
  provider: string
  model: string
  type: Message['type']
  conversation: Conversation
  suppressPreview?: boolean
  preserveRawOutput?: boolean
  proactiveSource?: ProactiveSource
}

export interface CreateStreamingReplySessionOptions {
  generationId: string
  conversation: Conversation
  type?: Message['type']
  proactiveSource?: ProactiveSource
}

export function createStreamingReplySession(
  options: CreateStreamingReplySessionOptions
): StreamingReplySession {
  return {
    generationId: options.generationId,
    rawText: '',
    text: '',
    provider: '',
    model: '',
    type: options.type ?? 'text',
    conversation: options.conversation,
    suppressPreview: false,
    proactiveSource: options.proactiveSource
  }
}

export interface StreamingReplyRuntimeHooks {
  onMessageCreated?: (message: Message) => void | Promise<void>
  onMessagePatched?: (messageId: string, patch: Partial<Message>) => void | Promise<void>
  onMessageRemoved?: (messageId: string) => void | Promise<void>
  onStreamingMessageChanged?: (messageId: string) => void
  onScrollRequested?: () => void
}

export interface StreamingReplyRuntimeDependencies {
  persistPlaceholder?: (options: Parameters<typeof persistStreamingPlaceholder>[0]) => Promise<Message>
  patchMessage?: (messageId: string, patch: Partial<Message>) => Promise<unknown>
  removeMessage?: (messageId: string) => Promise<unknown>
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
  persistDelayMs?: number
}

/**
 * Owns the mutable lifecycle of one streamed assistant placeholder.
 *
 * The Runtime persists only real provider output. Vue/UI concerns are exposed
 * through hooks, so ChatRoom does not need to own persistence timers or the
 * placeholder create/patch/remove state machine.
 */
export function createStreamingReplyRuntime(
  hooks: StreamingReplyRuntimeHooks = {},
  dependencies: StreamingReplyRuntimeDependencies = {}
) {
  const persistPlaceholder = dependencies.persistPlaceholder ?? persistStreamingPlaceholder
  const patchMessage = dependencies.patchMessage ?? patchGeneratedMessage
  const removeMessage = dependencies.removeMessage ?? removeGeneratedMessage
  const setTimer = dependencies.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs))
  const clearTimer = dependencies.clearTimer ?? (timer => clearTimeout(timer))
  const persistDelayMs = dependencies.persistDelayMs ?? 140

  let persistTimer: ReturnType<typeof setTimeout> | undefined

  function clearPersistenceTimer() {
    if (persistTimer === undefined) return
    clearTimer(persistTimer)
    persistTimer = undefined
  }

  async function ensurePlaceholder(session: StreamingReplySession) {
    if (session.messageId) return session.messageId

    const message = await persistPlaceholder({
      conversation: session.conversation,
      senderId: session.conversation.memberIds[0],
      type: session.type,
      content: session.text,
      provider: session.provider,
      model: session.model,
      generationId: session.generationId,
      proactiveSource: session.proactiveSource
    })

    session.messageId = message.id
    hooks.onStreamingMessageChanged?.(message.id)
    await hooks.onMessageCreated?.(message)
    hooks.onScrollRequested?.()
    return message.id
  }

  function schedulePersistence(session: StreamingReplySession) {
    if (!session.messageId) return
    clearPersistenceTimer()

    persistTimer = setTimer(() => {
      persistTimer = undefined
      if (!session.messageId) return
      void patchMessage(session.messageId, {
        content: session.text,
        provider: session.provider,
        model: session.model
      })
    }, persistDelayMs)
  }

  async function appendChunk(
    session: StreamingReplySession,
    chunk: ChatStreamChunk
  ) {
    session.rawText = chunk.text
    session.text = session.preserveRawOutput
      ? chunk.text
      : visibleStreamingText(chunk.text)

    if (!session.text || session.suppressPreview) return

    await ensurePlaceholder(session)
    if (!session.messageId) return

    const patch: Partial<Message> = {
      content: session.text,
      provider: session.provider,
      model: session.model,
      status: 'pending'
    }
    await hooks.onMessagePatched?.(session.messageId, patch)
    schedulePersistence(session)
    hooks.onScrollRequested?.()
  }

  async function flush(session: StreamingReplySession) {
    clearPersistenceTimer()
    if (!session.messageId) return

    await patchMessage(session.messageId, {
      content: session.text,
      provider: session.provider,
      model: session.model
    })
  }

  async function discard(session: StreamingReplySession) {
    clearPersistenceTimer()

    if (session.messageId) {
      const messageId = session.messageId
      await removeMessage(messageId)
      await hooks.onMessageRemoved?.(messageId)
    }

    hooks.onStreamingMessageChanged?.('')
    session.messageId = undefined
    session.text = ''
    session.rawText = ''
  }

  async function preserveInterrupted(
    session: StreamingReplySession,
    status: 'cancelled' | 'failed',
    errorText?: string
  ) {
    if (!session.messageId || !session.text.trim()) {
      if (session.messageId) {
        const messageId = session.messageId
        await removeMessage(messageId)
        await hooks.onMessageRemoved?.(messageId)
      }

      clearPersistenceTimer()
      hooks.onStreamingMessageChanged?.('')
      session.messageId = undefined
      return false
    }

    await flush(session)
    if (!session.messageId) return false

    const messageId = session.messageId
    const patch: Partial<Message> = {
      content: session.text.trim(),
      status,
      errorText,
      provider: session.provider,
      model: session.model
    }
    await patchMessage(messageId, patch)
    await hooks.onMessagePatched?.(messageId, patch)

    hooks.onStreamingMessageChanged?.('')
    session.messageId = undefined
    clearPersistenceTimer()
    return true
  }

  return {
    appendChunk,
    clearPersistenceTimer,
    discard,
    flush,
    preserveInterrupted
  }
}
