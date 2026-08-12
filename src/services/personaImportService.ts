import type { PersonaImportFormat, UserPersona } from '../types/domain'

export type ResourceKind =
  | 'persona'
  | 'character-card-v2'
  | 'character-card-v3'
  | 'world-book'
  | 'preset'
  | 'regex'
  | 'unknown'

export interface ResourceRecognition {
  kind: ResourceKind
  label: string
  details: string[]
}

export interface ImportedPersonaPreview {
  format: PersonaImportFormat
  recognition: ResourceRecognition
  patch: Partial<UserPersona> & Pick<UserPersona, 'name'>
  notes: string[]
  mappedFields: string[]
  preservedExtraKeys: string[]
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const stringList = (value: unknown) => Array.isArray(value)
  ? Array.from(new Set(value.map(text).filter(Boolean)))
  : typeof value === 'string'
    ? value.split(/[,，、\n]/).map(item => item.trim()).filter(Boolean)
    : []

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const pickText = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = text(source[key])
    if (value) return value
  }
  return ''
}

export function recognizeJsonResource(value: unknown): ResourceRecognition {
  if (!isRecord(value)) return { kind: 'unknown', label: '未知 JSON', details: [] }
  if (value.spec === 'ai_companion_persona') {
    return { kind: 'persona', label: 'AI Companion Persona', details: [`版本 ${text(value.spec_version) || '未知'}`] }
  }
  if (value.spec === 'chara_card_v3') {
    const data = isRecord(value.data) ? value.data : {}
    return { kind: 'character-card-v3', label: 'Character Card V3', details: [pickText(data, ['name'])].filter(Boolean) }
  }
  if (value.spec === 'chara_card_v2') {
    const data = isRecord(value.data) ? value.data : {}
    return { kind: 'character-card-v2', label: 'Character Card V2', details: [pickText(data, ['name'])].filter(Boolean) }
  }
  if ('entries' in value && (Array.isArray(value.entries) || isRecord(value.entries))) {
    const count = Array.isArray(value.entries) ? value.entries.length : Object.keys(value.entries as object).length
    return { kind: 'world-book', label: '世界书 / Lorebook', details: [`${count} 条条目`] }
  }
  if (Array.isArray(value.prompts) || Array.isArray(value.prompt_order) || 'openai_max_context' in value || 'temperature' in value) {
    return { kind: 'preset', label: 'Prompt / 模型预设', details: [] }
  }
  if (Array.isArray(value.regex_scripts) || ('findRegex' in value && 'replaceString' in value)) {
    return { kind: 'regex', label: '正则脚本', details: [] }
  }
  const personaSignals = ['name', 'description', 'persona', 'personality', 'appearance', 'background', 'identity', 'occupation']
  if (personaSignals.some(key => key in value)) {
    return { kind: 'persona', label: '通用 Persona JSON', details: [] }
  }
  return { kind: 'unknown', label: '未知 JSON', details: [] }
}

const knownPersonaKeys = new Set([
  'id','name','avatar','title','description','persona','identity','age','gender','birthday','height','occupation','job','profession',
  'appearance','looks','personality','traits','publicPersona','privatePersona','strengths','weaknesses','interests','likes','habits',
  'lifestyle','background','relationshipNote','relationship','characterKnowledge','knownByCharacter','boundaries','limits','tags','creator',
  'sourceUrl','source_url','source','isDefault','createdAt','updatedAt','extraFields','importFormat','sourceFileName',
  '姓名','名字','年龄','性别','生日','身高','职业','工作','身份','外貌','五官特征','发型与装扮','体态','性格','性格细化','核心性格',
  '公开表现','工作状态','私下表现','优点','缺点','兴趣','爱好','习惯','生活状态','背景','经历','关系','角色已知','边界','禁忌'
])

function collectExtras(source: Record<string, unknown>) {
  const nested = isRecord(source.extraFields) ? source.extraFields : {}
  return {
    ...nested,
    ...Object.fromEntries(Object.entries(source).filter(([key, value]) => !knownPersonaKeys.has(key) && value !== undefined && value !== ''))
  }
}

