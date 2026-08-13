import type {
  LorebookEntry,
  LorebookResource,
  PromptPreset,
  PromptPresetPrompt,
  RegexScript,
  ResourceSourceFormat
} from '../types/domain'

export type CommunityResourceKind = 'character-card' | 'lorebook' | 'preset' | 'regex' | 'persona' | 'theme' | 'unknown'

export interface ResourceCompatibilityReport {
  kind: CommunityResourceKind
  format: string
  name: string
  summary: string[]
  supported: string[]
  warnings: string[]
}

export interface ParsedLorebookResource {
  lorebook: Omit<LorebookResource, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>
  entries: Array<Omit<LorebookEntry, 'id' | 'worldId' | 'lorebookId' | 'createdAt' | 'updatedAt'>>
  report: ResourceCompatibilityReport
}

export interface ParsedPresetResource {
  preset: Omit<PromptPreset, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>
  report: ResourceCompatibilityReport
}

export interface ParsedRegexResource {
  scripts: Array<Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'>>
  report: ResourceCompatibilityReport
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const asText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const asBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const asStringArray = (value: unknown) => {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean)
  const single = asText(value)
  return single ? [single] : []
}
const cloneRecord = (value: unknown) => {
  const record = asRecord(value)
  return record ? JSON.parse(JSON.stringify(record)) as Record<string, unknown> : undefined
}

function fileStem(name: string) {
  return name.replace(/\.(json|txt|zip)$/i, '').replace(/^Tavo_/i, '').trim() || '导入资源'
}

function sourceFormat(fileName: string, root?: Record<string, unknown>): ResourceSourceFormat {
  if (/tavo/i.test(fileName)) return 'tavo'
  if (root?.spec === 'chara_card_v2' || root?.spec === 'chara_card_v3') return 'sillytavern'
  return 'legacy'
}

export function classifyCommunityJson(root: Record<string, unknown>): CommunityResourceKind {
  if (root.spec === 'chara_card_v2' || root.spec === 'chara_card_v3') return 'character-card'
  if (Array.isArray(root.prompts) && (Array.isArray(root.prompt_order) || root.prompt_order)) return 'preset'
  if (root.findRegex || root.replaceString || root.regex_scripts || Array.isArray(root.regex_scripts)) return 'regex'
  if (root.entries && (Array.isArray(root.entries) || typeof root.entries === 'object')) return 'lorebook'
  if (root.data && typeof root.data === 'object') {
    const data = root.data as Record<string, unknown>
    if (data.character_book) return 'character-card'
  }
  if (root.name && (root.description || root.personality) && !root.first_mes) return 'persona'
  const themeKeys = ['blur_strength', 'font_scale', 'main_text_color', 'italics_text_color', 'quote_text_color', 'blur_tint_color', 'shadow_color', 'movingUIState']
  if (themeKeys.some(key => key in root)) return 'theme'
  return 'unknown'
}

function normalizeEntryRows(entries: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(entries)) return entries.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>
  const record = asRecord(entries)
  if (!record) return []
  return Object.entries(record).map(([key, value]) => {
    const item = asRecord(value)
    return item ? { ...item, id: item.id ?? key } : undefined
  }).filter(Boolean) as Array<Record<string, unknown>>
}

