// memoryConsolidationService.ts
// V0.5.0-alpha.6 记忆巩固：阶段性摘要 + 陈旧记忆衰减。
// 设计原则：只做"加法"和"降权"，绝不删除原始记忆；LLM 失败时软降级，不影响聊天。
import { db } from '../db/database'
import { addMemory } from './memoryService'
import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import type { CharacterMemory } from '../types/domain'

const DAY_MS = 24 * 60 * 60 * 1000
const STALE_DAYS = 30
const CONSOLIDATE_BATCH = 12
const CONSOLIDATE_NOTE_TAG = '已由记忆巩固总结'

/**
 * 陈旧记忆衰减（纯本地，无外部调用）。
 * 对未锁定、active、重要度 ≤2、且 30 天未被召回的记忆，把重要度下调 1（最低到 1）。
 */
export async function decayStaleMemories(conversationId: string) {
  const rows = await db.memories.where('conversationId').equals(conversationId).toArray()
  const now = Date.now()
  let decayed = 0
  for (const memory of rows) {
    if (memory.locked || memory.status !== 'active') continue
    const importance = memory.importance ?? 3
    if (importance > 2 || importance <= 1) continue
    const reference = memory.lastHitAt || memory.updatedAt || memory.createdAt
    const ageDays = (now - new Date(reference).getTime()) / DAY_MS
    if (ageDays >= STALE_DAYS) {
      await db.memories.update(memory.id, {
        importance: (importance - 1) as CharacterMemory['importance'],
        note: memory.note ? memory.note : '长期未被召回，重要度自然衰减。',
        updatedAt: new Date().toISOString()
      })
      decayed += 1
    }
  }
  return { decayed }
}

/**
 * 阶段性记忆巩固：把最旧的一批零散细节，用 LLM 提炼成 1-3 条长期剧情记忆。
 * 原始记忆不删除，仅降为重要度 1 并加备注。
 */
export async function consolidateConversationMemories(
  conversationId: string,
  characterId: string
): Promise<{ summarized: number; reason?: string }> {
  const rows = await db.memories.where('conversationId').equals(conversationId).toArray()

  const candidates = rows.filter((memory) =>
    memory.status === 'active' &&
    !memory.locked &&
    (memory.layer === 'shared' || memory.layer === 'fact' ||
      memory.layer === 'subjective' || memory.layer === 'story') &&
    !(memory.note || '').includes(CONSOLIDATE_NOTE_TAG) &&
    (memory.importance ?? 3) <= 3
  )

  if (candidates.length < CONSOLIDATE_BATCH) {
    return { summarized: 0, reason: 'not-enough-memories' }
  }

  candidates.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const batch = candidates.slice(0, CONSOLIDATE_BATCH)

  try {
    const modelSettingsRow = await getModelSettings()
    const provider = createProvider(modelSettingsRow)
    const list = batch
      .map((memory, index) => `${index + 1}. [${memory.createdAt.slice(0, 10)}] ${memory.content}`)
      .join('\n')

    const systemPrompt = [
      '你是记忆整理助手。把下列零散的对话记忆提炼成简洁、稳定、可长期保留的阶段性总结。',
      '只保留反复出现或确实重要的信息，丢弃一次性的琐碎内容，不要编造或补全。',
      '输出 1-3 条总结，每条单独一行，以“数字. ”开头，不要给任何额外解释。'
    ].join('')

    const response = await provider.chat({
      model: modelSettingsRow.model,
      temperature: 0.3,
      character: { characterName: '记忆整理', userName: '用户' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `需要整理的记忆：\n${list}` }
      ]
    })

    const summaryLines = String(response.text || '')
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.、)]\s*/, '').trim())
      .filter((line) => line.length > 4)
      .slice(0, 3)

    let summarized = 0
    for (const line of summaryLines) {
      await addMemory({
        conversationId,
        characterId,
        content: line,
        category: 'event',
        importance: 4,
        layer: 'story'
      })
      summarized += 1
    }

    const today = new Date().toISOString().slice(0, 10)
    for (const memory of batch) {
      await db.memories.update(memory.id, {
        importance: 1,
        note: `${CONSOLIDATE_NOTE_TAG}（${today}），原始细节保留备查。`
      })
    }

    return { summarized }
  } catch (error) {
    console.warn('memory consolidation skipped:', error)
    return { summarized: 0, reason: 'llm-unavailable' }
  }
}
