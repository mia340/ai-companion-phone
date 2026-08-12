import type {
  Character,
  ChatSettings,
  CompanionActionKind,
  ConversationState,
  Message
} from '../types/domain'

export interface CompanionActionMessage {
  kind: CompanionActionKind
  content: string
  delayMs?: number
  targetMessageId?: string
}

export interface CompanionStatusPatch {
  mood?: string
  activity?: string
  location?: string
  presence?: 'together' | 'remote'
  relationshipNote?: string
  innerThought?: string
  timePeriod?: string
  energy?: string
  unresolvedTopics?: string[]
  pendingEvents?: string[]
  shortTermGoals?: string[]
  completedEvent?: string
}

export interface ParsedCompanionOutput {
  visibleText: string
  messages: CompanionActionMessage[]
  status?: CompanionStatusPatch
  rawPacket?: string
  actionSummary: string
  warnings: string[]
}

interface RawPacket {
  messages?: Array<{
    kind?: unknown
    content?: unknown
    delayMs?: unknown
    targetMessageId?: unknown
  }>
  status?: Record<string, unknown>
}

const PACKET_OPEN = '<companion_packet>'
const PACKET_CLOSE = '</companion_packet>'
const STATUS_OPEN = '<role_status>'
const STATUS_CLOSE = '</role_status>'

function cleanText(value: unknown, max = 1200) {
  return typeof value === 'string'
    ? value.replace(/\r\n/g, '\n').trim().slice(0, max)
    : ''
}

