export type ProviderType =
  | 'mock'
  | 'deepseek'
  | 'openai-compatible'

export interface ModelSettings {
  id: 'default'
  provider: ProviderType
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  fallbackToMock: boolean
  updatedAt: string
}

export interface PublicModelSettings
extends Omit<ModelSettings, 'apiKey'> {
  hasApiKey: boolean
}
