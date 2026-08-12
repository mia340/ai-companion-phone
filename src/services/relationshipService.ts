import { db } from '../db/database'
import type {
  Character,
  CharacterRelationship,
  RelationshipEvent,
  Message,
  CharacterMemory,
  ConversationState,
  ProactiveFrequency,
  ProactiveSource
} from '../types/domain'

export function createDefaultRelationship(characterId: string): CharacterRelationship {
  const now = new Date().toISOString()
  return {
    id: characterId,
    characterId,
    intimacy: 8,
    trust: 10,
    familiarity: 5,
    stage: '初识',
    emotion: '平静',
    emotionReason: '你们正在慢慢认识彼此',
    lastInteractionAt: now,
    lastProactiveAt: '',
    chatDays: 1,
    musicCount: 0,
    updatedAt: now
  }
}

function stageFor(score: number): CharacterRelationship['stage'] {
  if (score >= 82) return '特别关系'
  if (score >= 62) return '依赖'
  if (score >= 40) return '亲近'
  if (score >= 20) return '熟悉'
  return '初识'
}

export async function getRelationship(characterId: string) {
  return await db.relationships.get(characterId) ?? createDefaultRelationship(characterId)
}

export async function saveRelationship(value: CharacterRelationship) {
  const score = Math.round((value.intimacy + value.trust + value.familiarity) / 3)
  await db.relationships.put({
    ...value,
    intimacy: Math.max(0, Math.min(100, value.intimacy)),
    trust: Math.max(0, Math.min(100, value.trust)),
    familiarity: Math.max(0, Math.min(100, value.familiarity)),
    stage: stageFor(score),
    updatedAt: new Date().toISOString()
  })
}

export function inferEmotion(text: string) {
  if (/难过|委屈|想哭|崩溃|累了/.test(text)) return { emotion: '担心', reason: '察觉到你现在可能不太好' }
  if (/喜欢你|爱你|想你|抱抱/.test(text)) return { emotion: '害羞', reason: '因为你说了让人心里发热的话' }
  if (/生气|讨厌|不理你|烦/.test(text)) return { emotion: '不安', reason: '担心自己没有照顾好你的感受' }
  if (/晚安|睡了|困了/.test(text)) return { emotion: '温柔', reason: '想安静地陪你结束今天' }
  if (/开心|哈哈|好耶|太好了/.test(text)) return { emotion: '开心', reason: '被你的情绪感染了' }
  return { emotion: '平静', reason: '正在认真听你说话' }
}

export async function recordInteraction(options: {
  character: Character
  conversationId: string
  message: Message
}) {
  const current = await getRelationship(options.character.id)
  const isImage = options.message.type === 'image'
  const mood = isImage
    ? {
      emotion: '好奇',
      reason: options.message.content.trim()
        ? '正在认真看你分享的图片和附言'
        : '因为你愿意分享眼前的画面'
    }
    : inferEmotion(options.message.content)
  const oldStage = current.stage
  const now = new Date().toISOString()
  const next: CharacterRelationship = {
    ...current,
    intimacy: current.intimacy + (
      isImage
        ? 2
        : options.message.content.length > 20
          ? 2
          : 1
    ),
    trust: current.trust + (/秘密|相信|答应|约定/.test(options.message.content) ? 2 : 0.5),
    familiarity: current.familiarity + (isImage ? 1.5 : 1),
    emotion: mood.emotion,
    emotionReason: mood.reason,
    lastInteractionAt: now
  }
  const score = Math.round((next.intimacy + next.trust + next.familiarity) / 3)
  next.stage = stageFor(score)
  await saveRelationship(next)

  if (next.stage !== oldStage) {
    const event: RelationshipEvent = {
      id: crypto.randomUUID(),
      characterId: options.character.id,
      conversationId: options.conversationId,
      type: 'stage',
      title: `关系变得${next.stage}`,
      description: `你们的相处进入了“${next.stage}”阶段。`,
      createdAt: now
    }
    await db.relationshipEvents.add(event)
  }

  return next
}

