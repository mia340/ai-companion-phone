import { extractRoleCardUiHints, parseRoleCardUi, resolvePresenceFromRoleCardScene, roleCardUiToConversationPatch, type PresenceResolution, type RoleCardUiState } from './roleCardUiService'
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
  roleCardUi?: RoleCardUiState
  presenceResolution?: PresenceResolution
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

export function resolvePresenceMode(settings: ChatSettings, state?: ConversationState): 'together' | 'remote' | undefined {
  // V0.4.4.7：手动选择表示“当前状态”，不是永久锁。
  // 一旦用户本轮用明确动作改变位置，state 的 user-transition 优先，直到用户再次手动指定或发生新的明确变化。
  if (state?.presenceResolutionSource === 'user-transition' && (state.presence === 'together' || state.presence === 'remote')) return state.presence
  if (settings.presenceMode === 'together' || settings.presenceMode === 'remote') return settings.presenceMode
  return state?.presence === 'together' || state?.presence === 'remote' ? state.presence : undefined
}

function resolveConversationPresentationMode(settings: ChatSettings): 'scene-merged' | 'phone-text' | 'phone-split' {
  // V0.4.4.5：呈现方式只回答“用户想怎么看”，不再由相处状态自动改写。
  // 旧数据库没有该字段时默认采用场景合并，保持长文/沉浸聊天的默认体验。
  return settings.conversationPresentationMode ?? 'scene-merged'
}

export function buildPresentationOverridePrompt(settings: ChatSettings): string {
  const mode = resolveConversationPresentationMode(settings)
  if (mode === 'scene-merged') return ''
  if (mode === 'phone-text') {
    return [
      '【用户选择的最终呈现方式 · 最高优先级】',
      '当前是“纯手机消息”。最终可见回复只能包含角色本人真正发送/说出的语句。',
      '不要输出动作、旁白、心理、状态栏、日期地点、好感度、人物面板、HTML/XML/Markdown UI、场外观众席、角色互动栏或任何解释性标签。即使原卡通常带这些 UI，本模式也只保留其剧情语义，不输出界面外壳。',
      '如果角色这一轮自然发送一条完整长消息/小作文，就保持一条 text，不要按句号机械拆开；只有角色确实想连续发送数条独立短消息时才使用多个 text。',
      '绝对不要替用户生成新的发言、消息、选择或动作。任何 user/{{user}}/自己/我方/右侧用户消息槽只能引用真实历史中用户已经发送过的内容，本轮不得补写。',
      '需要多条消息时优先使用 companion_packet 的多个 text；每个 text 都只能是角色本人发送的内容。'
    ].join('\n')
  }
  return [
    '【用户选择的最终呈现方式 · 最高优先级】',
    '当前是“动作 / 台词分开”。只输出角色本轮可见动作 scene_action 与角色本人真正说出/发送的 text。',
    '不要输出状态栏、日期地点面板、好感度面板、作者 HTML/UI 外壳、场外观众席或其它状态型附属界面；剧情事实可以继续在后台上下文中保持。',
    '绝对不要替用户生成新的发言、消息、选择或动作。'
  ].join('\n')
}

const SCENE_ACTION_FULL_PATTERN = /<\s*scene[_-]?action\b[^>]*>([\s\S]*?)<\s*\/\s*scene[_-]?action\s*>/gi
const SCENE_ACTION_OPEN_PATTERN = /<\s*scene[_-]?action\b[^>]*>/gi
const SCENE_ACTION_CLOSE_PATTERN = /<\s*\/\s*scene[_-]?action\s*>/gi
const SCENE_ACTION_PARTIAL_PATTERN = /<\s*\/?\s*scene(?:[_-]?action)?[^>]*$/i

function cleanSceneActionMarkup(value: string) {
  return value
    .replace(SCENE_ACTION_OPEN_PATTERN, '')
    .replace(SCENE_ACTION_CLOSE_PATTERN, '')
    .replace(SCENE_ACTION_PARTIAL_PATTERN, '')
}

