import { db } from '../db/database'

import type {
  ModelSettings,
  ProviderType
} from '../types/modelSettings'

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  id: 'default',
  provider: 'mock',
  baseUrl: '',
  apiKey: '',
  model: 'mock',
  temperature: 0.8,
  maxTokens: 2048,
  fallbackToMock: true,
  availableModels: ['mock'],
  visionMode: 'auto',
  visionSupported: false,
  visionTestedSignature: 'mock||mock',
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
    model: 'mock',
    models: ['mock']
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

export function getVisionCapability(
  settings: ModelSettings
): 'supported' | 'unsupported' | 'unknown' {
  if (
    settings.provider === 'mock' ||
    settings.visionMode === 'disabled'
  ) {
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

  const defaults = getProviderDefaults(saved.provider)

  const shouldMigrateDeepSeekModel =
    saved.provider === 'deepseek' &&
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
        saved.provider !== 'deepseek' ||
        ![
          'deepseek-chat',
          'deepseek-reasoner'
        ].includes(item)
    ),
    ...(model ? [model] : []),
    ...defaults.models
  ])

  // 576/600 是早期版本的低默认值，长角色卡 + companion_packet 很容易被截断。
  // 只迁移这两个历史默认值；用户主动设置的其它长度保持不变。
  const migratedMaxTokens = [576, 600].includes(Math.round(saved.maxTokens ?? 0))
    ? 2048
    : saved.maxTokens

  const normalized: ModelSettings = {
    ...DEFAULT_MODEL_SETTINGS,
    ...saved,
    model,
    maxTokens: migratedMaxTokens ?? DEFAULT_MODEL_SETTINGS.maxTokens,
    availableModels,
    visionMode: saved.visionMode ?? 'auto'
  }

  if (normalized.provider === 'mock') {
    normalized.visionSupported = false
    normalized.visionTestedSignature = modelVisionSignature(normalized)
  }

  return normalized
}

export async function saveModelSettings(
  settings: ModelSettings
): Promise<void> {
  const existing = await db.modelSettings.get('default')
  const normalizedBaseUrl = normalizeApiBaseUrl(settings.baseUrl)
  const normalizedModel = settings.model.trim()
  const availableModels = normalizeModelList([
    ...(settings.availableModels ?? []),
    ...(normalizedModel ? [normalizedModel] : [])
  ])

  const nextSignature = modelVisionSignature({
    provider: settings.provider,
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
    baseUrl: normalizedBaseUrl,
    apiKey: settings.apiKey.trim(),
    model: normalizedModel,
    temperature: Math.min(
      2,
      Math.max(0, settings.temperature)
    ),
    maxTokens: Math.min(
      8192,
      Math.max(64, Math.round(settings.maxTokens))
    ),
    availableModels,
    visionMode: settings.visionMode ?? 'auto',
    visionSupported: settings.provider === 'mock'
      ? false
      : capabilityChanged
        ? undefined
        : settings.visionSupported,
    visionTestedSignature: settings.provider === 'mock'
      ? nextSignature
      : capabilityChanged
        ? undefined
        : settings.visionTestedSignature,
    visionTestedAt: capabilityChanged
      ? undefined
      : settings.visionTestedAt,
    updatedAt: new Date().toISOString()
  })
}
