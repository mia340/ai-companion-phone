import type { Character, PromptPreset, RegexScript } from '../types/domain'

export type CommunityUiMode = 'none' | 'regex-html' | 'html-contract' | 'structured-contract'

export interface CommunityUiContract {
  active: boolean
  mode: CommunityUiMode
  reasons: string[]
  requiredTagNames: string[]
  requiredHtmlTags: string[]
  requiredUiLabels: string[]
  requiredRegexNames: string[]
  requiredLiteralTokens: string[]
  exactHtmlTemplate?: string
  structuredTemplate?: string
  regexInputSkeleton?: string
}

const HTML_TAGS = new Set([
  'html', 'head', 'body', 'style', 'div', 'span', 'p', 'details', 'summary', 'section', 'article', 'main',
  'header', 'footer', 'img', 'audio', 'video', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'ul', 'ol',
  'li', 'br', 'meta', 'link', 'script', 'button', 'input', 'label', 'form', 'select', 'option', 'textarea', 'a',
  'strong', 'b', 'em', 'i', 'small', 'pre', 'code', 'blockquote', 'hr', 'nav', 'figure', 'figcaption', 'svg', 'path'
])

function compact(value: unknown) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function normalizeMarkup(value: string) {
  return value
    .replace(/\\</g, '<')
    .replace(/\\>/g, '>')
    .replace(/\\\//g, '/')
}

function directiveScore(source: string) {
  if (!source) return 0
  const patterns = [
    /(?:每次|每轮|每一轮|每条|回复正文|输出时|回复时).{0,24}(?:必须|需要|应当|包含|携带|使用|输出|遵守|按照|附带)/i,
    /(?:必须|严格|务必|不得|不可|禁止).{0,24}(?:格式|结构|模板|标签|字段|UI|界面|状态栏|HTML|XML|JSON)/i,
    /(?:输出格式|回复格式|格式规则|格式要求|固定格式|状态栏格式|UI\s*格式|界面格式|HTML\s*(?:模板|格式)|XML\s*(?:模板|格式))/i,
    /(?:every|each)\s+(?:reply|response|message).{0,40}(?:must|should|include|use|follow|output)/i,
    /(?:must|strictly|required|always).{0,40}(?:format|schema|template|tag|field|html|xml|json|ui)/i,
    /(?:response|output)\s+(?:format|schema|template)/i
  ]
  return patterns.reduce((score, pattern) => score + (pattern.test(source) ? 1 : 0), 0)
}

function collectStructuredTags(source: string) {
  const normalized = normalizeMarkup(source)
  const openNames = [...normalized.matchAll(/<\s*([\p{L}\p{N}_:-]{1,32})(?:\s[^<>]*?)?>/gu)]
    .map(match => match[1])
    .filter(Boolean)
  const unique = Array.from(new Set(openNames.filter(name => !HTML_TAGS.has(name.toLowerCase()))))
  return unique.filter(name => new RegExp(`<\\s*\\/\\s*${escapeRegex(name)}\\s*>`, 'i').test(normalized)).slice(0, 32)
}

function collectBraceFields(source: string) {
  const names = [...source.matchAll(/\{\s*([^{}|:\n]{1,24})\s*[:：][^{}\n]*\}/gu)]
    .map(match => match[1].trim())
    .filter(Boolean)
  return Array.from(new Set(names)).slice(0, 24)
}

function collectHtmlShape(source: string) {
  const normalized = normalizeMarkup(source)
  const counts = new Map<string, number>()
  for (const match of normalized.matchAll(/<\s*([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)) {
    const tag = match[1].toLowerCase()
    if (!HTML_TAGS.has(tag) || ['html', 'head', 'body', 'style', 'script', 'meta', 'link'].includes(tag)) continue
    counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  const semanticPriority = ['details', 'summary', 'section', 'article', 'main', 'table', 'button', 'div']
  return [...counts.keys()]
    .sort((a, b) => {
      const ai = semanticPriority.indexOf(a)
      const bi = semanticPriority.indexOf(b)
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
      return (counts.get(b) || 0) - (counts.get(a) || 0)
    })
    .slice(0, 8)
}

function stripHtmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectUiLabels(source: string) {
  const candidates: string[] = []
  const patterns = [
    /<summary\b[^>]*>([\s\S]*?)<\/summary>/gi,
    /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    /<(?:button|label)\b[^>]*>([\s\S]*?)<\/(?:button|label)>/gi
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = stripHtmlText(match[1] || '')
      if (text && text.length <= 40) candidates.push(text)
    }
  }
  return Array.from(new Set(candidates)).slice(0, 12)
}

function hasRichHtml(source: string) {
  return /<(?:!doctype\s+html|html\b|style\b|div\b|details\b|section\b|article\b|main\b|table\b)[\s>]/i.test(normalizeMarkup(source))
}

function hasStructuredShape(source: string) {
  return collectStructuredTags(source).length >= 2 || collectBraceFields(source).length >= 2
}

function containsStrongOutputContract(source: string) {
  if (!source) return false
  return directiveScore(source) > 0 && (hasStructuredShape(source) || hasRichHtml(source))
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractBalancedHtmlTemplate(source: string) {
  if (!source) return ''
  const marker = /(?:模板|格式|schema|template|format).{0,12}(?:如下|如下所示|below|following)?/i.exec(source)
  const searchFrom = marker ? marker.index + marker[0].length : 0
  const tail = source.slice(searchFrom)
  const opening = /<(html|div|details|section|article|main|table)\b[^>]*>/i.exec(tail)
  if (!opening) return ''
  const tag = opening[1].toLowerCase()
  const start = searchFrom + (opening.index || 0)
  const rest = source.slice(start)
  const token = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi')
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = token.exec(rest))) {
    const closing = /^<\s*\//.test(match[0])
    if (closing) depth -= 1
    else if (!/\/\s*>$/.test(match[0])) depth += 1
    if (depth === 0 && closing) return rest.slice(0, token.lastIndex).trim().slice(0, 16000)
  }
  const lastClosing = rest.toLowerCase().lastIndexOf(`</${tag}>`)
  if (lastClosing >= 0) return rest.slice(0, lastClosing + tag.length + 3).trim().slice(0, 16000)
  return rest.slice(0, 16000).trim()
}

function extractStructuredTemplate(source: string) {
  if (!source) return ''
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const candidateLines = lines.filter(line => {
    const trimmed = line.trim()
    return /<[^<>]{1,32}>.*<\s*\/[^<>]{1,32}>/.test(trimmed) || /\{\s*[^{}|:\n]{1,24}\s*[:：][^{}\n]*\}/u.test(trimmed)
  })
  if (candidateLines.length >= 2) return candidateLines.slice(0, 32).join('\n').trim().slice(0, 6000)

  const marker = /(?:输出格式|回复格式|格式规则|格式要求|schema|template|format)\s*(?:如下|[:：]|below)?/i.exec(source)
  if (!marker) return ''
  const tail = source.slice(marker.index + marker[0].length, marker.index + marker[0].length + 6000)
  return tail.split(/\n\s*\n(?:【|#{1,3}\s|\d+[.、])/)[0]?.trim() || ''
}

function regexStructuredTagNames(script: RegexScript) {
  return collectStructuredTags(script.findRegex || '')
}

function buildRegexInputSkeleton(scripts: RegexScript[]) {
  const names = Array.from(new Set(scripts.flatMap(regexStructuredTagNames))).slice(0, 32)
  if (!names.length) return ''
  return names.map(name => `<${name}>填写本轮内容</${name}>`).join('\n')
}

function presetText(preset?: PromptPreset) {
  if (!preset) return ''
  return [
    preset.name,
    ...preset.prompts.map(item => `${item.name}\n${item.content || ''}`),
    compact(preset.rawConfig)
  ].join('\n')
}

function characterText(character: Character) {
  return [
    character.systemPrompt,
    character.postHistoryInstructions,
    character.depthPrompt?.prompt,
    character.creatorNotes,
    character.scenario,
    character.firstMessage,
    ...(character.alternateGreetings || []),
    compact(character.rawCardExtensions)
  ].filter(Boolean).join('\n')
}

export function regexProducesRichUi(script: RegexScript) {
  if (!script.enabled || script.promptOnly) return false
  return hasRichHtml(script.replaceString || '')
}

function regexLooksLikePerReplyUi(script: RegexScript) {
  const tags = regexStructuredTagNames(script)
  if (tags.length >= 3) return true
  if (tags.length < 2) return false
  const captureCount = (script.findRegex.match(/(^|[^\\])\((?!\?:|\?=|\?!|\?<)/g) || []).length
  const replacementRefs = new Set([...(script.replaceString || '').matchAll(/\$(\d{1,2})/g)].map(match => match[1])).size
  return captureCount >= 2 && replacementRefs >= 2
}

export function detectCommunityUiContract(input: {
  character: Character
  lorebookPrompt?: string
  preset?: PromptPreset
  assistantRegex?: RegexScript[]
  promptRegex?: RegexScript[]
}): CommunityUiContract {
  const reasons: string[] = []
  const assistantRegex = input.assistantRegex || []
  const perReplyRichRegex = assistantRegex.filter(regexProducesRichUi).filter(regexLooksLikePerReplyUi)

  const sources = [
    { label: '世界书', text: input.lorebookPrompt || '' },
    { label: 'Prompt 预设', text: presetText(input.preset) },
    { label: '角色卡', text: characterText(input.character) },
    { label: 'Prompt 正则', text: (input.promptRegex || []).map(item => `${item.findRegex}\n${item.replaceString}`).join('\n') }
  ]
  const strongSources = sources.filter(item => containsStrongOutputContract(item.text))
  for (const source of strongSources) reasons.push(`${source.label}定义了固定输出结构`)
  if (perReplyRichRegex.length) reasons.push(`检测到结构化输出 Regex：${perReplyRichRegex.map(item => item.name).slice(0, 3).join('、')}`)

  const contractSources = [
    ...strongSources.map(item => item.text),
    ...perReplyRichRegex.map(item => `${item.findRegex}\n${item.replaceString}`)
  ].filter(Boolean)
  const contractSource = contractSources.join('\n')
  const exactHtmlTemplate = strongSources.map(item => extractBalancedHtmlTemplate(item.text)).find(Boolean) || ''
  const structuredTemplate = strongSources.map(item => extractStructuredTemplate(item.text)).find(Boolean) || ''
  const regexInputSkeleton = buildRegexInputSkeleton(perReplyRichRegex)
  const requiredTagNames = Array.from(new Set([
    ...perReplyRichRegex.flatMap(regexStructuredTagNames),
    ...collectStructuredTags(contractSource)
  ])).slice(0, 32)
  const requiredLiteralTokens = Array.from(new Set(contractSources.flatMap(collectBraceFields))).slice(0, 24)
  const requiredHtmlTags = collectHtmlShape(exactHtmlTemplate || contractSource)
  const requiredUiLabels = collectUiLabels(exactHtmlTemplate || contractSource)

  let mode: CommunityUiMode = 'none'
  if (perReplyRichRegex.length) mode = 'regex-html'
  else if (strongSources.some(item => hasRichHtml(item.text))) mode = 'html-contract'
  else if (strongSources.length && (requiredTagNames.length || requiredLiteralTokens.length || structuredTemplate)) mode = 'structured-contract'

  return {
    active: mode !== 'none',
    mode,
    reasons,
    requiredTagNames,
    requiredHtmlTags,
    requiredUiLabels,
    requiredRegexNames: perReplyRichRegex.map(item => item.name),
    requiredLiteralTokens,
    exactHtmlTemplate: exactHtmlTemplate || undefined,
    structuredTemplate: structuredTemplate || undefined,
    regexInputSkeleton: regexInputSkeleton || undefined
  }
}

export function buildCommunityUiPriorityPrompt(contract?: CommunityUiContract) {
  if (!contract?.active) return ''
  return [
    '【原卡输出协议 · 最高优先级】',
    '当前角色的社区资源定义了自己的输出结构。只负责按原资源生成内容，不要把它改写成小手机私有格式。',
    '保留原资源规定的 HTML、XML、花括号字段、状态块、字段顺序、正文位置和代码围栏。',
    '不要主动添加 <scene_action>、<companion_packet> 或其它小手机私有协议；只有原资源明确要求时才使用。',
    contract.requiredTagNames.length ? `必须保留的标签：${contract.requiredTagNames.map(item => `<${item}>`).join('、')}` : '',
    contract.requiredLiteralTokens.length ? `必须保留的字段：${contract.requiredLiteralTokens.join('、')}` : '',
    contract.mode === 'regex-html' && contract.regexInputSkeleton
      ? `【Regex 输入骨架】\n${contract.regexInputSkeleton}\n只填入本轮真实内容，不要直接输出 Regex 替换后的 HTML。`
      : '',
    contract.mode === 'html-contract' && contract.exactHtmlTemplate
      ? `【原卡 HTML 模板】\n${contract.exactHtmlTemplate}\n保留结构和样式，仅替换本轮内容。`
      : '',
    contract.mode === 'structured-contract' && contract.structuredTemplate
      ? `【原卡结构化模板】\n${contract.structuredTemplate}\n按原顺序填写，不得漏项。`
      : '',
    contract.requiredHtmlTags.length ? `关键 HTML 结构：${contract.requiredHtmlTags.map(item => `<${item}>`).join('、')}` : '',
    contract.requiredUiLabels.length ? `需要保留的可见栏目：${contract.requiredUiLabels.join('、')}` : '',
    contract.reasons.length ? `检测依据：${contract.reasons.join('；')}` : ''
  ].filter(Boolean).join('\n')
}

export function buildCommunityUiRepairPrompt(contract: CommunityUiContract, previousOutput = '') {
  const modeRule = contract.mode === 'regex-html'
    ? '上一版没有命中原卡的结构化输出 Regex。请重新生成完整回复，并严格输出 Regex 需要的原始标签结构。'
    : contract.mode === 'html-contract'
      ? '上一版没有保留原卡 HTML 模板。请重新生成完整回复并按原模板填充。'
      : '上一版没有完整遵守原卡结构化字段。请重新生成完整回复并保留全部必需字段。'
  return [
    '【原卡格式纠偏 · 必须重写】',
    modeRule,
    '只重写最终角色回复，不解释规则。不得改用小手机私有 scene_action / companion_packet。',
    previousOutput.trim() ? `【上一版剧情事实】\n${previousOutput.trim().slice(0, 3000)}` : '',
    contract.requiredTagNames.length ? `标签：${contract.requiredTagNames.map(item => `<${item}>`).join('、')}` : '',
    contract.requiredLiteralTokens.length ? `字段：${contract.requiredLiteralTokens.join('、')}` : '',
    contract.mode === 'regex-html' && contract.regexInputSkeleton ? `【Regex 输入骨架】\n${contract.regexInputSkeleton}` : '',
    contract.mode === 'html-contract' && contract.exactHtmlTemplate ? `【原卡 HTML 模板】\n${contract.exactHtmlTemplate}` : '',
    contract.mode === 'structured-contract' && contract.structuredTemplate ? `【原卡结构化模板】\n${contract.structuredTemplate}` : ''
  ].filter(Boolean).join('\n')
}

export function communityUiOutputConforms(options: {
  contract: CommunityUiContract
  rawText: string
  renderedText?: string
  appliedRegex?: string[]
}) {
  const { contract, rawText, renderedText = '', appliedRegex = [] } = options
  if (!contract.active) return true
  if (contract.mode === 'regex-html') {
    const matched = contract.requiredRegexNames.length
      ? appliedRegex.some(name => contract.requiredRegexNames.includes(name))
      : appliedRegex.length > 0
    return matched && hasRichHtml(renderedText)
  }
  if (contract.mode === 'html-contract') {
    const source = hasRichHtml(renderedText) ? renderedText : rawText
    if (!hasRichHtml(source)) return false
    if (contract.requiredUiLabels.length) {
      const hits = contract.requiredUiLabels.filter(label => source.includes(label)).length
      if (hits < Math.min(2, contract.requiredUiLabels.length)) return false
    }
    if (!contract.requiredHtmlTags.length) return true
    const hits = contract.requiredHtmlTags.filter(tag => new RegExp(`<${escapeRegex(tag)}\\b`, 'i').test(source)).length
    return hits >= Math.min(2, contract.requiredHtmlTags.length)
  }

  const tagHits = contract.requiredTagNames.filter(name => new RegExp(`<\\s*${escapeRegex(name)}(?:\\s[^>]*)?>`, 'i').test(rawText)).length
  const fieldHits = contract.requiredLiteralTokens.filter(name => new RegExp(`\\{\\s*${escapeRegex(name)}\\s*[:：]`, 'i').test(rawText)).length
  const expected = contract.requiredTagNames.length + contract.requiredLiteralTokens.length
  if (expected) return tagHits + fieldHits >= Math.min(2, expected)
  return hasStructuredShape(rawText)
}

/**
 * 原卡优先模式不解释、不删除任何作者标签。
 * 小手机私有协议只会在 phone-enhanced 模式由 interactionProtocol 处理，
 * 避免和社区卡恰好同名的 XML / 自定义标签发生冲突。
 */
export function sanitizeCommunityUiText(raw: string) {
  return raw.trim()
}