export function buildInteractionProtocolPrompt(
  settings: ChatSettings,
  character: Character,
  state?: ConversationState
): string {
  if (!settings.actionProtocolEnabled) return ''
  const voiceAllowed = settings.autoReadAloud || Boolean(settings.voiceName)
  const presence = resolvePresenceMode(settings, state)
  const actionVisibility = settings.actionVisibility ?? 'always'
  const presentationMode = resolveConversationPresentationMode(settings)
  const layoutRule = presentationMode === 'scene-merged'
    ? '当前聊天呈现方式是“场景合并”：动作与对白使用同一个剧情气泡；scene_action 与相邻 text 会由界面合并，不要把动作复制进对白。'
    : presentationMode === 'phone-text'
      ? '当前聊天呈现方式是“纯手机消息”：只输出角色本人真正发送/说出的 text；不要输出 scene_action、状态栏、旁白或 UI。角色仍可在内部保持动作与环境事实。'
      : '当前聊天呈现方式是“动作 / 台词分开”：scene_action 是独立动作消息，对白保持 text；不要把动作复制进对白。'

  const sceneRule = presence === 'together'
    ? [
      '当前相处状态：你与用户在同一现场。',
      presentationMode === 'phone-text' || actionVisibility === 'off'
        ? '当前可见动作关闭：不要输出 scene_action，只输出角色真正说出或发送的话。'
        : '你可以使用 scene_action 描写用户能直接看到的动作、表情、视线、距离变化和环境互动。',
      layoutRule,
      '同场景时不要为了“小手机感”强行把一句完整互动拆成很多气泡。'
    ]
    : presence === 'remote'
      ? [
        '当前相处状态：你与用户不在同一现场，通过当前世界观允许的远程方式联系。不要默认角色拥有手机、聊天软件或现代设备；若角色卡/世界观没有明确现代通讯设定，只描述角色自身状态与回复，不凭空加入设备动作。',
        presentationMode === 'phone-text' || actionVisibility !== 'always'
          ? '当前可见动作关闭：不要输出 scene_action。'
          : '可以输出有情境价值的 scene_action；不要为了满足协议机械补动作。',
        layoutRule,
        '远程对白保持自然完整。除非你明确想发送连续多条消息，否则不要为了“小手机感”把一个完整段落按句号、引号或换行机械拆成多条。'
      ]
      : [
        '当前相处状态尚未确定。必须根据原角色卡、当前剧情地点和本轮实际互动判断；不要默认远程，也不要默认同场。',
        '如果本轮出现明确身体接触或只能同场发生的近距离互动，presence 设为 together；如果明确分隔两地，presence 设为 remote；证据不足时不要强行改变状态。',
        presentationMode === 'phone-text' || actionVisibility === 'off' ? '当前可见动作关闭：不要输出 scene_action。' : '只有自然需要时才输出 scene_action，不要机械补动作。',
        '普通对白保持自然完整，不按标点机械拆分。'
      ]

  return [
    '【小手机互动协议 V2.1】',
    '先像真实角色一样回应。普通一条文字最合适时可以直接输出正文；需要动作、连续短消息、停顿或状态变化时使用隐藏协议。',
    ...sceneRule,
    '隐藏数据块格式示例：',
    '<companion_packet>{"messages":[{"kind":"text","content":"<由角色自行生成>"}],"status":{"presence":"together|remote|省略"}}</companion_packet>',
    'messages 最多 8 个动作。kind 可用：text、scene_action、emoji、voice、typing_pause、recall_message、react_to_message、image_placeholder。',
    'scene_action 只写动作本身，不要自带圆括号；界面会按用户选择的聊天呈现方式决定“同气泡 / 隐藏 / 独立 Action”，与相处状态分开处理。',
    'typing_pause 只表示停顿，delayMs 建议 250～1800；recall_message 用于偶尔撤回上一条角色消息；react_to_message 的 content 只放一个回应表情，targetMessageId 可用 latest_user；image_placeholder 描述角色想分享但当前没有真实文件的图片。',
    '撤回和回应表情只能偶尔使用，不能每轮出现。不要用撤回来操控、惩罚或制造焦虑。',
    voiceAllowed ? '可以偶尔使用 voice，内容必须是角色真正会说的话。' : '当前没有开启角色声音，通常不要使用 voice。',
    '是否使用多条 text、动作、停顿、语音或表情，完全由角色卡和本轮语境决定；协议只提供结构，不预设角色行为。',
    '绝对不要替用户生成用户未实际发送过的新台词、消息、选择或动作；社区聊天模板中的 user/{{user}}/自己/我方槽位只能引用真实历史，不得由角色代写。',
    `角色是“${character.name}”。presence 只有双方真正见面或分开时才改变，不要仅因为“我去找你”“我快到了”就提前切换；但只要本轮发生拥抱、亲吻、牵手、贴近、把用户搂进怀里等直接身体接触，presence 必须是 together。`,
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

  let visible = raw.replace(SCENE_ACTION_FULL_PATTERN, (_whole, body: string) => {
    const action = cleanSceneActionMarkup(String(body)).trim()
    return action ? `（${action}）` : ''
  })

  // 流式输出可能在开标签、闭标签甚至标签名中间被截断。
  // 未闭合动作仍可显示动作正文，但任何 XML 碎片都不能泄漏到聊天气泡。
  visible = visible.replace(/<\s*scene[_-]?action\b[^>]*>([\s\S]*)$/i, (_whole, body: string) => {
    const action = cleanSceneActionMarkup(String(body)).trim()
    return action ? `（${action}）` : ''
  })

  return cleanSceneActionMarkup(visible)
}

export interface ParseCompanionOutputOptions {
  interpretNativeProtocol?: boolean
  userName?: string
}

export function parseCompanionOutput(raw: string, options: ParseCompanionOutputOptions = {}): ParsedCompanionOutput {
  const interpretNativeProtocol = options.interpretNativeProtocol ?? true
  if (!interpretNativeProtocol) {
    const visibleText = raw.trim()
    const roleCardUi = extractRoleCardUiHints(raw)
    const userNames = options.userName ? [options.userName] : []
    const uiPatch = roleCardUi ? roleCardUiToConversationPatch(raw, roleCardUi, userNames) : {}
    const presenceResolution = resolvePresenceFromRoleCardScene(raw, roleCardUi, undefined, userNames)
    const status: CompanionStatusPatch | undefined = Object.keys(uiPatch).length || presenceResolution.resolvedPresence
      ? {
        location: uiPatch.location,
        innerThought: uiPatch.innerThought,
        timePeriod: uiPatch.timePeriod,
        shortTermGoals: uiPatch.shortTermGoals,
        presence: presenceResolution.resolvedPresence || uiPatch.presence
      }
      : undefined
    return {
      visibleText,
      messages: visibleText ? [{ kind: 'text', content: visibleText }] : [],
      status,
      actionSummary: visibleText ? '1 条原卡文本' : '无可见内容',
      warnings: [],
      roleCardUi,
      presenceResolution
    }
  }

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

  const parsedUi = parseRoleCardUi(visibleText)
  visibleText = parsedUi.content
  let roleCardUi = parsedUi.ui || extractRoleCardUiHints(raw)

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

  if (messages.length) {
    for (const row of messages) {
      if (row.kind === 'scene_action') {
        row.content = stripActionBrackets(row.content)
        continue
      }
      if (row.kind !== 'text') continue
      const parsed = parseRoleCardUi(row.content)
      if (parsed.ui && !roleCardUi) roleCardUi = parsed.ui
      row.content = parsed.content
    }
    const taggedExpanded = messages.flatMap(row =>
      row.kind === 'text' && /<\s*scene[_-]?action\b/i.test(row.content)
        ? extractInlineSceneActions(row.content).map(item => ({ ...item, delayMs: item.delayMs ?? row.delayMs }))
        : [row]
    )
    messages.splice(0, messages.length, ...taggedExpanded)
  }
  if (!messages.length && visibleText) messages.push(...extractInlineSceneActions(visibleText))
  if (!messages.length) {
    const recovered = raw.replace(/<companion_packet>[\s\S]*$/i, '').replace(/<role_status>[\s\S]*$/i, '').trim()
    if (recovered) messages.push(...extractInlineSceneActions(recovered))
  }

  let status = normalizeStatus(packet?.status)
  const reportedPresence = status?.presence
  if (roleCardUi) {
    const uiPatch = roleCardUiToConversationPatch(visibleText || messages.map(item => item.content).join(' '), roleCardUi, options.userName ? [options.userName] : [])
    status = { ...(status || {}), ...uiPatch, innerThought: uiPatch.innerThought || status?.innerThought, location: uiPatch.location || status?.location, timePeriod: uiPatch.timePeriod || status?.timePeriod, presence: uiPatch.presence || status?.presence, shortTermGoals: uiPatch.shortTermGoals || status?.shortTermGoals }
  }
  const sceneEvidenceText = [raw, ...messages.map(item => item.content)].filter(Boolean).join('\n')
  const presenceResolution = resolvePresenceFromRoleCardScene(sceneEvidenceText, roleCardUi, reportedPresence, options.userName ? [options.userName] : [])
  if (presenceResolution.resolvedPresence) {
    status = { ...(status || {}), presence: presenceResolution.resolvedPresence }
    if (presenceResolution.conflict) warnings.push(presenceResolution.reason)
  }
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
    warnings,
    roleCardUi,
    presenceResolution
  }
}