export async function recordMusicMoment(characterId: string, conversationId: string, title: string) {
  const current = await getRelationship(characterId)
  current.musicCount += 1
  current.intimacy += 1
  await saveRelationship(current)
  await db.relationshipEvents.add({
    id: crypto.randomUUID(),
    characterId,
    conversationId,
    type: 'music',
    title: `一起听了《${title}》`,
    description: '你们共享了一段音乐时光。',
    createdAt: new Date().toISOString()
  })
}

export function relationshipPrompt(value: CharacterRelationship) {
  return [
    `你们当前的关系阶段：${value.stage}`,
    `此刻情绪：${value.emotion}（${value.emotionReason}）`,
    '关系阶段只影响语气、亲近程度与主动关心，不要直接说出数值。',
    value.stage === '初识' ? '保持自然礼貌，仍带一点试探和距离。' : '',
    value.stage === '熟悉' ? '可以更自然地提起之前聊过的事情。' : '',
    value.stage === '亲近' ? '可以表达明显关心，称呼和语气更亲密。' : '',
    value.stage === '依赖' ? '可以表现想念、在意与轻微依赖，但不要控制用户。' : '',
    value.stage === '特别关系' ? '可以用非常亲密、熟悉的方式相处，同时尊重用户边界。' : '',
    ['亲近', '依赖', '特别关系'].includes(value.stage) ? '当语境合适时可以自然表现一点吃醋、想念或嘴硬，但不要控制、施压或要求用户证明感情。' : ''
  ].filter(Boolean).join('\n')
}

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

function sourceLabel(source: ProactiveSource) {
  return source === 'continue-topic' ? '延续话题'
    : source === 'promise-reminder' ? '履行承诺'
      : source === 'daily-share' ? '分享日常'
        : source === 'care' ? '关心状态'
          : '剧情事件'
}

function duePromise(memories: CharacterMemory[], now: number) {
  return memories
    .filter(memory => memory.status !== 'invalid' && (memory.layer === 'promise' || (!memory.layer && memory.category === 'promise')) && memory.dueAt)
    .map(memory => ({ memory, distance: new Date(memory.dueAt || '').getTime() - now }))
    .filter(item => Number.isFinite(item.distance) && item.distance >= -36 * 3600000 && item.distance <= 7 * 86400000)
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0]?.memory
}

