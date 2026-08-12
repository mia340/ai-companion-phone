import { db } from '../db/database'
import type {
  CharacterMemory,
  MemoryLayer,
  MemoryStrength,
  Message
} from '../types/domain'

interface MemoryCandidate {
  category: CharacterMemory['category']
  layer: MemoryLayer
  content: string
  importance: CharacterMemory['importance']
  confidence: number
  subject?: string
  topicKey?: string
  dueAt?: string
}

export interface MemoryHit {
  memory: CharacterMemory
  score: number
  reasons: string[]
}

export interface MemoryWriteResult {
  created: CharacterMemory[]
  merged: CharacterMemory[]
  conflicts: CharacterMemory[]
}

const LAYER_LABELS: Record<MemoryLayer, string> = {
  fact: '客观事实',
  subjective: '角色主观记忆',
  shared: '共同经历',
  promise: '承诺和约定',
  relationship: '关系事件',
  story: '长期剧情'
}

function normalizeContent(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[。！？!?]+$/, '')
    .trim()
}

function normalizeComparable(value: string) {
  return normalizeContent(value)
    .toLocaleLowerCase()
    .replace(/[，。、“”‘’：:；;,.!?！？\s]/g, '')
}

function clampImportance(value: number): CharacterMemory['importance'] {
  return Math.min(5, Math.max(1, Math.round(value))) as CharacterMemory['importance']
}

function parseRelativeDueAt(text: string, now = new Date()) {
  const date = new Date(now)
  date.setHours(9, 0, 0, 0)
  if (/今天|今晚/.test(text)) return date.toISOString()
  if (/明天|明早|明晚/.test(text)) {
    date.setDate(date.getDate() + 1)
    return date.toISOString()
  }
  if (/后天/.test(text)) {
    date.setDate(date.getDate() + 2)
    return date.toISOString()
  }
  if (/下周/.test(text)) {
    const weekdayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
    const target = text.match(/下周([一二三四五六日天])/)?.[1]
    const current = date.getDay()
    const targetDay = target ? weekdayMap[target] : 1
    // “下周三”必须落在下一自然周，而不是“最近的一个周三”。
    const daysToNextMonday = (8 - current) % 7 || 7
    const offsetFromMonday = targetDay === 0 ? 6 : targetDay - 1
    date.setDate(date.getDate() + daysToNextMonday + offsetFromMonday)
    return date.toISOString()
  }
  const monthDay = text.match(/(\d{1,2})月(\d{1,2})[日号]?/)
  if (monthDay) {
    const year = now.getFullYear()
    const candidate = new Date(year, Number(monthDay[1]) - 1, Number(monthDay[2]), 9)
    if (candidate.getTime() < now.getTime() - 86400000) candidate.setFullYear(year + 1)
    return candidate.toISOString()
  }
  return undefined
}

function stripMemoryCommand(segment: string) {
  return normalizeContent(segment)
    .replace(/^(?:请记住|你要记得|以后要记住|帮我记着|帮我记住|记一下|记住)[，,:：\s]*/i, '')
    .trim()
}

function inferSubject(segment: string) {
  const value = stripMemoryCommand(segment)
  const rules: Array<[RegExp, string]> = [
    [/^(?:我叫|我的名字是|你可以叫我)(.+)$/, 'profile:name'],
    [/^我的生日(?:是|在)?(.+)$/, 'profile:birthday'],
    [/^我(?:住在|来自)(.+)$/, 'profile:location'],
    [/^我(?:在|从事)(.+?)(?:工作|上班)?$/, 'profile:work'],
    [/^我(?:最)?喜欢(.+)$/, 'preference:like'],
    [/^我(?:不喜欢|讨厌)(.+)$/, 'preference:dislike'],
    [/^我对(.+)过敏$/, 'profile:allergy']
  ]
  for (const [pattern, prefix] of rules) {
    const match = value.match(pattern)
    if (match?.[1]) {
      const captured = normalizeContent(match[1]).slice(0, 36)
      const multiValue = prefix.startsWith('preference:')
      return {
        subject: multiValue ? `${prefix}:${captured}` : prefix,
        topicKey: `${prefix}:${captured}`
      }
    }
  }

  const event = value.match(/(面试|考试|比赛|手术|复诊|毕业|入职|搬家|旅行|约会|会议|体检|快递|外卖|申请|出成绩)/)?.[1]
  if (event) {
    return {
      subject: `event:${event}`,
      topicKey: `event:${event}:${normalizeComparable(value).slice(0, 30)}`
    }
  }
  return undefined
}

