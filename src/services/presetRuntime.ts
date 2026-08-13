import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import type { PromptPreset } from '../types/domain'

export interface PresetMacroContext {
  char?: string
  user?: string
  scenario?: string
  personality?: string
  persona?: string
  description?: string
  lastChatMessage?: string
}

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

function randomChoice(value: string) {
  const items = value.split('|').map(item => item.trim()).filter(Boolean)
  return items.length ? items[Math.floor(Math.random() * items.length)] : ''
}

function substitutePresetMacros(
  value: string,
  context: PresetMacroContext = {},
  variables: Record<string, string> = {}
) {
  const values: Record<string, string> = {
    char: context.char || '',
    user: context.user || '',
    scenario: context.scenario || '',
    personality: context.personality || '',
    persona: context.persona || '',
    description: context.description || '',
    lastChatMessage: context.lastChatMessage || '',
    lastUserMessage: context.lastChatMessage || '',
    current_date: new Date().toLocaleDateString('zh-CN'),
    date: new Date().toLocaleDateString('zh-CN')
  }

  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, expression: string) => {
    const expr = expression.trim()
    const parts = expr.split('::')
    const command = parts[0]?.toLowerCase()

    if (command === 'setvar' && parts[1]) {
      const key = parts[1].trim()
      let assigned = parts.slice(2).join('::').trim()
      if (/^random::/i.test(assigned)) assigned = randomChoice(assigned.replace(/^random::/i, ''))
      variables[key] = assigned
      return ''
    }

    if (command === 'getvar' && parts[1]) return variables[parts[1].trim()] ?? ''
    if (command === 'random' && parts.length > 1) return randomChoice(parts.slice(1).join('::'))

    if (Object.prototype.hasOwnProperty.call(variables, expr)) return variables[expr]
    if (Object.prototype.hasOwnProperty.call(values, expr)) return values[expr]

    const normalizedKey = Object.keys(values).find(key => key.toLowerCase() === expr.toLowerCase())
    return normalizedKey ? values[normalizedKey] : whole
  })
}

export function composeWithPromptPreset(basePrompt: string, preset?: PromptPreset, context: PresetMacroContext = {}) {
  if (!preset) return basePrompt
  const rows = enabledOrder(preset)
  const parts: string[] = []
  const variables: Record<string, string> = {}
  let insertedBase = false

  for (const prompt of rows) {
    if (prompt.marker) {
      if (['main', 'chatHistory', 'chat_history'].includes(prompt.identifier)) {
        if (!insertedBase) {
          parts.push(basePrompt)
          insertedBase = true
        }
      }
      continue
    }
    if (!prompt.content?.trim()) continue
    const content = substitutePresetMacros(prompt.content.trim(), context, variables)
    parts.push(`【预设 · ${prompt.name} · ${prompt.role || 'system'}】\n${content}`)
  }

  if (!insertedBase) parts.push(basePrompt)
  return [`【当前 Prompt 预设】${preset.name}`, ...parts].join('\n\n')
}

