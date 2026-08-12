import type { Character, CharacterExampleDialogue } from '../types/domain'
import type { ImportedPersonaPreview } from './personaImportService'
import { parseExampleDialogues } from './characterCardService'
import { parsePersonaText } from './personaImportService'

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
  character_book?: unknown
}

interface RawCharacterBookEntry {
  keys?: unknown
  content?: unknown
  enabled?: unknown
  constant?: unknown
  case_sensitive?: unknown
  insertion_order?: unknown
  name?: unknown
  comment?: unknown
  extensions?: unknown
}

export interface ImportedCharacterLorebookEntry {
  title: string
  keywords: string[]
  content: string
  enabled: boolean
  constant: boolean
  caseSensitive: boolean
  priority: number
}

export interface ImportedCharacterCard {
  format: 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json'
  patch: Partial<Character>
  lorebookEntries: ImportedCharacterLorebookEntry[]
  embeddedUser?: ImportedPersonaPreview & { rawTemplate: string }
  notes: string[]
}

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(asText).filter(Boolean)))
    : []

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback

const asFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const extractDialogue = (value: unknown): CharacterExampleDialogue[] => {
  const normalized = asText(value)
    .replace(/<START>/gi, '\n---\n')
    .replace(/\{\{user\}\}/gi, '用户')
    .replace(/\{\{char\}\}/gi, '角色')
  return normalized ? parseExampleDialogues(normalized) : []
}


export function extractEmbeddedUserTemplate(description: string): string {
  const lines = description.replace(/\r/g, '').split('\n')
  for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
    const marker = lines[markerIndex]?.match(/^(\s*)\{\{user\}\}\s*[:：]\s*(.*)$/i)
    if (!marker) continue

    const baseIndent = marker[1]?.length ?? 0
    const collected: string[] = []
    const inlineValue = marker[2]?.trim()
    if (inlineValue) collected.push(inlineValue)

    for (let index = markerIndex + 1; index < lines.length; index++) {
      const line = lines[index] ?? ''
      if (!line.trim()) {
        if (collected.length) collected.push('')
        continue
      }
      const indent = line.match(/^\s*/)?.[0].length ?? 0
      const trimmed = line.trim()
      if (indent <= baseIndent) break
      if (/^\{\{char\}\}\s*[:：]?/i.test(trimmed)) break
      collected.push(line.slice(Math.min(line.length, baseIndent + 2)))
    }

    return collected.join('\n').trim()
  }

  return ''
}

export function parseEmbeddedUserPersonaTemplate(rawTemplate: string, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const cleanTemplate = rawTemplate.trim()
  if (!cleanTemplate) return undefined
  const preview = parsePersonaText(cleanTemplate, `${characterName} · 原卡用户.txt`)
  const fallbackName = `${characterName} · 原卡用户`
  if (!preview.patch.name || preview.patch.name === '导入的人设') {
    preview.patch.name = fallbackName
  }
  preview.patch.title = preview.patch.title || `${characterName}角色卡自带 {{user}}`
  preview.patch.personaScope = 'character'
  preview.patch.isCardTemplate = true
  preview.patch.sourceUserTemplate = cleanTemplate
  preview.patch.extraFields = {
    ...(preview.patch.extraFields || {}),
    source: 'character-card-embedded-user'
  }
  preview.notes = [
    ...preview.notes,
    `检测到角色卡自带 {{user}} 模板。可创建为“${preview.patch.name}”角色专属 Persona。`
  ]
  return { ...preview, rawTemplate: cleanTemplate }
}

export function buildEmbeddedUserPreview(description: string, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const rawTemplate = extractEmbeddedUserTemplate(description)
  return parseEmbeddedUserPersonaTemplate(rawTemplate, characterName)
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

function extractCharacterBook(value: unknown): ImportedCharacterLorebookEntry[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const entries = (value as Record<string, unknown>).entries
  if (!Array.isArray(entries)) return []

  return entries.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const entry = raw as RawCharacterBookEntry
    const content = asText(entry.content)
    if (!content) return []

    const extensions = entry.extensions && typeof entry.extensions === 'object' && !Array.isArray(entry.extensions)
      ? entry.extensions as Record<string, unknown>
      : {}
    const keys = asStringArray(entry.keys)

    return [{
      title: asText(entry.name) || asText(entry.comment) || `角色世界书 ${index + 1}`,
      keywords: keys,
      content,
      enabled: asBoolean(entry.enabled, true),
      constant: asBoolean(entry.constant, keys.length === 0),
      caseSensitive: typeof entry.case_sensitive === 'boolean'
        ? entry.case_sensitive
        : asBoolean(extensions.case_sensitive, false),
      priority: Math.round(asFiniteNumber(entry.insertion_order, 100 - index))
    }]
  })
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

  if (format === 'legacy-json') {
    if (Array.isArray(record.entries) || (record.entries && typeof record.entries === 'object')) {
      throw new Error('检测到这是世界书 JSON，不是角色卡。请到世界书页面导入。')
    }
    if (Array.isArray(record.prompts) || Array.isArray(record.prompt_order)) {
      throw new Error('检测到这是 Prompt 预设 JSON，不是角色卡。')
    }
    if (Array.isArray(record.regex_scripts) || record.regex_scripts) {
      throw new Error('检测到这是正则资源 JSON，不是角色卡。')
    }
  }

  const data = extractData(record)
  const description = asText(data.description)
  const personality = asText(data.personality)
  const extensions = data.extensions && typeof data.extensions === 'object' && !Array.isArray(data.extensions)
    ? data.extensions as Record<string, unknown>
    : {}
  const notes: string[] = []

  if (!asText(data.name) && !description && !personality) {
    throw new Error('没有找到角色姓名、描述或性格。请确认选择的是角色卡，而不是预设、世界书或正则 JSON。')
  }

  const lorebookEntries = extractCharacterBook(data.character_book)
  const embeddedUser = buildEmbeddedUserPreview(description, asText(data.name) || '角色')
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
    embeddedUserTemplate: embeddedUser?.rawTemplate,
    cardVersion: 2
  }

  if (format === 'legacy-json') notes.push('已按旧版 JSON 字段导入，部分扩展字段可能无法识别。')
  if (!patch.exampleDialogues?.length) notes.push('角色卡没有可识别的示例对话。')
  if (!patch.firstMessage) notes.push('角色卡没有开场白。')
  if (lorebookEntries.length) notes.push(`检测到内嵌角色世界书 ${lorebookEntries.length} 条，将随角色一起导入。`)
  if (embeddedUser) notes.push(`检测到角色卡自带 {{user}} 用户模板，可直接生成角色专属 Persona 并自动绑定聊天。`)

  return { format, patch, lorebookEntries, embeddedUser, notes }
}

export async function parseCharacterCardFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error('当前支持 SillyTavern / Tavo JSON 角色卡；PNG 角色卡嵌入数据暂未开放。')
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
        character.boundaries ? `边界：${character.boundaries}` : '',
        character.embeddedUserTemplate
          ? `{{user}}:\n${character.embeddedUserTemplate.split('\n').map(line => `  ${line}`).join('\n')}`
          : ''
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
      character_version: character.resourceVersion || '0.4.2.7',
      extensions: {
        source_url: character.sourceUrl || '',
        license: character.license || '',
        allow_derivative: character.allowDerivative ?? false,
        ai_companion_embedded_user_template: character.embeddedUserTemplate || ''
      }
    }
  }, null, 2)
}