function cleanList(value: unknown, maxItems = 5, maxLength = 80) {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map(item => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
  return items.length ? Array.from(new Set(items)) : undefined
}

function normalizeKind(value: unknown): CompanionActionKind {
  const allowed: CompanionActionKind[] = [
    'text', 'scene_action', 'emoji', 'voice', 'typing_pause', 'recall_message',
    'react_to_message', 'image_placeholder'
  ]
  return allowed.includes(value as CompanionActionKind)
    ? value as CompanionActionKind
    : 'text'
}

function parseJsonBlock(value: string): RawPacket | undefined {
  try {
    const normalized = value
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    const parsed = JSON.parse(normalized)
    return parsed && typeof parsed === 'object' ? parsed as RawPacket : undefined
  } catch {
    return undefined
  }
}

function normalizePresence(value: unknown): 'together' | 'remote' | undefined {
  if (value === 'together' || value === 'remote') return value
  const text = cleanText(value, 24)
  if (/在身边|同场景|见面|一起/.test(text)) return 'together'
  if (/远程|不在身边|异地|手机/.test(text)) return 'remote'
  return undefined
}

function normalizeStatus(status: RawPacket['status']): CompanionStatusPatch | undefined {
  if (!status) return undefined
  const patch: CompanionStatusPatch = {
    mood: cleanText(status.mood, 40) || undefined,
    activity: cleanText(status.activity, 60) || undefined,
    location: cleanText(status.location, 60) || undefined,
    presence: normalizePresence(status.presence ?? status.distance ?? status.sceneMode),
    relationshipNote: cleanText(status.relationshipNote ?? status.relationship, 100) || undefined,
    innerThought: cleanText(status.innerThought ?? status.thought, 180) || undefined,
    timePeriod: cleanText(status.timePeriod ?? status.time, 24) || undefined,
    energy: cleanText(status.energy, 24) || undefined,
    unresolvedTopics: cleanList(status.unresolvedTopics ?? status.topics),
    pendingEvents: cleanList(status.pendingEvents ?? status.events),
    shortTermGoals: cleanList(status.shortTermGoals ?? status.goals),
    completedEvent: cleanText(status.completedEvent, 100) || undefined
  }
  return Object.values(patch).some(value => Array.isArray(value) ? value.length : Boolean(value)) ? patch : undefined
}

function extractBlock(raw: string, open: string, close: string) {
  const start = raw.indexOf(open)
  if (start < 0) return undefined
  const end = raw.indexOf(close, start + open.length)
  if (end < 0) return { before: raw.slice(0, start), block: raw.slice(start + open.length), complete: false }
  return { before: raw.slice(0, start), block: raw.slice(start + open.length, end), complete: true }
}

export function resolvePresenceMode(settings: ChatSettings, state?: ConversationState): 'together' | 'remote' {
  if (settings.presenceMode === 'together' || settings.presenceMode === 'remote') return settings.presenceMode
  return state?.presence === 'together' ? 'together' : 'remote'
}

export function buildInteractionProtocolPrompt(
  settings: ChatSettings,
  character: Character,
  state?: ConversationState
): string {
  if (!settings.actionProtocolEnabled) return ''
  const voiceAllowed = settings.autoReadAloud || Boolean(settings.voiceName)
  const expressive = /活泼|黏人|外向|元气|话多|直率/.test(`${character.persona} ${character.speakingStyle || ''}`)
  const restrained = /克制|冷静|简短|寡言|清冷|毒舌/.test(`${character.persona} ${character.speakingStyle || ''}`)
  const presence = resolvePresenceMode(settings, state)
  const actionVisibility = settings.actionVisibility ?? 'always'

  const sceneRule = presence === 'together'
    ? [
      '当前相处状态：你与用户在同一现场。',
      actionVisibility === 'off'
        ? '当前关闭动作视角：不要输出 scene_action，只输出角色说的话。'
        : '你可以使用 scene_action 描写用户能直接看到的动作、表情、视线、距离变化和环境互动。界面会把 scene_action 自动转成中文全角括号，并与对白合并在同一个剧情气泡中。',
      '同场景时不要为了“小手机感”强行把一句完整互动拆成很多气泡；动作与对白可以构成一个完整气泡。'
    ]
    : [
      '当前相处状态：你与用户不在同一现场，正在通过手机联系。',
      actionVisibility === 'always'
        ? '仍然可以使用 scene_action 描写角色此刻在另一边真正发生的动作，作为玩家可见的独立 Action。每轮通常 0～2 条，只写有情绪、情境或行为价值的动作，不写眨眼、呼吸之类流水账。'
        : '当前动作视角不显示远程动作：不要输出 scene_action。',
      '远程对白必须像真实手机聊天：较长内容自然拆成多个 text 消息；不要把角色动作塞进 text 的括号里。'
    ]

  return [
    '【小手机互动协议 V2.1】',
    '先像真实角色一样回应。普通一条文字最合适时可以直接输出正文；需要动作、连续短消息、停顿或状态变化时使用隐藏协议。',
    ...sceneRule,
    '隐藏数据块格式示例：',
    '<companion_packet>{"messages":[{"kind":"scene_action","content":"角色把刚拿到的行李推到一旁，低头看手机。"},{"kind":"text","content":"行李拿到了。"},{"kind":"typing_pause","content":"","delayMs":700},{"kind":"text","content":"我现在出来。"}],"status":{"mood":"情绪","activity":"正在做什么","location":"地点","presence":"remote","timePeriod":"上午/午后/夜晚","energy":"偏低/平稳/充足","relationshipNote":"此刻的关系感受","innerThought":"一句短暂内心想法","unresolvedTopics":["尚未聊完的话题"],"pendingEvents":["等待结果的事件"],"shortTermGoals":["短期目标"],"completedEvent":"刚刚完成的事件"}}</companion_packet>',
    'messages 最多 8 个动作。kind 可用：text、scene_action、emoji、voice、typing_pause、recall_message、react_to_message、image_placeholder。',
    'scene_action 只写动作本身，不要自带圆括号；界面会按当前相处状态决定“括号合并”还是“独立 Action”。',
    'typing_pause 只表示停顿，delayMs 建议 250～1800；recall_message 用于偶尔撤回上一条角色消息；react_to_message 的 content 只放一个回应表情，targetMessageId 可用 latest_user；image_placeholder 描述角色想分享但当前没有真实文件的图片。',
    '撤回和回应表情只能偶尔使用，不能每轮出现。不要用撤回来操控、惩罚或制造焦虑。',
    voiceAllowed ? '可以偶尔使用 voice，内容必须是角色真正会说的话。' : '当前没有开启角色声音，通常不要使用 voice。',
    expressive ? '这个角色情绪明显时，远程模式可以更自然地拆成 2～4 条短消息。' : '',
    restrained ? '这个角色更克制，远程模式通常保持 1～2 条，不要为了“小手机感”强行碎片化。' : '',
    `角色是“${character.name}”。presence 只有双方真正见面或分开时才改变，不要仅因为“我去找你”“我快到了”就提前切换。`,
    '状态只更新这一轮确实发生变化的字段，不要为了戏剧性突然改变地点、关系或事件。',
    '隐藏数据块必须放在回复最后，不要使用 Markdown 代码块，不要向用户解释协议。正文与 messages 不要重复；有 messages 时界面优先使用 messages。'
  ].filter(Boolean).join('\n')
}

export function visibleStreamingText(raw: string): string {
  const packet = extractBlock(raw, PACKET_OPEN, PACKET_CLOSE)
  if (packet) return packet.before.trimEnd()
  const status = extractBlock(raw, STATUS_OPEN, STATUS_CLOSE)
  if (status) return status.before.trimEnd()
  for (const marker of ['<companion_', '<role_']) {
    const index = raw.lastIndexOf(marker)
    if (index >= 0) return raw.slice(0, index).trimEnd()
  }
  return raw
}

export function parseCompanionOutput(raw: string): ParsedCompanionOutput {
  const warnings: string[] = []
  let visibleText = raw.trim()
  let packet: RawPacket | undefined
  let rawPacket = ''

  const packetBlock = extractBlock(raw, PACKET_OPEN, PACKET_CLOSE)
  if (packetBlock) {
    visibleText = packetBlock.before.trim()
    rawPacket = packetBlock.block.trim()
    if (packetBlock.complete) {
      packet = parseJsonBlock(packetBlock.block)
      if (!packet) warnings.push('互动协议 JSON 无法解析，已保留可见正文。')
    } else warnings.push('互动协议数据块没有正常闭合，已忽略状态更新。')
  } else {
    const statusBlock = extractBlock(raw, STATUS_OPEN, STATUS_CLOSE)
    if (statusBlock) {
      visibleText = statusBlock.before.trim()
      rawPacket = statusBlock.block.trim()
      const legacy = statusBlock.complete ? parseJsonBlock(statusBlock.block) : undefined
      if (legacy) packet = { status: (legacy.status && typeof legacy.status === 'object' ? legacy.status : legacy) as Record<string, unknown> }
      else warnings.push('角色状态数据无法解析，已忽略。')
    }
  }

  const messages: CompanionActionMessage[] = []
  if (Array.isArray(packet?.messages)) {
    for (const row of packet.messages.slice(0, 8)) {
      const kind = normalizeKind(row.kind)
      const content = cleanText(row.content, kind === 'image_placeholder' ? 240 : kind === 'scene_action' ? 420 : 800)
      const delayMs = typeof row.delayMs === 'number' && Number.isFinite(row.delayMs)
        ? Math.min(3000, Math.max(120, Math.round(row.delayMs)))
        : undefined
      const targetMessageId = cleanText(row.targetMessageId, 80) || undefined
      if (kind === 'typing_pause') {
        messages.push({ kind, content: '', delayMs: delayMs ?? 620 })
        continue
      }
      if (kind === 'recall_message') {
        messages.push({ kind, content, targetMessageId })
        continue
      }
      if (!content) continue
      messages.push({ kind, content, delayMs, targetMessageId })
    }
  }

  if (!messages.length && visibleText) messages.push({ kind: 'text', content: visibleText })
  if (!messages.length) {
    const recovered = raw.replace(/<companion_packet>[\s\S]*$/i, '').replace(/<role_status>[\s\S]*$/i, '').trim()
    if (recovered) messages.push({ kind: 'text', content: recovered })
  }

  const status = normalizeStatus(packet?.status)
  const visibleActions = messages.filter(item => !['typing_pause', 'recall_message', 'react_to_message'].includes(item.kind))
  const actionKinds = Array.from(new Set(messages.map(item => item.kind)))
  const actionSummary = [
    visibleActions.length ? `${visibleActions.length} 条可见内容` : '无可见内容',
    actionKinds.includes('scene_action') ? '场景动作' : '',
    actionKinds.includes('typing_pause') ? '输入停顿' : '',
    actionKinds.includes('recall_message') ? '撤回' : '',
    actionKinds.includes('react_to_message') ? '消息回应' : '',
    actionKinds.includes('emoji') ? '表情' : '',
    actionKinds.includes('voice') ? '语音样式' : '',
    actionKinds.includes('image_placeholder') ? '图片占位' : '',
    status ? '状态更新' : ''
  ].filter(Boolean).join(' · ')

  return {
    visibleText: visibleActions.map(item => item.kind === 'scene_action' ? `（${stripActionBrackets(item.content)}）` : item.content).filter(Boolean).join('\n\n'),
    messages,
    status,
    rawPacket: rawPacket || undefined,
    actionSummary,
    warnings
  }
}

function stripActionBrackets(value: string) {
  return value.trim()
    .replace(/^（([\s\S]*)）$/, '$1')
    .replace(/^\(([\s\S]*)\)$/, '$1')
    .replace(/^\*([\s\S]*)\*$/, '$1')
    .replace(/^【([\s\S]*)】$/, '$1')
    .trim()
}

/**
 * 兼容没有按协议输出、而是直接把动作写进括号或星号的模型。
 * 只有完整的括号/星号片段会转换为 scene_action，普通正文保持 text。
 */
export function extractInlineSceneActions(text: string): CompanionActionMessage[] {
  const value = text.replace(/\r\n/g, '\n').trim()
  if (!value) return []
  const pattern = /（([^（）\n]{1,180})）|\(([^()\n]{1,180})\)|\*([^*\n]{2,180})\*|【([^【】\n]{1,180})】/g
  const result: CompanionActionMessage[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value))) {
    const before = value.slice(cursor, match.index).trim()
    if (before) result.push({ kind: 'text', content: before })
    const action = stripActionBrackets(match[0])
    if (action) result.push({ kind: 'scene_action', content: action })
    cursor = match.index + match[0].length
  }
  const after = value.slice(cursor).trim()
  if (after) result.push({ kind: 'text', content: after })
  return result.length ? result : [{ kind: 'text', content: value }]
}

