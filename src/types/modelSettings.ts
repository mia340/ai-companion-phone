export type ProviderType =
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
  availableModels?: string[]
  modelsUpdatedAt?: string

  /**
   * auto：发送图片时尝试视觉请求，若接口不支持则只把文字部分继续交给同一 AI。
   * enabled：始终按视觉模型发送。
   * disabled：从不把图片发送到模型。
   */
  /**
   * 是否允许模型先输出隐藏思考链（reasoning）。当前网关的 deepseek-v4-flash
   * 是带思考的推理模型：思考 token 和正式回答共用 max_tokens，思考一长就会把
   * 输出预算吃光、正式回答为空或极短（历史上“超过最大输出长度/没有返回有效回复”根因）。
   * 默认 false = 请求带 thinking:{type:"disabled"}，更快、回答不再被思考饿死；
   * 想要更“想得深”可手动打开（会变慢、且回答可能因思考占额而变短）。
   */
  thinkingEnabled?: boolean
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
