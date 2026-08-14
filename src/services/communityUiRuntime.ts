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
  exactHtmlTemplate?: string
  structuredTemplate?: string
  regexInputSkeleton?: string
}

function compact(value: unknown) {
  if (typeof value === 'string') return value
  if (value == null) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function containsStrongOutputContract(source: string) {
  if (!source) return false
  const explicitRule = /(?:最高优先级|严格遵守|每次回复|每次扮演|每轮回复|回复正文|输出格式|格式规则|状态栏格式\s*UI|界面格式|UI\s*格式|不得省略|不能漏|字段缺一不可)/i.test(source)
  const structuredTags = /<(?:日期|时间|地点|环境|状态栏|U状态|U外观|[^<>]{1,8}(?:状态|心声|外观|计划|好感))>/i.test(source)
  const htmlTemplate = /<(?:!doctype\s+html|html\b|style\b|div\b|details\b|section\b|article\b)[\s>]/i.test(source)
  return explicitRule && (structuredTags || htmlTemplate)
}

function collectStructuredTags(source: string) {
  const htmlTags = new Set(['html', 'head', 'body', 'style', 'div', 'span', 'p', 'details', 'summary', 'section', 'article', 'main', 'header', 'footer', 'img', 'audio', 'video', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'br', 'meta', 'link', 'script'])
  const names = Array.from(new Set([...source.matchAll(/<\s*([\p{L}\p{N}_-]{1,18})\s*>/gu)]
    .map(match => match[1])
    .filter(name => !htmlTags.has(name.toLowerCase()))))
  const likelyOutput = names.filter(name => /(?:日期|时间|地点|环境|状态|外观|心声|计划|好感|状态栏|msg|rednote|phone)/i.test(name))
  const other = names.filter(name => !likelyOutput.includes(name))
  return [...likelyOutput, ...other].slice(0, 24)
}

function collectHtmlShape(source: string) {
  const candidates = ['details', 'summary', 'section', 'article', 'table', 'main', 'header', 'footer', 'div']
  return candidates.filter(tag => new RegExp(`<${tag}\\b`, 'i').test(source)).slice(0, 6)
}

function hasRichHtml(source: string) {
  return /<(?:!doctype\s+html|html\b|style\b|div\b|details\b|section\b|article\b|main\b|table\b)[\s>]/i.test(source)
}


function extractBalancedHtmlTemplate(source: string) {
  if (!source) return ''
  const marker = /(?:状态栏格式\s*UI\s*如下|UI\s*格式\s*如下|界面格式\s*如下|HTML\s*(?:UI\s*)?(?:模板|格式)\s*(?:如下)?)/i.exec(source)
  const searchFrom = marker ? (marker.index + marker[0].length) : 0
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
    if (depth === 0 && closing) return rest.slice(0, token.lastIndex).trim().slice(0, 12000)
  }
  // 社区模板偶尔有少一个内层 </div> 的宽松 HTML；浏览器仍能修复。
  // 这时以最后一个同类闭合标签作为模板边界，避免把后续角色卡正文一起吞进模板。
  const lastClosing = rest.toLowerCase().lastIndexOf(`</${tag}>`)
  if (lastClosing >= 0) return rest.slice(0, lastClosing + tag.length + 3).trim().slice(0, 12000)
  return rest.slice(0, 12000).trim()
}

