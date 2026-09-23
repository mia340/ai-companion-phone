import { z } from 'zod'
import { db } from '../db/database'
import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import { NATIVE_APP_TEXT_ONLY_RULE, sanitizeNativeAppText } from './appPresentationPolicy'
import { listConversationMemoryContext, recordMemoryHits, selectMemoryHitsDetailed } from './memoryService'
import { loadSharedTimeline } from './sharedTimelineService'
import { getCoupleBoardMapStop } from './coupleBoardMapService'
import type { ChatTurn } from './ai/provider'
import type { AppCustomization, Character, CharacterMemory, ConversationState } from '../types/domain'
import type { CoupleBoardGame, CoupleBoardPlayerId, CoupleBoardPrompt } from './coupleBoardGameService'

export type CoupleBoardInteractionSpeaker = 'user' | 'partner' | 'system'
export type CoupleBoardInteractionStatus = 'active' | 'closing' | 'closed' | 'skipped'

export interface CoupleBoardInteractionMessage {
  id: string
  speaker: CoupleBoardInteractionSpeaker
  text: string
  createdAt: string
  memoryEvidenceIds?: string[]
}

export interface CoupleBoardInteraction {
  id: string
  gameId: string
  promptId: string
  actor: CoupleBoardPlayerId
  characterId: string
  conversationId?: string
  questionText: string
  locationName: string
  status: CoupleBoardInteractionStatus
  messages: CoupleBoardInteractionMessage[]
  memorySyncedIds: string[]
  createdAt: string
  updatedAt: string
}

export interface CoupleBoardInteractionLedger {
  version: 1
  gameId: string
  interactions: CoupleBoardInteraction[]
  updatedAt: string
}

export interface CoupleBoardCharacterContext {
  character: {
    id: string
    name: string
    identity: string
    persona: string
    description: string
    personality: string
    speakingStyle: string
    background: string
    values: string
    habits: string
    likes: string[]
    dislikes: string[]
    boundaries: string
    relationship: string
    scenario: string
    systemPrompt: string
    postHistoryInstructions: string
  }
  memories: Array<{
    id: string
    text: string
    layer: string
    importance: number
    locked: boolean
  }>
  timeline: Array<{
    id: string
    text: string
    occurredAt: string
  }>
  conversationState?: Pick<ConversationState, 'summary' | 'innerMood' | 'innerActivity' | 'innerThought' | 'relationshipNote' | 'location' | 'presence'>
}

export interface CoupleBoardPartnerReply {
  reply: string
  endInteraction: boolean
  memoryEvidenceIds: string[]
  model: string
  roleConsistencyChecked: boolean
}

export interface CoupleBoardReplyAudit {
  pass: boolean
  reason: string
}

const INTERACTION_APP_KEY = '__couple-board-interactions__'
const MAX_INTERACTIONS = 60
const MAX_MESSAGES = 40

function interactionCustomizationId(worldId: string) {
  return `${worldId}:${INTERACTION_APP_KEY}`
}

function nowIso(now = new Date()) {
  return now.toISOString()
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function clean(value: unknown, max = 600) {
  return sanitizeNativeAppText(String(value ?? ''), { singleLine: true }).slice(0, max).trim()
}

const messageSchema: z.ZodType<CoupleBoardInteractionMessage> = z.object({
  id: z.string().min(1),
  speaker: z.enum(['user', 'partner', 'system']),
  text: z.string().min(1).max(1200),
  createdAt: z.string(),
  memoryEvidenceIds: z.array(z.string().min(1)).max(16).optional()
})

const interactionSchema: z.ZodType<CoupleBoardInteraction> = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  promptId: z.string().min(1),
  actor: z.enum(['user', 'partner']),
  characterId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  questionText: z.string().min(1).max(600),
  locationName: z.string().min(1).max(80),
  status: z.enum(['active', 'closing', 'closed', 'skipped']),
  messages: z.array(messageSchema).max(MAX_MESSAGES),
  memorySyncedIds: z.array(z.string().min(1)).max(24),
  createdAt: z.string(),
  updatedAt: z.string()
})

const ledgerSchema: z.ZodType<CoupleBoardInteractionLedger> = z.object({
  version: z.literal(1),
  gameId: z.string().min(1),
  interactions: z.array(interactionSchema).max(MAX_INTERACTIONS),
  updatedAt: z.string()
})

