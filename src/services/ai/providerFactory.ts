import {
  MockProvider,
  OpenAICompatibleProvider
} from './provider'

import type {
  ModelProvider
} from './provider'

import type {
  ModelSettings
} from '../../types/modelSettings'

export function createProvider(
  settings: ModelSettings
): ModelProvider {
  if (settings.provider === 'mock') {
    return new MockProvider()
  }

  const name =
    settings.provider === 'deepseek'
      ? 'DeepSeek'
      : 'OpenAI 兼容接口'

  return new OpenAICompatibleProvider({
    id: settings.provider,
    name,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    maxTokens: settings.maxTokens
  })
}