export async function maybeCreateProactiveMessage(options: {
  character: Character
  conversationId: string
  worldId: string
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
}) {
  if (!options.enabled || options.messages.length === 0) return null
  const nowDate = new Date()
  if (options.quietHoursEnabled && isWithinQuietHours(nowDate, options.quietStart || '23:00', options.quietEnd || '08:00')) return null

  const relationship = await getRelationship(options.character.id)
  const latest = options.messages.at(-1)
  if (!latest) return null
  if (options.character.initiative === 'low' && relationship.stage === '初识') return null

  const now = Date.now()
  const lastInteraction = new Date(latest.createdAt).getTime()
  const lastProactive = relationship.lastProactiveAt ? new Date(relationship.lastProactiveAt).getTime() : 0
  const initiativeFactor = options.character.initiative === 'high' ? .72 : options.character.initiative === 'low' ? 1.35 : 1
  const frequencyFactor = options.frequency === 'high' ? .72 : options.frequency === 'low' ? 1.5 : 1
  const stageFactor = relationship.stage === '初识' ? 1.35
    : relationship.stage === '熟悉' ? 1.12
      : relationship.stage === '亲近' ? .95
        : relationship.stage === '依赖' ? .82
          : .72
  const threshold = Math.max(1, options.intervalHours) * 3600000 * initiativeFactor * frequencyFactor * stageFactor
  if (now - lastInteraction < threshold || now - lastProactive < threshold) return null

  const allowed = new Set(options.allowedSources?.length ? options.allowedSources : ['continue-topic', 'promise-reminder', 'daily-share', 'care', 'story-event'] as ProactiveSource[])
  const recentUserMessages = options.messages.filter(item => item.senderId === 'user' && item.content.trim()).slice(-8)
  const latestUser = recentUserMessages.at(-1)?.content.trim() || ''
  const recentProactive = options.messages.filter(item => item.proactiveSource).slice(-5)
  const memories = options.memories || []
  const state = options.state
  const promise = allowed.has('promise-reminder') ? duePromise(memories, now) : undefined
  const unresolved = allowed.has('continue-topic')
    ? state?.unresolvedTopics?.[0] || [...recentUserMessages].reverse().find(item => /(明天|下周|等会|后来|结果|考试|面试|工作|生病|不舒服|睡不着|难过|答应|记得)/.test(item.content))?.content.trim()
    : undefined
  const pendingEvent = allowed.has('story-event') ? state?.pendingEvents?.[0] : undefined
  const needsCare = allowed.has('care') && /(难过|累|不舒服|生病|失眠|焦虑|紧张|害怕)/.test(latestUser)

  let source: ProactiveSource = 'daily-share'
  if (promise) source = 'promise-reminder'
  else if (unresolved) source = 'continue-topic'
  else if (needsCare) source = 'care'
  else if (pendingEvent) source = 'story-event'
  if (!allowed.has(source)) return null
  if (recentProactive.some(item => item.proactiveSource === source) && now - lastProactive < threshold * 2) return null

  const styleSource = `${options.character.persona} ${options.character.speakingStyle || ''}`
  const restrained = /克制|简短|冷静|毒舌|清冷/.test(styleSource)
  const lively = /活泼|开朗|黏人|话多|元气/.test(styleSource)
  const warm = /温柔|细腻|关心|治愈/.test(styleSource)
  let content = ''

  if (source === 'promise-reminder' && promise) {
    const topic = promise.content.replace(/^(请记住|你要记得|别忘了|以后要记住)/, '').slice(0, 42)
    content = restrained ? `之前说好的那件事，别忘了。${topic ? `——${topic}` : ''}`
      : lively ? `我可还记得呢——${topic}。现在准备得怎么样了？`
        : warm ? `我记得你之前提过“${topic}”。时间是不是快到了？别一个人紧张。`
          : `之前约定的“${topic}”，我还记得。现在进展怎么样了？`
  } else if (source === 'continue-topic' && unresolved) {
    const topic = unresolved.replace(/\s+/g, ' ').slice(0, 36)
    content = restrained ? '之前那件事，后来怎么样了。'
      : lively ? `我突然又想起你之前说的“${topic}”——后来呢？`
        : warm ? `刚刚想起你之前提到的“${topic}”。现在还好吗？`
          : `你之前说的“${topic}”，后来有结果了吗？`
  } else if (source === 'care') {
    content = restrained ? '现在好一点了吗。'
      : lively ? '我来查岗了。你现在有没有好一点？'
        : warm ? '刚才还是有点放心不下你。现在身体和心情好些了吗？'
          : '我还记得你刚才不太舒服。现在好一点了吗？'
  } else if (source === 'story-event' && pendingEvent) {
    content = restrained ? `那件事还没结束。${pendingEvent}`
      : lively ? `对了，我们还等着“${pendingEvent}”呢。要不要继续？`
        : `刚刚想到还有一件事没走完——${pendingEvent}。`
  } else {
    if (!allowed.has('daily-share')) return null
    const activity = options.character.activity || state?.innerActivity || '忙自己的事'
    const timeWord = nowDate.getHours() < 11 ? '早上' : nowDate.getHours() < 18 ? '白天' : '晚上'
    content = lively ? `我刚刚在${activity}，突然就想来敲你一下。${timeWord}过得怎么样？`
      : restrained ? relationship.stage === '初识' ? '路过。' : '顺便来看看你。'
        : warm ? `刚才在${activity}的时候想起你了。今天有没有什么想和我说的？`
          : `刚刚有件小事让我想起你，所以就来了。`
  }

  if (recentProactive.some(item => item.content === content)) return null
  const createdAt = new Date().toISOString()
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: options.worldId,
    conversationId: options.conversationId,
    senderId: options.character.id,
    type: 'text',
    content,
    status: 'delivered',
    createdAt,
    protocolVersion: 2,
    proactiveSource: source
  }
  await db.messages.add(message)
  await db.conversations.update(options.conversationId, { updatedAt: createdAt, unread: 0 })
  relationship.lastProactiveAt = createdAt
  relationship.emotion = source === 'promise-reminder' || source === 'continue-topic' ? '惦记' : source === 'care' ? '担心' : '想念'
  relationship.emotionReason = `${sourceLabel(source)}，不是泛泛问候`
  await saveRelationship(relationship)
  return message
}