function parseLorebookEntry(raw: Record<string, unknown>, index: number) {
  const extensions = asRecord(raw.extensions) || {}
  const keys = asStringArray(raw.keys ?? raw.key)
  const secondaryKeys = asStringArray(raw.secondary_keys ?? raw.keysecondary ?? raw.secondaryKeys)
  const insertionOrder = asNumber(raw.insertion_order ?? raw.order, 100 - index)
  const probability = asNumber(raw.probability ?? extensions.probability, 100)
  const caseSensitiveValue = raw.caseSensitive ?? raw.case_sensitive ?? extensions.caseSensitive ?? extensions.case_sensitive
  const knownKeys = new Set([
    'id', 'uid', 'name', 'comment', 'key', 'keys', 'keysecondary', 'secondary_keys', 'secondaryKeys', 'content',
    'enabled', 'disable', 'constant', 'caseSensitive', 'case_sensitive', 'matchWholeWords', 'use_regex', 'useRegex',
    'selective', 'selectiveLogic', 'selective_logic', 'priority', 'insertion_order', 'order', 'position', 'depth', 'role',
    'probability', 'useProbability', 'sticky', 'cooldown', 'delay', 'group', 'groupOverride', 'group_override',
    'groupWeight', 'group_weight', 'scanDepth', 'scan_depth', 'excludeRecursion', 'exclude_recursion',
    'preventRecursion', 'prevent_recursion', 'delayUntilRecursion', 'delay_until_recursion', 'useGroupScoring',
    'matchPersonaDescription', 'matchCharacterDescription', 'matchCharacterPersonality', 'matchCharacterDepthPrompt',
    'matchScenario', 'matchCreatorNotes', 'extensions'
  ])
  const extraFields = Object.fromEntries(Object.entries(raw).filter(([key]) => !knownKeys.has(key)))
  const rawExtensions = cloneRecord({ ...extensions, ...extraFields })

  return {
    characterId: undefined,
    title: asText(raw.name) || asText(raw.comment) || `条目 ${index + 1}`,
    keywords: keys,
    secondaryKeys,
    content: asText(raw.content),
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : !asBoolean(raw.disable, false),
    constant: asBoolean(raw.constant, keys.length === 0),
    caseSensitive: typeof caseSensitiveValue === 'boolean' ? caseSensitiveValue : false,
    matchWholeWords: typeof raw.matchWholeWords === 'boolean' ? raw.matchWholeWords : undefined,
    useRegex: asBoolean(raw.useRegex ?? raw.use_regex, false),
    selective: asBoolean(raw.selective, false),
    selectiveLogic: raw.selectiveLogic as number | string | undefined ?? raw.selective_logic as number | string | undefined ?? extensions.selectiveLogic as number | string | undefined,
    priority: Math.max(0, Math.min(100, Math.round(asNumber(raw.priority, 50)))),
    insertionOrder,
    position: raw.position as number | string | undefined ?? extensions.position as number | string | undefined,
    depth: asNumber(raw.depth ?? extensions.depth, 0) || undefined,
    role: raw.role as number | string | undefined ?? extensions.role as number | string | undefined,
    probability: Math.max(0, Math.min(100, probability)),
    useProbability: typeof raw.useProbability === 'boolean' ? raw.useProbability : asBoolean(extensions.useProbability, false),
    sticky: asNumber(raw.sticky ?? extensions.sticky, 0) || undefined,
    cooldown: asNumber(raw.cooldown ?? extensions.cooldown, 0) || undefined,
    delay: asNumber(raw.delay ?? extensions.delay, 0) || undefined,
    group: asText(raw.group ?? extensions.group) || undefined,
    groupOverride: asBoolean(raw.groupOverride ?? raw.group_override ?? extensions.groupOverride ?? extensions.group_override, false),
    groupWeight: asNumber(raw.groupWeight ?? raw.group_weight ?? extensions.groupWeight ?? extensions.group_weight, 100),
    scanDepth: asNumber(raw.scanDepth ?? raw.scan_depth ?? extensions.scanDepth ?? extensions.scan_depth, 0) || undefined,
    excludeRecursion: asBoolean(raw.excludeRecursion ?? raw.exclude_recursion ?? extensions.excludeRecursion ?? extensions.exclude_recursion, false),
    preventRecursion: asBoolean(raw.preventRecursion ?? raw.prevent_recursion ?? extensions.preventRecursion ?? extensions.prevent_recursion, false),
    delayUntilRecursion: asBoolean(raw.delayUntilRecursion ?? raw.delay_until_recursion ?? extensions.delayUntilRecursion ?? extensions.delay_until_recursion, false),
    useGroupScoring: typeof raw.useGroupScoring === 'boolean' ? raw.useGroupScoring : undefined,
    matchPersonaDescription: typeof raw.matchPersonaDescription === 'boolean' ? raw.matchPersonaDescription : undefined,
    matchCharacterDescription: typeof raw.matchCharacterDescription === 'boolean' ? raw.matchCharacterDescription : undefined,
    matchCharacterPersonality: typeof raw.matchCharacterPersonality === 'boolean' ? raw.matchCharacterPersonality : undefined,
    matchCharacterDepthPrompt: typeof raw.matchCharacterDepthPrompt === 'boolean' ? raw.matchCharacterDepthPrompt : undefined,
    matchScenario: typeof raw.matchScenario === 'boolean' ? raw.matchScenario : undefined,
    matchCreatorNotes: typeof raw.matchCreatorNotes === 'boolean' ? raw.matchCreatorNotes : undefined,
    sourceEntryId: raw.uid as number | string | undefined ?? raw.id as number | string | undefined,
    rawExtensions
  }
}