function topicFromText(segment: string, category: CharacterMemory['category']) {
  const subject = inferSubject(segment)
  if (subject) return subject
  const compact = normalizeComparable(segment)
    .replace(/^(我|我们|你|以后|请|记得|别忘了|说好了)/, '')
    .slice(0, 28)
  return {
    subject: `${category}:${compact.slice(0, 14) || 'general'}`,
    topicKey: `${category}:${compact || normalizeComparable(segment).slice(0, 28)}`
  }
}

function candidate(
  category: MemoryCandidate['category'],
  layer: MemoryLayer,
  content: string,
  importance: MemoryCandidate['importance'],
  confidence = .84
): MemoryCandidate | null {
  const normalized = normalizeContent(content)
  if (normalized.length < 3 || normalized.length > 180) return null
  const topic = topicFromText(normalized, category)
  return {
    category,
    layer,
    content: normalized,
    importance,
    confidence,
    subject: topic.subject,
    topicKey: topic.topicKey,
    dueAt: parseRelativeDueAt(normalized)
  }
}

export function memoryLayerFor(memory: Pick<CharacterMemory, 'layer' | 'category'>): MemoryLayer {
  if (memory.layer) return memory.layer
  if (memory.category === 'promise') return 'promise'
  if (memory.category === 'relationship') return 'relationship'
  if (memory.category === 'event') return 'shared'
  return 'fact'
}

export function memoryLayerLabel(memory: Pick<CharacterMemory, 'layer' | 'category'>) {
  return LAYER_LABELS[memoryLayerFor(memory)]
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
  const push = (item: MemoryCandidate | null) => {
    if (!item) return
    const duplicate = results.some(row => row.layer === item.layer && normalizeComparable(row.content) === normalizeComparable(item.content))
    if (!duplicate) results.push(item)
  }

  for (const rawSegment of segments) {
    const explicitRemember = /^(?:请记住|你要记得|别忘了|以后要记住|帮我记着|帮我记住|记一下|记住)/.test(rawSegment)
      || /(记得提醒|提醒我|别忘了提醒)/.test(rawSegment)
    const segment = stripMemoryCommand(rawSegment)
    if (!segment) continue

    if (/^(我叫|我的名字是|你可以叫我)/.test(segment)) {
      push(candidate('profile', 'fact', segment, 5, .98))
    } else if (/^(我喜欢|我最喜欢|我爱吃|我爱喝|我的爱好是)/.test(segment)) {
      push(candidate('preference', 'fact', segment, 4, .94))
    } else if (/^(我不喜欢|我讨厌|我害怕|我对.+过敏)/.test(segment)) {
      push(candidate('preference', 'fact', segment, 4, .94))
    }

    const hasEvent = /(生日|纪念日|毕业|入职|考试|面试|搬家|旅行|手术|复诊|比赛|约会|会议|体检|申请|出成绩)/.test(segment)
    const eventFactText = segment
      .replace(/[，,]?(?:记得|别忘了)?提醒我[，,:：\s]*/g, '')
      .replace(/[，,：:\s]+$/g, '')
      .trim()
    if (hasEvent) {
      // “用户将要发生什么”是客观事实/未来事件，不再错误归入共同经历。
      push(candidate('event', 'fact', eventFactText || segment, explicitRemember ? 5 : 4, .92))
    }

    if (/(提醒我|记得提醒|别忘了提醒|答应你|约定|说好了|一定会)/.test(segment)) {
      const promiseText = /提醒我|记得提醒|别忘了提醒/.test(segment)
        ? `需要提醒用户：${eventFactText || segment}`
        : segment
      push(candidate('promise', 'promise', promiseText, 5, .97))
    }

    if (/(我们是|你是我|我是你|在一起|分手|和好|第一次见面)/.test(segment)) {
      push(candidate('relationship', 'relationship', segment, 5, .93))
    }

    if (/(我们一起|我们刚刚|我们昨天|我们曾经|上次我们)/.test(segment) && !hasEvent) {
      push(candidate('event', 'shared', segment, explicitRemember ? 5 : 4, .9))
    }

    const alreadyCaptured = results.some(row => normalizeComparable(row.content) === normalizeComparable(segment))
    if (explicitRemember && !alreadyCaptured && !/(提醒我|记得提醒|别忘了提醒)/.test(segment)) {
      push(candidate('other', 'fact', segment, 5, .96))
    } else if (!alreadyCaptured && strength === 'deep' && /^(我在|我有|我想|我希望|我准备|我打算|我最近)/.test(segment)) {
      push(candidate('other', /想|希望|准备|打算/.test(segment) ? 'story' : 'fact', segment, 3, .76))
    } else if (!alreadyCaptured && strength !== 'light' && /^(今天我|明天我|后天我|下周我)/.test(segment)) {
      push(candidate('event', 'fact', segment, 3, .8))
    }
  }

  const max = strength === 'deep' ? 8 : strength === 'standard' ? 5 : 3
  return results.slice(0, max)
}

