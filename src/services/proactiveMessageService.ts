import type {
  Character,
  CharacterMemory,
  ConversationState,
  Message,
  ProactiveFrequency,
  ProactiveSource
} from '../types/domain'

function timeMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
}

function isWithinQuietHours(now: Date, start: string, end: string) {
  const current = now.getHours() * 60 + now.getMinutes()
  const from = timeMinutes(start)
  const to = timeMinutes(end)
  return from === to ? false : from < to ? current >= from && current < to : current >= from || current < to
}

function duePromise(memories: CharacterMemory[], now: number) {
  return memories
    .filter(memory => memory.status !== 'invalid' && (memory.layer === 'promise' || (!memory.layer && memory.category === 'promise')) && memory.dueAt)
    .map(memory => ({ memory, distance: new Date(memory.dueAt || '').getTime() - now }))
    .filter(item => Number.isFinite(item.distance) && item.distance >= -36 * 3600000 && item.distance <= 7 * 86400000)
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0]?.memory
}

export interface ProactiveMessagePlan {
  source: ProactiveSource
  /** 只给 AI 的触发事实，不包含预写角色台词。 */
  instruction: string
}

/**
 * 只决定“是否该让 AI 主动生成一条消息”以及可用事实。
 * 不在本地拼接任何角色回复。
 */
export async function planProactiveMessage(options: {
  character: Character
  messages: Message[]
  enabled: boolean
  intervalHours: number
  frequency?: ProactiveFrequency
  quietHoursEnabled?: boolean
  quietStart?: string
  quietEnd?: string
  allowedSources?: ProactiveSource[]
  memories?: CharacterMemory[]
  state?: ConversationState
}): Promise<ProactiveMessagePlan | null> {
  if (!options.enabled || options.messages.length === 0) return null
  const nowDate = new Date()
  if (options.quietHoursEnabled && isWithinQuietHours(nowDate, options.quietStart || '23:00', options.quietEnd || '08:00')) return null

  const latest = options.messages.at(-1)
  if (!latest) return null

  const now = Date.now()
  const lastInteraction = new Date(latest.createdAt).getTime()
  const lastProactive = options.state?.lastProactiveAt ? new Date(options.state.lastProactiveAt).getTime() : 0
  const initiativeFactor = options.character.initiative === 'high' ? .72 : options.character.initiative === 'low' ? 1.35 : 1
  const frequencyFactor = options.frequency === 'high' ? .72 : options.frequency === 'low' ? 1.5 : 1
  const threshold = Math.max(1, options.intervalHours) * 3600000 * initiativeFactor * frequencyFactor
  if (now - lastInteraction < threshold || now - lastProactive < threshold) return null

  const allowed = new Set(options.allowedSources?.length
    ? options.allowedSources
    : ['continue-topic', 'promise-reminder', 'daily-share', 'care', 'story-event'] as ProactiveSource[])
  const recentUserMessages = options.messages.filter(item => item.senderId === 'user' && item.content.trim()).slice(-8)
  const latestUser = recentUserMessages.at(-1)?.content.trim() || ''
  const memories = options.memories || []
  const state = options.state
  const promise = allowed.has('promise-reminder') ? duePromise(memories, now) : undefined
  const unresolved = allowed.has('continue-topic')
    ? state?.unresolvedTopics?.[0] || [...recentUserMessages].reverse().find(item => /(明天|下周|等会|后来|结果|考试|面试|工作|生病|不舒服|睡不着|难过|答应|记得)/.test(item.content))?.content.trim()
    : undefined
  const pendingEvent = allowed.has('story-event') ? state?.pendingEvents?.[0] : undefined
  const needsCare = allowed.has('care') && /(难过|累|不舒服|生病|失眠|焦虑|紧张|害怕)/.test(latestUser)

  let source: ProactiveSource = 'daily-share'
  let fact = ''
  if (promise) {
    source = 'promise-reminder'
    fact = `存在一条临近或已到期的用户约定：${promise.content}`
  } else if (unresolved) {
    source = 'continue-topic'
    fact = `最近有一个尚未结束的话题：${unresolved}`
  } else if (needsCare) {
    source = 'care'
    fact = `用户最近明确表达过不适或负面状态：${latestUser}`
  } else if (pendingEvent) {
    source = 'story-event'
    fact = `当前剧情存在一个等待后续的事件：${pendingEvent}`
  } else {
    source = 'daily-share'
    fact = '没有新的用户消息；是否主动联系以及说什么，都由角色卡、当前剧情和最近聊天决定。'
  }

  if (!allowed.has(source)) return null

  return {
    source,
    instruction: [
      '【主动消息触发】',
      '现在不是用户刚发来一条新消息，而是小手机允许角色在合适时机主动发起一次联系。',
      fact,
      '请完全依据角色卡、世界书、当前场景、记忆和最近聊天，自行决定是否要发消息以及具体内容。',
      '不要使用任何本地预设问候；如果角色此刻不应主动联系，只输出 <no_proactive_message/>。'
    ].join('\n')
  }
}
