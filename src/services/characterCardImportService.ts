import type { Character, CharacterExampleDialogue, LorebookEntry, LorebookResource, RegexScript } from '../types/domain'
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
  format: 'sillytavern-v2' | 'sillytavern-v3' | 'legacy-json' | 'community-json' | 'png-character-card'
  patch: Partial<Character>
  lorebookEntries: ImportedCharacterLorebookEntry[]
  lorebookName?: string
  lorebookResource?: Partial<Omit<LorebookResource, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>>
  regexScripts: Array<Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>>
  embeddedUser?: ImportedPersonaPreview & { rawTemplate: string }
  notes: string[]
  rawSourceJson?: string
}

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const asStringArray = (value: unknown) => {
  if (Array.isArray(value)) return Array.from(new Set(value.map(asText).filter(Boolean)))
  const single = asText(value)
  return single ? [single] : []
}

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

function buildImportedCharacterIntroduction(description: string, personality: string) {
  const parts: string[] = []
  if (description.trim()) parts.push(description.trim())
  if (personality.trim() && !parts.some(item => item === personality.trim() || item.includes(personality.trim()))) {
    parts.push(personality.trim())
  }
  return parts.join('\n\n')
}

function inferRelationshipFromCard(firstMessage: string, embeddedUser?: ImportedPersonaPreview) {
  const normalized = firstMessage.replace(/<br\s*\/?\s*>/gi, '\n')
  const xml = normalized.match(/<(?:关系|关系状态|relationship|relation)>\s*([\s\S]{1,50}?)\s*<\/(?:关系|关系状态|relationship|relation)>/i)?.[1]?.trim()
  const plain = normalized.match(/(?:^|\n)\s*[▪•·\-]?\s*(?:关系|关系状态|relationship|relation)\s*[:：=]\s*([^\n<]{1,50})/i)?.[1]?.trim()
  const explicit = xml || plain || embeddedUser?.patch.relationshipNote?.trim()
  if (!explicit || /^(?:无|未知|待定|未设定|none|unknown|n\/a)$/i.test(explicit)) return undefined
  return explicit.replace(/^人(?=陌生人$)/, '')
}

const extractDialogue = (value: unknown): CharacterExampleDialogue[] => {
  const normalized = asText(value)
    .replace(/<START>/gi, '\n---\n')
    .replace(/\{\{user\}\}/gi, '用户')
    .replace(/\{\{char\}\}/gi, '角色')
  return normalized ? parseExampleDialogues(normalized) : []
}


function stripPersonaMarkup(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripUserMarker(value: string) {
  return stripPersonaMarkup(value)
    .replace(/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\d+[.)、]|[-*•·#>]+)\s*/u, '')
    .replace(/^\s*\[(?:我的设定|用户设定[^\]]*|user设定[^\]]*|用户人设[^\]]*|user人设[^\]]*|用户|user)\]\s*/i, '')
    .replace(/^\s*(?:\[(?:用户|user)\]\s*)?\{\{user\}\}\s*(?:\[(?:用户|user)\]\s*)?/i, '')
    .replace(/^\s*\[(?:我的设定|用户设定[^\]]*|user设定[^\]]*|用户人设[^\]]*|user人设[^\]]*|用户|user)\]\s*/i, '')
    .replace(/^\s*[:：]\s*/, '')
    .trim()
}

function personaSignalCount(value: string) {
  const head = value.slice(0, 320)
  const signals = [
    /(?:^|[,，。；;\s])(男|女)(?:[,，。；;\s]|$)/,
    /\d{1,3}\s*岁/,
    /\d{2,3}(?:\.\d+)?\s*(?:cm|厘米)/i,
    /(?:学生|新生|研究生|本科生|徒弟|弟子|剑修|杀手|记者|幼师|插画师|演员|导演|助理|医生|教师|律师|老板|店主|妻子|丈夫|老公|老婆|继承人|军人|警察|女将|将军|修士|少爷|小姐|职业|身份|家庭|学校|住校|寝室)/
  ]
  return signals.filter(pattern => pattern.test(head)).length
}

function looksLikeNaturalPersona(value: string) {
  return personaSignalCount(value) >= 2
}

function looksLikeDirectPersonaLine(value: string) {
  return personaSignalCount(value) >= 1
}

function looksLikePersonaTemplateContent(value: string) {
  const readable = stripPersonaMarkup(value)
  if (looksLikeNaturalPersona(readable)) return true
  return /(?:^|\n)\s*(?:[-*•·]\s*)?(?:姓名|名字|年龄|性别|生日|身高|职业|工作|身份|外貌|性格|背景|经历|爱好|兴趣|习惯|边界)\s*[:：]/u.test(readable)
}