function stripActionBrackets(value: string) {
  return cleanSceneActionMarkup(value.trim())
    .replace(/^（([\s\S]*)）$/, '$1')
    .replace(/^\(([\s\S]*)\)$/, '$1')
    .replace(/^\*([\s\S]*)\*$/, '$1')
    .replace(/^【([\s\S]*)】$/, '$1')
    .trim()
}

const STRUCTURED_STATUS_LINE_PATTERN = /^\s*(?:[^\p{L}\p{N}\n]{0,3})?(?:日期|时间|地点|当前地点|人物|在场人物|在场角色|相对位置|衣着|穿着|关系|亲密状态|恋爱纪念日|恋爱天数|内心|心声|天气|季节|环境|场景|周围|待办|状态)\s*[：:∶﹕︰|]/u
const ACTION_SIGNAL_PATTERN = /(?:点头|摇头|皱眉|挑眉|抬眼|抬眸|垂眸|低头|抬头|转头|侧身|起身|坐下|站起|走|靠近|后退|伸手|抬手|收手|握|牵|抱|搂|揽|吻|亲|碰|触|摸|揉|拍|推|拉|递|放|拿|笑|叹|看|望|盯|扫过|扫|眨眼|闭眼|睁眼|呼吸|停顿|顿了|顿住|沉默|开口|说|问|答|弯腰|俯身|蹲|躺|倚|靠|转身|回头|耸肩|抿唇|咬唇|吞咽|颔首|摇了摇)/u