function richText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(item => richText(item)).filter(Boolean).join('\n')
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) => {
      const body = richText(item)
      return body ? `${key}：${body}` : ''
    }).filter(Boolean).join('\n')
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const pickRichText = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = richText(source[key])
    if (value) return value
  }
  return ''
}

function mapGenericPersona(source: Record<string, unknown>, fallbackName = '导入的人设') {
  const description = pickRichText(source, ['description', 'persona', 'profile', 'bio', '完整描述', '人设'])
  const occupation = pickRichText(source, ['occupation', 'profession', 'job', '职业', '工作'])
  const patch: ImportedPersonaPreview['patch'] = {
    name: pickText(source, ['name', 'user_name', 'username', 'title']) || fallbackName,
    avatar: pickText(source, ['avatar', 'emoji']) || '🧑',
    title: pickText(source, ['title', 'persona_title']) || undefined,
    description: description || undefined,
    identity: pickRichText(source, ['identity', 'role', '身份']) || undefined,
    age: pickRichText(source, ['age', '年龄']) || undefined,
    gender: pickRichText(source, ['gender', 'sex', '性别']) || undefined,
    birthday: pickRichText(source, ['birthday', 'birthdate', '生日']) || undefined,
    height: pickRichText(source, ['height', '身高']) || undefined,
    occupation: occupation || undefined,
    appearance: pickRichText(source, ['appearance', 'looks', 'appearanceDescription', '外貌', '五官特征', '发型与装扮', '体态']) || undefined,
    personality: pickRichText(source, ['personality', 'traits', 'character', '性格', '性格细化', '核心性格']) || undefined,
    publicPersona: pickRichText(source, ['publicPersona', 'public_persona', '公开表现', '工作状态']) || undefined,
    privatePersona: pickRichText(source, ['privatePersona', 'private_persona', '私下表现']) || undefined,
    strengths: pickRichText(source, ['strengths', 'advantages', '优点']) || undefined,
    weaknesses: pickRichText(source, ['weaknesses', 'flaws', 'disadvantages', '缺点']) || undefined,
    interests: pickRichText(source, ['interests', 'likes', 'hobbies', '兴趣', '爱好']) || undefined,
    habits: pickRichText(source, ['habits', '习惯']) || undefined,
    lifestyle: pickRichText(source, ['lifestyle', 'dailyLife', '生活状态']) || undefined,
    background: pickRichText(source, ['background', 'history', 'backstory', '背景', '经历']) || undefined,
    relationshipNote: pickRichText(source, ['relationshipNote', 'relationship', 'relationship_note', '关系']) || undefined,
    characterKnowledge: pickRichText(source, ['characterKnowledge', 'knownByCharacter', 'character_knowledge', '角色已知']) || undefined,
    boundaries: pickRichText(source, ['boundaries', 'limits', 'boundary', '边界', '禁忌']) || undefined,
    tags: stringList(source.tags),
    creator: pickText(source, ['creator', 'author']) || undefined,
    sourceUrl: pickText(source, ['sourceUrl', 'source_url', 'source']) || undefined,
    extraFields: collectExtras(source)
  }
  return patch
}

function parseNative(root: Record<string, unknown>): ImportedPersonaPreview {
  const data = isRecord(root.data) ? root.data : root
  const patch = mapGenericPersona(data)
  const version = text(root.spec_version)
  const format: PersonaImportFormat = version.startsWith('2') ? 'native-v2' : 'native-v1'
  return finalize(format, recognizeJsonResource(root), patch, [], data)
}

function parseCharacterCard(root: Record<string, unknown>): ImportedPersonaPreview {
  const data = isRecord(root.data) ? root.data : root
  const recognition = recognizeJsonResource(root)
  const description = text(data.description)
  const personality = text(data.personality)
  const creator = text(data.creator)
  const extensions = isRecord(data.extensions) ? data.extensions : {}
  const patch: ImportedPersonaPreview['patch'] = {
    name: text(data.name) || '从角色卡导入的人设',
    avatar: '🧑',
    description: description || undefined,
    personality: personality || undefined,
    background: text(data.scenario) || undefined,
    tags: stringList(data.tags),
    creator: creator || undefined,
    sourceUrl: pickText(extensions, ['source_url', 'sourceUrl']) || undefined,
    extraFields: {
      originalCharacterCard: {
        creator_notes: data.creator_notes,
        system_prompt: data.system_prompt,
        post_history_instructions: data.post_history_instructions,
        alternate_greetings: data.alternate_greetings,
        character_book: data.character_book,
        extensions: data.extensions
      }
    }
  }
  const format: PersonaImportFormat = root.spec === 'chara_card_v3'
    ? 'sillytavern-character-v3'
    : 'sillytavern-character-v2'
  const notes = [
    '检测到的是角色卡，不是专门的用户 Persona。已按“导入为用户人设”模式映射；导入前请检查预览。',
    '角色卡中的开场白、示例对话和系统提示不会直接注入用户 Persona；原始扩展内容会保存在“其他设定”中，避免丢失。'
  ]
  return finalize(format, recognition, patch, notes, data)
}

