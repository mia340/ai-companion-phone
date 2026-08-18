import { db } from '../db/database'
import type {
  ConversationState,
  ConversationStateHistory
} from '../types/domain'

const FIELD_META: Array<{
  key: keyof ConversationState
  field: ConversationStateHistory['field']
  label: string
}> = [
  { key: 'location', field: 'location', label: '地点变化' },
  { key: 'presence', field: 'presence', label: '相处状态变化' },
  { key: 'timePeriod', field: 'timePeriod', label: '时间段变化' },
  { key: 'energy', field: 'energy', label: '精力变化' },
  { key: 'innerMood', field: 'mood', label: '心情变化' },
  { key: 'innerActivity', field: 'activity', label: '活动变化' },
  { key: 'relationshipNote', field: 'relationship', label: '关系感受变化' },
  { key: 'lastCompletedEvent', field: 'event', label: '事件完成' }
]

function serialize(value: unknown) {
  if (Array.isArray(value)) return value.join('、')
  return typeof value === 'string' ? value.trim() : String(value ?? '')
}

export async function recordConversationStateChanges(options: {
  conversationId: string
  characterId: string
  before: ConversationState
  after: ConversationState
  sourceMessageId?: string
}) {
  const now = new Date().toISOString()
  const rows: ConversationStateHistory[] = []

  for (const meta of FIELD_META) {
    const previousValue = serialize(options.before[meta.key])
    const nextValue = serialize(options.after[meta.key])
    if (!nextValue || previousValue === nextValue) continue
    rows.push({
      id: crypto.randomUUID(),
      conversationId: options.conversationId,
      characterId: options.characterId,
      field: meta.field,
      label: meta.label,
      previousValue: previousValue || undefined,
      nextValue,
      sourceMessageId: options.sourceMessageId,
      createdAt: now
    })
  }

  const listFields: Array<{
    key: 'unresolvedTopics' | 'pendingEvents' | 'shortTermGoals'
    field: ConversationStateHistory['field']
    label: string
  }> = [
    { key: 'unresolvedTopics', field: 'topic', label: '未完成话题' },
    { key: 'pendingEvents', field: 'event', label: '等待中的事件' },
    { key: 'shortTermGoals', field: 'goal', label: '短期目标' }
  ]

  for (const meta of listFields) {
    const beforeSet = new Set(options.before[meta.key] || [])
    for (const item of options.after[meta.key] || []) {
      if (!item.trim() || beforeSet.has(item)) continue
      rows.push({
        id: crypto.randomUUID(),
        conversationId: options.conversationId,
        characterId: options.characterId,
        field: meta.field,
        label: meta.label,
        nextValue: item.trim(),
        sourceMessageId: options.sourceMessageId,
        createdAt: now
      })
    }
  }

  if (!rows.length) return rows
  await db.conversationStateHistory.bulkAdd(rows)

  const history = await db.conversationStateHistory
    .where('conversationId')
    .equals(options.conversationId)
    .sortBy('createdAt')
  const overflow = history.length - 160
  if (overflow > 0) {
    await db.conversationStateHistory.bulkDelete(history.slice(0, overflow).map(item => item.id))
  }
  return rows
}