function splitNaturalText(text: string, maxParts: number) {
  const paragraphs = text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)
  if (paragraphs.length > 1) {
    if (paragraphs.length <= maxParts) return paragraphs
    return [
      ...paragraphs.slice(0, Math.max(1, maxParts - 1)),
      paragraphs.slice(Math.max(1, maxParts - 1)).join('\n\n')
    ]
  }
  const normalized = text.trim()
  if (normalized.length < 12) return [normalized]
  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g)?.map(item => item.trim()).filter(Boolean) || [normalized]
  if (sentences.length < 2) return [normalized]
  if (normalized.length <= 42 && sentences.length <= maxParts) return sentences
  const parts: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (parts.length >= maxParts - 1) {
      current += sentence
      continue
    }
    const shouldBreak = Boolean(current) && ((current.length + sentence.length > 22 && current.length >= 4) || current.length >= 18)
    if (shouldBreak) {
      parts.push(current)
      current = sentence
    } else current += sentence
  }
  if (current) parts.push(current)
  return parts.slice(0, maxParts)
}

function expandInlineActions(actions: CompanionActionMessage[]) {
  const result: CompanionActionMessage[] = []
  for (const action of actions) {
    if (action.kind !== 'text') {
      result.push(action)
      continue
    }
    const expanded = extractInlineSceneActions(action.content)
    for (const item of expanded) result.push({ ...item, delayMs: item.kind === 'text' ? action.delayMs : item.delayMs })
  }
  return result
}

