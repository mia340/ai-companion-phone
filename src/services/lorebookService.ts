import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import { buildResourceFocusInstruction, buildResourceSessionContinuationContent, looksLikeLargeFeatureModule, looksLikeMandatoryPerReplyContract, looksLikeOnDemandFeatureModule, routeLorebookIntent, shouldExitResourceSession, type ResourceRoutingDecision } from './resourceIntentRouter'
import type { Character, LorebookEntry, LorebookResource, Message, UserPersona } from '../types/domain'

function normalizeText(value: string, caseSensitive: boolean) {
  return caseSensitive ? value : value.toLocaleLowerCase()
}

function compileRegex(value: string, caseSensitive: boolean) {
  try {
    const match = value.match(/^\/(.*)\/([a-z]*)$/is)
    if (match) {
      const flags = Array.from(new Set(match[2].replace(/g/g, '').split(''))).join('')
      return new RegExp(match[1], caseSensitive ? flags.replace(/i/g, '') : flags.includes('i') ? flags : `${flags}i`)
    }
    return new RegExp(value, caseSensitive ? '' : 'i')
  } catch {
    return undefined
  }
}

function keywordMatches(entry: LorebookEntry, keyword: string, source: string) {
  const value = keyword.trim()
  if (!value) return false
  if (entry.useRegex) {
    const regex = compileRegex(value, entry.caseSensitive)
    return regex ? regex.test(source) : false
  }
  if (entry.matchWholeWords && /^[A-Za-z0-9_][A-Za-z0-9_ .'-]*$/.test(value)) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      return new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`, entry.caseSensitive ? '' : 'i').test(source)
    } catch {
      // 非法边界表达式退回普通包含匹配。
    }
  }
  return normalizeText(source, entry.caseSensitive).includes(normalizeText(value, entry.caseSensitive))
}

function optionalFilterMatches(entry: LorebookEntry, source: string) {
  const secondary = entry.secondaryKeys || []
  if (!entry.selective || !secondary.length) return true
  const hits = secondary.map(key => keywordMatches(entry, key, source))
  const logic = entry.selectiveLogic
  // Tavo/ST 常见：0=AND ANY，1=NOT ANY，2=NOT ALL，3=AND ALL。未知值按 AND ANY 降级。
  if (logic === 1 || logic === 'not_any') return hits.every(hit => !hit)
  if (logic === 2 || logic === 'not_all') return !hits.every(Boolean)
  if (logic === 3 || logic === 'and_all') return hits.every(Boolean)
  return hits.some(Boolean)
}

function entryMatchDetails(
  entry: LorebookEntry,
  messages: Message[],
  latestText = '',
  character?: Character,
  persona?: UserPersona
) {
  const scanDepth = Math.max(1, entry.scanDepth || 16)
  const sticky = Math.max(0, entry.sticky || 0)
  const delay = Math.max(0, entry.delay || 0)
  const relevant = messages.filter(message => !message.recalledAt).slice(-(scanDepth + sticky + delay + 2))
  const chunks = [...relevant.map(message => message.content), latestText].filter(Boolean)
  const activeChunks = delay > 0 ? chunks.slice(0, Math.max(0, chunks.length - delay)) : chunks
  const contextualSources = [
    entry.matchPersonaDescription
      ? [persona?.description, persona?.identity, persona?.occupation, persona?.personality, persona?.background].filter(Boolean).join('\n')
      : '',
    entry.matchCharacterDescription
      ? [character?.identity, character?.appearance, character?.background, character?.persona].filter(Boolean).join('\n')
      : '',
    entry.matchCharacterPersonality ? character?.persona || '' : '',
    entry.matchCharacterDepthPrompt
      ? [character?.depthPrompt?.prompt, character?.postHistoryInstructions].filter(Boolean).join('\n')
      : '',
    entry.matchScenario ? character?.scenario || '' : '',
    entry.matchCreatorNotes ? character?.creatorNotes || '' : ''
  ].filter(Boolean)
  const source = [...activeChunks.slice(-scanDepth), ...contextualSources].join('\n')
  const stickySource = [...activeChunks.slice(-(scanDepth + sticky)), ...contextualSources].join('\n')

  if (entry.constant && !entry.useRegex) return { matched: true, reason: '常驻条目', source }
  if (!entry.keywords.length) return { matched: false, reason: '', source }

  const directKeys = entry.keywords.filter(key => keywordMatches(entry, key, source))
  if (directKeys.length && optionalFilterMatches(entry, source)) {
    return { matched: true, reason: `${entry.useRegex ? '命中正则' : '命中关键词'}：${directKeys.slice(0, 3).join('、')}`, source }
  }

  if (sticky > 0) {
    const stickyKeys = entry.keywords.filter(key => keywordMatches(entry, key, stickySource))
    if (stickyKeys.length && optionalFilterMatches(entry, stickySource)) {
      return { matched: true, reason: `Sticky 延续：${stickyKeys.slice(0, 2).join('、')}`, source: stickySource }
    }
  }

  return { matched: false, reason: '', source }
}

