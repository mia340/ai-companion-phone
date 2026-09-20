import { db } from '../db/database'

import type {
  ModelSettings,
  ProviderType
} from '../types/modelSettings'

/** 单次回复输出 token 的统一硬上限：触顶就截断保留已生成内容，不再报“超长”。 */
export const MAX_OUTPUT_TOKENS = 4000
export const MIN_OUTPUT_TOKENS = 64

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  id: 'default',
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-flash',
  temperature: 0.8,
  maxTokens: MAX_OUTPUT_TOKENS,
  thinkingEnabled: false,
  availableModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  visionMode: 'auto',
  visionSupported: false,
  visionTestedSignature: undefined,
  updatedAt: new Date(0).toISOString()
}

export function getProviderDefaults(
  provider: ProviderType
): {
  baseUrl: string
  model: string
  models: string[]
} {
  if (provider === 'deepseek') {
    return {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      models: [
        'deepseek-v4-flash',
        'deepseek-v4-pro'
      ]
    }
  }

  if (provider === 'openai-compatible') {
    return {
      baseUrl: '',
      model: '',
      models: []
    }
  }

  return {
    baseUrl: '',
    model: '',
    models: []
  }
}

export function normalizeApiBaseUrl(
  value: string
) {
  return value
    .trim()
    .replace(/\/(?:chat\/completions|models)\/?$/i, '')
    .replace(/\/+$/, '')
}

function normalizeModelList(
  values?: string[]
) {
  if (!values) return []

  return [...new Set(
    values
      .map(item => item.trim())
      .filter(Boolean)
  )]
}

export function modelVisionSignature(
  settings: Pick<ModelSettings, 'provider' | 'baseUrl' | 'model'>
) {
  return [
    settings.provider,
    normalizeApiBaseUrl(settings.baseUrl).toLowerCase(),
    settings.model.trim().toLowerCase()
  ].join('|')
}

/** 保存前把 maxTokens 收敛到 [64, 4000]：<=0（含旧的 0=不设上限）一律按新默认。 */
function normalizeOutputTokens(value: number | undefined): number {
  const raw = Number.isFinite(value) ? Math.round(value as number) : 0
  if (raw <= 0) return DEFAULT_MODEL_SETTINGS.maxTokens
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(MIN_OUTPUT_TOKENS, raw))
}

export function getVisionCapability(
  settings: ModelSettings
): 'supported' | 'unsupported' | 'unknown' {
  if (settings.visionMode === 'disabled') {
    return 'unsupported'
  }

  if (settings.visionMode === 'enabled') {
    return 'supported'
  }

  const signature = modelVisionSignature(settings)

  if (
    settings.visionTestedSignature === signature &&
    typeof settings.visionSupported === 'boolean'
  ) {
    return settings.visionSupported
      ? 'supported'
      : 'unsupported'
  }

  return 'unknown'
}

export async function saveVisionCapability(
  settings: ModelSettings,
  supported: boolean
): Promise<ModelSettings> {
  const next: ModelSettings = {
    ...settings,
    visionSupported: supported,
    visionTestedSignature: modelVisionSignature(settings),
    visionTestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await db.modelSettings.put(next)
  return next
}

export async function getModelSettings():
Promise<ModelSettings> {
  const saved = await db.modelSettings.get('default')

  if (!saved) {
    return {
      ...DEFAULT_MODEL_SETTINGS,
      updatedAt: new Date().toISOString()
    }
  }

  const savedProvider = String((saved as unknown as { provider?: unknown }).provider || '')
  const legacyMock = savedProvider === 'mock'
  const effectiveProvider: ProviderType = savedProvider === 'openai-compatible' ? 'openai-compatible' : 'deepseek'
  const defaults = getProviderDefaults(effectiveProvider)

  const shouldMigrateDeepSeekModel =
    effectiveProvider === 'deepseek' &&
    [
      'deepseek-chat',
      'deepseek-reasoner'
    ].includes(saved.model)

  const model = shouldMigrateDeepSeekModel
    ? defaults.model
    : saved.model

  const availableModels = normalizeModelList([
    ...(saved.availableModels ?? []).filter(
      item =>
        effectiveProvider !== 'deepseek' ||
        ![
          'deepseek-chat',
          'deepseek-reasoner'
        ].includes(item)
    ),
    ...(model ? [model] : []),
    ...defaults.models
  ])

  // 576/600/2048/8192 是早期版本的系统默认值，8192 是上一版默认；0 是旧的“不设上限”。
  // 新策略：输出统一压到 4000 以内（触顶截断保留，不再报超长）。
  // 因此历史默认、旧 0 值、以及任何超出 4000 的旧值，都收敛到新默认 4000；
  // 只有用户主动设过的 [64, 4000] 区间内的值保持不变。
  const rawMaxTokens = Math.round(saved.maxTokens ?? 0)
  const migratedMaxTokens = rawMaxTokens === 0 ||
    [576, 600, 2048, 8192].includes(rawMaxTokens) ||
    rawMaxTokens > MAX_OUTPUT_TOKENS
    ? DEFAULT_MODEL_SETTINGS.maxTokens
    : normalizeOutputTokens(saved.maxTokens)

  const normalized: ModelSettings = {
    ...DEFAULT_MODEL_SETTINGS,
    ...saved,
    provider: effectiveProvider,
    baseUrl: legacyMock ? defaults.baseUrl : saved.baseUrl,
    apiKey: legacyMock ? '' : saved.apiKey,
    model: legacyMock ? defaults.model : model,
    maxTokens: migratedMaxTokens ?? DEFAULT_MODEL_SETTINGS.maxTokens,
    availableModels: legacyMock ? defaults.models : availableModels,
    visionMode: saved.visionMode ?? 'auto'
  }


  return normalized
}

export async function saveModelSettings(
  settings: ModelSettings
): Promise<void> {
  const existing = await db.modelSettings.get('default')
  const provider: ProviderType = settings.provider
  const normalizedBaseUrl = normalizeApiBaseUrl(settings.baseUrl)
  const normalizedModel = settings.model.trim()
  const availableModels = normalizeModelList([
    ...(settings.availableModels ?? []),
    ...(normalizedModel ? [normalizedModel] : [])
  ])

  const nextSignature = modelVisionSignature({
    provider,
    baseUrl: normalizedBaseUrl,
    model: normalizedModel
  })

  const previousSignature = existing
    ? modelVisionSignature(existing)
    : ''

  const capabilityChanged = nextSignature !== previousSignature

  await db.modelSettings.put({
    ...settings,
    id: 'default',
    provider,
    baseUrl: normalizedBaseUrl,
    apiKey: settings.apiKey.trim(),
    model: normalizedModel,
    temperature: Math.min(
      2,
      Math.max(0, settings.temperature)
    ),
    // 统一收敛到 [64, 4000]：0 / 负数 / 空值都按新默认，不再有“不设上限”分支。
    maxTokens: normalizeOutputTokens(settings.maxTokens),
    availableModels,
    visionMode: settings.visionMode ?? 'auto',
    visionSupported: capabilityChanged
      ? undefined
      : settings.visionSupported,
    visionTestedSignature: capabilityChanged
      ? undefined
      : settings.visionTestedSignature,
    visionTestedAt: capabilityChanged
      ? undefined
      : settings.visionTestedAt,
    updatedAt: new Date().toISOString()
  })
}