export function parseLorebookJson(text: string, fileName = '世界书.json'): ParsedLorebookResource {
  const root = JSON.parse(text) as unknown
  const record = asRecord(root) || (Array.isArray(root) ? { entries: root } : undefined)
  if (!record) throw new Error('世界书 JSON 结构无效。')
  const data = asRecord(record.data)
  const bookRecord = data && data.entries ? data : record
  const rows = normalizeEntryRows(bookRecord.entries)
  if (!rows.length) throw new Error('没有找到世界书 entries。')
  const entries = rows.map(parseLorebookEntry).filter(item => item.content)
  const format = sourceFormat(fileName, record)
  const name = asText(bookRecord.name) || asText(bookRecord.description) || fileStem(fileName)
  return {
    lorebook: {
      name,
      description: asText(bookRecord.description) || undefined,
      characterId: undefined,
      sourceFileName: fileName,
      sourceFormat: format,
      scanDepth: asNumber(bookRecord.scanDepth ?? bookRecord.scan_depth, 0) || undefined,
      tokenBudget: asNumber(bookRecord.tokenBudget ?? bookRecord.token_budget, 0) || undefined,
      recursiveScanning: asBoolean(bookRecord.recursiveScanning ?? bookRecord.recursive_scanning, true),
      rawExtensions: cloneRecord(bookRecord.extensions)
    },
    entries,
    report: {
      kind: 'lorebook',
      format: `${format} lorebook`,
      name,
      summary: [`${entries.length} 条世界书`, `${entries.filter(item => item.enabled).length} 条启用`],
      supported: ['关键词/常驻', 'camelCase / snake_case 字段', '正则关键词', '可选过滤', 'order / 插入顺序', '概率', '深度', '整词匹配', '分组字段', 'Persona/角色字段扫描开关', '递归字段保留'],
      warnings: entries.some(item => item.cooldown || item.delay || item.sticky)
        ? ['sticky / cooldown / delay 已保留，并使用兼容近似行为；与原客户端的逐消息状态可能存在细微差异。']
        : []
    }
  }
}

function extractPromptOrderGroups(root: Record<string, unknown>) {
  const raw = Array.isArray(root.prompt_order) ? root.prompt_order : []
  return raw.map(asRecord).filter(Boolean).map(group => ({
    characterId: group!.character_id as number | string | undefined ?? group!.characterId as number | string | undefined,
    order: (Array.isArray(group!.order) ? group!.order : [])
      .map(asRecord)
      .filter(Boolean)
      .map(item => ({
        identifier: asText(item!.identifier),
        enabled: asBoolean(item!.enabled, true)
      }))
      .filter(item => item.identifier)
  })).filter(group => group.order.length)
}