function hasNegativePolarity(value: string) {
  return /(?:没有|没了|取消|不用|不去|不参加|不再|不是|无需|改期|延期)/.test(normalizeContent(value))
}

function conflictsSemantically(existing: CharacterMemory, incoming: MemoryCandidate) {
  if (!incoming.subject || existing.subject !== incoming.subject) return false
  const left = normalizeComparable(existing.content)
  const right = normalizeComparable(incoming.content)
  if (left === right) return false
  if (hasNegativePolarity(existing.content) !== hasNegativePolarity(incoming.content)) return true
  const singleValue = /^(profile:(?:name|birthday|location|work)|event:)/.test(incoming.subject)
  if (singleValue && similarity(existing.content, incoming.content) < .88) return true
  return similarity(existing.content, incoming.content) < .55
}

function tokenSet(value: string) {
  const normalized = normalizeComparable(value)
  return new Set(Array.from(normalized))
}

function similarity(a: string, b: string) {
  const left = tokenSet(a)
  const right = tokenSet(b)
  if (!left.size || !right.size) return 0
  let overlap = 0
  for (const token of left) if (right.has(token)) overlap += 1
  return overlap / Math.max(left.size, right.size)
}

function normalizeMemory(row: CharacterMemory): CharacterMemory {
  return {
    ...row,
    layer: memoryLayerFor(row),
    confidence: typeof row.confidence === 'number' ? row.confidence : .82,
    locked: Boolean(row.locked),
    status: row.status ?? 'active',
    sourceType: row.sourceType ?? (row.sourceMessageId ? 'automatic' : 'manual'),
    hitCount: Number(row.hitCount || 0),
    mergedFrom: row.mergedFrom ?? [],
    conflictWith: row.conflictWith ?? []
  }
}

export async function rememberFromMessage(options: {
  conversationId: string
  characterId: string
  sourceMessageId: string
  text: string
  strength: MemoryStrength
}): Promise<CharacterMemory[]> {
  const result = await rememberFromMessageDetailed(options)
  return [...result.created, ...result.merged]
}

