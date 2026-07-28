import { db } from '../db/database'
import type {
  CharacterMemory,
  MemoryStrength,
  Message
} from '../types/domain'

interface MemoryCandidate {
  category: CharacterMemory['category']
  content: string
  importance: CharacterMemory['importance']
}

function normalizeContent(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[。！？!?]+$/, '')
    .trim()
}

function candidate(
  category: MemoryCandidate['category'],
  content: string,
  importance: MemoryCandidate['importance']
): MemoryCandidate | null {
  const normalized = normalizeContent(content)
  if (normalized.length < 3 || normalized.length > 120) return null

  return {
    category,
    content: normalized,
    importance
  }
}

export function extractMemoryCandidates(
  text: string,
  strength: MemoryStrength
): MemoryCandidate[] {
  const segments = text
    .split(/[。！？!?\n]/)
    .map(item => item.trim())
    .filter(Boolean)

  const results: MemoryCandidate[] = []

  for (const segment of segments) {
    let item: MemoryCandidate | null = null

    if (/^(我叫|我的名字是|你可以叫我)/.test(segment)) {
      item = candidate('profile', segment, 5)
    } else if (/^(我喜欢|我最喜欢|我爱吃|我爱喝|我的爱好是)/.test(segment)) {
      item = candidate('preference', segment, 4)
    } else if (/^(我不喜欢|我讨厌|我害怕|我对.+过敏)/.test(segment)) {
      item = candidate('preference', segment, 4)
    } else if (/(生日|纪念日|毕业|入职|考试|面试|搬家|旅行)/.test(segment)) {
      item = candidate('event', segment, 4)
    } else if (/(答应你|约定|说好了|一定会|别忘了)/.test(segment)) {
      item = candidate('promise', segment, 5)
    } else if (/(我们是|你是我|我是你|在一起|分手|和好)/.test(segment)) {
      item = candidate('relationship', segment, 5)
    } else if (strength === 'deep' && /^(我在|我有|我想|我希望|我准备|我打算)/.test(segment)) {
      item = candidate('other', segment, 2)
    } else if (strength !== 'light' && /^(我最近|今天我|明天我|下周我)/.test(segment)) {
      item = candidate('event', segment, 3)
    }

    if (item) results.push(item)
  }

  return results.slice(0, strength === 'deep' ? 4 : 2)
}

export async function rememberFromMessage(options: {
  conversationId: string
  characterId: string
  sourceMessageId: string
  text: string
  strength: MemoryStrength
}): Promise<CharacterMemory[]> {
  const candidates = extractMemoryCandidates(
    options.text,
    options.strength
  )

  if (candidates.length === 0) return []

  const existing = await db.memories
    .where('conversationId')
    .equals(options.conversationId)
    .toArray()

  const existingKeys = new Set(
    existing.map(item => normalizeContent(item.content).toLowerCase())
  )

  const now = new Date().toISOString()
  const rows = candidates
    .filter(item => !existingKeys.has(item.content.toLowerCase()))
    .map(item => ({
      id: crypto.randomUUID(),
      conversationId: options.conversationId,
      characterId: options.characterId,
      category: item.category,
      content: item.content,
      importance: item.importance,
      sourceMessageId: options.sourceMessageId,
      createdAt: now,
      updatedAt: now
    } satisfies CharacterMemory))

  if (rows.length > 0) {
    await db.memories.bulkAdd(rows)
  }

  return rows
}

export async function listMemories(
  conversationId: string
): Promise<CharacterMemory[]> {
  const rows = await db.memories
    .where('conversationId')
    .equals(conversationId)
    .toArray()

  return rows.sort((a, b) => {
    if (a.importance !== b.importance) {
      return b.importance - a.importance
    }

    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export async function addMemory(options: {
  conversationId: string
  characterId: string
  content: string
  category?: CharacterMemory['category']
  importance?: CharacterMemory['importance']
}): Promise<CharacterMemory> {
  const content = normalizeContent(options.content)

  if (!content) {
    throw new Error('记忆内容不能为空。')
  }

  const now = new Date().toISOString()
  const row: CharacterMemory = {
    id: crypto.randomUUID(),
    conversationId: options.conversationId,
    characterId: options.characterId,
    category: options.category ?? 'other',
    content,
    importance: options.importance ?? 3,
    createdAt: now,
    updatedAt: now
  }

  await db.memories.add(row)
  return row
}

export async function removeMemory(id: string) {
  await db.memories.delete(id)
}

export async function clearMemories(conversationId: string) {
  await db.memories
    .where('conversationId')
    .equals(conversationId)
    .delete()
}

export function buildMemoryPrompt(
  memories: CharacterMemory[],
  summary: string
) {
  const lines: string[] = []

  if (summary.trim()) {
    lines.push(`过往对话摘要：${summary.trim()}`)
  }

  if (memories.length > 0) {
    lines.push('你记得的用户信息：')
    for (const memory of memories.slice(0, 16)) {
      lines.push(`- ${memory.content}`)
    }
  }

  return lines.join('\n')
}

export function createLocalSummary(messages: Message[]) {
  const usable = messages
    .filter(item => item.type === 'text' && item.content.trim())
    .slice(-30, -8)

  if (usable.length === 0) return ''

  return usable
    .slice(-10)
    .map(item => {
      const speaker = item.senderId === 'user' ? '用户' : '角色'
      const content = item.content.replace(/\s+/g, ' ').slice(0, 72)
      return `${speaker}：${content}`
    })
    .join('；')
}