function choosePromptOrder(
  groups: ReturnType<typeof extractPromptOrderGroups>,
  promptIdentifiers: Set<string>
): Array<{ identifier: string; enabled: boolean }> {
  if (!groups.length) return []
  const ranked = groups.map((group, index) => ({
    group,
    index,
    coverage: group.order.filter(item => promptIdentifiers.has(item.identifier)).length,
    length: group.order.length
  })).sort((a, b) => b.coverage - a.coverage || b.length - a.length || a.index - b.index)
  return ranked[0].group.order
}

export function parsePromptPresetJson(text: string, fileName = '预设.json'): ParsedPresetResource {
  const root = JSON.parse(text) as unknown
  const record = asRecord(root)
  if (!record || !Array.isArray(record.prompts)) throw new Error('这不是可识别的 Prompt 预设。')
  const promptIdentifiers = new Set(record.prompts.map(asRecord).filter(Boolean).map(item => asText(item!.identifier)).filter(Boolean))
  const promptOrderGroups = extractPromptOrderGroups(record)
  const order = choosePromptOrder(promptOrderGroups, promptIdentifiers)
  const orderMap = new Map(order.map(item => [item.identifier, item.enabled]))
  const prompts: PromptPresetPrompt[] = record.prompts.map(asRecord).filter(Boolean).map((item, index) => {
    const identifier = asText(item!.identifier) || `prompt-${index + 1}`
    return {
      identifier,
      name: asText(item!.name) || identifier,
      content: asText(item!.content) || undefined,
      role: asText(item!.role) || undefined,
      enabled: orderMap.has(identifier) ? Boolean(orderMap.get(identifier)) : asBoolean(item!.enabled, true),
      marker: asBoolean(item!.marker, false),
      systemPrompt: asBoolean(item!.system_prompt, false),
      injectionPosition: asNumber(item!.injection_position, 0),
      injectionDepth: asNumber(item!.injection_depth, 0),
      forbidOverrides: asBoolean(item!.forbid_overrides, false),
      raw: cloneRecord(item)
    }
  })
  const name = asText(record.name) || fileStem(fileName)
  const rawConfig = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'prompts'))
  return {
    preset: {
      name,
      prompts,
      promptOrder: order.length ? order : prompts.map(item => ({ identifier: item.identifier, enabled: item.enabled })),
      promptOrderGroups,
      sourceFileName: fileName,
      sourceFormat: sourceFormat(fileName, record),
      rawConfig: JSON.parse(JSON.stringify(rawConfig))
    },
    report: {
      kind: 'preset',
      format: 'SillyTavern / Tavo preset',
      name,
      summary: [`${prompts.length} 个 Prompt`, `${prompts.filter(item => item.enabled).length} 个启用`, `${promptOrderGroups.length || 1} 组 Prompt Order`],
      supported: ['多组 Prompt Order 自动择优', 'marker 插槽', '角色/Persona/世界书插槽', '{{char}} / {{user}} / 场景 Persona 宏', '自定义 system/user/assistant Prompt'],
      warnings: [
        ...(promptOrderGroups.length > 1 ? ['检测到多个 prompt_order 分组；运行时会选择与 prompts 覆盖率最高且最完整的一组，其余分组继续无损保存。'] : []),
        '模型参数仍以本 App 的模型设置为主；预设里的供应商专属采样参数会保存但不会强行覆盖。'
      ]
    }
  }
}

function normalizeRegexRows(root: Record<string, unknown>) {
  if (Array.isArray(root.regex_scripts)) return root.regex_scripts.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>
  if (root.regex_scripts && asRecord(root.regex_scripts)) return Object.values(root.regex_scripts as Record<string, unknown>).map(asRecord).filter(Boolean) as Array<Record<string, unknown>>
  if (root.findRegex || root.replaceString) return [root]
  if (Array.isArray(root.scripts)) return root.scripts.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>
  return []
}

