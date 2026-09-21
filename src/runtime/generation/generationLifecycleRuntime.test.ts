import { describe, expect, it, vi } from 'vitest'
import { createGenerationLifecycleRuntime, isGenerationAbortError, shouldRefreshLocalSummary } from './generationLifecycleRuntime'

const conversation = { id: 'conv-1' } as any
const settings = { memoryEnabled: true } as any
const messages = Array.from({ length: 30 }, (_, index) => ({
  id: `m-${index}`,
  conversationId: 'conv-1',
  senderId: index % 2 ? 'char-1' : 'user',
  type: 'text',
  content: `消息 ${index}`,
  status: 'delivered',
  createdAt: `2026-09-21T00:00:${String(index).padStart(2, '0')}.000Z`
})) as any

function messageHooks() {
  return { updateUserMessageState: vi.fn().mockResolvedValue(undefined) }
}

describe('generationLifecycleRuntime', () => {
  it('识别 DOMException 和普通 Error 的 AbortError', () => {
    expect(isGenerationAbortError(new DOMException('stop', 'AbortError'))).toBe(true)
    const error = new Error('stop'); error.name = 'AbortError'
    expect(isGenerationAbortError(error)).toBe(true)
    expect(isGenerationAbortError(new Error('network'))).toBe(false)
  })

  it('summary 只在 memory 开启且新增消息达到阈值时刷新', () => {
    expect(shouldRefreshLocalSummary({ settings, state: { summaryMessageCount: 18 } as any, messages })).toBe(true)
    expect(shouldRefreshLocalSummary({ settings, state: { summaryMessageCount: 25 } as any, messages })).toBe(false)
    expect(shouldRefreshLocalSummary({ settings: { memoryEnabled: false } as any, state: {} as any, messages })).toBe(false)
  })

  it('成功完成统一清除技术错误并写 provider notice', async () => {
    const patchConversationState = vi.fn()
      .mockResolvedValueOnce({ summaryMessageCount: 29 })
    const runtime = createGenerationLifecycleRuntime({ patchConversationState, createLocalSummary: vi.fn() })
    const hooks = messageHooks()
    const state = await runtime.complete({
      conversation,
      settings,
      currentState: {} as any,
      messages,
      sourceMessageId: 'm-user',
      providerNotice: 'fallback model',
      visualMessagePresent: true,
      visionUsed: true,
      visionFallback: false
    }, hooks)
    expect(hooks.updateUserMessageState).toHaveBeenCalledWith('m-user', 'read', { visionUsed: true, visionFallback: false })
    expect(patchConversationState).toHaveBeenCalledWith('conv-1', expect.objectContaining({ lastTechnicalError: '', lastProviderNotice: 'fallback model' }))
    expect(state).toMatchObject({ summaryMessageCount: 29 })
  })

  it('主动消息完成时记录 lastProactiveAt', async () => {
    const patchConversationState = vi.fn().mockResolvedValue({ summaryMessageCount: 30 })
    const runtime = createGenerationLifecycleRuntime({ patchConversationState, createLocalSummary: vi.fn() })
    await runtime.complete({
      conversation,
      settings,
      messages,
      proactiveSource: 'care',
      providerNotice: '',
      visualMessagePresent: false,
      visionUsed: false,
      visionFallback: false
    }, messageHooks())
    expect(patchConversationState.mock.calls[0]?.[1].lastProactiveAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('达到 summary 阈值时统一更新 summaryMessageCount', async () => {
    const patchConversationState = vi.fn()
      .mockResolvedValueOnce({ summaryMessageCount: 10 })
      .mockResolvedValueOnce({ summary: '摘要', summaryMessageCount: 30 })
    const createLocalSummary = vi.fn().mockReturnValue('摘要')
    const runtime = createGenerationLifecycleRuntime({ patchConversationState, createLocalSummary })
    await runtime.complete({
      conversation,
      settings,
      messages,
      providerNotice: '',
      visualMessagePresent: false,
      visionUsed: false,
      visionFallback: false
    }, messageHooks())
    expect(createLocalSummary).toHaveBeenCalledWith(messages)
    expect(patchConversationState).toHaveBeenLastCalledWith('conv-1', { summary: '摘要', summaryMessageCount: 30 })
  })

  it('用户手动停止时保留已出现的真实流式内容', async () => {
    const runtime = createGenerationLifecycleRuntime({ patchConversationState: vi.fn(), createLocalSummary: vi.fn() })
    const hooks = {
      ...messageHooks(),
      preserveInterrupted: vi.fn().mockResolvedValue(true),
      discardStream: vi.fn()
    }
    const result = await runtime.fail({
      error: new DOMException('stop', 'AbortError'),
      manualStopRequested: true,
      conversation,
      sourceMessageId: 'user-1',
      visualMessagePresent: false,
      visionUsed: false,
      visionFallback: false
    }, hooks)
    expect(hooks.preserveInterrupted).toHaveBeenCalledOnce()
    expect(hooks.discardStream).not.toHaveBeenCalled()
    expect(hooks.updateUserMessageState).toHaveBeenCalledWith('user-1', 'read', { visionUsed: undefined, visionFallback: undefined })
    expect(result.noticeMessage).toContain('真实 AI 内容已保留')
  })

  it('非手动 abort 丢弃 placeholder 并标记 cancelled', async () => {
    const runtime = createGenerationLifecycleRuntime({ patchConversationState: vi.fn(), createLocalSummary: vi.fn() })
    const hooks = {
      ...messageHooks(),
      preserveInterrupted: vi.fn(),
      discardStream: vi.fn().mockResolvedValue(undefined)
    }
    const result = await runtime.fail({
      error: new DOMException('route changed', 'AbortError'),
      manualStopRequested: false,
      conversation,
      sourceMessageId: 'user-1',
      visualMessagePresent: false,
      visionUsed: false,
      visionFallback: false
    }, hooks)
    expect(hooks.discardStream).toHaveBeenCalledOnce()
    expect(hooks.updateUserMessageState).toHaveBeenCalledWith('user-1', 'cancelled', { visionUsed: undefined, visionFallback: undefined })
    expect(result.aborted).toBe(true)
  })

  it('普通 Provider 错误统一落 technical state，不生成本地替代回复', async () => {
    const patchConversationState = vi.fn().mockResolvedValue({ lastTechnicalError: 'network' })
    const runtime = createGenerationLifecycleRuntime({ patchConversationState, createLocalSummary: vi.fn() })
    const hooks = {
      ...messageHooks(),
      preserveInterrupted: vi.fn(),
      discardStream: vi.fn().mockResolvedValue(undefined)
    }
    const result = await runtime.fail({
      error: new Error('network'),
      manualStopRequested: false,
      conversation,
      sourceMessageId: 'user-1',
      visualMessagePresent: true,
      visionUsed: false,
      visionFallback: true
    }, hooks)
    expect(hooks.updateUserMessageState).toHaveBeenCalledWith('user-1', 'failed', expect.objectContaining({ errorText: 'network', visionFallback: true }))
    expect(patchConversationState).toHaveBeenCalledWith('conv-1', { lastTechnicalError: 'network', lastProviderNotice: '' })
    expect(result.errorMessage).toBe('AI 请求失败：network')
    expect(result.noticeMessage).toContain('不会使用本地内容续写')
  })
})
