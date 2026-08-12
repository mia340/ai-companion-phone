import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import type { PromptPreset } from '../types/domain'

export async function getActivePromptPreset(characterId: string): Promise<PromptPreset | undefined> {
  const ids = await getCharacterResourceIds(characterId, 'preset')
  for (const id of ids) {
    const preset = await db.promptPresets.get(id)
    if (preset) return preset
  }
  return undefined
}

function enabledOrder(preset: PromptPreset) {
  const map = new Map(preset.prompts.map(prompt => [prompt.identifier, prompt]))
  const order = preset.promptOrder.length ? preset.promptOrder : preset.prompts.map(prompt => ({ identifier: prompt.identifier, enabled: prompt.enabled }))
  return order.flatMap(item => {
    const prompt = map.get(item.identifier)
    return prompt && item.enabled && prompt.enabled ? [prompt] : []
  })
}

export function composeWithPromptPreset(basePrompt: string, preset?: PromptPreset) {
  if (!preset) return basePrompt
  const rows = enabledOrder(preset)
  const parts: string[] = []
  let insertedBase = false

  for (const prompt of rows) {
    if (prompt.marker) {
      if (prompt.identifier === 'main' || prompt.identifier === 'chatHistory') {
        if (!insertedBase) {
          parts.push(basePrompt)
          insertedBase = true
        }
      }
      continue
    }
    if (!prompt.content?.trim()) continue
    parts.push(`【预设 · ${prompt.name} · ${prompt.role || 'system'}】\n${prompt.content.trim()}`)
  }

  if (!insertedBase) parts.push(basePrompt)
  return [`【当前 Prompt 预设】${preset.name}`, ...parts].join('\n\n')
}