function finalize(
  format: PersonaImportFormat,
  recognition: ResourceRecognition,
  patch: ImportedPersonaPreview['patch'],
  notes: string[],
  source: Record<string, unknown>
): ImportedPersonaPreview {
  const mappedFields = Object.entries(patch)
    .filter(([key, value]) => key !== 'extraFields' && value !== undefined && value !== '' && (!Array.isArray(value) || value.length))
    .map(([key]) => key)
  const extra = isRecord(patch.extraFields) ? patch.extraFields : collectExtras(source)
  patch.extraFields = Object.keys(extra).length ? extra : undefined
  return {
    format,
    recognition,
    patch,
    notes,
    mappedFields,
    preservedExtraKeys: patch.extraFields ? Object.keys(patch.extraFields) : []
  }
}

export function parsePersonaJson(value: string): ImportedPersonaPreview {
  let root: unknown
  try { root = JSON.parse(value) } catch { throw new Error('文件不是有效的 JSON。') }
  if (!isRecord(root)) throw new Error('Persona JSON 顶层必须是对象。')
  const recognition = recognizeJsonResource(root)
  if (recognition.kind === 'world-book' || recognition.kind === 'preset' || recognition.kind === 'regex') {
    throw new Error(`检测到“${recognition.label}”，这不是用户 Persona。请不要导入到用户人设。`)
  }
  if (root.spec === 'ai_companion_persona') return parseNative(root)
  if (root.spec === 'chara_card_v2' || root.spec === 'chara_card_v3') return parseCharacterCard(root)

  const data = isRecord(root.data) ? root.data : root
  const patch = mapGenericPersona(data)
  if (!patch.name && !patch.description && !patch.personality) throw new Error('没有找到可识别的用户人设字段。')
  const looksTavo = /tavo/i.test(text(root.app) + text(root.source) + text(root.generator)) || 'character_book' in data
  return finalize(looksTavo ? 'tavo-json' : 'generic-json', recognition, patch, [], data)
}