export async function rememberFromMessageDetailed(options: {
  conversationId: string
  characterId: string
  sourceMessageId: string
  text: string
  strength: MemoryStrength
}): Promise<MemoryWriteResult> {
  const candidates = extractMemoryCandidates(options.text, options.strength)
  if (!candidates.length) return { created: [], merged: [], conflicts: [] }

  const existing = (await db.memories
    .where('conversationId')
    .equals(options.conversationId)
    .toArray()).map(normalizeMemory)

  const created: CharacterMemory[] = []
  const merged: CharacterMemory[] = []
  const conflicts: CharacterMemory[] = []
  const now = new Date().toISOString()

  for (const item of candidates) {
    const comparable = normalizeComparable(item.content)
    const contradictory = existing.find(row => row.status !== 'invalid' && conflictsSemantically(row, item))
    const duplicate = existing.find(row =>
      row.status !== 'invalid' && !conflictsSemantically(row, item) && (
        normalizeComparable(row.content) === comparable ||
        similarity(row.content, item.content) >= .84
      )
    )

    if (duplicate) {
      const next: CharacterMemory = {
        ...duplicate,
        importance: clampImportance(Math.max(duplicate.importance, item.importance)),
        confidence: Math.max(duplicate.confidence ?? .82, item.confidence),
        dueAt: duplicate.dueAt || item.dueAt,
        topicKey: duplicate.topicKey || item.topicKey,
        subject: duplicate.subject || item.subject,
        sourceMessageId: options.sourceMessageId,
        mergedFrom: Array.from(new Set([...(duplicate.mergedFrom || []), options.sourceMessageId])),
        updatedAt: now
      }
      await db.memories.put(next)
      Object.assign(duplicate, next)
      merged.push(next)
      continue
    }

    const sameTopic = contradictory || existing.find(row =>
      row.status !== 'invalid' &&
      item.subject && row.subject === item.subject &&
      conflictsSemantically(row, item)
    )

    const row: CharacterMemory = {
      id: crypto.randomUUID(),
      conversationId: options.conversationId,
      characterId: options.characterId,
      category: item.category,
      layer: item.layer,
      content: item.content,
      importance: item.importance,
      confidence: item.confidence,
      subject: item.subject,
      topicKey: item.topicKey,
      dueAt: item.dueAt,
      locked: false,
      status: sameTopic ? 'conflict' : 'active',
      conflictWith: sameTopic ? [sameTopic.id] : [],
      sourceType: 'automatic',
      sourceMessageId: options.sourceMessageId,
      hitCount: 0,
      createdAt: now,
      updatedAt: now
    }

    if (sameTopic) {
      const related = Array.from(new Set([...(sameTopic.conflictWith || []), row.id]))
      const patched = { ...sameTopic, status: 'conflict' as const, conflictWith: related, updatedAt: now }
      await db.memories.put(patched)
      Object.assign(sameTopic, patched)
      conflicts.push(patched)
    }

    await db.memories.add(row)
    existing.push(row)
    created.push(row)
    if (sameTopic) conflicts.push(row)
  }

  return { created, merged, conflicts }
}

