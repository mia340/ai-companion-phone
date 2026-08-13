import type { Character, PromptPreset, RegexScript } from '../types/domain'

export type CommunityUiMode = 'none' | 'regex-html' | 'html-contract' | 'structured-contract'

export interface CommunityUiContract {
  active: boolean
  mode: CommunityUiMode
  reasons: string[]
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
  return /<(?:!doctype\s+html|html\b|style\b|div\b|details\b|section\b|article\b|main\b|table\b)[\s>]/i.test(replacement)
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
  if (richRegex.length) reasons.push(`输出正则生成 UI：${richRegex.map(item => item.name).slice(0, 3).join('、')}`)

  const lorebookPrompt = input.lorebookPrompt || ''
  if (containsStrongOutputContract(lorebookPrompt)) reasons.push('世界书定义了每轮 UI / 状态栏输出格式')

  const preset = presetText(input.preset)
  if (containsStrongOutputContract(preset)) reasons.push('Prompt 预设定义了 UI / 固定输出格式')

  const character = characterText(input.character)
  if (containsStrongOutputContract(character)) reasons.push('角色卡定义了 UI / 固定输出格式')

  const promptRegex = (input.promptRegex || []).map(item => `${item.name}\n${item.findRegex}\n${item.replaceString}`).join('\n')
  if (containsStrongOutputContract(promptRegex)) reasons.push('Prompt 正则包含 UI 输出协议')

  let mode: CommunityUiMode = 'none'
  if (richRegex.length) mode = 'regex-html'
  else if (/<(?:!doctype\s+html|html\b|style\b|div\b|details\b|section\b|article\b)[\s>]/i.test(`${lorebookPrompt}\n${preset}\n${character}`) && reasons.length) mode = 'html-contract'
  else if (reasons.length) mode = 'structured-contract'

  return { active: mode !== 'none', mode, reasons }
}

export function buildCommunityUiPriorityPrompt(contract?: CommunityUiContract) {
  if (!contract?.active) return ''
  return [
    '【社区 UI 输出接管 · 最高优先级】',
    '当前角色绑定的社区 JSON / 世界书 / Preset / Regex 已定义自己的 UI 或固定输出协议。',
    '严格遵守资源原本规定的 HTML、XML、状态栏、消息标签、字段顺序、正文位置和代码围栏要求；资源要求什么格式就输出什么格式。',
    '此时不要套用小手机默认的“动作与对白分开/合并”规则，不要为了手机气泡擅自拆句、加中文括号、改写标签或重新排版。',
    '不要主动添加 <scene_action>、<companion_packet> 或其它小手机私有协议；只有社区资源本身明确要求这些标签时才使用。',
    'UI 输出协议只控制格式，不改变角色人设、世界书、Persona、记忆和当前剧情事实。',
    `检测依据：${contract.reasons.join('；')}`
  ].join('\n')
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