export function parseRegexJson(text: string, fileName = '正则.json'): ParsedRegexResource {
  const root = JSON.parse(text) as unknown
  const record = asRecord(root) || (Array.isArray(root) ? { regex_scripts: root } : undefined)
  if (!record) throw new Error('正则 JSON 结构无效。')
  const rows = normalizeRegexRows(record)
  if (!rows.length) throw new Error('没有找到可识别的正则脚本。')
  const scripts = rows.map((raw, index) => ({
    characterId: undefined,
    name: asText(raw.scriptName ?? raw.name) || `正则 ${index + 1}`,
    findRegex: asText(raw.findRegex ?? raw.find_regex),
    replaceString: typeof (raw.replaceString ?? raw.replace_string) === 'string' ? String(raw.replaceString ?? raw.replace_string) : '',
    trimStrings: asStringArray(raw.trimStrings ?? raw.trim_strings),
    placement: Array.isArray(raw.placement) ? raw.placement.map(value => asNumber(value, -1)).filter(value => value >= 0) : [],
    enabled: !asBoolean(raw.disabled, false) && asBoolean(raw.enabled, true),
    markdownOnly: asBoolean(raw.markdownOnly ?? raw.markdown_only, false),
    promptOnly: asBoolean(raw.promptOnly ?? raw.prompt_only, false),
    runOnEdit: asBoolean(raw.runOnEdit ?? raw.run_on_edit, false),
    substituteRegex: asNumber(raw.substituteRegex ?? raw.substitute_regex, 0),
    minDepth: raw.minDepth == null ? undefined : asNumber(raw.minDepth, 0),
    maxDepth: raw.maxDepth == null ? undefined : asNumber(raw.maxDepth, 0),
    sourceFileName: fileName,
    sourceFormat: sourceFormat(fileName, record),
    raw: cloneRecord(raw)
  })).filter(item => item.findRegex)
  const name = scripts.length === 1 ? scripts[0].name : fileStem(fileName)
  return {
    scripts,
    report: {
      kind: 'regex',
      format: 'SillyTavern / Tavo regex',
      name,
      summary: [`${scripts.length} 条正则`, `${scripts.filter(item => item.enabled).length} 条启用`],
      supported: ['findRegex / replaceString', 'placement', 'promptOnly', 'markdownOnly', '深度字段保留', '显示 HTML 安全渲染'],
      warnings: ['第三方 JavaScript 不执行；HTML/CSS 会进入隔离的安全渲染器。']
    }
  }
}

export function inspectCommunityResourceJson(text: string, fileName: string): ResourceCompatibilityReport {
  const root = JSON.parse(text) as unknown
  const record = asRecord(root)
  if (!record) {
    return { kind: 'unknown', format: 'unknown json', name: fileStem(fileName), summary: ['JSON 根节点不是对象'], supported: ['原始文件无损归档'], warnings: ['当前无法直接运行这个资源。'] }
  }
  const kind = classifyCommunityJson(record)
  if (kind === 'character-card') {
    const data = asRecord(record.data) || record
    const name = asText(data.name) || fileStem(fileName)
    const version = asText(record.spec_version) || (record.spec === 'chara_card_v3' ? '3.0' : '2.0')
    return { kind, format: `Character Card ${version}`, name, summary: ['检测到角色卡资源'], supported: ['原始 JSON 无损归档', '{{user}} / character_book / extensions 可由角色导入器继续处理'], warnings: ['请到“通讯录 → 创建角色”完成角色创建；资源中心不会自动生成角色。'] }
  }
  if (kind === 'persona') {
    return { kind, format: 'persona json', name: asText(record.name) || fileStem(fileName), summary: ['检测到用户 Persona'], supported: ['原始 JSON 无损归档'], warnings: ['请到“我的资料 / Persona”完成 Persona 导入。'] }
  }
  if (kind === 'theme') {
    return { kind, format: 'community theme', name: asText(record.name) || fileStem(fileName), summary: ['检测到社区美化 / Theme 类资源'], supported: ['原始 JSON 无损归档', '主题字段完整保留'], warnings: ['Theme Runtime 尚未完全启用；当前不会自动覆盖 App 样式。'] }
  }
  if (kind === 'lorebook') return parseLorebookJson(text, fileName).report
  if (kind === 'preset') return parsePromptPresetJson(text, fileName).report
  if (kind === 'regex') return parseRegexJson(text, fileName).report
  return { kind: 'unknown', format: 'unknown json', name: asText(record.name) || fileStem(fileName), summary: ['暂未识别资源类型'], supported: ['原始 JSON 无损归档'], warnings: ['不会执行未知脚本或未知配置；后续兼容层升级后可重新解析。'] }
}