export function parseCoupleBoardInteractionLedger(value: unknown) {
  const parsed = ledgerSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function createCoupleBoardInteraction(options: {
  game: CoupleBoardGame
  prompt: CoupleBoardPrompt
  questionText: string
  conversationId?: string
  now?: Date
}): CoupleBoardInteraction {
  if (!options.game.pending) throw new Error('当前没有待处理题目。')
  const timestamp = nowIso(options.now)
  return {
    id: randomId('interaction'),
    gameId: options.game.id,
    promptId: options.prompt.id,
    actor: options.game.pending.actor,
    characterId: options.game.settings.characterId,
    conversationId: options.conversationId,
    questionText: clean(options.questionText, 600),
    locationName: getCoupleBoardMapStop(options.game.pending.cellIndex).name,
    status: 'active',
    messages: [],
    memorySyncedIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function appendCoupleBoardInteractionMessage(
  interaction: CoupleBoardInteraction,
  speaker: CoupleBoardInteractionSpeaker,
  text: string,
  options: { evidenceIds?: string[]; now?: Date } = {}
): CoupleBoardInteraction {
  const cleaned = clean(text, 1000)
  if (!cleaned) return interaction
  const next: CoupleBoardInteraction = interactionSchema.parse(interaction)
  next.messages = [...next.messages, {
    id: randomId('line'),
    speaker,
    text: cleaned,
    createdAt: nowIso(options.now),
    ...(options.evidenceIds?.length ? { memoryEvidenceIds: [...new Set(options.evidenceIds)].slice(0, 16) } : {})
  }].slice(-MAX_MESSAGES)
  next.updatedAt = nowIso(options.now)
  return next
}

export function setCoupleBoardInteractionStatus(
  interaction: CoupleBoardInteraction,
  status: CoupleBoardInteractionStatus,
  now = new Date()
): CoupleBoardInteraction {
  return interactionSchema.parse({ ...interaction, status, updatedAt: nowIso(now) })
}

export function markCoupleBoardInteractionMemories(
  interaction: CoupleBoardInteraction,
  ids: readonly string[],
  now = new Date()
): CoupleBoardInteraction {
  return interactionSchema.parse({
    ...interaction,
    memorySyncedIds: [...new Set([...interaction.memorySyncedIds, ...ids])].slice(0, 24),
    updatedAt: nowIso(now)
  })
}

export async function loadCoupleBoardInteractionLedger(worldId: string, gameId: string): Promise<CoupleBoardInteractionLedger> {
  const row = await db.appCustomizations.get(interactionCustomizationId(worldId))
  const parsed = parseCoupleBoardInteractionLedger(
    (row as AppCustomization & { coupleBoardInteractionLedger?: unknown } | undefined)?.coupleBoardInteractionLedger
  )
  if (!parsed || parsed.gameId !== gameId) return { version: 1, gameId, interactions: [], updatedAt: new Date(0).toISOString() }
  return parsed
}

export async function saveCoupleBoardInteractionLedger(worldId: string, ledger: CoupleBoardInteractionLedger) {
  const normalized = ledgerSchema.parse({
    ...ledger,
    interactions: ledger.interactions.slice(-MAX_INTERACTIONS),
    updatedAt: new Date().toISOString()
  })
  const id = interactionCustomizationId(worldId)
  const existing = await db.appCustomizations.get(id)
  const row: AppCustomization & { coupleBoardInteractionLedger: CoupleBoardInteractionLedger } = {
    ...(existing ?? {}),
    id,
    worldId,
    appKey: INTERACTION_APP_KEY,
    coupleBoardInteractionLedger: normalized,
    updatedAt: normalized.updatedAt
  }
  await db.appCustomizations.put(row)
  return normalized
}

export async function upsertCoupleBoardInteraction(worldId: string, interaction: CoupleBoardInteraction) {
  const previous = await loadCoupleBoardInteractionLedger(worldId, interaction.gameId)
  const interactions = [...previous.interactions.filter(row => row.id !== interaction.id), interaction]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-MAX_INTERACTIONS)
  return saveCoupleBoardInteractionLedger(worldId, {
    version: 1,
    gameId: interaction.gameId,
    interactions,
    updatedAt: new Date().toISOString()
  })
}

export async function getOrCreateCoupleBoardInteraction(options: {
  worldId: string
  game: CoupleBoardGame
  prompt: CoupleBoardPrompt
  questionText: string
  conversationId?: string
}) {
  const ledger = await loadCoupleBoardInteractionLedger(options.worldId, options.game.id)
  const existing = [...ledger.interactions].reverse().find(row => row.promptId === options.prompt.id && row.status !== 'closed' && row.status !== 'skipped')
  if (existing) return existing
  const interaction = createCoupleBoardInteraction(options)
  await upsertCoupleBoardInteraction(options.worldId, interaction)
  return interaction
}

function characterField(value: unknown, max = 900) {
  return clean(value, max)
}

export async function buildCoupleBoardCharacterContext(options: {
  character: Character
  conversationId: string
  worldId: string
  query: string
}): Promise<{ context: CoupleBoardCharacterContext; memoryRows: CharacterMemory[] }> {
  const [allMemories, timeline, state] = await Promise.all([
    listConversationMemoryContext(options.conversationId, options.character.id),
    loadSharedTimeline(options.worldId),
    db.conversationStates.get(options.conversationId)
  ])
  const hits = selectMemoryHitsDetailed(allMemories, options.query, 10)
  await recordMemoryHits(hits)
  const memoryRows = hits.map(hit => hit.memory)
  const memoryIds = new Set(memoryRows.map(row => row.id))
  const timelineRows = timeline
    .filter(item => item.characterId === options.character.id && !item.hidden)
    .filter(item => item.relationshipSignal !== 'promise' && item.relationshipSignal !== 'goal' && item.relationshipSignal !== 'story')
    .filter(item => !memoryIds.has(item.sourceId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 6)

  const character = options.character
  return {
    context: {
      character: {
        id: character.id,
        name: character.name,
        identity: characterField(character.identity),
        persona: characterField(character.persona, 1600),
        description: characterField(character.cardDescription, 1200),
        personality: characterField(character.cardPersonality, 1200),
        speakingStyle: characterField(character.speakingStyle),
        background: characterField(character.background),
        values: characterField(character.values),
        habits: characterField(character.habits),
        likes: (character.likes || []).slice(0, 20).map(row => clean(row, 100)).filter(Boolean),
        dislikes: (character.dislikes || []).slice(0, 20).map(row => clean(row, 100)).filter(Boolean),
        boundaries: characterField(character.boundaries),
        relationship: characterField(character.relationship),
        scenario: characterField(character.scenario),
        systemPrompt: characterField(character.systemPrompt, 1200),
        postHistoryInstructions: characterField(character.postHistoryInstructions, 1200)
      },
      memories: memoryRows.map(memory => ({
        id: memory.id,
        text: clean(memory.content, 280),
        layer: String(memory.layer || memory.category),
        importance: memory.importance,
        locked: Boolean(memory.locked)
      })),
      timeline: timelineRows.map(item => ({
        id: `timeline:${item.id}`,
        text: clean(item.customTitle || item.summary || item.title, 260),
        occurredAt: item.occurredAt
      })),
      ...(state ? { conversationState: {
        summary: characterField(state.summary, 700),
        innerMood: characterField(state.innerMood, 180),
        innerActivity: characterField(state.innerActivity, 180),
        innerThought: characterField(state.innerThought, 260),
        relationshipNote: characterField(state.relationshipNote, 260),
        location: characterField(state.location, 120),
        presence: state.presence
      } } : {})
    },
    memoryRows
  }
}

function interactionTranscript(interaction: CoupleBoardInteraction, characterName: string) {
  return interaction.messages.slice(-16).map(message => {
    const speaker = message.speaker === 'partner' ? characterName : message.speaker === 'user' ? '用户' : '系统'
    return `${speaker}: ${message.text}`
  }).join('\n')
}

export function buildCoupleBoardPartnerReplyMessages(options: {
  game: CoupleBoardGame
  prompt: CoupleBoardPrompt
  interaction: CoupleBoardInteraction
  context: CoupleBoardCharacterContext
  intent: 'answer' | 'react' | 'continue'
}): ChatTurn[] {
  const { game, prompt, interaction, context, intent } = options
  const allowedEvidenceIds = [
    ...context.memories.map(row => row.id),
    ...context.timeline.map(row => row.id)
  ]
  const actorName = game.players[interaction.actor].name
  const characterIsActor = interaction.actor === 'partner'
  const mapStop = getCoupleBoardMapStop(game.pending?.cellIndex ?? game.players[interaction.actor].position)
  const intentRule = intent === 'answer'
    ? `现在由 ${context.character.name} 先完成这道题。要直接回答/完成，不要把问题又丢回给用户。`
    : intent === 'react'
      ? '用户刚刚完成或回答了题目。你要像角色本人一样对这句话做真实反应；可以追问、接话、靠近、沉默或自然收住，但不要套固定反应模板。'
      : '这是同一段互动的继续。顺着刚才的内容自然接下去，不要突然换话题。'

  return [
    {
      role: 'system',
      content: [
        `你现在就是角色「${context.character.name}」，不是旁白、主持人、出题器，也不是通用恋爱机器人。`,
        NATIVE_APP_TEXT_ONLY_RULE,
        '角色一致性是最高优先级：严格保持角色卡里已有的人格、价值观、说话方式、关系设定、边界与习惯。游戏氛围不能覆盖原角色设定。',
        '记忆连续性同样是最高优先级：memory/timeline 是已经存在的事实证据。能自然用到时可以引用；没有证据时绝不能编造“之前发生过”的共同经历。',
        '如果回复明确提到某段过去的共同经历，必须在 memoryEvidenceIds 返回支撑它的 id；只能返回 allowedEvidenceIds 中存在的 id。',
        '不要把固定的“害羞/吃醋/反撩”等反应标签当规则。你的反应只由角色本人、人设、记忆、当前关系和眼前互动决定。',
        '这是情侣互动游戏，不赶进度。可以只回一句，也可以让话题继续。如果角色觉得这一小段已经自然说完，可将 endInteraction=true；用户仍然可以选择继续。',
        '地图地点是这局游戏里的舞台语境，可以影响措辞和气氛，但不能被当成现实世界已经发生过的共同经历。',
        '现实模式下，不替用户决定现实身体接触的同意；涉及身体动作时把选择权留给双方。',
        game.settings.intensity >= 4
          ? '本局已经通过成人门禁，可以使用符合角色本人口吻的直接成人表达；不要变成性行为教学，也不要把同意当默认。'
          : '保持在本局强度范围内，不主动升级到成人内容。',
        intentRule,
        '严格返回 JSON：{"reply":"角色回复","endInteraction":false,"memoryEvidenceIds":[]}',
        'reply 最多 260 个汉字；不要返回 Markdown、代码围栏、HTML/XML 或额外解释。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        roleCard: context.character,
        conversationState: context.conversationState,
        memory: context.memories,
        timeline: context.timeline,
        allowedEvidenceIds,
        game: {
          mode: game.settings.mode,
          intensity: game.settings.intensity,
          turn: game.turn,
          location: interaction.locationName,
          locationMood: mapStop.hint,
          locationZone: mapStop.zone,
          actor: actorName,
          characterIsActor,
          promptType: prompt.type,
          prompt: interaction.questionText
        },
        transcript: interactionTranscript(interaction, context.character.name)
      })
    }
  ]
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

export function parseCoupleBoardPartnerReply(
  raw: string,
  allowedEvidenceIds: readonly string[]
): Omit<CoupleBoardPartnerReply, 'model' | 'roleConsistencyChecked'> | undefined {
  const row = parseJsonObject(raw)
  if (!row) return undefined
  const reply = clean(row.reply, 520)
  if (!reply) return undefined
  const allowed = new Set(allowedEvidenceIds)
  const ids = Array.isArray(row.memoryEvidenceIds)
    ? [...new Set(row.memoryEvidenceIds.filter((item): item is string => typeof item === 'string' && allowed.has(item)))].slice(0, 16)
    : []
  const providedIds = Array.isArray(row.memoryEvidenceIds)
    ? row.memoryEvidenceIds.filter((item): item is string => typeof item === 'string')
    : []
  if (providedIds.some(id => !allowed.has(id))) return undefined
  return {
    reply,
    endInteraction: row.endInteraction === true,
    memoryEvidenceIds: ids
  }
}

export function buildCoupleBoardReplyAuditMessages(options: {
  interaction: CoupleBoardInteraction
  context: CoupleBoardCharacterContext
  candidate: Omit<CoupleBoardPartnerReply, 'model' | 'roleConsistencyChecked'>
}): ChatTurn[] {
  return [
    {
      role: 'system',
      content: [
        '你是角色连续性审校器，不负责把回复改得更甜，也不规定角色应该害羞、吃醋或反撩。',
        '只检查候选回复是否明显违背已经给出的角色卡、稳定边界、说话方式、关系设定或真实记忆。',
        '如果候选声称某个过去共同事件发生过，但没有与该说法对应的 evidence id，应判定不通过。',
        '不要因为回复直接、克制、冷淡、主动或成人化就判 OOC；判断标准只能来自这个角色自己的设定与已有上下文。',
        '不要要求候选迎合用户，也不要把游戏题目本身当成角色事实。',
        '严格返回 JSON：{"pass":true,"reason":""}。不通过时 reason 用一句短中文指出最具体的冲突。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        roleCard: options.context.character,
        conversationState: options.context.conversationState,
        memory: options.context.memories,
        timeline: options.context.timeline,
        question: options.interaction.questionText,
        transcript: interactionTranscript(options.interaction, options.context.character.name),
        candidate: options.candidate
      })
    }
  ]
}

export function parseCoupleBoardReplyAudit(raw: string): CoupleBoardReplyAudit | undefined {
  const row = parseJsonObject(raw)
  if (!row || typeof row.pass !== 'boolean') return undefined
  return {
    pass: row.pass,
    reason: clean(row.reason, 220)
  }
}

async function auditCoupleBoardPartnerReply(options: {
  provider: ReturnType<typeof createProvider>
  model: string
  interaction: CoupleBoardInteraction
  context: CoupleBoardCharacterContext
  candidate: Omit<CoupleBoardPartnerReply, 'model' | 'roleConsistencyChecked'>
}) {
  const response = await options.provider.chat({
    model: options.model,
    temperature: 0,
    messages: buildCoupleBoardReplyAuditMessages({
      interaction: options.interaction,
      context: options.context,
      candidate: options.candidate
    })
  })
  return parseCoupleBoardReplyAudit(response.text)
}

export async function generateCoupleBoardPartnerReply(options: {
  worldId: string
  conversationId: string
  game: CoupleBoardGame
  prompt: CoupleBoardPrompt
  interaction: CoupleBoardInteraction
  character: Character
  intent: 'answer' | 'react' | 'continue'
}): Promise<CoupleBoardPartnerReply> {
  const query = [options.interaction.questionText, ...options.interaction.messages.slice(-6).map(row => row.text)].join(' ')
  const { context } = await buildCoupleBoardCharacterContext({
    character: options.character,
    conversationId: options.conversationId,
    worldId: options.worldId,
    query
  })
  const allowedEvidenceIds = [...context.memories.map(row => row.id), ...context.timeline.map(row => row.id)]
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new Error('还没配好可用的 AI。请先到「设置 → API 与模型」完成配置。')
  }
  const provider = createProvider(settings)
  const baseMessages = buildCoupleBoardPartnerReplyMessages({
    game: options.game,
    prompt: options.prompt,
    interaction: options.interaction,
    context,
    intent: options.intent
  })
  const temperature = Math.min(0.82, Math.max(0.35, settings.temperature ?? 0.7))

  async function generateCandidate(messages: ChatTurn[]) {
    const response = await provider.chat({ model: settings.model, temperature, messages })
    return parseCoupleBoardPartnerReply(response.text, allowedEvidenceIds)
  }

  let parsed = await generateCandidate(baseMessages)
  if (!parsed) throw new Error('角色这次回应没有通过格式/记忆证据校验，请再试一次。')

  let audit = await auditCoupleBoardPartnerReply({
    provider,
    model: settings.model,
    interaction: options.interaction,
    context,
    candidate: parsed
  })
  if (audit?.pass === false) {
    const repairMessages: ChatTurn[] = [
      ...baseMessages,
      {
        role: 'user',
        content: `上一版候选没有通过角色连续性审校：${audit.reason || '与既有人设或记忆不一致'}。请保持同一个角色，重新生成；不要为了过审变成通用、讨好或模板化回答。`
      }
    ]
    const repaired = await generateCandidate(repairMessages)
    if (!repaired) throw new Error('角色重试回应没有通过格式/记忆证据校验。')
    const repairedAudit = await auditCoupleBoardPartnerReply({
      provider,
      model: settings.model,
      interaction: options.interaction,
      context,
      candidate: repaired
    })
    if (repairedAudit?.pass === false) throw new Error(`角色回应仍和既有人设/记忆冲突：${repairedAudit.reason || '请再试一次。'}`)
    parsed = repaired
    audit = repairedAudit
  }

  return { ...parsed, model: settings.model, roleConsistencyChecked: Boolean(audit?.pass) }
}