function mergeTogetherActions(actions: CompanionActionMessage[], showSceneActions: boolean) {
  const result: CompanionActionMessage[] = []
  let buffer: string[] = []
  let firstDelay: number | undefined
  const flush = () => {
    if (!buffer.length) return
    result.push({ kind: 'text', content: buffer.join('\n').trim(), delayMs: firstDelay })
    buffer = []
    firstDelay = undefined
  }

  for (const action of actions) {
    if (action.kind === 'typing_pause') continue
    if (action.kind === 'text') {
      if (!firstDelay && action.delayMs) firstDelay = action.delayMs
      if (action.content.trim()) buffer.push(action.content.trim())
      continue
    }
    if (action.kind === 'scene_action') {
      if (showSceneActions && action.content.trim()) buffer.push(`（${stripActionBrackets(action.content)}）`)
      continue
    }
    flush()
    result.push(action)
  }
  flush()
  return result
}

function splitRemoteTextActions(
  actions: CompanionActionMessage[],
  character: Character,
  settings: ChatSettings
) {
  const source = `${character.persona} ${character.speakingStyle || ''}`
  const restrained = /克制|清冷|寡言|简短|冷静|毒舌/.test(source)
  const expressive = /活泼|外向|黏人|元气|直率|话多/.test(source)
  const maxParts = restrained ? 3 : expressive ? 5 : 4
  const pause = expressive ? 360 : restrained ? 760 : 540
  const result: CompanionActionMessage[] = []

  for (const action of actions) {
    if (action.kind !== 'text' || !settings.multiBubble) {
      result.push(action)
      continue
    }
    const parts = splitNaturalText(action.content, maxParts)
    parts.forEach((content, index) => {
      if (index > 0) result.push({ kind: 'typing_pause', content: '', delayMs: pause })
      result.push({ kind: 'text', content, delayMs: index === 0 ? action.delayMs : undefined })
    })
  }
  return result
}

