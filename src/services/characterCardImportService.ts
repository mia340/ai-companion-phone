import type { Character, CharacterExampleDialogue } from '../types/domain'
import { parseExampleDialogues } from './characterCardService'

interface CardPayload {
  name?: unknown
  description?: unknown
  personality?: unknown
  scenario?: unknown
  first_mes?: unknown
  mes_example?: unknown
  alternate_greetings?: unknown
  creator_notes?: unknown
  system_prompt?: unknown
  post_history_instructions?: unknown
  tags?: unknown
  creator?: unknown
  character_version?: unknown
  extensions?: unknown
}

export interface ImportedCharacterCard {
  format: 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json'
  patch: Partial<Character>
  notes: string[]
}

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(asText).filter(Boolean)))
    : []

const extractDialogue = (value: unknown): CharacterExampleDialogue[] => {
  const normalized = asText(value)
    .replace(/<START>/gi, '\n---\n')
    .replace(/\{\{user\}\}/gi, '用户')
    .replace(/\{\{char\}\}/gi, '角色')
  return normalized ? parseExampleDialogues(normalized) : []
}

function inferFormat(root: Record<string, unknown>) {
  if (root.spec === 'chara_card_v3') return 'sillytavern-v3' as const
  if (root.spec === 'chara_card_v2') return 'sillytavern-v2' as const
  return 'legacy-json' as const
}

function extractData(root: Record<string, unknown>): CardPayload {
  const data = root.data
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as CardPayload
    : root as CardPayload
}

export function parseCharacterCardJson(value: string): ImportedCharacterCard {
  let root: unknown
  try {
    root = JSON.parse(value)
  } catch {
    throw new Error('角色卡不是有效的 JSON 文件。')
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('角色卡 JSON 结构无效。')
  }

  const record = root as Record<string, unknown>
  const format = inferFormat(record)
  const data = extractData(record)
  const description = asText(data.description)
  const personality = asText(data.personality)
  const extensions = data.extensions && typeof data.extensions === 'object'
    ? data.extensions as Record<string, unknown>
    : {}
  const notes: string[] = []

  if (!asText(data.name) && !description && !personality) {
    throw new Error('角色卡中没有找到姓名、描述或性格字段。')
  }

  const patch: Partial<Character> = {
    name: asText(data.name) || undefined,
    persona: [personality, description].filter(Boolean).join('\n\n') || undefined,
    scenario: asText(data.scenario) || undefined,
    firstMessage: asText(data.first_mes) || undefined,
    alternateGreetings: asStringArray(data.alternate_greetings),
    exampleDialogues: extractDialogue(data.mes_example),
    creatorNotes: asText(data.creator_notes) || undefined,
    systemPrompt: asText(data.system_prompt) || undefined,
    postHistoryInstructions: asText(data.post_history_instructions) || undefined,
    tags: asStringArray(data.tags),
    creator: asText(data.creator) || undefined,
    resourceVersion: asText(data.character_version) || undefined,
    sourceUrl: asText(extensions.source_url ?? extensions.sourceUrl) || undefined,
    license: asText(extensions.license) || undefined,
    allowDerivative: typeof extensions.allow_derivative === 'boolean'
      ? extensions.allow_derivative
      : undefined,
    importFormat: format,
    cardVersion: 2
  }

  if (format === 'legacy-json') {
    notes.push('已按旧版 JSON 字段导入，部分扩展字段可能无法识别。')
  }
  if (!patch.exampleDialogues?.length) {
    notes.push('角色卡没有可识别的示例对话，建议手动补充。')
  }
  if (!patch.firstMessage) notes.push('角色卡没有开场白。')

  return { format, patch, notes }
}

export async function parseCharacterCardFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error('当前版本先支持 SillyTavern JSON 角色卡；PNG 角色卡将在后续版本支持。')
  }

  return parseCharacterCardJson(await file.text())
}

export function exportCharacterAsSillyTavernV2(character: Character) {
  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      description: [
        character.identity ? `身份：${character.identity}` : '',
        character.appearance ? `外貌：${character.appearance}` : '',
        character.background ? `背景：${character.background}` : '',
        character.values ? `价值观：${character.values}` : '',
        character.habits ? `习惯：${character.habits}` : '',
        character.boundaries ? `边界：${character.boundaries}` : ''
      ].filter(Boolean).join('\n'),
      personality: character.persona,
      scenario: character.scenario || '',
      first_mes: character.firstMessage || '',
      mes_example: (character.exampleDialogues || [])
        .map(item => `{{user}}: ${item.user}\n{{char}}: ${item.assistant}`)
        .join('\n<START>\n'),
      creator_notes: character.creatorNotes || '',
      system_prompt: character.systemPrompt || '',
      post_history_instructions: character.postHistoryInstructions || '',
      alternate_greetings: character.alternateGreetings || [],
      tags: character.tags || [],
      creator: character.creator || '',
      character_version: character.resourceVersion || '0.4.1',
      extensions: {
        source_url: character.sourceUrl || '',
        license: character.license || '',
        allow_derivative: character.allowDerivative ?? false
      }
    }
  }, null, 2)
}
