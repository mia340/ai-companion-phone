import { describe, expect, it, vi } from 'vitest'
import type { AssistantReplyFinalizationResult } from './assistantReplyFinalizationRuntime'
import { canReuseStreamingPlaceholder, createAssistantReplyPersistenceRuntime } from './assistantReplyPersistenceRuntime'
import type { StreamingReplySession } from './streamingReplyRuntime'

const conversation = { id: 'conv-1', memberIds: ['char-1'] } as any
const character = { id: 'char-1', name: '阿澈' } as any
const settings = { naturalDelay: false } as any

function finalization(mode: AssistantReplyFinalizationResult['persistenceMode'], actionKind: any = 'text'): AssistantReplyFinalizationResult {
  return {
    parsedOutput: { messages: [{ kind: actionKind, content: '你好' }], visibleText: '你好', warnings: [] } as any,
    projectedActions: [{ kind: actionKind, content: '你好' }] as any,
    projectedVisibleText: '你好',
    finalVisibleOutput: '你好',
    regexApplied: { storage: [], display: [] },
    hasDisplayOnlyProjection: false,
    persistenceMode: mode
  }
}

function session(messageId = 'stream-1'): StreamingReplySession {
  return {
    generationId: 'gen-1',
    conversation,
    text: '',
    rawText: 'raw',
    canonicalText: 'canonical',
    provider: 'openai',
    model: 'gpt-test',
    messageId,
    type: 'text'
  }
}

function hooks() {
  return {
    onMessagesChanged: vi.fn(),
    onScrollRequested: vi.fn().mockResolvedValue(undefined),
    onStreamingMessageChanged: vi.fn(),
    onClearStreamTimers: vi.fn(),
    onNotice: vi.fn()
  }
}

function baseOptions(mode: AssistantReplyFinalizationResult['persistenceMode']) {
  return {
    conversation,
    character,
    settings,
    finalization: finalization(mode),
    provider: 'openai',
    model: 'gpt-test',
    generationId: 'gen-1',
    streamSession: session(),
    richReplyHtml: '<div>hi</div>',
    canonicalText: 'canonical',
    modelOutput: 'raw',
    communityUiActive: false,
    communityUiText: '',
    regexDisplayText: 'display'
  } as any
}

describe('assistantReplyPersistenceRuntime', () => {
  it('单条文本流式回复可以复用 placeholder', () => {
    expect(canReuseStreamingPlaceholder(session(), finalization('streaming'))).toBe(true)
    expect(canReuseStreamingPlaceholder({ ...session(), type: 'voice' }, finalization('streaming'))).toBe(false)
  })

  it('alternative 只更新候选并刷新消息列表', async () => {
    const target = { id: 'target-1', content: '旧回复' } as any
    const persistAlternativeReply = vi.fn().mockResolvedValue({ patch: {}, activeAlternativeIndex: 2 })
    const runtime = createAssistantReplyPersistenceRuntime({
      listMessages: vi.fn().mockResolvedValue([target]),
      persistAlternativeReply
    })
    const h = hooks()
    await runtime.persist({ ...baseOptions('alternative'), alternativeTargetId: 'target-1' }, h)
    expect(persistAlternativeReply).toHaveBeenCalledOnce()
    expect(h.onNotice).toHaveBeenCalledWith('已生成第 3 个候选回复。')
  })

  it('rich 模式先移除 streaming placeholder，再保存 Rich 消息', async () => {
    const removeGeneratedMessage = vi.fn().mockResolvedValue(undefined)
    const persistRichAssistantMessage = vi.fn().mockResolvedValue({})
    const runtime = createAssistantReplyPersistenceRuntime({
      listMessages: vi.fn().mockResolvedValue([]),
      removeGeneratedMessage,
      persistRichAssistantMessage
    })
    const h = hooks()
    const options = baseOptions('rich')
    await runtime.persist(options, h)
    expect(removeGeneratedMessage).toHaveBeenCalledWith('stream-1')
    expect(persistRichAssistantMessage).toHaveBeenCalledOnce()
    expect(options.streamSession.messageId).toBeUndefined()
    expect(h.onClearStreamTimers).toHaveBeenCalledOnce()
  })

  it('canonical-display 保留 canonical 存储并单独投影 displayContent', async () => {
    const persistActions = vi.fn().mockResolvedValue([])
    const runtime = createAssistantReplyPersistenceRuntime({ persistActions })
    await runtime.persist({ ...baseOptions('canonical-display'), regexDisplayText: '展示文本' }, hooks())
    expect(persistActions.mock.calls[0]?.[0]).toMatchObject({
      actions: [{ kind: 'text', content: 'canonical' }],
      rawContent: 'canonical',
      displayContent: '你好'
    })
  })

  it('streaming 单条文本直接 patch 已有 placeholder', async () => {
    const patchGeneratedMessage = vi.fn().mockResolvedValue(undefined)
    const persistActions = vi.fn().mockResolvedValue([])
    const runtime = createAssistantReplyPersistenceRuntime({
      listMessages: vi.fn().mockResolvedValue([]),
      patchGeneratedMessage,
      persistActions
    })
    const h = hooks()
    await runtime.persist(baseOptions('streaming'), h)
    expect(patchGeneratedMessage).toHaveBeenCalledWith('stream-1', expect.objectContaining({ status: 'delivered', content: '你好' }))
    expect(persistActions).not.toHaveBeenCalled()
    expect(h.onStreamingMessageChanged).toHaveBeenCalledWith('')
  })

  it('streaming 多动作不能复用 placeholder，会回到 action persistence', async () => {
    const persistActions = vi.fn().mockResolvedValue([])
    const runtime = createAssistantReplyPersistenceRuntime({ persistActions, listMessages: vi.fn().mockResolvedValue([]) })
    const options = baseOptions('streaming')
    options.finalization.projectedActions = [{ kind: 'text', content: '一' }, { kind: 'text', content: '二' }] as any
    await runtime.persist(options, hooks())
    expect(persistActions).toHaveBeenCalledOnce()
    expect(persistActions.mock.calls[0]?.[0].replaceMessageId).toBe('stream-1')
  })

  it('actions 模式在 naturalDelay 开启时保留首段等待策略', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)
    const persistActions = vi.fn().mockResolvedValue([])
    const runtime = createAssistantReplyPersistenceRuntime({ wait, persistActions })
    const options = baseOptions('actions')
    options.settings = { naturalDelay: true }
    await runtime.persist(options, hooks())
    expect(wait).toHaveBeenCalledWith(258, undefined)
    expect(persistActions).toHaveBeenCalledOnce()
  })

  it('alternative 缺失目标时拒绝静默落库', async () => {
    const runtime = createAssistantReplyPersistenceRuntime({ listMessages: vi.fn().mockResolvedValue([]) })
    await expect(runtime.persist({ ...baseOptions('alternative'), alternativeTargetId: 'missing' }, hooks()))
      .rejects.toThrow('没有找到需要添加候选回复的消息。')
  })
})
