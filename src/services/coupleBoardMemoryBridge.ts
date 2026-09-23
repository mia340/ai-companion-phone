import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import { addMemory, listConversationMemoryContext, updateMemory } from './memoryService'
import type { ChatTurn } from './ai/provider'
import type { Character, CharacterMemory, MemoryLayer } from '../types/domain'
import type { CoupleBoardInteraction } from './coupleBoardInteractionService'

export interface CoupleBoardMemoryCandidate {
  kind: 'stable' | 'hypothetical' | 'transient'
  content: string
  category: 'preference' | 'relationship' | 'event' | 'other'
  layer: 'fact' | 'relationship' | 'shared'
  importance: 1 | 2 | 3 | 4 | 5
}

export interface CoupleBoardMemorySyncResult {
  eventMemoryId?: string
  semanticMemoryIds: string[]
  semanticSkippedReason?: string
}

function clean(value: unknown, max = 500) {
  return sanitizeNativeAppText(String(value ?? ''), { singleLine: true }).slice(0, max).trim()
}

function comparable(value: string) {
  return clean(value, 800)
    .toLocaleLowerCase()
    .replace(/[，。、“”‘’：:；;,.!?！？\s]/g, '')
}

function speakerLabel(speaker: CoupleBoardInteraction['messages'][number]['speaker'], characterName: string) {
  if (speaker === 'partner') return characterName
  if (speaker === 'user') return '用户'
  return '游戏'
}

export function buildCoupleBoardMemoryEventText(interaction: CoupleBoardInteraction, characterName: string) {
  const lines = interaction.messages
    .filter(message => message.speaker !== 'system')
    .slice(-8)
    .map(message => `${speakerLabel(message.speaker, characterName)}：「${clean(message.text, 180)}」`)
  if (!lines.length) return ''
  return clean(`心跳飞行棋（棋盘格：${interaction.locationName}，仅游戏舞台）：${lines.join('；')}`, 760)
}

function parseJsonArray(raw: string): unknown[] {
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseCoupleBoardMemoryCandidates(raw: string): CoupleBoardMemoryCandidate[] {
  const rows = parseJsonArray(raw)
  const result: CoupleBoardMemoryCandidate[] = []
  const seen = new Set<string>()
  for (const entry of rows) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const kind = row.kind === 'stable' || row.kind === 'hypothetical' || row.kind === 'transient' ? row.kind : undefined
    if (kind !== 'stable') continue
    const content = clean(row.content, 260)
    if (content.length < 4) continue
    const key = comparable(content)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const category = row.category === 'preference' || row.category === 'relationship' || row.category === 'event' || row.category === 'other'
      ? row.category
      : 'other'
    const layer = row.layer === 'fact' || row.layer === 'relationship' || row.layer === 'shared'
      ? row.layer
      : category === 'relationship' ? 'relationship' : category === 'event' ? 'shared' : 'fact'
    const importanceValue = Math.max(1, Math.min(5, Math.round(Number(row.importance) || 3))) as 1 | 2 | 3 | 4 | 5
    result.push({ kind, content, category, layer, importance: importanceValue })
    if (result.length >= 4) break
  }
  return result
}

