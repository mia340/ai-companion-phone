import type { Character, CharacterExampleDialogue, LorebookEntry, RegexScript } from '../types/domain'
import { parseLorebookJson, parseRegexJson } from './resourceImportService'
import type { ImportedPersonaPreview } from './personaImportService'
import { parseExampleDialogues } from './characterCardService'
import { parsePersonaText } from './personaImportService'

interface CardPayload {
  name?: unknown
  avatar?: unknown
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
  group_only_greetings?: unknown
}


export type ImportedCharacterLorebookEntry = Omit<LorebookEntry, 'id' | 'worldId' | 'lorebookId' | 'createdAt' | 'updatedAt'>

export interface ImportedCharacterCard {
  format: 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json'
  patch: Partial<Character>
  lorebookEntries: ImportedCharacterLorebookEntry[]
  lorebookName?: string
  regexScripts: Array<Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>>
  embeddedUser?: ImportedPersonaPreview & { rawTemplate: string }
  notes: string[]
}

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(asText).filter(Boolean)))
    : []

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}

const asNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function importableAvatar(value: unknown) {
  const avatar = asText(value)
  if (!avatar || avatar.toLowerCase() === 'none') return undefined
  if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(avatar)) return avatar
  // 只把很短的文本当 Emoji/字符头像；Tavo 的 charaCard/xxx.jpg 路径没有随 JSON 一起提供文件，不能伪装成可用图片。
  return avatar.length <= 12 && !/[\/\.]/.test(avatar) ? avatar : undefined
}

function extractDepthPrompt(...extensions: Record<string, unknown>[]) {
  for (const ext of extensions) {
    const raw = asRecord(ext.depth_prompt ?? ext.depthPrompt)
    const direct = asText(raw.prompt)
    if (direct) {
      return { prompt: direct, depth: asNumber(raw.depth), role: asText(raw.role) || undefined }
    }
    const prompts = Array.isArray(raw.prompts) ? raw.prompts.map(asRecord) : []
    for (const item of prompts) {
      const prompt = asText(item.prompt)
      if (prompt) return { prompt, depth: asNumber(item.depth), role: asText(item.role) || undefined }
    }
  }
  return undefined
}

function inferInitiative(talkativeness?: number): Character['initiative'] | undefined {
  if (talkativeness == null) return undefined
  if (talkativeness <= 0.34) return 'low'
  if (talkativeness >= 0.66) return 'high'
  return 'natural'
}