function probabilityPasses(entry: LorebookEntry) {
  if (!entry.useProbability) return true
  const probability = Math.max(0, Math.min(100, entry.probability ?? 100))
  return Math.random() * 100 < probability
}

function applyGroups<T extends LorebookEntry & { activationReason: string }>(rows: T[]) {
  const ungrouped = rows.filter(item => !item.group)
  const grouped = new Map<string, T[]>()
  rows.filter(item => item.group).forEach(item => {
    const key = item.group || ''
    const list = grouped.get(key) || []
    list.push(item)
    grouped.set(key, list)
  })
  const winners = [...grouped.values()].flatMap(items => {
    const overrides = items.filter(item => item.groupOverride)
    if (overrides.length) return overrides.sort((a, b) => (b.groupWeight || 100) - (a.groupWeight || 100)).slice(0, 1)
    const total = items.reduce((sum, item) => sum + Math.max(1, item.groupWeight || 100), 0)
    let point = Math.random() * total
    for (const item of items) {
      point -= Math.max(1, item.groupWeight || 100)
      if (point <= 0) return [item]
    }
    return items.slice(0, 1)
  })
  return [...ungrouped, ...winners]
}

export async function listLorebooks(options?: { worldId?: string; characterId?: string }): Promise<LorebookResource[]> {
  const rows = await db.lorebooks.toArray()
  return rows
    .filter(item => !options?.worldId || item.worldId === options.worldId)
    // 世界书是可复用资源；characterId 只影响绑定，不再限制资源可见性。
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

export async function saveLorebook(input: Partial<LorebookResource> & Pick<LorebookResource, 'worldId' | 'name'>): Promise<LorebookResource> {
  const now = new Date().toISOString()
  const existing = input.id ? await db.lorebooks.get(input.id) : undefined
  const lorebook: LorebookResource = {
    id: input.id || crypto.randomUUID(),
    worldId: input.worldId,
    name: input.name.trim() || '未命名世界书',
    description: input.description?.trim() || undefined,
    characterId: input.characterId || undefined,
    sourceCharacterId: input.sourceCharacterId || existing?.sourceCharacterId,
    sourceCharacterName: input.sourceCharacterName || existing?.sourceCharacterName,
    sourceFileName: input.sourceFileName || existing?.sourceFileName,
    sourceFormat: input.sourceFormat || existing?.sourceFormat || 'native',
    scanDepth: input.scanDepth ?? existing?.scanDepth,
    tokenBudget: input.tokenBudget ?? existing?.tokenBudget,
    recursiveScanning: input.recursiveScanning ?? existing?.recursiveScanning ?? true,
    rawExtensions: input.rawExtensions || existing?.rawExtensions,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  await db.lorebooks.put(lorebook)
  return lorebook
}

export async function deleteLorebook(id: string) {
  const entries = await db.lorebookEntries.where('lorebookId').equals(id).toArray()
  await db.transaction('rw', [db.lorebooks, db.lorebookEntries, db.resourceBindings], async () => {
    if (entries.length) await db.lorebookEntries.bulkDelete(entries.map(item => item.id))
    const bindings = (await db.resourceBindings.toArray()).filter(item => item.resourceType === 'lorebook' && item.resourceId === id)
    if (bindings.length) await db.resourceBindings.bulkDelete(bindings.map(item => item.id))
    await db.lorebooks.delete(id)
  })
}

export async function listLorebookEntries(options?: {
  worldId?: string
  characterId?: string
  lorebookId?: string
}): Promise<LorebookEntry[]> {
  const rows = await db.lorebookEntries.toArray() as LorebookEntry[]
  return rows
    .filter(item => !options?.worldId || item.worldId === options.worldId)
    .filter(item => !options?.lorebookId || item.lorebookId === options.lorebookId)
    .filter(item => {
      if (options?.lorebookId) return true
      if (!options?.characterId) return true
      // 只有旧版“散装条目”仍按旧 characterId 兼容；有 lorebookId 的条目由资源绑定决定。
      return Boolean(item.lorebookId) || !item.characterId || item.characterId === options.characterId
    })
    .sort((a, b) => (a.insertionOrder ?? 100 - a.priority) - (b.insertionOrder ?? 100 - b.priority) || b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveLorebookEntry(
  input: Partial<LorebookEntry> & Pick<LorebookEntry, 'worldId' | 'title' | 'content'>
): Promise<LorebookEntry> {
  const now = new Date().toISOString()
  const existing = input.id ? await db.lorebookEntries.get(input.id) : undefined
  const has = (key: keyof LorebookEntry) => Object.prototype.hasOwnProperty.call(input, key)
  const entry: LorebookEntry = {
    id: input.id || crypto.randomUUID(),
    worldId: input.worldId,
    lorebookId: input.lorebookId || existing?.lorebookId,
    characterId: input.characterId || undefined,
    title: input.title.trim() || '未命名设定',
    keywords: Array.from(new Set((input.keywords || []).map(item => item.trim()).filter(Boolean))),
    secondaryKeys: Array.from(new Set((input.secondaryKeys || existing?.secondaryKeys || []).map(item => item.trim()).filter(Boolean))),
    content: input.content.trim(),
    enabled: input.enabled ?? existing?.enabled ?? true,
    constant: input.constant ?? existing?.constant ?? false,
    caseSensitive: input.caseSensitive ?? existing?.caseSensitive ?? false,
    matchWholeWords: input.matchWholeWords ?? existing?.matchWholeWords,
    useRegex: input.useRegex ?? existing?.useRegex ?? false,
    selective: input.selective ?? existing?.selective ?? false,
    selectiveLogic: has('selectiveLogic') ? input.selectiveLogic : existing?.selectiveLogic,
    priority: Math.min(100, Math.max(0, Math.round(input.priority ?? existing?.priority ?? 50))),
    insertionOrder: has('insertionOrder') ? input.insertionOrder : existing?.insertionOrder,
    position: has('position') ? input.position : existing?.position,
    depth: has('depth') ? input.depth : existing?.depth,
    role: has('role') ? input.role : existing?.role,
    probability: input.probability ?? existing?.probability,
    useProbability: input.useProbability ?? existing?.useProbability,
    sticky: input.sticky ?? existing?.sticky,
    cooldown: input.cooldown ?? existing?.cooldown,
    delay: input.delay ?? existing?.delay,
    group: has('group') ? input.group : existing?.group,
    groupOverride: input.groupOverride ?? existing?.groupOverride,
    groupWeight: input.groupWeight ?? existing?.groupWeight,
    scanDepth: input.scanDepth ?? existing?.scanDepth,
    excludeRecursion: input.excludeRecursion ?? existing?.excludeRecursion,
    preventRecursion: input.preventRecursion ?? existing?.preventRecursion,
    delayUntilRecursion: input.delayUntilRecursion ?? existing?.delayUntilRecursion,
    useGroupScoring: input.useGroupScoring ?? existing?.useGroupScoring,
    matchPersonaDescription: input.matchPersonaDescription ?? existing?.matchPersonaDescription,
    matchCharacterDescription: input.matchCharacterDescription ?? existing?.matchCharacterDescription,
    matchCharacterPersonality: input.matchCharacterPersonality ?? existing?.matchCharacterPersonality,
    matchCharacterDepthPrompt: input.matchCharacterDepthPrompt ?? existing?.matchCharacterDepthPrompt,
    matchScenario: input.matchScenario ?? existing?.matchScenario,
    matchCreatorNotes: input.matchCreatorNotes ?? existing?.matchCreatorNotes,
    sourceEntryId: has('sourceEntryId') ? input.sourceEntryId : existing?.sourceEntryId,
    rawExtensions: has('rawExtensions') ? input.rawExtensions : existing?.rawExtensions,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  await db.lorebookEntries.put(entry)
  return entry
}

export async function deleteLorebookEntry(id: string): Promise<void> {
  await db.lorebookEntries.delete(id)
}

async function activeLorebookIds(characterId?: string) {
  if (!characterId) return []
  return getCharacterResourceIds(characterId, 'lorebook')
}

export async function buildLorebookPrompt(options: {
  worldId: string
  characterId?: string
  messages: Message[]
  latestText?: string
  character?: Character
  persona?: UserPersona
  maxEntries?: number
  activeResourceEntryId?: string
}): Promise<{
  prompt: string
  beforePrompt: string
  afterPrompt: string
  activated: Array<LorebookEntry & { activationReason: string }>
  focused: Array<LorebookEntry & { activationReason: string }>
  deferred: Array<LorebookEntry & { activationReason: string }>
  routingDecisions: ResourceRoutingDecision[]
  estimatedSavedCharacters: number
  resourceSession: { entryId?: string; title?: string; continued: boolean; exitRequested: boolean }
}> {
  const activeIds = await activeLorebookIds(options.characterId)
  const allowedBookIds = new Set(activeIds)
  const all = await db.lorebookEntries.toArray() as LorebookEntry[]
  const entries = all.filter(item => item.worldId === options.worldId)
    .filter(item => {
      // 旧版本散装条目继续按历史 characterId 兼容。
      if (!item.lorebookId) return !item.characterId || item.characterId === options.characterId
      // 有 lorebookId 的条目完全由 ResourceBinding 决定；来源角色不限制复用。
      return allowedBookIds.has(item.lorebookId)
    })

  const explicitIntent = routeLorebookIntent(entries, options.latestText || '')
  const activeSessionEntry = options.activeResourceEntryId
    ? entries.find(item => item.id === options.activeResourceEntryId && item.enabled)
    : undefined
  const staleActiveSession = Boolean(options.activeResourceEntryId && !activeSessionEntry)
  const exitRequested = staleActiveSession || shouldExitResourceSession(options.latestText || '', activeSessionEntry)
  const focusedIds = new Set(explicitIntent.focusedIds)
  const focusedAliases = new Map(explicitIntent.focusedAliases)
  if (exitRequested && activeSessionEntry) {
    focusedIds.delete(activeSessionEntry.id)
    focusedAliases.delete(activeSessionEntry.id)
  }
  const continueSession = Boolean(
    activeSessionEntry
    && !exitRequested
    && focusedIds.size === 0
    && looksLikeOnDemandFeatureModule(activeSessionEntry)
  )
  if (continueSession && activeSessionEntry) {
    focusedIds.add(activeSessionEntry.id)
    focusedAliases.set(activeSessionEntry.id, activeSessionEntry.title)
  }

  const deferred: Array<LorebookEntry & { activationReason: string }> = []
  const candidates: Array<LorebookEntry & { activationReason: string }> = []

  for (const item of entries.filter(entry => entry.enabled)) {
    const focusedAlias = focusedAliases.get(item.id)
    if (focusedIds.has(item.id)) {
      candidates.push({
        ...item,
        activationReason: continueSession && activeSessionEntry?.id === item.id
          ? `资源会话延续：${item.title}`
          : `用户意图 Focus：${focusedAlias || item.title}`
      })
      continue
    }

    const details = entryMatchDetails(item, options.messages, options.latestText, options.character, options.persona)
    if (!details.matched) continue

    // 大型“功能说明书/UI 模块”不再因为 constant 就每轮全文注入。
    // 但作者明确规定“每轮必须输出”的状态栏/固定合同仍保持常驻，避免破坏原卡。
    if (item.constant && looksLikeLargeFeatureModule(item) && looksLikeOnDemandFeatureModule(item) && !looksLikeMandatoryPerReplyContract(item)) {
      deferred.push({ ...item, activationReason: '大型功能模块：本轮未明确调用，已按需休眠' })
      continue
    }

    if (probabilityPasses(item)) candidates.push({ ...item, activationReason: details.reason })
  }

  const focusedCandidates = candidates.filter(item => focusedIds.has(item.id))
  const normalCandidates = candidates.filter(item => !focusedIds.has(item.id))
  const groupedNormal = applyGroups(normalCandidates)
  let activated = [...focusedCandidates, ...groupedNormal]
    .sort((a, b) => (a.insertionOrder ?? (100 - a.priority)) - (b.insertionOrder ?? (100 - b.priority)))
    .slice(0, options.maxEntries ?? 24)

  // Focus 不应被 maxEntries 挤掉；如果超限，优先保留用户明确调用的资源。
  const keptFocusedIds = new Set(focusedCandidates.map(item => item.id))
  if (focusedCandidates.length) {
    const kept = new Map(activated.map(item => [item.id, item]))
    for (const item of focusedCandidates) kept.set(item.id, item)
    activated = [...kept.values()]
      .sort((a, b) => keptFocusedIds.has(a.id) === keptFocusedIds.has(b.id)
        ? (a.insertionOrder ?? (100 - a.priority)) - (b.insertionOrder ?? (100 - b.priority))
        : keptFocusedIds.has(a.id) ? -1 : 1)
      .slice(0, options.maxEntries ?? 24)
  }

  const focused = activated.filter(item => keptFocusedIds.has(item.id))
  const normal = activated.filter(item => !keptFocusedIds.has(item.id))
  const promptContent = (entry: (typeof activated)[number]) =>
    entry.activationReason.startsWith('资源会话延续：')
      ? buildResourceSessionContinuationContent(entry)
      : entry.content
  const section = (rows: typeof activated) => rows.map((entry, index) => `${index + 1}. ${entry.title}\n${promptContent(entry)}`).join('\n\n')
  const before = normal.filter(entry => entry.position === 'before_char' || entry.position === 0 || entry.position == null)
  const after = normal.filter(entry => !before.includes(entry))
  const focusPrompt = focused.length
    ? `${buildResourceFocusInstruction(focused)}\n\n${section(focused)}`
    : ''
  const beforePrompt = before.length ? `【本轮触发的世界书 · Before】\n\n${section(before)}` : ''
  const afterPrompt = after.length ? `【本轮触发的世界书 · After】\n\n${section(after)}` : ''
  const prompt = [
    focusPrompt,
    beforePrompt,
    afterPrompt,
    activated.length ? '以上设定是当前启用资源产生的世界事实或玩法规则。自然遵守，不要向用户解释“世界书”或触发过程。' : ''
  ].filter(Boolean).join('\n\n')

  const routingDecisions: ResourceRoutingDecision[] = [
    ...focused.map(item => ({ id: item.id, title: item.title, status: 'focused' as const, reason: item.activationReason, characters: promptContent(item).length })),
    ...normal.map(item => ({ id: item.id, title: item.title, status: 'activated' as const, reason: item.activationReason, characters: item.content.length })),
    ...deferred.map(item => ({ id: item.id, title: item.title, status: 'deferred' as const, reason: item.activationReason, characters: item.content.length }))
  ]
  const sessionSavedCharacters = focused.reduce((sum, item) => {
    if (!item.activationReason.startsWith('资源会话延续：')) return sum
    return sum + Math.max(0, item.content.length - promptContent(item).length)
  }, 0)
  const estimatedSavedCharacters = deferred.reduce((sum, item) => sum + item.content.length, 0) + sessionSavedCharacters
  const sessionCandidate = focused.find(item => looksLikeOnDemandFeatureModule(item))
  return {
    prompt, beforePrompt, afterPrompt, activated, focused, deferred, routingDecisions, estimatedSavedCharacters,
    resourceSession: {
      entryId: exitRequested ? undefined : sessionCandidate?.id || (continueSession ? activeSessionEntry?.id : undefined),
      title: exitRequested ? undefined : sessionCandidate?.title || (continueSession ? activeSessionEntry?.title : undefined),
      continued: continueSession,
      exitRequested
    }
  }
}
