import { OpenAICompatibleProvider } from './provider'

import type { ModelProvider } from './provider'
import type { ModelSettings } from '../../types/modelSettings'

export function createProvider(
  settings: ModelSettings
): ModelProvider {
  // 只为极老 IndexedDB 数据保留运行时保护；正常设置界面已经不存在 mock 选项。
  if (String((settings as unknown as { provider?: unknown }).provider) === 'mock') {
    throw new Error('本地模拟回复已停用。请先在“API 与模型”中配置可用 AI 接口。')
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
