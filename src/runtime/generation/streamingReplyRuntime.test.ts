import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Conversation, Message } from '../../types/domain'
import {
  createStreamingReplyRuntime,
  createStreamingReplySession
} from './streamingReplyRuntime'

const conversation = {
  id: 'conversation-1',
  worldId: 'world-1',
  memberIds: ['character-1'],
  title: 'Test'
} as Conversation

function placeholder(content: string): Message {
  return {
    id: 'stream-message-1',
    worldId: conversation.worldId,
    conversationId: conversation.id,
    senderId: 'character-1',
    type: 'text',
    content,
    status: 'pending',
    createdAt: '2026-09-20T00:00:00.000Z'
  } as Message
}

function createHarness(options?: { suppressPreview?: boolean; preserveRawOutput?: boolean }) {
  const persistPlaceholder = vi.fn(async ({ content }: { content: string }) => placeholder(content))
  const patchMessage = vi.fn(async () => undefined)
  const removeMessage = vi.fn(async () => undefined)
  const onMessageCreated = vi.fn()
  const onMessagePatched = vi.fn()
  const onMessageRemoved = vi.fn()
  const onStreamingMessageChanged = vi.fn()
  const onScrollRequested = vi.fn()

  const runtime = createStreamingReplyRuntime({
    onMessageCreated,
    onMessagePatched,
    onMessageRemoved,
    onStreamingMessageChanged,
    onScrollRequested
  }, {
    persistPlaceholder,
    patchMessage,
    removeMessage,
    persistDelayMs: 140
  })

  const session = createStreamingReplySession({
    generationId: 'generation-1',
    conversation
  })
  session.provider = 'test-provider'
  session.model = 'test-model'
  session.suppressPreview = options?.suppressPreview
  session.preserveRawOutput = options?.preserveRawOutput

  return {
    runtime,
    session,
    persistPlaceholder,
    patchMessage,
    removeMessage,
    onMessageCreated,
    onMessagePatched,
    onMessageRemoved,
    onStreamingMessageChanged,
    onScrollRequested
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('streamingReplyRuntime', () => {
  it('creates one placeholder on the first visible provider chunk and reuses it', async () => {
    vi.useFakeTimers()
    const harness = createHarness({ preserveRawOutput: true })

    await harness.runtime.appendChunk(harness.session, { delta: '你', text: '你' })
    await harness.runtime.appendChunk(harness.session, { delta: '好', text: '你好' })

    expect(harness.persistPlaceholder).toHaveBeenCalledTimes(1)
    expect(harness.session.messageId).toBe('stream-message-1')
    expect(harness.onMessageCreated).toHaveBeenCalledTimes(1)
    expect(harness.onMessagePatched).toHaveBeenLastCalledWith('stream-message-1', expect.objectContaining({
      content: '你好',
      status: 'pending'
    }))
  })

  it('does not persist a suppressed streaming preview while still retaining raw provider output', async () => {
    const harness = createHarness({ suppressPreview: true, preserveRawOutput: true })

    await harness.runtime.appendChunk(harness.session, { delta: '<ui>partial</ui>', text: '<ui>partial</ui>' })

    expect(harness.session.rawText).toBe('<ui>partial</ui>')
    expect(harness.session.text).toBe('<ui>partial</ui>')
    expect(harness.persistPlaceholder).not.toHaveBeenCalled()
    expect(harness.patchMessage).not.toHaveBeenCalled()
  })

  it('debounces persistence and stores the latest streamed text', async () => {
    vi.useFakeTimers()
    const harness = createHarness({ preserveRawOutput: true })

    await harness.runtime.appendChunk(harness.session, { delta: 'a', text: 'a' })
    await harness.runtime.appendChunk(harness.session, { delta: 'b', text: 'ab' })
    await vi.advanceTimersByTimeAsync(139)
    expect(harness.patchMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(harness.patchMessage).toHaveBeenCalledTimes(1)
    expect(harness.patchMessage).toHaveBeenCalledWith('stream-message-1', expect.objectContaining({ content: 'ab' }))
  })

  it('flushes the latest chunk immediately and cancels the pending debounce', async () => {
    vi.useFakeTimers()
    const harness = createHarness({ preserveRawOutput: true })

    await harness.runtime.appendChunk(harness.session, { delta: 'latest', text: 'latest' })
    await harness.runtime.flush(harness.session)
    await vi.runAllTimersAsync()

    expect(harness.patchMessage).toHaveBeenCalledTimes(1)
    expect(harness.patchMessage).toHaveBeenCalledWith('stream-message-1', expect.objectContaining({ content: 'latest' }))
  })

  it('discards a placeholder without inventing replacement content', async () => {
    const harness = createHarness({ preserveRawOutput: true })
    await harness.runtime.appendChunk(harness.session, { delta: 'partial', text: 'partial' })

    await harness.runtime.discard(harness.session)

    expect(harness.removeMessage).toHaveBeenCalledWith('stream-message-1')
    expect(harness.onMessageRemoved).toHaveBeenCalledWith('stream-message-1')
    expect(harness.session.messageId).toBeUndefined()
    expect(harness.session.text).toBe('')
    expect(harness.session.rawText).toBe('')
    expect(harness.onStreamingMessageChanged).toHaveBeenLastCalledWith('')
  })

  it('preserves already-visible real provider output when the user stops generation', async () => {
    const harness = createHarness({ preserveRawOutput: true })
    await harness.runtime.appendChunk(harness.session, { delta: '真实部分', text: '真实部分' })

    const preserved = await harness.runtime.preserveInterrupted(harness.session, 'cancelled')

    expect(preserved).toBe(true)
    expect(harness.removeMessage).not.toHaveBeenCalled()
    expect(harness.patchMessage).toHaveBeenLastCalledWith('stream-message-1', expect.objectContaining({
      content: '真实部分',
      status: 'cancelled'
    }))
    expect(harness.session.messageId).toBeUndefined()
  })

  it('removes an empty placeholder instead of preserving an empty interrupted reply', async () => {
    const harness = createHarness()
    harness.session.messageId = 'stream-message-1'
    harness.session.text = '   '

    const preserved = await harness.runtime.preserveInterrupted(harness.session, 'failed', 'network error')

    expect(preserved).toBe(false)
    expect(harness.removeMessage).toHaveBeenCalledWith('stream-message-1')
    expect(harness.patchMessage).not.toHaveBeenCalled()
    expect(harness.session.messageId).toBeUndefined()
  })
})