function isInsideCodeFence(text: string, index: number) {
  return (text.slice(0, index).match(/```/g) || []).length % 2 === 1
}

function lineAround(text: string, index: number) {
  const start = text.lastIndexOf('\n', Math.max(0, index - 1)) + 1
  const next = text.indexOf('\n', index)
  const end = next < 0 ? text.length : next
  return text.slice(start, end)
}

function shouldTreatBracketAsAction(text: string, matchIndex: number, rawMatch: string) {
  if (isInsideCodeFence(text, matchIndex)) return false
  const line = lineAround(text, matchIndex)
  if (STRUCTURED_STATUS_LINE_PATTERN.test(line)) return false
  if (/<\/?[A-Za-z][^>]*>/.test(line) || /<!--|-->|<!doctype/i.test(line)) return false
  const action = stripActionBrackets(rawMatch)
  if (!action || !ACTION_SIGNAL_PATTERN.test(action)) return false
  const compactLine = line.trim()
  // 单独一行的（点头）最可靠；嵌在普通叙事中的明显动作也允许。
  if (compactLine === rawMatch.trim()) return true
  return true
}

function stripClearlyUserAuthoredHtmlSections(value: string) {
  return value.replace(/<!--\s*(?=[^>\n]{0,100}(?:自己|用户|我方|user|self))(?=[^>\n]{0,100}(?:消息|发言|message))[^>\n]{0,100}-->[\s\S]*?(?=<!--|$)/gi, '')
}

function extractClearlyRoleAuthoredHtmlSections(value: string) {
  const blocks = [...value.matchAll(/<!--\s*(?=[^>\n]{0,100}(?:对方|角色|char|assistant))(?=[^>\n]{0,100}(?:消息|发言|message))[^>\n]{0,100}-->([\s\S]*?)(?=<!--|$)/gi)]
  if (!blocks.length) return ''
  return blocks
    .map(match => match[1] || '')
    .map(block => block
      .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !/^\d{1,2}:\d{2}$/.test(line) && !/^(?:已读|未读|发送中)$/.test(line))
      .join('\n')
      .trim())
    .filter(Boolean)
    .join('\n\n')
}

function normalizePhonePlainText(value: string, characterName = '') {
  const normalizedSource = value.replace(/\r\n/g, '\n')
  const explicitRoleSide = extractClearlyRoleAuthoredHtmlSections(normalizedSource)
  let text = (explicitRoleSide || stripClearlyUserAuthoredHtmlSections(normalizedSource))
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<([\p{L}\p{N}_:-]{1,32}(?:日期|时间|地点|环境|状态|外观|好感|心声|计划|关系|天气|季节|人物|位置|内心|待办|热搜)[\p{L}\p{N}_:-]*)[^>]*>[\s\S]*?<\/\1>/giu, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:html|body|div|span|section|article|main|header|footer|details|summary|p|strong|b|em|i|small|pre|code|table|tbody|thead|tr|td|th|ul|ol|li|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '\n')

  const lineAllowed = (line: string) => !STRUCTURED_STATUS_LINE_PATTERN.test(line)
    && !/^```/.test(line)
    && !/^\d{1,2}:\d{2}$/.test(line)
    && !/^(?:已读|未读|发送中|对方正在输入(?:…|\.\.\.)?)$/.test(line)
  text = text.split('\n')
    .map(line => line.trim())
    .filter(line => explicitRoleSide ? (!line || lineAllowed(line)) : (line && lineAllowed(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!text) return ''

  const fullyQuoted = text.match(/^[“「"]([\s\S]{1,1600})[”」"]$/)
  if (fullyQuoted) return fullyQuoted[1].trim()

  const escapedName = characterName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const narrator = escapedName ? `(?:他|她|${escapedName})` : '(?:他|她)'
  const quotePattern = /[“「"]([^”」"\n]{1,1200})[”」"]/g
  const quoteMatches = [...text.matchAll(quotePattern)]
  const directSpeechQuotes = quoteMatches
    .filter(match => {
      const start = match.index ?? 0
      const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const linePrefix = text.slice(lineStart, start)
      const context = linePrefix.trimEnd().slice(-80)
      // 引用、备忘录、文件、屏幕文字等不是角色真正发给用户的消息。
      if (/(?:备忘录|笔记|日记|清单|文件|报刊|屏幕|记录|标题|路牌|标签|备注|相册|搜索框|网页).{0,24}(?:写|显示|添|记|记录|内容|是)?\s*[:：]?$/u.test(context)) return false
      if (/(?:没|未|没有)(?:真的)?(?:说|提|写)|(?:提到|引用|重复|想起|想到|想着|看到|读到|所谓)[^“”「」"']{0,18}$/u.test(context)) return false
      // 段首引号、说话动词后的引号、角色叙事段中的对话都属于真实对白。
      if (!context.trim()) return true
      if (/(?:说|问|答|道|补充|开口|回复|发来|发消息|写道|敲下|低声|轻声|喊|叫|嘟囔|呢喃|提醒|表示)[^“”「」"']{0,36}[，,：:]?\s*$/u.test(context)) return true
      if (new RegExp(`${narrator}.{0,48}$`, 'u').test(context) && !/(?:想|看|读|写|记|备忘录|文件|屏幕)/u.test(context)) return true
      return true
    })
    .map(match => match[1].trim())
    .filter(Boolean)

  // “发了一遍：到了，水烧好告诉你。”这类没有引号但明确标记为发送/回复的内容。
  const sentTailMatches = [...text.matchAll(/(?:发(?:了|来)?(?:一条|一句|消息)?|回复(?:了)?|回(?:了)?消息|发了一遍|重新发(?:了)?)[^：:\n]{0,24}[：:]\s*([^\n]{1,800})/gu)]
    .map(match => match[1].trim())
    .filter(item => item && !STRUCTURED_STATUS_LINE_PATTERN.test(item))

  const extracted = [...directSpeechQuotes, ...sentTailMatches]
  if (extracted.length) return Array.from(new Set(extracted)).join('\n\n')

  const outsideQuotes = text.replace(quotePattern, ' ')
  const narrativeOpening = new RegExp(
    `^${narrator}(?:的)?(?:指尖|手指|手|目光|视线|眼|眸|眉|唇|喉结|肩|身体|脚|步伐|下巴|头|脸|身影|呼吸)|^${narrator}(?:抬|低|垂|转|侧|起|坐|站|走|迈|跑|伸|收|握|牵|抱|搂|揽|吻|碰|触|摸|揉|拍|推|拉|递|拿|放|捞|披|绕|系|踩|发动|打开|关上|摸出|盯|扫|眨|闭|睁|停|顿|弯|俯|蹲|躺|倚|靠)`,
    'u'
  )
  const hasNarration = new RegExp(`${narrator}.{0,36}(?:${ACTION_SIGNAL_PATTERN.source})|(?:${ACTION_SIGNAL_PATTERN.source}).{0,28}${narrator}`, 'u').test(outsideQuotes)
    || text.split(/\n{2,}/).some(paragraph => narrativeOpening.test(paragraph.trim()))
  if (hasNarration) {
    // 纯叙事但没有真正对白/消息时，手机投影宁可不显示，也绝不把旁白伪装成聊天消息。
    // 这里只移除明显以角色动作/身体描写开头的叙事段；无法确认的直接消息不做语义改写。
    const paragraphs = text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean)
    const direct = paragraphs.filter(paragraph => {
      if (narrativeOpening.test(paragraph)) return false
      return !new RegExp(`^${narrator}.{0,48}(?:${ACTION_SIGNAL_PATTERN.source})`, 'u').test(paragraph)
    })
    return direct.join('\n\n').trim()
  }

  // 本身就是直接消息（没有第三人称动作叙事）时原样保留。
  return text.trim()
}

export function segmentNaturalPhoneMessages(value: string): string[] {
  const text = value.replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const blocks = text.split(/\n\s*\n+/).map(item => item.trim()).filter(Boolean)
  if (blocks.length <= 1) return [text]
  const lengths = blocks.map(item => item.replace(/\s+/g, '').length)
  const total = lengths.reduce((sum, item) => sum + item, 0)
  const max = Math.max(...lengths)
  // 仅把“明显是连续短消息”的段落拆开；长解释、小作文、告白/道歉等保持完整。
  if (blocks.length <= 4 && total <= 90 && max <= 30) return blocks
  return [blocks.join('\n\n')]
}

function extractBracketSceneActions(text: string): CompanionActionMessage[] {
  const pattern = /（([^（）\n]{1,180})）|\(([^()\n]{1,180})\)|\*([^*\n]{2,180})\*/g
  const result: CompanionActionMessage[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    if (!shouldTreatBracketAsAction(text, match.index, match[0])) continue
    const before = text.slice(cursor, match.index).trim()
    if (before) result.push({ kind: 'text', content: before })
    const action = stripActionBrackets(match[0])
    if (action) result.push({ kind: 'scene_action', content: action })
    cursor = match.index + match[0].length
  }
  const after = text.slice(cursor).trim()
  if (after) result.push({ kind: 'text', content: after })
  return result.length ? result : text.trim() ? [{ kind: 'text', content: text.trim() }] : []
}

/**
 * 兼容社区卡常见的 scene_action XML 标签，以及没有按协议输出、直接使用括号/星号的动作。
 * scene_action 可带 perspective 等任意属性，标签永远不会作为普通聊天文字泄漏。
 */
export function extractInlineSceneActions(text: string): CompanionActionMessage[] {
  const value = text.replace(/\r\n/g, '\n').trim()
  if (!value) return []
  const tagPattern = new RegExp(SCENE_ACTION_FULL_PATTERN.source, 'gi')
  const result: CompanionActionMessage[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  let foundTag = false
  while ((match = tagPattern.exec(value))) {
    foundTag = true
    const before = cleanSceneActionMarkup(value.slice(cursor, match.index))
    result.push(...extractBracketSceneActions(before))
    const action = stripActionBrackets(match[0])
    if (action) result.push({ kind: 'scene_action', content: action })
    cursor = match.index + match[0].length
  }
  if (foundTag) {
    result.push(...extractBracketSceneActions(cleanSceneActionMarkup(value.slice(cursor))))
    return result.filter(item => item.content.trim())
  }

  const orphanOpen = value.match(/<\s*scene[_-]?action\b[^>]*>([\s\S]*)$/i)
  if (orphanOpen) {
    const before = cleanSceneActionMarkup(value.slice(0, orphanOpen.index || 0))
    result.push(...extractBracketSceneActions(before))
    const action = stripActionBrackets(orphanOpen[1] || '')
    if (action) result.push({ kind: 'scene_action', content: action })
    return result.filter(item => item.content.trim())
  }

  return extractBracketSceneActions(cleanSceneActionMarkup(value))
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
    result.push({ kind: 'text', content: buffer.join('').trim(), delayMs: firstDelay })
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

export function shapeCompanionActions(
  actions: CompanionActionMessage[],
  _character: Character,
  settings: ChatSettings,
  _hadProtocol = false,
  state?: ConversationState
): CompanionActionMessage[] {
  const presence = resolvePresenceMode(settings, state)
  const actionVisibility = settings.actionVisibility ?? 'always'
  const presentationMode = resolveConversationPresentationMode(settings)
  const showSceneActions = presentationMode !== 'phone-text' && (actionVisibility === 'always' || (actionVisibility === 'together' && presence === 'together'))
  const expanded = expandInlineActions(actions)

  if (presentationMode === 'scene-merged') {
    return mergeTogetherActions(expanded, showSceneActions)
  }

  // 纯手机消息：最终可见层只有角色本人真正发送的文字。
  // 状态/动作仍可由 parsedOutput.status 在后台维护，但 UI、动作、表情、语音占位都不进入聊天流。
  if (presentationMode === 'phone-text') {
    const textRows = expanded
      .filter(action => action.kind === 'text')
      .map(action => ({ ...action, content: normalizePhonePlainText(action.content, _character.name) }))
      .filter(action => action.content.trim())

    if (!textRows.length) return []
    if (!settings.multiBubble) {
      return [{ kind: 'text', content: textRows.map(item => item.content).join('\n\n').trim(), delayMs: textRows[0].delayMs }]
    }
    // companion_packet 已经明确给出多条 text 时尊重模型的发送边界；
    // 没有显式边界时才做保守的“自然消息分段”，绝不按句号机械切碎。
    if (_hadProtocol || textRows.length > 1) return textRows
    return segmentNaturalPhoneMessages(textRows[0].content).map((content, index) => ({
      kind: 'text' as const,
      content,
      delayMs: index === 0 ? textRows[0].delayMs : undefined
    }))
  }

  // 动作 / 台词分开：只显示真正动作与角色台词，不把状态 UI / HTML 当作普通消息。
  return expanded
    .filter(action => action.kind === 'text' || action.kind === 'scene_action')
    .map(action => action.kind === 'text' ? { ...action, content: normalizePhonePlainText(action.content, _character.name) } : action)
    .filter(action => action.content.trim() && (action.kind !== 'scene_action' || showSceneActions))
}

export function estimateVoiceDuration(text: string) {
  const count = text.replace(/\s+/g, '').length
  return Math.max(2, Math.min(60, Math.round(count / 4.2)))
}

export function mergeStatusIntoConversationState(state: ConversationState, patch?: CompanionStatusPatch, presenceResolution?: PresenceResolution): Partial<ConversationState> {
  if (!patch) return {}
  return {
    innerMood: patch.mood || state.innerMood,
    innerActivity: patch.activity || state.innerActivity,
    innerThought: patch.innerThought || state.innerThought,
    location: patch.location || state.location,
    presence: patch.presence || state.presence,
    reportedPresence: presenceResolution?.reportedPresence ?? state.reportedPresence,
    presenceResolutionReason: presenceResolution?.reason || state.presenceResolutionReason,
    presenceResolutionSource: presenceResolution?.source || state.presenceResolutionSource,
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