function looksLikePersonaNameToken(value: string) {
  const token = value.trim().replace(/^[\[{（【]|[}\]）】]$/g, '')
  if (!token || token.length > 30) return false
  if (/^(?:用户|user|我|你)$/i.test(token)) return false
  if (/(?:要求|身份|关系|故事|网恋|年龄|状态|内心|外观|计划|好感|工作|职业|已经|已发生|希望|可以|应该|不能|不高|自卑|唯一|秘密|例外|们|的|被|让|对于|关于|作为|为“|为")/u.test(token)) return false
  if (/^[A-Za-z][A-Za-z ._'’\-]{0,29}$/u.test(token)) return true
  if (/^[\p{Script=Han}·]{2,8}(?:\([A-Za-z][A-Za-z ._'’\-]{0,20}\))?$/u.test(token)) return true
  return false
}

function inferNaturalPersonaName(value: string) {
  const raw = stripUserMarker(value)
    .replace(/^\s*(?:\[(?:用户|user)\]\s*)/i, '')
    .replace(/^\s*[\[{（【]\s*/, '')
  const labeled = raw.match(/(?:^|\n)\s*(?:姓名|名字|本名|现代名|穿越后身份名)\s*[:：]\s*(?!\{\{user\}\})([^,，。；;\n<]{1,30})/iu)?.[1]?.trim()
  if (labeled) return labeled
  const explicit = raw.match(/^\s*(?:我(?:是|叫|名为)|是)\s*[\[{（【]?\s*([^,，。；;\n}\]）】]{1,30})/u)?.[1]?.trim()
  if (explicit && !/^\{\{user\}\}$/i.test(explicit)) return explicit
  const first = raw.match(/^\s*([^,，。；;\n:：{}\[\]（）【】]{1,30})\s*[,，]/u)?.[1]?.trim()
  if (first && looksLikePersonaNameToken(first) && looksLikeDirectPersonaLine(raw)) return first
  return ''
}

function inferNaturalPersonaIdentity(value: string, explicitName = '') {
  const raw = stripUserMarker(value)
  const firstLine = raw.split('\n')[0] || raw
  const segments = firstLine
    .replace(/^\s*(?:我(?:是|叫|名为)|是)\s*/u, '')
    .replace(/^\s*[\[{（【]|[}\]）】]\s*$/g, '')
    .split(/[,，。；;.]/)
    .map(item => item.trim())
    .filter(Boolean)
  const identitySignals = /(?:学生|新生|研究生|本科生|徒弟|弟子|剑修|杀手|记者|幼师|插画师|演员|导演|助理|医生|教师|律师|老板|店主|妻子|丈夫|老公|老婆|继承人|军人|警察|少爷|小姐|家主|修士|身份|职业)/
  return segments
    .filter(item => item !== explicitName)
    .filter(item => !/^(?:男|女)$/.test(item))
    .filter(item => !/^\d{1,3}\s*岁$/.test(item))
    .filter(item => !/^\d{2,3}(?:\.\d+)?\s*(?:cm|厘米)$/i.test(item))
    .filter(item => !/\{\{user\}\}/i.test(item))
    .filter(item => !/(?:提供|因为|所以|已经|曾经|当前|现在|希望|要求|不可|不能|为了)/u.test(item))
    .filter(item => identitySignals.test(item))
    .slice(0, 3)
    .join('、')
}

function extractIndentedUserBlock(lines: string[], markerIndex: number, baseIndent: number, inlineValue = '') {
  const collected: string[] = []
  if (inlineValue.trim()) collected.push(inlineValue.trim())

  for (let index = markerIndex + 1; index < lines.length; index++) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      if (collected.length) collected.push('')
      continue
    }
    if (/^(?:[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|\d+[.)、]|[-*•·#>]*)?\s*\{\{char\}\}\s*[:：]?/iu.test(trimmed)) break
    const indent = line.match(/^\s*/)?.[0].length ?? 0
    const looksLikeField = /^(?:[-*•·]\s*)?(?:姓名|名字|年龄|性别|生日|身高|体重|职业|工作|身份|外貌|性格|背景|经历|关系|爱好|兴趣|习惯|边界|住址|住所)\s*[:：]/u.test(trimmed)
    if (indent <= baseIndent && !looksLikeField) break
    collected.push(indent > baseIndent ? line.slice(Math.min(line.length, baseIndent + 1)).trimEnd() : trimmed)
  }

  return collected.join('\n').trim()
}

/**
 * 从任意社区角色卡文本字段中寻找“独立 {{user}} Persona”。
 * 这里只接受明确的人设声明，不把普通剧情里的 {{user}} 行为句误当 Persona。
 */
export function extractEmbeddedUserTemplate(sourceText: string): string {
  const lines = sourceText.replace(/\r/g, '').split('\n')
  const candidates: Array<{ raw: string; score: number }> = []

  for (let markerIndex = 0; markerIndex < lines.length; markerIndex++) {
    const line = lines[markerIndex] ?? ''
    const markerAt = line.search(/\{\{user\}\}/i)
    if (markerAt < 0) continue
    const tail = line.slice(markerAt)
    const indent = line.match(/^\s*/)?.[0].length ?? 0

    const block = tail.match(/^\{\{user\}\}\s*[:：]\s*(.*)$/i)
    if (block) {
      const raw = `{{user}}:${block[1]?.trim() ? ` ${block[1].trim()}` : ''}${extractIndentedUserBlock(lines, markerIndex, indent, '').replace(/^/, block[1]?.trim() ? '\n' : '')}`.trim()
      if (raw && raw !== '{{user}}:' && looksLikePersonaTemplateContent(stripUserMarker(raw))) {
        candidates.push({ raw, score: 120 })
      }
      continue
    }

    const direct = tail.replace(/^\{\{user\}\}\s*(?:\[(?:用户|user)\]\s*)?/i, '').trim()
    const explicitDeclaration = /^(?:我(?:是|叫|名为)|姓名\s*[:：]|名字\s*[:：])/u.test(direct)
    const structuredIsDeclaration = /^是\s*[\[{（【]/u.test(direct) && looksLikeDirectPersonaLine(direct)
    const bareMatch = direct.match(/^(?:是\s*)?([^,，。；;\n]{1,30})[,，]/u)
    const directNameProfile = Boolean(bareMatch?.[1] && looksLikePersonaNameToken(bareMatch[1]) && looksLikeDirectPersonaLine(direct.slice(0, 180)))
    if (explicitDeclaration || structuredIsDeclaration || directNameProfile) {
      candidates.push({ raw: tail.trim(), score: explicitDeclaration ? 140 : structuredIsDeclaration ? 135 : 125 })
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0]?.raw || ''
}

export function parseEmbeddedUserPersonaTemplate(rawTemplate: string, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const cleanTemplate = rawTemplate.trim()
  if (!cleanTemplate) return undefined

  const personaText = stripUserMarker(cleanTemplate)
  const readablePersonaText = personaText || stripPersonaMarkup(cleanTemplate)
  const preview = parsePersonaText(readablePersonaText || cleanTemplate, `${characterName} · 原卡用户.txt`)
  const fallbackName = `${characterName} · 原卡用户`

  const explicitName = inferNaturalPersonaName(cleanTemplate)
  if (explicitName) preview.patch.name = explicitName
  else if (!preview.patch.name || preview.patch.name === '导入的人设' || preview.patch.name === `${characterName} · 原卡用户`) {
    preview.patch.name = fallbackName
  }

  if (!preview.patch.age) {
    const age = readablePersonaText.match(/(?:^|[,，。；;.\s])(?:年龄\s*[:：]\s*)?(\d{1,3})\s*岁(?:[,，。；;.\s]|$)/u)?.[1]
    if (age) preview.patch.age = age
  }
  if (!preview.patch.gender) {
    const gender = readablePersonaText.match(/(?:^|[,，。；;\s])(?:性别\s*[:：]\s*)?(男|女)(?:[,，。；;\s]|$)/u)?.[1]
    if (gender) preview.patch.gender = gender
  }
  if (!preview.patch.height) {
    const height = readablePersonaText.match(/(?:^|[,，。；;.\s])(?:身高\s*[:：]\s*)?(\d{2,3}(?:\.\d+)?)\s*(cm|厘米)(?:[,，。；;.\s]|$)/iu)
    if (height) preview.patch.height = `${height[1]}${height[2].toLowerCase() === 'cm' ? 'cm' : '厘米'}`
  }

  const inferredIdentity = inferNaturalPersonaIdentity(cleanTemplate, explicitName)
  if (!preview.patch.identity && inferredIdentity) preview.patch.identity = inferredIdentity

  preview.patch.description = readablePersonaText || cleanTemplate
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

export function buildEmbeddedUserPreview(sourceText: string, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const rawTemplate = extractEmbeddedUserTemplate(sourceText)
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
  const compactLabel = label.replace(/[\s_\-<>/\\]+/g, '')
  const content = asText(entry.content)

  // “user 的房间 / 座驾 / 衣橱 / NPC”等是世界资料，不是 Persona。
  if (/(?:personalroom|房间|住址|住所|居住|座驾|车辆|出行|衣橱|穿搭|单位|公司|npc|联系人|手机|相册|日记)/i.test(compactLabel)) return -100

  let score = 0
  if (/^(?:user|用户|\{\{user\}\})(?:人设|设定|persona|profile|人物设定|人物档案|基本情况|基本信息|档案)$/i.test(compactLabel)) score += 130
  if (/(?:user人设|用户人设|userpersona(?![a-z])|user设定|用户设定|user人物设定|用户人物设定|user基本情况|用户基本情况|user基本信息|用户基本信息|用户档案|\{\{user\}\}人设)/i.test(compactLabel)) score += 110
  if (/(?:user人设辅助|用户人设辅助|userprofile(?![a-z])|关于user$|关于用户$)/i.test(compactLabel)) score += 85
  if (/^\s*\{\{user\}\}/i.test(content)) score += 35
  if (/^\s*(?:\[(?:用户|user)\]\s*)?\{\{user\}\}\s*(?:\[(?:用户|user)\]\s*)?(?:我(?:是|叫|名为)|是|姓名\s*[:：])/i.test(content)) score += 45
  if (looksLikeNaturalPersona(stripPersonaMarkup(content))) score += 25
  if (/(?:姓名|年龄|性别|身高|职业|身份)\s*[:：]/u.test(stripPersonaMarkup(content))) score += 15
  return score
}

export function buildEmbeddedUserPreviewFromCharacterBook(value: unknown, characterName = '角色'): (ImportedPersonaPreview & { rawTemplate: string }) | undefined {
  const candidates = characterBookEntryRows(value)
    .map(entry => ({ entry, score: userPersonaEntryScore(entry) }))
    .filter(item => item.score >= 80)
    .sort((a, b) => b.score - a.score)
  const content = candidates.length ? asText(candidates[0].entry.content) : ''
  return parseEmbeddedUserPersonaTemplate(content, characterName)
}

function objectPersonaTemplate(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value)) return value.map(item => objectPersonaTemplate(item)).filter(Boolean).join('\n')
  return Object.entries(asRecord(value))
    .map(([key, item]) => {
      if (item == null || item === '') return ''
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return `${key}: ${String(item)}`
      return `${key}: ${objectPersonaTemplate(item)}`
    })
    .filter(Boolean)
    .join('\n')
}

function buildEmbeddedUserPreviewFromExtensions(extensions: Record<string, unknown>[], characterName: string) {
  const keys = [
    'ai_companion_embedded_user_template',
    'embedded_user_template',
    'embeddedUserTemplate',
    'user_persona',
    'userPersona',
    'user_profile',
    'userProfile'
  ]
  for (const ext of extensions) {
    for (const key of keys) {
      const raw = objectPersonaTemplate(ext[key])
      const preview = parseEmbeddedUserPersonaTemplate(raw, characterName)
      if (preview) return preview
    }
  }
  return undefined
}


function collectEmbeddedRegexRows(...records: Record<string, unknown>[]) {
  const rows: unknown[] = []
  const seenObjects = new Set<object>()
  const visit = (value: unknown, depth = 0) => {
    if (!value || depth > 3) return
    if (Array.isArray(value)) {
      const looksRegexArray = value.some(item => {
        const row = asRecord(item)
        return Boolean(row.findRegex ?? row.find_regex ?? row.regex ?? row.replaceString ?? row.replace_string)
      })
      if (looksRegexArray) rows.push(...value)
      else value.forEach(item => visit(item, depth + 1))
      return
    }
    if (typeof value !== 'object') return
    if (seenObjects.has(value as object)) return
    seenObjects.add(value as object)
    const record = value as Record<string, unknown>
    for (const [key, child] of Object.entries(record)) {
      if (/^(?:regex_scripts|regexScripts|regexes|regex)$/i.test(key)) visit(child, depth + 1)
      else if (/^(?:tavern_helper|tavernHelper|scripts|plugins|extensions)$/i.test(key)) visit(child, depth + 1)
    }
  }
  records.forEach(record => visit(record))
  return rows
}

function inferFormat(root: Record<string, unknown>) {
  const spec = asText(root.spec).toLowerCase()
  const specVersion = asText(root.spec_version ?? root.specVersion).toLowerCase()
  if (spec.includes('chara_card_v3')) return 'sillytavern-v3' as const
  if (spec.includes('chara_card_v2')) return 'sillytavern-v2' as const

  const data = asRecord(root.data)
  const characterSignals = [
    root.name, root.description, root.personality, root.first_mes, root.firstMessage, root.character_name, root.characterName,
    data.name, data.description, data.personality, data.first_mes, data.firstMessage, data.character_name, data.characterName
  ].some(value => Boolean(asText(value)))

  // 只有同时存在角色卡结构时才用 spec_version 推断 V2/V3；
  // 普通社区 JSON 的 `version: 2/3` 可能只是它自己的版本号，不能误判为 Tavern 角色卡版本。
  if (characterSignals && /^3(?:\.|$)/.test(specVersion)) return 'sillytavern-v3' as const
  if (characterSignals && /^2(?:\.|$)/.test(specVersion)) return 'sillytavern-v2' as const
  return characterSignals ? 'community-json' as const : 'legacy-json' as const
}

function firstDefined(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function extractData(root: Record<string, unknown>): CardPayload {
  const nested = asRecord(root.data)
  const source = { ...root, ...nested }
  return {
    name: firstDefined(source, ['name', 'character_name', 'characterName', 'char_name', 'display_name']),
    avatar: firstDefined(source, ['avatar', 'avatar_url', 'avatarUrl', 'image', 'portrait']),
    description: firstDefined(source, ['description', 'desc', 'character_description', 'characterDescription']),
    personality: firstDefined(source, ['personality', 'persona', 'character_persona', 'characterPersona']),
    scenario: firstDefined(source, ['scenario', 'setting', 'context', 'world_scenario']),
    first_mes: firstDefined(source, ['first_mes', 'first_message', 'firstMessage', 'greeting', 'initial_message']),
    mes_example: firstDefined(source, ['mes_example', 'example_dialogue', 'exampleDialogue', 'example_dialogues', 'examples']),
    alternate_greetings: firstDefined(source, ['alternate_greetings', 'alternateGreetings', 'greetings', 'swipes']),
    creator_notes: firstDefined(source, ['creator_notes', 'creatorNotes', 'notes']),
    system_prompt: firstDefined(source, ['system_prompt', 'systemPrompt']),
    post_history_instructions: firstDefined(source, ['post_history_instructions', 'postHistoryInstructions', 'post_history']),
    tags: firstDefined(source, ['tags', 'labels']),
    creator: firstDefined(source, ['creator', 'author']),
    character_version: firstDefined(source, ['character_version', 'characterVersion', 'version']),
    extensions: firstDefined(source, ['extensions', 'extension']),
    character_book: firstDefined(source, ['character_book', 'characterBook', 'world_book', 'worldBook', 'lorebook', 'lore_book']),
    group_only_greetings: firstDefined(source, ['group_only_greetings', 'groupOnlyGreetings'])
  }
}

function parseCharacterBook(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  try {
    const normalized = Array.isArray(value) ? { entries: value } : value
    return parseLorebookJson(JSON.stringify(normalized), '角色卡内嵌世界书.json')
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
  const sourceSpec = asText(record.spec) || undefined
  const sourceSpecVersion = asText(record.spec_version ?? record.specVersion) || undefined
  const nestedData = asRecord(record.data)
  const knownDataKeys = new Set([
    'name', 'avatar', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'alternate_greetings',
    'creator_notes', 'system_prompt', 'post_history_instructions', 'tags', 'creator', 'character_version', 'extensions',
    'character_book', 'group_only_greetings'
  ])
  const unknownData = Object.fromEntries(Object.entries(nestedData).filter(([key]) => !knownDataKeys.has(key)))
  const rootMetadata = Object.fromEntries(Object.entries(record).filter(([key]) => !['spec', 'spec_version', 'specVersion', 'data', 'extensions'].includes(key)))
  const rawCardExtensions = JSON.parse(JSON.stringify({
    dataExtensions: extensions,
    rootExtensions,
    unknownData,
    rootMetadata,
    originalAvatar: asText(data.avatar ?? record.avatar) || undefined,
    sourceSpec,
    sourceSpecVersion
  })) as Record<string, unknown>
  const notes: string[] = []

  if (!asText(data.name) && !description && !personality) {
    throw new Error('没有找到角色姓名、描述或性格。请确认选择的是角色卡，而不是预设、世界书或正则 JSON。')
  }

  const parsedCharacterBook = parseCharacterBook(data.character_book)
  const lorebookEntries = parsedCharacterBook?.entries || []
  const lorebookName = parsedCharacterBook?.lorebook.name === '角色卡内嵌世界书' ? undefined : parsedCharacterBook?.lorebook.name || undefined
  const lorebookResource = parsedCharacterBook?.lorebook
  let regexScripts: Array<Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>> = []
  const embeddedRegexRows = collectEmbeddedRegexRows(extensions, rootExtensions)
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
  const embeddedUserSources = [
    { label: '角色扩展 user Persona', preview: buildEmbeddedUserPreviewFromExtensions([rootExtensions, extensions], characterName) },
    { label: '内嵌世界书 user 人设条目', preview: buildEmbeddedUserPreviewFromCharacterBook(data.character_book, characterName) },
    { label: '角色 description', preview: buildEmbeddedUserPreview(description, characterName) },
    { label: '角色 scenario', preview: buildEmbeddedUserPreview(asText(data.scenario), characterName) },
    { label: '角色 creator_notes', preview: buildEmbeddedUserPreview(asText(data.creator_notes), characterName) },
    { label: '角色 system_prompt', preview: buildEmbeddedUserPreview(asText(data.system_prompt), characterName) },
    { label: '角色 post_history_instructions', preview: buildEmbeddedUserPreview(asText(data.post_history_instructions), characterName) }
  ]
  const embeddedUserCandidate = embeddedUserSources.find(item => Boolean(item.preview))
  const embeddedUser = embeddedUserCandidate?.preview
  const hasUserPlaceholder = [
    description,
    asText(data.scenario),
    asText(data.first_mes),
    asText(data.mes_example),
    asText(data.creator_notes),
    asText(data.system_prompt),
    asText(data.post_history_instructions),
    JSON.stringify(data.character_book || {}),
    JSON.stringify(extensions || {}),
    JSON.stringify(rootExtensions || {})
  ].some(value => /\{\{user\}\}/i.test(value))
  const inferredRelationship = inferRelationshipFromCard(asText(data.first_mes), embeddedUser)
  const characterIntroduction = buildImportedCharacterIntroduction(description, personality)
  const patch: Partial<Character> = {
    name: asText(data.name) || undefined,
    avatar: importableAvatar(data.avatar ?? record.avatar),
    relationship: inferredRelationship,
    // 无法可靠拆分成‘说话方式/背景故事’时，不猜字段；保留一份完整角色介绍用于展示与手动补充。
    persona: characterIntroduction || undefined,
    cardDescription: description || undefined,
    cardPersonality: personality || undefined,
    scenario: asText(data.scenario) || undefined,
    firstMessage: asText(data.first_mes) || undefined,
    alternateGreetings: asStringArray(data.alternate_greetings),
    exampleDialogues: extractDialogue(data.mes_example),
    creatorNotes: asText(data.creator_notes) || undefined,
    systemPrompt: asText(data.system_prompt) || undefined,
    postHistoryInstructions: asText(data.post_history_instructions) || undefined,
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
    cardVersion: format === 'sillytavern-v3' ? 3 : format === 'sillytavern-v2' ? 2 : sourceSpecVersion || undefined,
    sourceSpec,
    sourceSpecVersion
  }

  if (format === 'legacy-json') notes.push('已按旧版 JSON 字段导入，部分扩展字段可能无法识别。')
  if (!patch.exampleDialogues?.length) notes.push('角色卡没有可识别的示例对话。')
  if (!patch.firstMessage) notes.push('角色卡没有开场白。')
  if (inferredRelationship) notes.push(`从角色卡明确状态/用户设定识别到与用户关系：${inferredRelationship}。`)
  if (lorebookEntries.length) notes.push(`检测到内嵌角色世界书 ${lorebookEntries.length} 条：将导入共享资源库，并默认绑定当前角色；之后可给其它角色复用。`)
  if (embeddedUser) {
    const sourceLabel = embeddedUserCandidate?.label || '角色卡'
    notes.push(`检测到${sourceLabel}中的独立 {{user}} 用户模板，可直接生成角色专属 Persona 并自动绑定聊天。`)
  } else if (hasUserPlaceholder) {
    notes.push('检测到 {{user}} 剧情占位，但没有可安全提取的独立用户姓名/Persona：不会猜名字；运行时使用当前聊天 Persona，角色卡与世界书中的剧情关系仍按本会话设定生效。')
  }
  if (regexScripts.length) notes.push(`检测到内嵌正则 ${regexScripts.length} 条：将导入共享资源库，并默认绑定当前角色；之后可给其它角色复用。`)
  if (depthPrompt) notes.push('检测到 depth_prompt，将按角色卡扩展提示参与运行时 Prompt。')
  if (talkativeness != null) notes.push(`检测到 talkativeness=${talkativeness}，已保留原始数值供兼容运行时使用。`)
  if (worldBookHint) notes.push(`检测到角色卡 world 绑定提示“${worldBookHint}”，已保留供资源兼容与后续绑定。`)
  if (asRecord(extensions.tavern_helper).scripts || asRecord(rootExtensions.tavern_helper).scripts) {
    notes.push('检测到 tavern_helper / JavaScript 扩展：已无损归档，但不会执行第三方 JS。')
  }
  if (asText(data.avatar ?? record.avatar) && !patch.avatar) notes.push('角色卡头像是外部相对路径；JSON 未携带图片文件，已保留原路径但不会显示成损坏头像。')

  return { format, patch, lorebookEntries, lorebookName, lorebookResource, regexScripts, embeddedUser, notes, rawSourceJson: value }
}

function decodeBase64Utf8(value: string) {
  try {
    const binary = atob(value.replace(/\s+/g, ''))
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

async function inflatePngText(bytes: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') return ''
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
    return await new Response(stream).text()
  } catch {
    return ''
  }
}

async function extractPngCharacterJson(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (signature.some((value, index) => bytes[index] !== value)) throw new Error('PNG 文件头无效。')
  const decoder = new TextDecoder()
  const candidates: Array<{ keyword: string; text: string }> = []
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8))
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    if (dataEnd + 4 > bytes.length) break
    const data = bytes.slice(dataStart, dataEnd)
    if (type === 'tEXt') {
      const zero = data.indexOf(0)
      if (zero > 0) candidates.push({ keyword: decoder.decode(data.slice(0, zero)), text: decoder.decode(data.slice(zero + 1)) })
    } else if (type === 'zTXt') {
      const zero = data.indexOf(0)
      if (zero > 0 && zero + 2 <= data.length) {
        const text = await inflatePngText(data.slice(zero + 2))
        if (text) candidates.push({ keyword: decoder.decode(data.slice(0, zero)), text })
      }
    } else if (type === 'iTXt') {
      let cursor = data.indexOf(0)
      if (cursor > 0 && cursor + 3 < data.length) {
        const keyword = decoder.decode(data.slice(0, cursor))
        const compressed = data[cursor + 1] === 1
        cursor += 3
        const languageEnd = data.indexOf(0, cursor)
        if (languageEnd >= 0) {
          cursor = languageEnd + 1
          const translatedEnd = data.indexOf(0, cursor)
          if (translatedEnd >= 0) {
            cursor = translatedEnd + 1
            const payload = data.slice(cursor)
            const text = compressed ? await inflatePngText(payload) : decoder.decode(payload)
            if (text) candidates.push({ keyword, text })
          }
        }
      }
    }
    offset = dataEnd + 4
    if (type === 'IEND') break
  }

  const prioritized = candidates.sort((a, b) => {
    const score = (item: { keyword: string; text: string }) => /^(?:chara|ccv3|character|card)$/i.test(item.keyword.trim()) ? 2 : /chara|character|card/i.test(item.keyword) ? 1 : 0
    return score(b) - score(a)
  })
  for (const candidate of prioritized) {
    const direct = candidate.text.trim()
    const attempts = [direct, decodeBase64Utf8(direct)].filter(Boolean)
    for (const text of attempts) {
      try {
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return text
      } catch {
        // 继续尝试其它 metadata chunk。
      }
    }
  }
  throw new Error('PNG 中没有找到可识别的角色卡 JSON 元数据。')
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error || new Error('读取角色卡图片失败。'))
    reader.readAsDataURL(file)
  })
}

function characterNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.(?:json|png)$/i, '')
    .replace(/^Tavo[_\s-]*/i, '')
    .replace(/[_\s-]*\d{8}T?\d{4,6}(?:\(\d+\))?$/i, '')
    .trim()
}

function applyFileNameFallback(parsed: ImportedCharacterCard, fileName: string): ImportedCharacterCard {
  if (parsed.patch.name?.trim()) return parsed
  const fallbackName = characterNameFromFile(fileName)
  return fallbackName ? { ...parsed, patch: { ...parsed.patch, name: fallbackName } } : parsed
}

export async function parseCharacterCardFile(file: File) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.json')) return applyFileNameFallback(parseCharacterCardJson(await file.text()), file.name)
  if (lower.endsWith('.png')) {
    const parsed = applyFileNameFallback(parseCharacterCardJson(await extractPngCharacterJson(file)), file.name)
    const embeddedAvatar = await fileToDataUrl(file)
    return {
      ...parsed,
      format: 'png-character-card' as const,
      patch: {
        ...parsed.patch,
        avatar: embeddedAvatar || parsed.patch.avatar,
        importFormat: 'png-character-card' as const
      },
      notes: [
        '从 PNG 角色卡 metadata 读取到嵌入 JSON。',
        embeddedAvatar ? 'PNG 卡面已作为角色头像保存。' : '',
        ...parsed.notes
      ].filter(Boolean)
    }
  }
  throw new Error('请选择 JSON 或带角色卡 metadata 的 PNG 文件。')
}

export function exportCharacterAsSillyTavernV2(character: Character, resources: { lorebook?: LorebookResource; lorebookEntries?: LorebookEntry[]; regexScripts?: RegexScript[] } = {}) {
  const stored = asRecord(character.rawCardExtensions)
  const storedDataExtensions = asRecord(stored.dataExtensions ?? stored.data)
  const storedRootExtensions = asRecord(stored.rootExtensions ?? stored.root)
  const unknownData = asRecord(stored.unknownData)
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

  if (resources.regexScripts?.length) {
    extensions.regex_scripts = resources.regexScripts.map(script => ({
      ...(script.raw || {}),
      scriptName: script.name,
      findRegex: script.findRegex,
      replaceString: script.replaceString,
      trimStrings: script.trimStrings,
      placement: script.placement,
      disabled: !script.enabled,
      markdownOnly: script.markdownOnly,
      promptOnly: script.promptOnly,
      runOnEdit: script.runOnEdit,
      substituteRegex: script.substituteRegex,
      minDepth: script.minDepth,
      maxDepth: script.maxDepth
    }))
  }

  const characterBook = resources.lorebookEntries?.length
    ? {
      ...(resources.lorebook?.rawExtensions || {}),
      name: resources.lorebook?.name || `${character.name} · Lorebook`,
      description: resources.lorebook?.description || '',
      scan_depth: resources.lorebook?.scanDepth,
      token_budget: resources.lorebook?.tokenBudget,
      recursive_scanning: resources.lorebook?.recursiveScanning,
      entries: resources.lorebookEntries.map(entry => ({
        ...(entry.rawExtensions || {}),
        id: entry.sourceEntryId,
        name: entry.title,
        keys: entry.keywords,
        secondary_keys: entry.secondaryKeys || [],
        content: entry.content,
        enabled: entry.enabled,
        constant: entry.constant,
        case_sensitive: entry.caseSensitive,
        matchWholeWords: entry.matchWholeWords,
        use_regex: entry.useRegex,
        selective: entry.selective,
        selectiveLogic: entry.selectiveLogic,
        priority: entry.priority,
        insertion_order: entry.insertionOrder,
        position: entry.position,
        depth: entry.depth,
        role: entry.role,
        probability: entry.probability,
        useProbability: entry.useProbability,
        sticky: entry.sticky,
        cooldown: entry.cooldown,
        delay: entry.delay,
        group: entry.group,
        groupOverride: entry.groupOverride,
        groupWeight: entry.groupWeight,
        scanDepth: entry.scanDepth,
        excludeRecursion: entry.excludeRecursion,
        preventRecursion: entry.preventRecursion,
        delayUntilRecursion: entry.delayUntilRecursion,
        useGroupScoring: entry.useGroupScoring,
        matchPersonaDescription: entry.matchPersonaDescription,
        matchCharacterDescription: entry.matchCharacterDescription,
        matchCharacterPersonality: entry.matchCharacterPersonality,
        matchCharacterDepthPrompt: entry.matchCharacterDepthPrompt,
        matchScenario: entry.matchScenario,
        matchCreatorNotes: entry.matchCreatorNotes
      }))
    }
    : undefined

  const embeddedUserBlock = character.embeddedUserTemplate?.trim()
    ? /\{\{user\}\}/i.test(character.embeddedUserTemplate)
      ? character.embeddedUserTemplate.trim()
      : `{{user}}:\n${character.embeddedUserTemplate.split('\n').map(line => `  ${line}`).join('\n')}`
    : ''

  return JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      ...unknownData,
      name: character.name,
      avatar: character.avatar || asText(stored.originalAvatar) || '',
      description: character.cardDescription || [
        character.identity ? `身份：${character.identity}` : '',
        character.appearance ? `外貌：${character.appearance}` : '',
        character.background ? `背景：${character.background}` : '',
        character.values ? `价值观：${character.values}` : '',
        character.habits ? `习惯：${character.habits}` : '',
        character.boundaries ? `边界：${character.boundaries}` : '',
        embeddedUserBlock
      ].filter(Boolean).join('\n'),
      personality: character.cardPersonality || character.persona,
      scenario: character.scenario || '',
      first_mes: character.firstMessage || '',
      mes_example: (character.exampleDialogues || [])
        .map(item => `{{user}}: ${item.user}\n{{char}}: ${item.assistant}`)
        .join('\n<START>\n'),
      creator_notes: character.creatorNotes || '',
      system_prompt: character.systemPrompt || '',
      post_history_instructions: character.postHistoryInstructions || '',
      character_book: characterBook,
      alternate_greetings: character.alternateGreetings || [],
      group_only_greetings: character.groupOnlyGreetings || [],
      tags: character.tags || [],
      creator: character.creator || '',
      character_version: character.resourceVersion || '',
      extensions
    }
  }, null, 2)
}
