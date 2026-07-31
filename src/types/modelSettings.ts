export type ProviderType =
  | 'mock'
  | 'deepseek'
  | 'openai-compatible'

export type VisionMode =
  | 'auto'
  | 'enabled'
  | 'disabled'

export interface ModelSettings {
  id: 'default'
  provider: ProviderType
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  fallbackToMock: boolean
  availableModels?: string[]
  modelsUpdatedAt?: string

  /**
   * auto：发送图片时尝试视觉请求，若接口不支持则自动改用文字兜底。
   * enabled：始终按视觉模型发送。
   * disabled：从不把图片发送到模型。
   */
  visionMode: VisionMode
  visionSupported?: boolean
  visionTestedSignature?: string
  visionTestedAt?: string

  updatedAt: string
}

export interface PublicModelSettings
extends Omit<ModelSettings, 'apiKey'> {
  hasApiKey: boolean
}