export async function listConversationStateHistory(conversationId: string, limit = 60) {
  const rows = await db.conversationStateHistory
    .where('conversationId')
    .equals(conversationId)
    .toArray()
  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export async function clearConversationStateHistory(conversationId: string) {
  await db.conversationStateHistory.where('conversationId').equals(conversationId).delete()
}

export function buildConversationStatePrompt(state?: ConversationState) {
  if (!state) return ''
  const lines = [
    state.location ? `当前地点：${state.location}` : '',
    state.presence ? `当前相处状态：${state.presence === 'together' ? '与用户在身边 / 同一现场' : '与用户不在同一现场 / 远程联系'}` : '',
    state.timePeriod ? `当前时间段：${state.timePeriod}` : '',
    state.innerActivity ? `当前活动：${state.innerActivity}` : '',
    state.innerMood ? `当前心情：${state.innerMood}` : '',
    state.energy ? `当前精力：${state.energy}` : '',
    state.relationshipNote ? `当前关系感受：${state.relationshipNote}` : '',
    state.unresolvedTopics?.length ? `未完成话题：${state.unresolvedTopics.join('；')}` : '',
    state.pendingEvents?.length ? `等待中的事件：${state.pendingEvents.join('；')}` : '',
    state.shortTermGoals?.length ? `短期目标：${state.shortTermGoals.join('；')}` : '',
    state.lastCompletedEvent ? `刚完成的事件：${state.lastCompletedEvent}` : '',
    '只延续与当前消息有关的状态；不要机械汇报状态字段，不要暴露数值或技术格式。'
  ].filter(Boolean)
  return lines.join('\n')
}


export interface UserSceneTransition {
  presence: 'together' | 'remote'
  reason: string
  evidence: string
}

/**
 * V0.4.4.7：只识别用户本轮“明确改变物理位置”的强证据。
 * 这是通用场景状态机，不根据角色名/卡名做判断；弱语句（例如“想见你”“我快到了”）不会提前切状态。
 */
export function deriveUserSceneTransition(text: string, previous?: ConversationState): UserSceneTransition | undefined {
  const source = text.replace(/\r\n/g, '\n').trim()
  if (!source) return undefined
  const compact = source.replace(/\s+/g, '')
  const makeTransition = (presence: 'together' | 'remote', reason: string, evidence: string): UserSceneTransition => ({
    presence,
    reason: previous?.presence === presence ? `${reason}（确认当前状态）` : reason,
    evidence
  })

  const togetherPatterns: Array<[RegExp, string]> = [
    [/(?:^|[（(])(?:我)?上车(?:[）)]|$)|坐进(?:副驾|车里|车内)|钻进(?:车里|车内)/u, '用户明确进入同一车辆'],
    [/(?:走|来到|跑到|挪到|坐到|站到)(?:了)?你(?:的)?(?:身边|面前|旁边|对面)/u, '用户明确来到角色身边'],
    [/(?:抱住|搂住|牵住|握住|亲了|吻了|扑进)你/u, '用户主动发生直接身体接触'],
    [/(?:推门|开门)(?:走|进)|走进(?:你的|你所在的)|进入(?:你的|你所在的)(?:房间|办公室|病房|家里)/u, '用户明确进入角色所在空间']
  ]
  for (const [pattern, reason] of togetherPatterns) {
    const match = compact.match(pattern)
    if (match) return makeTransition('together', reason, match[0])
  }

  const remotePatterns: Array<[RegExp, string]> = [
    [/(?:^|[（(])(?:没看你[,，]?)?(?:我)?(?:先)?回家(?:了|去)?(?:[）)]|$)/u, '用户明确离开当前现场回家'],
    [/(?:我先走了|我走了|我回去了|先回去了|转身离开|离开这里|离开你|回自己家|已经到家了|我到家了)/u, '用户明确离开角色所在现场'],
    [/(?:挂了|挂电话|结束通话|关掉视频|退出通话)/u, '用户明确结束当前实时同场/通话互动']
  ]
  for (const [pattern, reason] of remotePatterns) {
    const match = compact.match(pattern)
    if (match) return makeTransition('remote', reason, match[0])
  }

  return undefined
}

export function buildUserSceneTransitionPrompt(transition?: UserSceneTransition) {
  if (!transition) return ''
  return [
    '【用户本轮明确场景变化 · 高优先级】',
    `用户本轮已经明确把物理相处状态切换为：${transition.presence === 'together' ? '同一现场' : '不在同一现场 / 远程'}。`,
    `证据：${transition.evidence}。${transition.reason}。`,
    '这是当前剧情事实，优先于 first_mes、开场 scenario 或旧状态。不要把已经离开的用户重新写回旧现场，也不要在尚未重新见面时制造身体接触。',
    '只有用户后续再次明确改变位置，或剧情中出现无歧义的新事实时，才继续改变相处状态。'
  ].join('\n')
}

export function deriveUserStatePatch(text: string, state?: ConversationState): Partial<ConversationState> {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return {}
  const unresolved = [...(state?.unresolvedTopics || [])]
  const pending = [...(state?.pendingEvents || [])]
  const goals = [...(state?.shortTermGoals || [])]

  const addUnique = (list: string[], value: string) => {
    const clean = value.slice(0, 72)
    if (clean && !list.some(item => item === clean)) list.unshift(clean)
    return list.slice(0, 6)
  }

  if (/(后来|结果|等会|明天|后天|下周|到时候|有消息再说|还没结束)/.test(normalized)) addUnique(unresolved, normalized)
  if (/(面试|考试|比赛|手术|复诊|快递|外卖|申请|通知|开奖|出成绩)/.test(normalized) && /(明天|后天|下周|等|结果|通知|到时候)/.test(normalized)) addUnique(pending, normalized)
  if (/(我要|我准备|我打算|我计划|我得|目标是)/.test(normalized)) addUnique(goals, normalized)

  if (/(已经结束|有结果了|通过了|完成了|做完了|解决了)/.test(normalized)) {
    const terms = new Set(normalized.split(/[，。！？!?\s]/).filter(item => item.length >= 2))
    const matches = (value: string) => Array.from(terms).some(term => value.includes(term))
    return {
      unresolvedTopics: unresolved.filter(item => !matches(item)).slice(0, 6),
      pendingEvents: pending.filter(item => !matches(item)).slice(0, 6),
      shortTermGoals: goals.filter(item => !matches(item)).slice(0, 6),
      lastCompletedEvent: normalized.slice(0, 90),
      stateVersion: 2
    }
  }

  return {
    unresolvedTopics: unresolved.slice(0, 6),
    pendingEvents: pending.slice(0, 6),
    shortTermGoals: goals.slice(0, 6),
    stateVersion: 2
  }
}
