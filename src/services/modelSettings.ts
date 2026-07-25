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
  updatedAt: new Date(0).toISOString()
}

export function getProviderDefaults(
  provider: ProviderType
) {
  if (provider === 'deepseek') {
    return {
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat'
    }
  }

  if (provider === 'openai-compatible') {
    return {
      baseUrl: '',
      model: ''
    }
  }

  return {
    baseUrl: '',
    model: 'mock'
  }
}

export async function getModelSettings():
Promise<ModelSettings> {
  const saved = await db.modelSettings.get('default')

  return saved ?? {
    ...DEFAULT_MODEL_SETTINGS,
    updatedAt: new Date().toISOString()
  }
}

export async function saveModelSettings(
  settings: ModelSettings
): Promise<void> {
  await db.modelSettings.put({
    ...settings,
    id: 'default',
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
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
    updatedAt: new Date().toISOString()
  })
}