export function buildCoupleBoardMemoryCandidateMessages(options: {
  interaction: CoupleBoardInteraction
  character: Character
}): ChatTurn[] {
  const transcript = options.interaction.messages
    .filter(message => message.speaker !== 'system')
    .map(message => `${speakerLabel(message.speaker, options.character.name)}: ${message.text}`)
    .join('\n')
  return [
    {
      role: 'system',
      content: [
        '你在做长期记忆整理。只能提取这段“心跳飞行棋”互动里明确说出来、以后确实值得记住的稳定信息。',
        '禁止把题目里的假设、幻想、角色扮演条件句、玩笑或临时情绪改写成现实事实。',
        '棋盘格名称只是游戏舞台，不是现实地点；不能把“花店/公园/电影院/床边”等棋盘格提炼成现实共同经历。',
        '如果用户说“如果/假如/想象/也许以后”，除非同时明确表达稳定偏好，否则标为 hypothetical，最终不会写入。',
        '不能推断没有说出口的性格、欲望、关系状态或共同经历。不能把游戏题目本身当事实。',
        `角色名是 ${options.character.name}。如果记录角色自己的表达，要写成“${options.character.name}表示/喜欢/不喜欢……”，不要伪装成用户事实。`,
        '只返回最多 4 条 JSON 数组；没有稳定信息就返回 []。',
        '格式：[{' + '"kind":"stable|hypothetical|transient","content":"...","category":"preference|relationship|event|other","layer":"fact|relationship|shared","importance":1' + '}]。',
        '不要返回 Markdown 或其它文字。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        question: options.interaction.questionText,
        boardStop: options.interaction.locationName,
        transcript
      })
    }
  ]
}

function isDuplicate(existing: readonly CharacterMemory[], content: string) {
  const key = comparable(content)
  if (!key) return true
  return existing.some(memory => {
    const other = comparable(memory.content)
    return other === key || (key.length >= 20 && other.length >= 20 && (other.includes(key) || key.includes(other)))
  })
}

async function writeMemory(options: {
  conversationId: string
  characterId: string
  content: string
  category: CharacterMemory['category']
  layer: MemoryLayer
  importance: CharacterMemory['importance']
  gameId: string
  interactionId: string
}) {
  const memory = await addMemory({
    conversationId: options.conversationId,
    characterId: options.characterId,
    content: options.content,
    category: options.category,
    layer: options.layer,
    scope: 'character',
    importance: options.importance
  })
  await updateMemory(memory.id, {
    sourceType: 'automatic',
    confidence: 1,
    note: `couple-board:${options.gameId}:${options.interactionId}`
  })
  return memory
}

export async function syncCoupleBoardInteractionMemory(options: {
  conversationId: string
  interaction: CoupleBoardInteraction
  character: Character
}): Promise<CoupleBoardMemorySyncResult> {
  const existing = await listConversationMemoryContext(options.conversationId, options.character.id)
  const result: CoupleBoardMemorySyncResult = { semanticMemoryIds: [] }
  const eventText = buildCoupleBoardMemoryEventText(options.interaction, options.character.name)

  if (eventText && !isDuplicate(existing, eventText)) {
    const event = await writeMemory({
      conversationId: options.conversationId,
      characterId: options.character.id,
      content: eventText,
      category: 'event',
      layer: 'shared',
      importance: 4,
      gameId: options.interaction.gameId,
      interactionId: options.interaction.id
    })
    result.eventMemoryId = event.id
    existing.push(event)
  }

  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    result.semanticSkippedReason = '未配置 AI；已经保存这段真实游戏互动，但没有额外提炼稳定偏好。'
    return result
  }

  try {
    const provider = createProvider(settings)
    const response = await provider.chat({
      model: settings.model,
      temperature: 0.1,
      messages: buildCoupleBoardMemoryCandidateMessages({ interaction: options.interaction, character: options.character })
    })
    const candidates = parseCoupleBoardMemoryCandidates(response.text)
    for (const candidate of candidates) {
      if (isDuplicate(existing, candidate.content)) continue
      const memory = await writeMemory({
        conversationId: options.conversationId,
        characterId: options.character.id,
        content: candidate.content,
        category: candidate.category,
        layer: candidate.layer,
        importance: candidate.importance,
        gameId: options.interaction.gameId,
        interactionId: options.interaction.id
      })
      result.semanticMemoryIds.push(memory.id)
      existing.push(memory)
    }
  } catch (error) {
    result.semanticSkippedReason = error instanceof Error ? `互动已保存；语义记忆提炼暂时失败：${error.message}` : '互动已保存；语义记忆提炼暂时失败。'
  }
  return result
}
