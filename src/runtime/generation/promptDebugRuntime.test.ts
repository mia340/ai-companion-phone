import { describe, expect, it, vi } from 'vitest'
import type { ChatRequest } from '../../services/ai/provider'
import type { GenerationContext } from './generationContextBuilder'
import { buildPromptDebugBeginPayload, createPromptDebugRuntime } from './promptDebugRuntime'

function contextFixture(): GenerationContext {
  return {
    generationId: 'gen-1',
    contextCreatedAt: '2026-09-21T00:00:00.000Z',
    conversation: { id: 'conv-1', memberIds: ['char-1'] },
    character: { id: 'char-1', name: '阿澈' },
    settings: { roleplayMode: 'balanced' },
    conversationState: { updatedAt: '2026-09-21T00:00:00.000Z' },
    messages: [
      { id: 'm1', conversationId: 'conv-1', senderId: 'user', content: '你好', type: 'text', status: 'delivered', createdAt: '2026-09-21T00:00:00.000Z' }
    ],
    persona: { id: 'persona-1', name: '小米' },
    cardRuntime: {
      family: 'v3',
      sourceLabel: 'V3',
      macroCharacterName: '阿澈',
      systemPromptMode: 'default',
      postHistoryMode: 'default',
      greetings: ['嗨'],
      notes: ['测试'],
      creatorNotesDisplay: undefined,
      promptFields: { description: true, personality: false, scenario: false, examples: false, systemPrompt: false, postHistoryInstructions: false, creatorNotes: false },
      rawExtensionGroups: []
    },
    lorebook: {
      activated: [{ id: 'l1', title: '咖啡店', activationReason: '关键词' }],
      routingDecisions: [{ id: 'l1', title: '咖啡店', status: 'activated', reason: '关键词', characters: 20 }],
      estimatedSavedCharacters: 10,
      engineDebug: {
        evaluatedEntries: 1,
        initialActivated: 1,
        recursiveActivated: 0,
        recursionSteps: 0,
        estimatedUsedTokens: 20,
        droppedByBudget: 0,
        stickyActive: [],
        cooldownBlocked: [],
        delayBlocked: [],
        groupDropped: [],
        depthInjections: [],
        decisions: []
      }
    },
    memoryHitDetails: [{ memory: { id: 'mem-1', characterId: 'char-1', content: '喜欢拿铁', importance: 3, createdAt: '', updatedAt: '' }, score: 0.9, reasons: ['关键词'] }],
    runtimeProfile: { useNativeInteractionProtocol: true },
    regexExecutionTraces: [],
    activeAssistantRegex: [],
    activeUserRegex: [],
    activeWorldRegex: [],
    latestUserText: '你好'
  } as unknown as GenerationContext
}

const request: ChatRequest = {
  model: 'gpt-test',
  messages: [
    { role: 'system', content: '【角色卡】阿澈\n【自然交流规则】不要像客服' },
    { role: 'user', content: '你好' }
  ]
}

describe('promptDebugRuntime', () => {
  it('从冻结 GenerationContext 构造 trace，而不是由 View 手拼', () => {
    const payload = buildPromptDebugBeginPayload({
      enabled: true,
      context: contextFixture(),
      request,
      providerId: 'openai',
      sourceMessageId: 'm1'
    })
    expect(payload.generationId).toBe('gen-1')
    expect(payload.activatedLorebook[0]?.title).toBe('咖啡店')
    expect(payload.memoryHits[0]?.content).toBe('喜欢拿铁')
    expect(payload.ruleInfluences).toContain('启用了去客服腔和减少二选一追问规则。')
  })

  it('关闭 Prompt Debug 时完全旁路', async () => {
    const saveTrace = vi.fn()
    const runtime = createPromptDebugRuntime({ saveTrace })
    const id = await runtime.begin({ enabled: false, context: contextFixture(), request, providerId: 'openai' })
    expect(id).toBeUndefined()
    expect(saveTrace).not.toHaveBeenCalled()
  })

  it('trace 写入失败不会阻断正常生成', async () => {
    const warn = vi.fn()
    const runtime = createPromptDebugRuntime({
      saveTrace: vi.fn().mockRejectedValue(new Error('db down')),
      warn
    })
    await expect(runtime.begin({ enabled: true, context: contextFixture(), request, providerId: 'openai' })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })

  it('完成阶段只更新同一 trace id', async () => {
    const patchTrace = vi.fn().mockResolvedValue(undefined)
    const runtime = createPromptDebugRuntime({ patchTrace })
    await runtime.complete({
      traceId: 'trace-1',
      context: contextFixture(),
      providerId: 'openai',
      model: 'gpt-test',
      response: { text: '你好呀' },
      tokenUsage: { promptTokens: 10, completionTokens: 3, totalTokens: 13, successfulCalls: 1 },
      finalVisibleOutput: '你好呀',
      parsedOutput: {
        messages: [{ kind: 'text', content: '你好呀' }],
        visibleText: '你好呀',
        warnings: [],
        actionSummary: 'text'
      } as any
    })
    expect(patchTrace).toHaveBeenCalledOnce()
    expect(patchTrace.mock.calls[0]?.[0]).toBe('trace-1')
    expect(patchTrace.mock.calls[0]?.[1]).toMatchObject({ provider: 'openai', model: 'gpt-test', rawOutput: '你好呀' })
  })

  it('完成阶段写库失败也只降级调试能力', async () => {
    const warn = vi.fn()
    const runtime = createPromptDebugRuntime({ patchTrace: vi.fn().mockRejectedValue(new Error('db down')), warn })
    await expect(runtime.complete({
      traceId: 'trace-1',
      context: contextFixture(),
      providerId: 'openai',
      model: 'gpt-test',
      response: { text: 'ok' },
      tokenUsage: {},
      finalVisibleOutput: 'ok',
      parsedOutput: { messages: [{ kind: 'text', content: 'ok' }], visibleText: 'ok', warnings: [] } as any
    })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
  })
})
