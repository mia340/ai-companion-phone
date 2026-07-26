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
  maxTokens: 600,
  fallbackToMock: true,
  availableModels: ['mock'],
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

  return {
    ...DEFAULT_MODEL_SETTINGS,
    ...saved,
    model,
    availableModels
  }
}

export async function saveModelSettings(
  settings: ModelSettings
): Promise<void> {
  const availableModels = normalizeModelList([
    ...(settings.availableModels ?? []),
    ...(settings.model ? [settings.model] : [])
  ])

  await db.modelSettings.put({
    ...settings,
    id: 'default',
    baseUrl: normalizeApiBaseUrl(
      settings.baseUrl
    ),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    temperature: Math.min(
      2,
      Math.max(0, settings.temperature)
    ),
    maxTokens: Math.min(
      8192,
      Math.max(64, Math.round(settings.maxTokens))
    ),
    availableModels,
    updatedAt: new Date().toISOString()
  })
}