export function parseCommunityResourceJson(text: string, fileName: string) {
  const root = JSON.parse(text) as unknown
  if (Array.isArray(root)) {
    const rows = root.map(asRecord).filter(Boolean) as Array<Record<string, unknown>>
    if (rows.some(item => item.findRegex || item.find_regex || item.replaceString || item.replace_string)) return parseRegexJson(text, fileName)
    if (rows.some(item => item.content && (item.keys || item.key || item.constant != null))) return parseLorebookJson(text, fileName)
    throw new Error('暂时无法识别这个 JSON 数组资源。')
  }
  const record = asRecord(root)
  if (!record) throw new Error('JSON 根节点无效。')
  const kind = classifyCommunityJson(record)
  if (kind === 'lorebook') return parseLorebookJson(text, fileName)
  if (kind === 'preset') return parsePromptPresetJson(text, fileName)
  if (kind === 'regex') return parseRegexJson(text, fileName)
  throw new Error(kind === 'character-card' ? '这是角色卡，请到创建角色页面导入。' : kind === 'persona' ? '这是用户 Persona，请到“我的资料 / Persona”导入。' : '暂时无法识别这个 JSON 资源。')
}

function decodeFileName(bytes: Uint8Array, utf8: boolean) {
  // 社区 ZIP 经常漏写 UTF-8 flag。优先尝试严格 UTF-8，失败后再按 GB18030，
  // 避免“紧急更新”被解成“绱ф€ユ洿鏂�”这类文件名乱码。
  if (utf8) return new TextDecoder('utf-8').decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch {
    try { return new TextDecoder('gb18030').decode(bytes) } catch { return new TextDecoder().decode(bytes) }
  }
}

async function inflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') throw new Error('当前浏览器不支持 ZIP 解压。')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function extractJsonFilesFromZip(file: File): Promise<Array<{ name: string; text: string }>> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let index = Math.max(0, bytes.length - 65557); index <= bytes.length - 22; index += 1) {
    if (view.getUint32(index, true) === 0x06054b50) eocd = index
  }
  if (eocd < 0) throw new Error('ZIP 目录结构无法识别。')
  const count = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const files: Array<{ name: string; text: string }> = []
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break
    const flags = view.getUint16(cursor + 8, true)
    const method = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength)
    const name = decodeFileName(nameBytes, Boolean(flags & 0x800))
    cursor += 46 + nameLength + extraLength + commentLength
    const normalizedName = name.replace(/\\/g, '/')
    const leafName = normalizedName.split('/').pop() || normalizedName
    if (normalizedName.split('/').includes('__MACOSX') || leafName.startsWith('._')) continue
    if (!/\.json$/i.test(normalizedName) || normalizedName.endsWith('/')) continue
    if (view.getUint32(localOffset, true) !== 0x04034b50) continue
    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = bytes.slice(dataStart, dataStart + compressedSize)
    const output = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : undefined
    if (!output) continue
    files.push({ name: leafName, text: new TextDecoder('utf-8').decode(output) })
  }
  if (!files.length) throw new Error('ZIP 中没有找到可读取的 JSON 正则资源。')
  return files
}
