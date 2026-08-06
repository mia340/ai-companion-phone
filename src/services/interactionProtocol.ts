import type {
  Character,
  ChatSettings,
  CompanionMessageKind,
  ConversationState
} from '../types/domain'

export interface CompanionActionMessage {
  kind: CompanionMessageKind
  content: string
}

export interface CompanionStatusPatch {
  mood?: string
  activity?: string
  location?: string
  relationshipNote?: string
  innerThought?: string
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

function normalizeKind(value: unknown): CompanionMessageKind {
  return value === 'emoji' || value === 'voice'
    ? value
    : 'text'
}

function parseJsonBlock(value: string): RawPacket | undefined {
  try {
    const normalized = value
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
    const parsed = JSON.parse(normalized)
    return parsed && typeof parsed === 'object'
      ? parsed as RawPacket
      : undefined
  } catch {
    return undefined
  }
}

function normalizeStatus(
  status: RawPacket['status']
): CompanionStatusPatch | undefined {
  if (!status) return undefined

  const patch: CompanionStatusPatch = {
    mood: cleanText(status.mood, 40) || undefined,
    activity: cleanText(status.activity, 60) || undefined,
    location: cleanText(status.location, 60) || undefined,
    relationshipNote: cleanText(
      status.relationshipNote ?? status.relationship,
      100
    ) || undefined,
    innerThought: cleanText(
      status.innerThought ?? status.thought,
      180
    ) || undefined
  }

  return Object.values(patch).some(Boolean)
    ? patch
    : undefined
}

function extractBlock(raw: string, open: string, close: string) {
  const start = raw.indexOf(open)
  if (start < 0) return undefined

  const end = raw.indexOf(close, start + open.length)
  if (end < 0) {
    return {
      before: raw.slice(0, start),
      block: raw.slice(start + open.length),
      complete: false
    }
  }

  return {
    before: raw.slice(0, start),
    block: raw.slice(start + open.length, end),
    complete: true
  }
}

export function buildInteractionProtocolPrompt(
  settings: ChatSettings,
  character: Character
): string {
  if (!settings.actionProtocolEnabled) return ''

  const voiceAllowed = settings.autoReadAloud || Boolean(settings.voiceName)

  return [
    '【小手机互动协议】',
    '先像真实角色一样生成自然内容。通常直接输出正文即可，不必每轮都使用协议。',
    '当这一轮适合连续短消息、单独表情、语音样式或状态更新时，在回复末尾追加一个隐藏数据块：',
    '<companion_packet>{"messages":[{"kind":"text","content":"第一条"},{"kind":"emoji","content":"😒"},{"kind":"voice","content":"语音内容"}],"status":{"mood":"情绪","activity":"正在做什么","location":"地点","relationshipNote":"这一刻对关系的主观感受","innerThought":"一句短暂内心想法"}}</companion_packet>',
    'messages 最多 4 条。kind 只能是 text、emoji、voice。emoji 只放一个自然表情或颜文字；voice 内容必须是角色真正会说的话。',
    voiceAllowed
      ? '当前聊天允许语音样式消息，可以偶尔使用 voice，但不要频繁使用。'
      : '当前聊天没有开启角色声音；除非情境特别适合，否则不要使用 voice。',
    `角色是“${character.name}”。状态字段必须符合角色卡和当前关系，不得为了制造戏剧性突然大幅变化。`,
    '隐藏数据块必须放在回复最后；不要用 Markdown 代码块包裹；不要向用户解释这个协议。',
    '正文与 messages 不要重复。如果提供 messages，界面会优先使用 messages；正文可以留空。'
  ].join('\n')
}

export function visibleStreamingText(raw: string): string {
  const packet = extractBlock(raw, PACKET_OPEN, PACKET_CLOSE)
  if (packet) return packet.before.trimEnd()

  const status = extractBlock(raw, STATUS_OPEN, STATUS_CLOSE)
  if (status) return status.before.trimEnd()

  // 模型可能正在逐字输出标签。先隐藏不完整的技术字段，避免闪现在聊天气泡里。
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
      if (!packet) {
        warnings.push('互动协议 JSON 无法解析，已保留可见正文。')
      }
    } else {
      warnings.push('互动协议数据块没有正常闭合，已忽略状态更新。')
    }
  } else {
    const statusBlock = extractBlock(raw, STATUS_OPEN, STATUS_CLOSE)
    if (statusBlock) {
      visibleText = statusBlock.before.trim()
      rawPacket = statusBlock.block.trim()
      const legacy = statusBlock.complete
        ? parseJsonBlock(statusBlock.block)
        : undefined

      if (legacy) {
        packet = {
          status: (
            legacy.status && typeof legacy.status === 'object'
              ? legacy.status
              : legacy
          ) as Record<string, unknown>
        }
      } else {
        warnings.push('角色状态数据无法解析，已忽略。')
      }
    }
  }

  const messages: CompanionActionMessage[] = []
  if (Array.isArray(packet?.messages)) {
    for (const row of packet.messages.slice(0, 4)) {
      const content = cleanText(row.content, 800)
      if (!content) continue
      messages.push({
        kind: normalizeKind(row.kind),
        content
      })
    }
  }

  if (!messages.length && visibleText) {
    messages.push({ kind: 'text', content: visibleText })
  }

  if (!messages.length) {
    const recovered = raw
      .replace(/<companion_packet>[\s\S]*$/i, '')
      .replace(/<role_status>[\s\S]*$/i, '')
      .trim()
    if (recovered) messages.push({ kind: 'text', content: recovered })
  }

  const status = normalizeStatus(packet?.status)
  const kinds = messages.map(item => item.kind)
  const actionSummary = [
    messages.length ? `${messages.length} 条消息` : '无可见消息',
    kinds.includes('emoji') ? '表情' : '',
    kinds.includes('voice') ? '语音样式' : '',
    status ? '状态更新' : ''
  ].filter(Boolean).join(' · ')

  return {
    visibleText: messages.map(item => item.content).join('\n\n'),
    messages,
    status,
    rawPacket: rawPacket || undefined,
    actionSummary,
    warnings
  }
}

export function estimateVoiceDuration(text: string) {
  const count = text.replace(/\s+/g, '').length
  return Math.max(2, Math.min(60, Math.round(count / 4.2)))
}

export function mergeStatusIntoConversationState(
  state: ConversationState,
  patch?: CompanionStatusPatch
): Partial<ConversationState> {
  if (!patch) return {}

  return {
    innerMood: patch.mood || state.innerMood,
    innerActivity: patch.activity || state.innerActivity,
    innerThought: patch.innerThought || state.innerThought,
    location: patch.location || state.location,
    relationshipNote: patch.relationshipNote || state.relationshipNote,
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
    [/(首先|其次|最后)[，,:：]/, '回复呈现说明文列表腔。']
  ]

  const warnings = rules
    .filter(([pattern]) => pattern.test(value))
    .map(([, label]) => label)

  const questionCount = (value.match(/[？?]/g) || []).length
  if (questionCount >= 3) warnings.push('单次回复问题过多，容易像问卷。')
  if (value.length > 420) warnings.push('日常聊天回复偏长，可能削弱手机聊天感。')

  return warnings
}