function extractStructuredTemplate(source: string) {
  if (!source) return ''
  const match = /<状态栏>\s*(?:内容\s*[:：])?([\s\S]*?)<\s*\/\s*状态栏\s*>/i.exec(source)
  if (match?.[1]?.trim()) return match[1].trim().slice(0, 5000)
  const marker = /(?:输出格式|格式规则|状态栏格式)\s*(?:如下|[:：])/i.exec(source)
  if (!marker) return ''
  const tail = source.slice(marker.index + marker[0].length, marker.index + marker[0].length + 5000)
  return tail.split(/\n\s*\n(?:【|#{1,3}\s|\d+[.、])/)[0]?.trim() || ''
}

function collectUiLabels(source: string) {
  const candidates = ['状态信息', '正文', '角色互动', '场外观众席', '世界信息', '用户信息', '联系人']
  return candidates.filter(label => source.includes(label)).slice(0, 8)
}

function regexStructuredTagNames(script: RegexScript) {
  const normalized = String(script.findRegex || '')
    .replace(/\\</g, '<')
    .replace(/\\>/g, '>')
    .replace(/\\\//g, '/')
  return collectStructuredTags(normalized)
}

function buildRegexInputSkeleton(scripts: RegexScript[]) {
  const names = Array.from(new Set(scripts.flatMap(regexStructuredTagNames))).slice(0, 24)
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
  const replacement = script.replaceString || ''
  return hasRichHtml(replacement)
}

function regexLooksLikePerReplyUi(script: RegexScript) {
  const tags = regexStructuredTagNames(script)
  // 开场页常见 findRegex 只是 `【主页】` 之类标记；即使 replacement 很漂亮，也不能拿它当每轮回复契约。
  // 状态栏/手机面板通常会匹配多个结构化字段，优先把这类 Regex 作为 per-reply UI。
  return tags.length >= 4 || (/(?:状态栏|status|ui|界面|面板|手机)/i.test(script.name) && tags.length >= 2)
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
  const richRegex = assistantRegex.filter(regexProducesRichUi)
  const perReplyRichRegex = richRegex.filter(regexLooksLikePerReplyUi)
  const contractRichRegex = perReplyRichRegex.length ? perReplyRichRegex : richRegex

  const lorebookPrompt = input.lorebookPrompt || ''
  const preset = presetText(input.preset)
  const character = characterText(input.character)
  const promptRegex = (input.promptRegex || []).map(item => `${item.name}\n${item.findRegex}\n${item.replaceString}`).join('\n')

  const strongLorebook = containsStrongOutputContract(lorebookPrompt)
  const strongPreset = containsStrongOutputContract(preset)
  const strongCharacter = containsStrongOutputContract(character)
  const strongPromptRegex = containsStrongOutputContract(promptRegex)
  const hasPerReplyContract = strongLorebook || strongPreset || strongCharacter || strongPromptRegex

  if (contractRichRegex.length && hasPerReplyContract) reasons.push(`输出正则生成 UI：${contractRichRegex.map(item => item.name).slice(0, 3).join('、')}`)
  if (strongLorebook) reasons.push('世界书定义了每轮 UI / 状态栏输出格式')
  if (strongPreset) reasons.push('Prompt 预设定义了 UI / 固定输出格式')
  if (strongCharacter) reasons.push('角色卡定义了 UI / 固定输出格式')
  if (strongPromptRegex) reasons.push('Prompt 正则包含 UI 输出协议')

  const assistantRegexSource = contractRichRegex.map(item => `${item.name}\n${item.findRegex}\n${item.replaceString}`).join('\n')
  const contractSources = [lorebookPrompt, preset, character, promptRegex, assistantRegexSource].filter(Boolean)
  const contractSource = contractSources.join('\n')
  const exactHtmlTemplate = contractSources.map(extractBalancedHtmlTemplate).find(Boolean) || ''
  const structuredTemplate = contractSources.map(extractStructuredTemplate).find(Boolean) || ''
  const regexInputSkeleton = buildRegexInputSkeleton(contractRichRegex)
  const requiredTagNames = Array.from(new Set([
    ...contractRichRegex.flatMap(regexStructuredTagNames),
    ...collectStructuredTags(contractSource)
  ])).slice(0, 24)
  const requiredHtmlTags = collectHtmlShape(exactHtmlTemplate || contractSource)
  const requiredUiLabels = collectUiLabels(exactHtmlTemplate || contractSource)
  const hasRegexPerReplyUi = perReplyRichRegex.length > 0

  let mode: CommunityUiMode = 'none'
  if (contractRichRegex.length && (hasPerReplyContract || hasRegexPerReplyUi)) {
    mode = 'regex-html'
    if (!hasPerReplyContract && hasRegexPerReplyUi) reasons.push('输出 Regex 本身定义了多字段状态栏 UI')
  } else if ((exactHtmlTemplate || hasRichHtml(contractSource)) && hasPerReplyContract) mode = 'html-contract'
  else if (hasPerReplyContract) mode = 'structured-contract'

  return {
    active: mode !== 'none',
    mode,
    reasons,
    requiredTagNames,
    requiredHtmlTags,
    requiredUiLabels,
    requiredRegexNames: contractRichRegex.map(item => item.name),
    exactHtmlTemplate: exactHtmlTemplate || undefined,
    structuredTemplate: structuredTemplate || undefined,
    regexInputSkeleton: regexInputSkeleton || undefined
  }
}

export function buildCommunityUiPriorityPrompt(contract?: CommunityUiContract) {
  if (!contract?.active) return ''
  return [
    '【社区 UI 输出接管 · 最高优先级】',
    '当前角色绑定的社区 JSON / 世界书 / Preset / Regex 已定义自己的 UI 或固定输出协议。',
    '严格遵守资源原本规定的 HTML、XML、状态栏、消息标签、字段顺序、正文位置和代码围栏要求；资源要求什么格式就输出什么格式。',
    '此时不要套用小手机默认的“动作与对白分开/合并”规则，不要为了手机气泡擅自拆句、加中文括号、改写标签或重新排版。',
    '不要主动添加 <scene_action>、<companion_packet> 或其它小手机私有协议；只有社区资源本身明确要求这些标签时才使用。',
    '如果资源给出了完整 HTML UI 模板，不得退化成普通纯文本；如果资源通过 Regex 把 XML/标签转换成 UI，则必须先输出能命中该 Regex 的原始结构。',
    'UI 输出协议只控制格式，不改变角色人设、世界书、Persona、记忆和当前剧情事实。',
    contract.requiredTagNames.length ? `资源中检测到的结构化标签：${contract.requiredTagNames.slice(0, 24).map(item => `<${item}>`).join('、')}` : '',
    contract.mode === 'regex-html' && contract.regexInputSkeleton
      ? `【原卡 Regex 输入骨架】\n${contract.regexInputSkeleton}\n必须保留这些标签与顺序，只把“填写本轮内容”替换成真实内容；不要直接输出 Regex 替换后的 HTML。`
      : '',
    contract.mode === 'html-contract' && contract.exactHtmlTemplate
      ? `【原卡 HTML UI 模板 · 必须照此填充】\n${contract.exactHtmlTemplate}\n保留 HTML 层级、style、details/summary 与栏目标题，只替换模板中的示例/占位文字为本轮真实状态和正文。不要把模板改写成纯文本。`
      : '',
    contract.mode === 'structured-contract' && contract.structuredTemplate
      ? `【原卡结构化模板】\n${contract.structuredTemplate}\n按原顺序逐项填写，不得漏项。`
      : '',
    contract.mode === 'html-contract' && contract.requiredHtmlTags.length ? `原 UI 的关键 HTML 结构：${contract.requiredHtmlTags.map(item => `<${item}>`).join('、')}，不要简化成单层普通 <div>。` : '',
    contract.requiredUiLabels.length ? `原 UI 栏目：${contract.requiredUiLabels.join('、')}。` : '',
    `检测依据：${contract.reasons.join('；')}`
  ].filter(Boolean).join('\n')
}

export function buildCommunityUiRepairPrompt(contract: CommunityUiContract, previousOutput = '') {
  const modeRule = contract.mode === 'regex-html'
    ? '上一版没有命中角色卡的输出 Regex，因此 UI 没有生成。请重新生成整条回复，并严格输出能被原卡 Regex 匹配的 XML/标签/状态栏结构。不要直接输出一个“差不多”的普通聊天文本。'
    : contract.mode === 'html-contract'
      ? '上一版退化成了普通文本，但原资源要求每轮使用 HTML UI。请重新生成整条回复，严格使用角色卡/世界书给出的 HTML UI 模板和字段顺序，把本轮真实内容填入对应区域。'
      : '上一版没有完整遵守角色卡规定的结构化状态栏/标签。请重新生成整条回复，所有必需字段都要保留，并保持原顺序。'
  return [
    '【社区 UI 格式纠偏 · 必须重写】',
    modeRule,
    '只重写最终角色回复，不解释错误、不讨论规则、不输出分析。',
    '不得改用小手机默认 scene_action / companion_packet 格式。',
    previousOutput.trim() ? `【上一版内容，仅保留剧情事实，不保留错误格式】\n${previousOutput.trim().slice(0, 3000)}` : '',
    contract.requiredTagNames.length ? `优先核对这些原卡标签：${contract.requiredTagNames.slice(0, 24).map(item => `<${item}>`).join('、')}` : '',
    contract.mode === 'regex-html' && contract.regexInputSkeleton ? `【必须使用的 Regex 输入骨架】\n${contract.regexInputSkeleton}` : '',
    contract.mode === 'html-contract' && contract.exactHtmlTemplate ? `【必须使用的原卡 HTML UI 模板】\n${contract.exactHtmlTemplate}` : '',
    contract.mode === 'structured-contract' && contract.structuredTemplate ? `【必须使用的原卡结构化模板】\n${contract.structuredTemplate}` : '',
    contract.mode === 'html-contract' && contract.requiredHtmlTags.length ? `至少保留原模板关键结构：${contract.requiredHtmlTags.map(item => `<${item}>`).join('、')}` : '',
    contract.requiredUiLabels.length ? `栏目标题也要保留：${contract.requiredUiLabels.join('、')}` : ''
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
    const matchedRichRegex = contract.requiredRegexNames.length
      ? appliedRegex.some(name => contract.requiredRegexNames.includes(name))
      : appliedRegex.length > 0
    return matchedRichRegex && hasRichHtml(renderedText)
  }
  if (contract.mode === 'html-contract') {
    const source = hasRichHtml(renderedText) ? renderedText : rawText
    if (!hasRichHtml(source)) return false
    if (contract.requiredUiLabels.length) {
      const labelHits = contract.requiredUiLabels.filter(label => source.includes(label)).length
      if (labelHits < Math.min(2, contract.requiredUiLabels.length)) return false
    }
    if (!contract.requiredHtmlTags.length) return true
    const hits = contract.requiredHtmlTags.filter(tag => new RegExp(`<${tag}\\b`, 'i').test(source)).length
    return hits >= Math.min(2, contract.requiredHtmlTags.length)
  }

  if (contract.requiredTagNames.length) {
    const candidates = contract.requiredTagNames.slice(0, Math.min(6, contract.requiredTagNames.length))
    const hitCount = candidates.filter(name => new RegExp(`<\\s*${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*>`, 'i').test(rawText)).length
    return hitCount >= Math.min(2, candidates.length)
  }
  return /<[^<>]{1,18}>[\s\S]*?<\s*\/[^<>]{1,18}>/.test(rawText)
}

/**
 * 社区 UI 模式下，正则若没有生成 HTML，也要保留资源自己的结构化文本；
 * 这里只移除小手机内部协议，绝不把社区 XML / 标签改写成默认动作气泡。
 */
export function sanitizeCommunityUiText(raw: string) {
  let output = raw
    .replace(/<companion_packet>[\s\S]*?<\/companion_packet>/gi, '')
    .replace(/<role_status>[\s\S]*?<\/role_status>/gi, '')
    .replace(/<companion_packet>[\s\S]*$/gi, '')
    .replace(/<role_status>[\s\S]*$/gi, '')

  output = output.replace(/<\s*scene[_-]?action\b[^>]*>([\s\S]*?)<\s*\/\s*scene[_-]?action\s*>/gi, (_whole, body: string) => String(body).trim())
  output = output.replace(/<\s*scene[_-]?action\b[^>]*>([\s\S]*)$/i, (_whole, body: string) => String(body).trim())
  return output.trim()
}
