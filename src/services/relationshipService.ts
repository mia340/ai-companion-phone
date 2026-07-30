import { db } from '../db/database'
import type {
  Character,
  CharacterRelationship,
  RelationshipEvent,
  Message
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
  const mood = inferEmotion(options.message.content)
  const oldStage = current.stage
  const now = new Date().toISOString()
  const next: CharacterRelationship = {
    ...current,
    intimacy: current.intimacy + (options.message.content.length > 20 ? 2 : 1),
    trust: current.trust + (/秘密|相信|答应|约定/.test(options.message.content) ? 2 : 0.5),
    familiarity: current.familiarity + 1,
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
    value.stage === '特别关系' ? '可以用非常亲密、熟悉的方式相处，同时尊重用户边界。' : ''
  ].filter(Boolean).join('\n')
}

export async function maybeCreateProactiveMessage(options: {
  character: Character
  conversationId: string
  worldId: string
  messages: Message[]
  enabled: boolean
  intervalHours: number
}) {
  if (!options.enabled || options.messages.length === 0) return null
  const relationship = await getRelationship(options.character.id)
  const latest = options.messages.at(-1)
  if (!latest || latest.senderId === options.character.id) return null
  const now = Date.now()
  const lastInteraction = new Date(latest.createdAt).getTime()
  const lastProactive = relationship.lastProactiveAt ? new Date(relationship.lastProactiveAt).getTime() : 0
  const threshold = Math.max(1, options.intervalHours) * 60 * 60 * 1000
  if (now - lastInteraction < threshold || now - lastProactive < threshold) return null

  const content = /面试|考试|上班|工作/.test(latest.content)
    ? `之前你说的那件事，后来还顺利吗？`
    : relationship.stage === '初识'
      ? '刚刚忽然想起我们上次聊的话，你今天过得怎么样？'
      : '有一会儿没见到你了。今天有没有什么想和我说的？'
  const createdAt = new Date().toISOString()
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: options.worldId,
    conversationId: options.conversationId,
    senderId: options.character.id,
    type: 'text',
    content,
    status: 'delivered',
    createdAt
  }
  await db.messages.add(message)
  await db.conversations.update(options.conversationId, { updatedAt: createdAt, unread: 0 })
  relationship.lastProactiveAt = createdAt
  relationship.emotion = '想念'
  relationship.emotionReason = '有一会儿没有等到你的消息'
  await saveRelationship(relationship)
  return message
}