export function shapeCompanionActions(
  actions: CompanionActionMessage[],
  character: Character,
  settings: ChatSettings,
  _hadProtocol = false,
  state?: ConversationState
): CompanionActionMessage[] {
  const presence = resolvePresenceMode(settings, state)
  const actionVisibility = settings.actionVisibility ?? 'always'
  const expanded = expandInlineActions(actions)

  if (presence === 'together') {
    return mergeTogetherActions(expanded, actionVisibility !== 'off')
  }

  const remoteActions = expanded.filter(action => action.kind !== 'scene_action' || actionVisibility === 'always')
  return splitRemoteTextActions(remoteActions, character, settings)
}

export function estimateVoiceDuration(text: string) {
  const count = text.replace(/\s+/g, '').length
  return Math.max(2, Math.min(60, Math.round(count / 4.2)))
}

export function mergeStatusIntoConversationState(state: ConversationState, patch?: CompanionStatusPatch): Partial<ConversationState> {
  if (!patch) return {}
  return {
    innerMood: patch.mood || state.innerMood,
    innerActivity: patch.activity || state.innerActivity,
    innerThought: patch.innerThought || state.innerThought,
    location: patch.location || state.location,
    presence: patch.presence || state.presence || 'remote',
    relationshipNote: patch.relationshipNote || state.relationshipNote,
    timePeriod: patch.timePeriod || state.timePeriod,
    energy: patch.energy || state.energy,
    unresolvedTopics: patch.unresolvedTopics ?? state.unresolvedTopics ?? [],
    pendingEvents: patch.pendingEvents ?? state.pendingEvents ?? [],
    shortTermGoals: patch.shortTermGoals ?? state.shortTermGoals ?? [],
    lastCompletedEvent: patch.completedEvent || state.lastCompletedEvent,
    stateVersion: 2,
    statusUpdatedAt: new Date().toISOString()
  }
}

