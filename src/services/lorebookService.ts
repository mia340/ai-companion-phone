import { db } from '../db/database'
import type { LorebookEntry, Message } from '../types/domain'

function normalizeText(value: string, caseSensitive: boolean) {
  return caseSensitive ? value : value.toLocaleLowerCase()
}

function entryMatches(entry: LorebookEntry, source: string) {
  if (entry.constant) return true
  if (!entry.keywords.length) return false

  const haystack = normalizeText(source, entry.caseSensitive)
  return entry.keywords.some(keyword => {
    const needle = normalizeText(keyword.trim(), entry.caseSensitive)
    return Boolean(needle) && haystack.includes(needle)
  })
}

export async function listLorebookEntries(options?: {
  worldId?: string
  characterId?: string
}): Promise<LorebookEntry[]> {
  const rows = await db.lorebookEntries.toArray() as LorebookEntry[]
  return rows
    .filter(item => !options?.worldId || item.worldId === options.worldId)
    .filter(item => !options?.characterId || !item.characterId || item.characterId === options.characterId)
    .sort((a, b) => b.priority - a.priority || b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveLorebookEntry(
  input: Partial<LorebookEntry> & Pick<LorebookEntry, 'worldId' | 'title' | 'content'>
): Promise<LorebookEntry> {
  const now = new Date().toISOString()
  const existing = input.id ? await db.lorebookEntries.get(input.id) : undefined
  const entry: LorebookEntry = {
    id: input.id || crypto.randomUUID(),
    worldId: input.worldId,
    characterId: input.characterId || undefined,
    title: input.title.trim() || '未命名设定',
    keywords: Array.from(new Set((input.keywords || []).map(item => item.trim()).filter(Boolean))),
    content: input.content.trim(),
    enabled: input.enabled ?? existing?.enabled ?? true,
    constant: input.constant ?? existing?.constant ?? false,
    caseSensitive: input.caseSensitive ?? existing?.caseSensitive ?? false,
    priority: Math.min(100, Math.max(0, Math.round(input.priority ?? existing?.priority ?? 50))),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  await db.lorebookEntries.put(entry)
  return entry
}

export async function deleteLorebookEntry(id: string): Promise<void> {
  await db.lorebookEntries.delete(id)
}

export async function buildLorebookPrompt(options: {
  worldId: string
  characterId?: string
  messages: Message[]
  latestText?: string
  maxEntries?: number
}): Promise<{ prompt: string; activated: LorebookEntry[] }> {
  const entries = await listLorebookEntries({
    worldId: options.worldId,
    characterId: options.characterId
  })

  const source = [
    ...options.messages.slice(-16).map(message => message.content),
    options.latestText || ''
  ].join('\n')

  const activated = entries
    .filter(item => item.enabled)
    .filter(item => !item.characterId || item.characterId === options.characterId)
    .filter(item => entryMatches(item, source))
    .slice(0, options.maxEntries ?? 8)

  const prompt = activated.length
    ? [
      '【本轮触发的世界书】',
      ...activated.map((entry, index) => `${index + 1}. ${entry.title}\n${entry.content}`),
      '以上设定是世界事实。自然融入回复，不要向用户解释“世界书”或触发过程。'
    ].join('\n\n')
    : ''

  return { prompt, activated }
}