export async function listMemories(conversationId: string): Promise<CharacterMemory[]> {
  const rows = await db.memories
    .where('conversationId')
    .equals(conversationId)
    .toArray()

  return rows.map(normalizeMemory).sort((a, b) => {
    const statusRank = (value?: CharacterMemory['status']) => value === 'conflict' ? 0 : value === 'active' ? 1 : 2
    if (statusRank(a.status) !== statusRank(b.status)) return statusRank(a.status) - statusRank(b.status)
    if (Boolean(a.locked) !== Boolean(b.locked)) return a.locked ? -1 : 1
    if (a.importance !== b.importance) return b.importance - a.importance
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export async function addMemory(options: {
  conversationId: string
  characterId: string
  content: string
  category?: CharacterMemory['category']
  importance?: CharacterMemory['importance']
  layer?: MemoryLayer
}): Promise<CharacterMemory> {
  const content = normalizeContent(options.content)
  if (!content) throw new Error('记忆内容不能为空。')

  const category = options.category ?? 'other'
  const now = new Date().toISOString()
  const topic = topicFromText(content, category)
  const row: CharacterMemory = {
    id: crypto.randomUUID(),
    conversationId: options.conversationId,
    characterId: options.characterId,
    category,
    layer: options.layer ?? (category === 'promise' ? 'promise' : category === 'relationship' ? 'relationship' : category === 'event' ? 'shared' : 'fact'),
    content,
    importance: options.importance ?? 3,
    confidence: 1,
    subject: topic.subject,
    topicKey: topic.topicKey,
    dueAt: parseRelativeDueAt(content),
    locked: false,
    status: 'active',
    sourceType: 'manual',
    hitCount: 0,
    createdAt: now,
    updatedAt: now
  }
  await db.memories.add(row)
  return row
}

export async function rememberCharacterObservation(options: {
  conversationId: string
  characterId: string
  content: string
  sourceMessageId?: string
  importance?: CharacterMemory['importance']
}) {
  const content = normalizeContent(options.content)
  if (content.length < 4) return undefined
  const rows = await db.memories.where('conversationId').equals(options.conversationId).toArray()
  const existing = rows
    .map(normalizeMemory)
    .find(memory => memory.layer === 'subjective' && memory.status !== 'invalid' && similarity(memory.content, content) >= .72)
  const now = new Date().toISOString()
  if (existing) {
    return updateMemory(existing.id, {
      content: existing.content.length >= content.length ? existing.content : content,
      importance: clampImportance(Math.max(existing.importance, options.importance ?? 3)),
      confidence: Math.max(existing.confidence ?? .78, .82),
      sourceMessageId: options.sourceMessageId,
      mergedFrom: Array.from(new Set([...(existing.mergedFrom || []), ...(options.sourceMessageId ? [options.sourceMessageId] : [])])),
      updatedAt: now
    })
  }
  const row: CharacterMemory = {
    id: crypto.randomUUID(),
    conversationId: options.conversationId,
    characterId: options.characterId,
    category: 'relationship',
    layer: 'subjective',
    content,
    importance: options.importance ?? 3,
    confidence: .82,
    subject: `subjective:${normalizeComparable(content).slice(0, 18)}`,
    topicKey: `subjective:${normalizeComparable(content).slice(0, 32)}`,
    locked: false,
    status: 'active',
    sourceType: 'automatic',
    sourceMessageId: options.sourceMessageId,
    hitCount: 0,
    createdAt: now,
    updatedAt: now
  }
  await db.memories.add(row)
  return row
}

export async function updateMemory(id: string, patch: Partial<CharacterMemory>) {
  const current = await db.memories.get(id)
  if (!current) throw new Error('没有找到这条记忆。')
  const content = patch.content === undefined ? current.content : normalizeContent(patch.content)
  if (!content) throw new Error('记忆内容不能为空。')
  const next: CharacterMemory = normalizeMemory({
    ...current,
    ...patch,
    content,
    importance: patch.importance === undefined ? current.importance : clampImportance(patch.importance),
    confidence: patch.confidence === undefined ? current.confidence : Math.min(1, Math.max(0, patch.confidence)),
    updatedAt: new Date().toISOString()
  })
  await db.memories.put(next)
  return next
}

export async function toggleMemoryLock(id: string) {
  const current = await db.memories.get(id)
  if (!current) throw new Error('没有找到这条记忆。')
  return updateMemory(id, { locked: !current.locked })
}

export async function lowerMemoryImportance(id: string) {
  const current = await db.memories.get(id)
  if (!current) throw new Error('没有找到这条记忆。')
  return updateMemory(id, { importance: clampImportance(current.importance - 1) })
}

export async function markMemoryInvalid(id: string) {
  return updateMemory(id, { status: 'invalid', note: '用户标记为错误记忆。' })
}

export async function resolveMemoryConflict(
  id: string,
  mode: 'keep-this' | 'keep-other' | 'keep-both' = 'keep-this'
) {
  const current = await db.memories.get(id)
  if (!current) throw new Error('没有找到这条记忆。')
  const relatedIds = current.conflictWith || []
  const related = (await Promise.all(relatedIds.map(otherId => db.memories.get(otherId)))).filter(Boolean) as CharacterMemory[]
  const now = new Date().toISOString()

  await db.transaction('rw', db.memories, async () => {
    if (mode === 'keep-both') {
      await db.memories.update(id, { status: 'active', conflictWith: [], note: '用户确认两条信息都保留，请结合时间与上下文理解。', updatedAt: now })
      for (const row of related) {
        await db.memories.update(row.id, { status: 'active', conflictWith: [], note: '用户确认两条信息都保留，请结合时间与上下文理解。', updatedAt: now })
      }
      return
    }

    if (mode === 'keep-other' && related.length) {
      await db.memories.update(id, { status: 'invalid', conflictWith: [], note: '用户选择保留另一条冲突记忆。', updatedAt: now })
      for (const row of related) {
        await db.memories.update(row.id, { status: 'active', conflictWith: [], locked: true, note: '用户已确认这条冲突记忆。', updatedAt: now })
      }
      return
    }

    await db.memories.update(id, { status: 'active', conflictWith: [], locked: true, note: '用户已确认这条冲突记忆。', updatedAt: now })
    for (const row of related) {
      await db.memories.update(row.id, { status: 'invalid', conflictWith: [], note: `与已确认记忆 ${id} 冲突。`, updatedAt: now })
    }
  })
}

export function buildMemoryWriteNotice(result: MemoryWriteResult, userText: string) {
  if (!result.created.length && !result.merged.length && !result.conflicts.length) return ''
  const explicit = /(请记住|记住|别忘了|提醒我|记得提醒|帮我记)/.test(userText)
  const lines = [
    explicit ? '用户明确要求你记住本轮信息。先自然确认已经记下，再回应内容本身；不要回复“然后呢？”或假装没有听懂记忆请求。' : '',
    result.created.length ? `新写入 ${result.created.length} 条记忆：${result.created.map(item => `「${item.content}」`).join('；')}` : '',
    result.merged.length ? `与已有记忆合并 ${result.merged.length} 条。不要重复强调已经存了多份。` : '',
    result.conflicts.length ? `检测到记忆冲突：${Array.from(new Set(result.conflicts.map(item => item.content))).map(item => `「${item}」`).join(' / ')}。不要同时把冲突内容都当真；可以自然指出“这和之前记的不一样”，等待用户在记忆管理中确认。` : ''
  ].filter(Boolean)
  return lines.join('\n')
}

export async function removeMemory(id: string) {
  await db.memories.delete(id)
}

export async function clearMemories(conversationId: string) {
  await db.memories.where('conversationId').equals(conversationId).delete()
}

function tokenizeForMemory(value: string) {
  const normalized = value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')
  const words = normalized.split(/\s+/).filter(item => item.length > 1)
  const chars = Array.from(normalized.replace(/\s+/g, '')).filter(Boolean)
  return new Set([...words, ...chars])
}

export function selectMemoryHitsDetailed(
  memories: CharacterMemory[],
  query: string,
  limit = 10,
  now = new Date()
): MemoryHit[] {
  const queryTokens = tokenizeForMemory(query)
  const scored = memories
    .map(normalizeMemory)
    .filter(memory => memory.status !== 'invalid')
    .map(memory => {
      const memoryTokens = tokenizeForMemory(memory.content)
      let overlap = 0
      for (const token of queryTokens) if (memoryTokens.has(token)) overlap += token.length > 1 ? 3 : 1
      const reasons: string[] = []
      if (overlap > 0) reasons.push(`与本轮内容命中 ${overlap} 个关键词`)
      const ageDays = Math.max(0, (now.getTime() - new Date(memory.updatedAt).getTime()) / 86400000)
      const recency = Math.max(0, 5 - Math.floor(ageDays / 30))
      const layer = memoryLayerFor(memory)
      const layerBoost = layer === 'promise' ? 8 : layer === 'relationship' ? 5 : layer === 'shared' ? 3 : 0
      if (layerBoost) reasons.push(`${LAYER_LABELS[layer]}优先`)
      const lockedBoost = memory.locked ? 7 : 0
      if (memory.locked) reasons.push('用户已锁定')
      let dueBoost = 0
      if (memory.dueAt) {
        const diffDays = (new Date(memory.dueAt).getTime() - now.getTime()) / 86400000
        if (diffDays >= -1 && diffDays <= 7) {
          dueBoost = diffDays <= 1 ? 12 : 7
          reasons.push(diffDays < 0 ? '约定刚刚到期' : '约定日期临近')
        }
      }
      const conflictPenalty = memory.status === 'conflict' ? -15 : 0
      if (memory.status === 'conflict') reasons.push('存在冲突，已降低权重')
      const score = overlap * 4 + memory.importance * 3 + recency + layerBoost + lockedBoost + dueBoost + conflictPenalty
      return { memory, score, reasons: reasons.length ? reasons : ['重要度与近期性匹配'] }
    })

  const ranked = scored
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
  const relevant = ranked.filter(item =>
    item.reasons.some(reason => /关键词|约定|锁定/.test(reason)) ||
    item.memory.importance >= 4 ||
    memoryLayerFor(item.memory) === 'relationship'
  )
  return (relevant.length ? relevant : ranked.slice(0, 2)).slice(0, Math.max(1, limit))
}

export function selectMemoryHits(memories: CharacterMemory[], query: string, limit = 10): CharacterMemory[] {
  return selectMemoryHitsDetailed(memories, query, limit).map(item => item.memory)
}

export async function recordMemoryHits(hits: MemoryHit[]) {
  if (!hits.length) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.memories, async () => {
    for (const hit of hits) {
      await db.memories.update(hit.memory.id, {
        lastHitAt: now,
        hitCount: Number(hit.memory.hitCount || 0) + 1
      })
    }
  })
}

export function buildMemoryPrompt(memories: CharacterMemory[], summary: string) {
  const lines: string[] = []
  if (summary.trim()) lines.push(`【长期剧情摘要】\n${summary.trim()}`)

  const active = memories.map(normalizeMemory).filter(memory => memory.status === 'active')
  const layers: MemoryLayer[] = ['fact', 'subjective', 'shared', 'promise', 'relationship', 'story']
  for (const layer of layers) {
    const rows = active.filter(memory => memoryLayerFor(memory) === layer)
    if (!rows.length) continue
    lines.push(`【${LAYER_LABELS[layer]}】`)
    for (const memory of rows.slice(0, 8)) {
      const due = memory.dueAt ? `（时间：${new Date(memory.dueAt).toLocaleDateString('zh-CN')}）` : ''
      lines.push(`- ${memory.content}${due}`)
    }
  }

  if (active.some(memory => memory.locked)) {
    lines.push('被用户锁定的记忆视为高可信事实，除非用户明确修正，不要自行改写。')
  }
  return lines.join('\n')
}

export function createLocalSummary(messages: Message[]) {
  const usable = messages
    .filter(item => item.type === 'text' && item.content.trim())
    .slice(-40, -8)
  if (!usable.length) return ''
  return usable
    .slice(-12)
    .map(item => {
      const speaker = item.senderId === 'user' ? '用户' : '角色'
      const content = item.content.replace(/\s+/g, ' ').slice(0, 86)
      return `${speaker}：${content}`
    })
    .join('；')
}
