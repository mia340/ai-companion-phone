import { describe, expect, it, vi } from 'vitest'

import type { ModelProvider } from '../../services/ai/provider'
import type { ModelSettings } from '../../types/modelSettings'
import type { GenerationContext } from './generationContextBuilder'
import {
  createGenerationTokenUsage,
  runGenerationProvider
} from './generationOrchestrator'

const modelSettings: ModelSettings = {
  id: 'default',
  provider: 'deepseek',
  baseUrl: 'https://example.invalid/v1',
  apiKey: 'secret',
  model: 'test-model',
  temperature: 0.8,
  maxTokens: 1024,
  visionMode: 'disabled',
  updatedAt: '2026-09-11T12:00:00.000Z'
}

function provider(): ModelProvider {
  return {
    id: 'mock',
    name: 'Mock Provider',
    chat: vi.fn(async () => ({
      text: '真实 provider 回复',
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18 }
    })),
    chatStream: vi.fn(async (_request, handlers) => {
      await handlers?.onDelta?.({ delta: '流', text: '流' })
      await handlers?.onDelta?.({ delta: '式', text: '流式' })
      return {
        text: '流式',
        usage: { promptTokens: 13, completionTokens: 2, totalTokens: 15 }
      }
    }),
    listModels: vi.fn(async () => []),
    testConnection: vi.fn(async () => true),
    testVision: vi.fn(async () => false)
  }
}

function context(): GenerationContext {
  const request = {
    model: 'test-model',
    temperature: 0.8,
    messages: [
      { role: 'system' as const, content: 'system' },
      { role: 'user' as const, content: 'hello' }
    ]
  }
  return {
    modelSettings,
    mayUseVision: false,
    visualMessage: undefined,
    requests: { withVision: request, withoutVision: request }
  } as GenerationContext
}

describe('Generation Provider Orchestrator', () => {
  it('dispatches one frozen non-streaming request and accumulates provider token usage', async () => {
    const mock = provider()
    const usage = createGenerationTokenUsage()
    const before = vi.fn()
    const stage = vi.fn()

    const result = await runGenerationProvider({
      context: context(),
      provider: mock,
      useStreaming: false,
      usage,
      onBeforeRequest: before,
      onVisionStage: stage
    })

    expect(mock.chat).toHaveBeenCalledTimes(1)
    expect(mock.chatStream).not.toHaveBeenCalled()
    expect(before).toHaveBeenCalledTimes(1)
    expect(stage).not.toHaveBeenCalled()
    expect(result.response.text).toBe('真实 provider 回复')
    expect(result.tokenUsage).toEqual({
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
      successfulCalls: 1
    })
  })

  it('forwards streaming deltas while keeping token accounting in the runtime boundary', async () => {
    const mock = provider()
    const deltas: string[] = []
    const result = await runGenerationProvider({
      context: context(),
      provider: mock,
      useStreaming: true,
      onDelta: chunk => {
        deltas.push(chunk.delta)
      }
    })

    expect(mock.chat).not.toHaveBeenCalled()
    expect(mock.chatStream).toHaveBeenCalledTimes(1)
    expect(deltas).toEqual(['流', '式'])
    expect(result.tokenUsage.totalTokens).toBe(15)
    expect(result.tokenUsage.successfulCalls).toBe(1)
  })
})