function normalizeQuotes(value: string) {
  return value.trim().replace(/^['\"]|['\"]$/g, '').trim()
}

function parseLabelValue(raw: string, labels: string[]) {
  for (const label of labels) {
    const match = raw.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:：]\\s*["']?([^\\n"']+)["']?`, 'i'))
    if (match?.[1]) return normalizeQuotes(match[1])
  }
  return ''
}

function extractIndentedBlock(raw: string, headingLabels: string[]) {
  const lines = raw.replace(/\r/g, '').split('\n')
  for (let index = 0; index < lines.length; index++) {
    const trimmed = lines[index].trim()
    if (!headingLabels.some(label => trimmed === `${label}:` || trimmed === `${label}：`)) continue
    const baseIndent = lines[index].match(/^\s*/)?.[0].length ?? 0
    const values: string[] = []
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor]
      if (!line.trim()) continue
      const indent = line.match(/^\s*/)?.[0].length ?? 0
      if (indent <= baseIndent && /[:：]\s*$/.test(line.trim())) break
      if (indent <= baseIndent && !/^[-*]/.test(line.trim())) break
      const cleaned = line.trim().replace(/^[-*]\s*/, '').replace(/^['\"]|['\"]$/g, '')
      if (cleaned) values.push(cleaned)
    }
    if (values.length) return values.join('\n')
  }
  return ''
}

export function parsePersonaText(value: string, sourceName = ''): ImportedPersonaPreview {
  const raw = value.trim()
  if (!raw) throw new Error('用户人设文本为空。')
  const name = parseLabelValue(raw, ['姓名', '名字', 'name']) || sourceName.replace(/\.(txt|md)$/i, '') || '导入的人设'
  const appearanceParts = [
    parseLabelValue(raw, ['体态']),
    extractIndentedBlock(raw, ['五官特征', '外貌', '外貌特征']),
    extractIndentedBlock(raw, ['发型与装扮', '穿着', '装扮'])
  ].filter(Boolean)
  const personalityParts = [
    extractIndentedBlock(raw, ['核心性格']),
    extractIndentedBlock(raw, ['工作状态']),
    extractIndentedBlock(raw, ['私下表现'])
  ].filter(Boolean)
  const patch: ImportedPersonaPreview['patch'] = {
    name,
    avatar: '🧑',
    description: raw,
    age: parseLabelValue(raw, ['年龄', 'age']) || undefined,
    gender: parseLabelValue(raw, ['性别', 'gender']) || undefined,
    birthday: parseLabelValue(raw, ['生日', 'birthday']) || undefined,
    height: parseLabelValue(raw, ['身高', 'height']) || undefined,
    occupation: parseLabelValue(raw, ['职业', '工作', 'occupation']) || undefined,
    identity: parseLabelValue(raw, ['身份', 'identity']) || undefined,
    appearance: appearanceParts.join('\n') || undefined,
    personality: personalityParts.join('\n') || undefined,
    strengths: extractIndentedBlock(raw, ['优点']) || undefined,
    weaknesses: extractIndentedBlock(raw, ['缺点']) || undefined,
    interests: extractIndentedBlock(raw, ['兴趣', '爱好']) || undefined,
    habits: extractIndentedBlock(raw, ['习惯']) || undefined,
    background: extractIndentedBlock(raw, ['背景', '经历']) || undefined,
    boundaries: extractIndentedBlock(raw, ['边界', '禁忌']) || undefined,
    extraFields: { rawText: raw }
  }
  const format: PersonaImportFormat = /tavo/i.test(sourceName) || /性格细化|五官特征|私下表现/.test(raw) ? 'tavo-text' : 'plain-text'
  return finalize(format, { kind: 'persona', label: format === 'tavo-text' ? 'Tavo / 酒馆文本人设' : '文本用户人设', details: [] }, patch, [
    '文本人设会保留完整原文，同时尽可能提取姓名、外貌、性格等结构化字段。'
  ], {})
}

async function decodeTextFile(file: File) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try { return new TextDecoder('gb18030').decode(bytes) } catch { return new TextDecoder().decode(bytes) }
  }
}

export async function parsePersonaFile(file: File): Promise<ImportedPersonaPreview> {
  const lower = file.name.toLowerCase()
  const raw = await decodeTextFile(file)
  const preview = lower.endsWith('.json') ? parsePersonaJson(raw) : parsePersonaText(raw, file.name)
  preview.patch.sourceFileName = file.name
  return preview
}

export function exportPersonaJson(persona: UserPersona) {
  return JSON.stringify({
    spec: 'ai_companion_persona',
    spec_version: '2.0',
    data: {
      name: persona.name,
      avatar: persona.avatar,
      title: persona.title || '',
      description: persona.description || '',
      identity: persona.identity || '',
      age: persona.age || '',
      gender: persona.gender || '',
      birthday: persona.birthday || '',
      height: persona.height || '',
      occupation: persona.occupation || '',
      appearance: persona.appearance || '',
      personality: persona.personality || '',
      publicPersona: persona.publicPersona || '',
      privatePersona: persona.privatePersona || '',
      strengths: persona.strengths || '',
      weaknesses: persona.weaknesses || '',
      interests: persona.interests || '',
      habits: persona.habits || '',
      lifestyle: persona.lifestyle || '',
      background: persona.background || '',
      relationshipNote: persona.relationshipNote || '',
      characterKnowledge: persona.characterKnowledge || '',
      boundaries: persona.boundaries || '',
      tags: persona.tags || [],
      creator: persona.creator || '',
      sourceUrl: persona.sourceUrl || '',
      extraFields: persona.extraFields || {}
    }
  }, null, 2)
}