function inferRelationshipFromCard(firstMessage: string, embeddedUser?: ImportedPersonaPreview) {
  const normalized = firstMessage.replace(/<br\s*\/?\s*>/gi, '\n')
  const explicit = normalized.match(/(?:^|\n)\s*[▪•·-]?\s*关系\s*[:：]\s*([^\n<]{1,24})/i)?.[1]?.trim()
  if (explicit && !/^(?:无|未知|待定|未设定)$/i.test(explicit)) return explicit

  const identity = [embeddedUser?.patch.identity, embeddedUser?.patch.relationshipNote, embeddedUser?.patch.description]
    .filter(Boolean)
    .join(' ')
  if (/徒弟|弟子/.test(identity)) return '师徒'
  if (/妻子|丈夫|老公|老婆|配偶|已婚/.test(identity)) return '夫妻'
  if (/恋人|情侣|男友|女友/.test(identity)) return '恋人'
  if (/同事/.test(identity)) return '同事'
  if (/朋友|好友/.test(identity)) return '朋友'
  return undefined
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

  // 社区卡并不总使用“{{user}}:”这种 YAML 风格。
  // 常见写法还有“{{user}}我是洛梨,……”。先移除占位符，再做文本 Persona 解析。
  const personaText = cleanTemplate
    .replace(/^\s*\{\{user\}\}\s*(?:[:：]\s*)?/i, '')
    .trim()
  const preview = parsePersonaText(personaText || cleanTemplate, `${characterName} · 原卡用户.txt`)
  const fallbackName = `${characterName} · 原卡用户`

  // 自然语言首句中的“我是/我叫/我名为”优先于文件名回退。
  const explicitName = (personaText || cleanTemplate).match(/^(?:我(?:是|叫|名为)\s*|姓名\s*[:：]\s*)([^,，。；;\n]{1,30})/u)?.[1]?.trim()
  if (explicitName) preview.patch.name = explicitName
  else if (!preview.patch.name || preview.patch.name === '导入的人设' || preview.patch.name === `${characterName} · 原卡用户`) {
    preview.patch.name = fallbackName
  }

  if (!preview.patch.age) {
    const age = (personaText || cleanTemplate).match(/(?:^|[,，。；;.\s])(\d{1,3})\s*岁(?:[,，。；;.\s]|$)/)?.[1]
    if (age) preview.patch.age = age
  }

  if (!preview.patch.identity && explicitName) {
    const firstLine = (personaText || cleanTemplate).split('\n')[0] || ''
    const afterName = firstLine.slice(firstLine.indexOf(explicitName) + explicitName.length)
    const identitySource = afterName.split(/\d{1,3}\s*岁/)[0] || afterName
    const segments = identitySource
      .split(/[,，。；;.]/)
      .map(item => item.trim())
      .filter(Boolean)
      .filter(item => !/^\d{1,3}\s*岁$/.test(item))
      .slice(0, 3)
    if (segments.length) preview.patch.identity = segments.join('、')
  }

  preview.patch.description = preview.patch.description || personaText || cleanTemplate
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

function characterBookEntryRows(value: unknown): Record<string, unknown>[] {
  const book = asRecord(value)
  const entries = book.entries
  if (Array.isArray(entries)) return entries.map(asRecord).filter(item => Object.keys(item).length)
  if (entries && typeof entries === 'object') return Object.values(asRecord(entries)).map(asRecord).filter(item => Object.keys(item).length)
  return []
}

function userPersonaEntryScore(entry: Record<string, unknown>): number {
  const label = [asText(entry.name), asText(entry.comment), asText(entry.title)].filter(Boolean).join(' ').toLowerCase()
  const content = asText(entry.content)
  let score = 0
  if (/^(?:user|用户|\{\{user\}\}).{0,8}(?:人设|设定|persona|profile)$/i.test(label.replace(/\s+/g, ''))) score += 100
  if (/(?:user人设|用户人设|userpersona|user设定|用户设定|\{\{user\}\}人设)/i.test(label.replace(/\s+/g, ''))) score += 80
  if (/^\s*\{\{user\}\}/i.test(content)) score += 30
  if (/^\s*\{\{user\}\}\s*(?:我(?:是|叫|名为)|姓名\s*[:：])/i.test(content)) score += 40
  return score
}

export function buildEmbeddedUserPreviewFromCharacterBook(value: unknown, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const candidates = characterBookEntryRows(value)
    .map(entry => ({ entry, score: userPersonaEntryScore(entry) }))
    .filter(item => item.score >= 60)
    .sort((a, b) => b.score - a.score)
  const content = candidates.length ? asText(candidates[0].entry.content) : ''
  return parseEmbeddedUserPersonaTemplate(content, characterName)
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
  try {
    return parseLorebookJson(JSON.stringify(value), '角色卡内嵌世界书.json').entries
  } catch {
    return []
  }
}

function extractCharacterBookName(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  try {
    const name = parseLorebookJson(JSON.stringify(value), '角色卡内嵌世界书.json').lorebook.name
    return name === '角色卡内嵌世界书' ? undefined : name || undefined
  } catch {
    return undefined
  }
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
  const extensions = asRecord(data.extensions)
  const rootExtensions = asRecord(record.extensions)
  const talkativeness = asNumber(rootExtensions.talkativeness ?? extensions.talkativeness ?? record.talkativeness)
  const depthPrompt = extractDepthPrompt(rootExtensions, extensions)
  const worldBookHint = asText(rootExtensions.world ?? extensions.world) || undefined
  const rootMetadata = Object.fromEntries(Object.entries(record).filter(([key]) => !['spec', 'spec_version', 'data', 'extensions'].includes(key)))
  const rawCardExtensions = JSON.parse(JSON.stringify({ data: extensions, root: rootExtensions, rootMetadata })) as Record<string, unknown>
  const notes: string[] = []

  if (!asText(data.name) && !description && !personality) {
    throw new Error('没有找到角色姓名、描述或性格。请确认选择的是角色卡，而不是预设、世界书或正则 JSON。')
  }

  const lorebookEntries = extractCharacterBook(data.character_book)
  const lorebookName = lorebookEntries.length ? extractCharacterBookName(data.character_book) : undefined
  let regexScripts: Array<Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>> = []
  const embeddedRegexRows = [
    ...(Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : []),
    ...(Array.isArray(rootExtensions.regex_scripts) ? rootExtensions.regex_scripts : [])
  ]
  if (embeddedRegexRows.length) {
    try {
      const parsed = parseRegexJson(JSON.stringify({ regex_scripts: embeddedRegexRows }), `${asText(data.name) || '角色'}-内嵌正则.json`).scripts
      const seen = new Set<string>()
      regexScripts = parsed.filter(script => {
        const key = `${script.name}\u0000${script.findRegex}\u0000${script.replaceString}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } catch {
      regexScripts = []
    }
  }
  const characterName = asText(data.name) || '角色'
  const embeddedUserFromBook = buildEmbeddedUserPreviewFromCharacterBook(data.character_book, characterName)
  const embeddedUserFromDescription = buildEmbeddedUserPreview(description, characterName)
  // “user人设/用户人设”这类专门世界书条目比 description 中的模糊模板更明确。
  const embeddedUser = embeddedUserFromBook || embeddedUserFromDescription
  const hasUserPlaceholder = [
    description,
    asText(data.scenario),
    asText(data.first_mes),
    asText(data.mes_example),
    JSON.stringify(data.character_book || {})
  ].some(value => /\{\{user\}\}/i.test(value))
  const inferredRelationship = inferRelationshipFromCard(asText(data.first_mes), embeddedUser)
  const patch: Partial<Character> = {
    name: asText(data.name) || undefined,
    avatar: importableAvatar(data.avatar ?? record.avatar),
    relationship: inferredRelationship,
    persona: [personality, description].filter(Boolean).join('\n\n') || undefined,
    scenario: asText(data.scenario) || undefined,
    firstMessage: asText(data.first_mes) || undefined,
    alternateGreetings: asStringArray(data.alternate_greetings),
    exampleDialogues: extractDialogue(data.mes_example),
    creatorNotes: asText(data.creator_notes) || undefined,
    systemPrompt: asText(data.system_prompt) || undefined,
    postHistoryInstructions: asText(data.post_history_instructions) || undefined,
    initiative: inferInitiative(talkativeness),
    talkativeness,
    depthPrompt,
    worldBookHint,
    rawCardExtensions,
    groupOnlyGreetings: asStringArray(data.group_only_greetings),
    tags: asStringArray(data.tags),
    creator: asText(data.creator) || undefined,
    resourceVersion: asText(data.character_version) || undefined,
    sourceUrl: asText(rootExtensions.source_url ?? rootExtensions.sourceUrl ?? extensions.source_url ?? extensions.sourceUrl) || undefined,
    license: asText(rootExtensions.license ?? extensions.license) || undefined,
    allowDerivative: typeof extensions.allow_derivative === 'boolean'
      ? extensions.allow_derivative
      : undefined,
    importFormat: format,
    embeddedUserTemplate: embeddedUser?.rawTemplate,
    cardVersion: format === 'sillytavern-v3' ? 3 : 2
  }

  if (format === 'legacy-json') notes.push('已按旧版 JSON 字段导入，部分扩展字段可能无法识别。')
  if (!patch.exampleDialogues?.length) notes.push('角色卡没有可识别的示例对话。')
  if (!patch.firstMessage) notes.push('角色卡没有开场白。')
  if (inferredRelationship) notes.push(`从角色卡明确状态/用户设定识别到与用户关系：${inferredRelationship}。`)
  if (lorebookEntries.length) notes.push(`检测到内嵌角色世界书 ${lorebookEntries.length} 条，将随角色一起导入。`)
  if (embeddedUser) {
    const sourceLabel = embeddedUserFromBook ? '内嵌世界书 user 人设条目' : '角色 description'
    notes.push(`检测到${sourceLabel}中的 {{user}} 用户模板，可直接生成角色专属 Persona 并自动绑定聊天。`)
  } else if (hasUserPlaceholder) {
    notes.push('检测到 {{user}} 剧情占位，但没有可安全提取的独立用户姓名/Persona：不会猜名字；运行时使用当前聊天 Persona，角色卡与世界书中的剧情关系仍按本会话设定生效。')
  }
  if (regexScripts.length) notes.push(`检测到内嵌正则 ${regexScripts.length} 条，将保存为角色专属正则并自动启用。`)
  if (depthPrompt) notes.push('检测到 depth_prompt，将按角色卡扩展提示参与运行时 Prompt。')
  if (talkativeness != null) notes.push(`检测到 talkativeness=${talkativeness}，已映射到角色主动程度。`)
  if (worldBookHint) notes.push(`检测到角色卡 world 绑定提示“${worldBookHint}”，已保留供资源兼容与后续绑定。`)
  if (asRecord(extensions.tavern_helper).scripts || asRecord(rootExtensions.tavern_helper).scripts) {
    notes.push('检测到 tavern_helper / JavaScript 扩展：已无损归档，但不会执行第三方 JS。')
  }
  if (asText(data.avatar ?? record.avatar) && !patch.avatar) notes.push('角色卡头像是外部相对路径；JSON 未携带图片文件，已保留原路径但不会显示成损坏头像。')

  return { format, patch, lorebookEntries, lorebookName, regexScripts, embeddedUser, notes }
}

export async function parseCharacterCardFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    throw new Error('当前支持 SillyTavern / Tavo JSON 角色卡；PNG 角色卡嵌入数据暂未开放。')
  }
  return parseCharacterCardJson(await file.text())
}

export function exportCharacterAsSillyTavernV2(character: Character) {
  const stored = asRecord(character.rawCardExtensions)
  const storedDataExtensions = asRecord(stored.data)
  const storedRootExtensions = asRecord(stored.root)
  const extensions: Record<string, unknown> = {
    ...storedDataExtensions,
    source_url: character.sourceUrl || storedDataExtensions.source_url || '',
    license: character.license || storedDataExtensions.license || '',
    allow_derivative: character.allowDerivative ?? storedDataExtensions.allow_derivative ?? false,
    ai_companion_embedded_user_template: character.embeddedUserTemplate || '',
    ai_companion_root_extensions: Object.keys(storedRootExtensions).length ? storedRootExtensions : undefined
  }
  if (character.talkativeness != null) extensions.talkativeness = character.talkativeness
  if (character.depthPrompt?.prompt) extensions.depth_prompt = {
    prompt: character.depthPrompt.prompt,
    depth: character.depthPrompt.depth,
    role: character.depthPrompt.role
  }
  if (character.worldBookHint) extensions.world = character.worldBookHint

  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: character.name,
      avatar: character.avatar || '',
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
      group_only_greetings: character.groupOnlyGreetings || [],
      tags: character.tags || [],
      creator: character.creator || '',
      character_version: character.resourceVersion || '0.4.3.4',
      extensions
    }
  }, null, 2)
}