export function naturalnessWarnings(text: string): string[] {
  const value = text.trim()
  if (!value) return ['回复为空。']
  const rules: Array<[RegExp, string]> = [
    [/你分享了.{0,18}(图片|照片)/, '出现“你分享了……”的图片助手腔。'],
    [/从(这|这些)?(张)?(图片|照片|图中)(可以)?看出/, '使用了分析报告式开场。'],
    [/你是想.{0,30}还是/, '使用了客服式二选一追问。'],
    [/我注意到/, '使用了高频通用 AI 句式“我注意到”。'],
    [/作为(一个)?AI|我是(一个)?AI|语言模型/, '暴露了 AI 或模型身份。'],
    [/(首先|其次|最后)[，,:：]/, '回复呈现说明文列表腔。'],
    [/如果你愿意|如果你需要|我可以帮你/, '出现通用助手式服务话术。']
  ]
  const warnings = rules.filter(([pattern]) => pattern.test(value)).map(([, label]) => label)
  const questionCount = (value.match(/[？?]/g) || []).length
  if (questionCount >= 3) warnings.push('单次回复问题过多，容易像问卷。')
  if (value.length > 420) warnings.push('日常聊天回复偏长，可能削弱手机聊天感。')
  const repeated = value.split(/[。！？!?\n]/).map(item => item.trim()).filter(Boolean)
  if (new Set(repeated).size < repeated.length) warnings.push('回复中出现重复句子。')
  return warnings
}

export function scoreNaturalness(options: {
  text: string
  character: Character
  latestUserText?: string
  relationshipNote?: string
  imageCount?: number
  recentAssistantMessages?: Message[]
}) {
  const text = options.text.trim()
  const warnings = naturalnessWarnings(text)
  const questionCount = (text.match(/[？?]/g) || []).length
  const source = `${options.character.persona} ${options.character.speakingStyle || ''}`
  const styleTokens = source.split(/[，。；、\s]/).filter(item => item.length >= 2).slice(0, 18)
  const styleHits = styleTokens.filter(token => text.includes(token)).length
  const recent = options.recentAssistantMessages?.slice(-4).map(item => item.content) || []
  const repeatedOpening = recent.some(item => item.slice(0, 12) && text.startsWith(item.slice(0, 12)))
  const userKeywords = (options.latestUserText || '').split(/[，。！？!?\s]/).filter(item => item.length >= 2)
  const userFocusHits = userKeywords.filter(token => text.includes(token)).length

  const roleConsistency = Math.min(100, 68 + styleHits * 5 + (text.includes(options.character.nickname || options.character.name) ? 2 : 0))
  const aiToneRisk = Math.max(0, 100 - warnings.length * 19)
  const repetitionRisk = repeatedOpening ? 45 : 88
  const questionBalance = questionCount >= 3 ? 42 : questionCount === 2 ? 70 : 92
  const lengthFit = text.length > 500 ? 45 : text.length > 320 ? 68 : text.length < 4 ? 35 : 92
  const relationshipResponse = options.relationshipNote && /想|在意|吃醋|关心|担心|喜欢|记得/.test(text) ? 94 : 78
  const userFocus = userKeywords.length ? Math.min(100, 68 + userFocusHits * 8) : 82
  const imageUse = options.imageCount ? (/图片|照片|第一张|第二张|画面|看/.test(text) ? 88 : 74) : 90
  const total = Math.round((roleConsistency + aiToneRisk + repetitionRisk + questionBalance + lengthFit + relationshipResponse + userFocus + imageUse) / 8)
  return { total, roleConsistency, aiToneRisk, repetitionRisk, questionBalance, lengthFit, relationshipResponse, userFocus, imageUse }
}
