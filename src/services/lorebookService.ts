import { db } from '../db/database'
import { getCharacterResourceIds } from './resourceBindingService'
import { initialLorebookEntryMode } from './lorebookSemantics'
import {
  buildResourceFocusInstruction,
  buildResourceSessionContinuationContent,
  looksLikeLargeFeatureModule,
  looksLikeMandatoryPerReplyContract,
  looksLikeOnDemandFeatureModule,
  routeLorebookIntent,
  shouldExitResourceSession,
  type ResourceRoutingDecision
} from './resourceIntentRouter'
import type {
  Character,
  LorebookEntry,
  LorebookResource,
  LorebookRuntimeState,
  Message,
  UserPersona
} from '../types/domain'

export type LorebookActivationKind = 'focus' | 'constant' | 'keyword' | 'sticky' | 'recursive' | 'session'

export interface ActivatedLorebookEntry extends LorebookEntry {
  activationReason: string
  activationKind: LorebookActivationKind
  matchScore: number
  recursionDepth: number
  estimatedTokens: number
}

export interface LorebookDepthInjection {
  entryId: string
  title: string
  content: string
  role: 'system' | 'user' | 'assistant'
  depth: number
  order: number
}

export type LorebookDecisionStatus = 'focused' | 'activated' | 'deferred' | 'not-triggered'

export interface LorebookEngineDebugDecision {
  id: string
  title: string
  status: LorebookDecisionStatus
  reason: string
}

export interface LorebookEngineDebug {
  evaluatedEntries: number
  initialActivated: number
  recursiveActivated: number
  recursionSteps: number
  estimatedBudgetTokens?: number
  estimatedUsedTokens: number
  droppedByBudget: number
  stickyActive: string[]
  cooldownBlocked: string[]
  delayBlocked: string[]
  groupDropped: string[]
  depthInjections: Array<{ title: string; depth: number; role: 'system' | 'user' | 'assistant' }>
  /** Per-entry decision trace for the Activation Inspector. Old traces can omit it. */
  decisions: LorebookEngineDebugDecision[]
}

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

function normalizedSelectiveLogic(value: LorebookEntry['selectiveLogic']) {
  if (value === 1 || value === 'not_all') return 'not_all' as const
  if (value === 2 || value === 'not_any') return 'not_any' as const
  if (value === 3 || value === 'and_all') return 'and_all' as const
  return 'and_any' as const
}

function matchKeys(entry: LorebookEntry, source: string) {
  const primaryKeys = (entry.keywords || []).filter(key => keywordMatches(entry, key, source))
  if (!primaryKeys.length) return { matched: false, primaryKeys: [], secondaryKeys: [], score: 0 }

  const secondary = entry.secondaryKeys || []
  if (!entry.selective || !secondary.length) {
    return { matched: true, primaryKeys, secondaryKeys: [], score: primaryKeys.length }
  }

  const secondaryKeys = secondary.filter(key => keywordMatches(entry, key, source))
  const logic = normalizedSelectiveLogic(entry.selectiveLogic)
  const allSecondary = secondaryKeys.length === secondary.length
  const anySecondary = secondaryKeys.length > 0
  const matched = logic === 'and_all'
    ? allSecondary
    : logic === 'not_any'
      ? !anySecondary
      : logic === 'not_all'
        ? !allSecondary
        : anySecondary
  const secondaryScore = logic === 'and_any'
    ? secondaryKeys.length
    : logic === 'and_all' && allSecondary
      ? secondary.length
      : 0
  return { matched, primaryKeys, secondaryKeys, score: matched ? primaryKeys.length + secondaryScore : 0 }
}

function contextualSources(entry: LorebookEntry, character?: Character, persona?: UserPersona) {
  return [
    entry.matchPersonaDescription
      ? [persona?.description, persona?.identity, persona?.occupation, persona?.personality, persona?.background].filter(Boolean).join('\n')
      : '',
    entry.matchCharacterDescription
      ? [character?.identity, character?.appearance, character?.background, character?.cardDescription].filter(Boolean).join('\n')
      : '',
    entry.matchCharacterPersonality ? [character?.cardPersonality, character?.persona].filter(Boolean).join('\n') : '',
    entry.matchCharacterDepthPrompt
      ? [character?.depthPrompt?.prompt, character?.postHistoryInstructions].filter(Boolean).join('\n')
      : '',
    entry.matchScenario ? character?.scenario || '' : '',
    entry.matchCreatorNotes ? character?.creatorNotes || '' : ''
  ].filter(Boolean)
}

function buildScanSource(options: {
  entry: LorebookEntry
  messages: Message[]
  latestText: string
  bookScanDepth?: number
  character?: Character
  persona?: UserPersona
}) {
  const configuredDepth = options.entry.scanDepth ?? options.bookScanDepth ?? 16
  const scanDepth = Math.max(0, configuredDepth)
  const messages = options.messages.filter(message => !message.recalledAt)
  const history = scanDepth > 0 ? messages.slice(-scanDepth).map(message => message.content) : []
  const latest = scanDepth > 0 && options.latestText ? [options.latestText] : []
  return [...history, ...latest, ...contextualSources(options.entry, options.character, options.persona)].filter(Boolean).join('\n')
}

function estimateLorebookTokens(value: string) {
  const compact = value || ''
  const cjk = (compact.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
  const other = Math.max(0, compact.length - cjk)
  return Math.max(1, Math.ceil(cjk * 0.8 + other / 4))
}

function probabilityPasses(entry: LorebookEntry) {
  if (!entry.useProbability) return true
  const probability = Math.max(0, Math.min(100, entry.probability ?? 100))
  return Math.random() * 100 < probability
}

function entryOrder(entry: LorebookEntry) {
  return entry.insertionOrder ?? (100 - entry.priority)
}

function splitGroups(entry: LorebookEntry) {
  return (entry.group || '').split(/[,，、;]/).map(item => item.trim()).filter(Boolean)
}

function applyGroups(rows: ActivatedLorebookEntry[]) {
  const selected = new Map(rows.map(item => [item.id, item]))
  const groups = new Map<string, ActivatedLorebookEntry[]>()
  for (const item of rows) {
    for (const group of splitGroups(item)) {
      const list = groups.get(group) || []
      list.push(item)
      groups.set(group, list)
    }
  }

  const dropped = new Map<string, string>()
  for (const [group, originalItems] of groups) {
    let items = originalItems.filter(item => selected.has(item.id))
    if (items.length <= 1) continue

    if (items.some(item => item.useGroupScoring)) {
      const highScore = Math.max(...items.map(item => item.matchScore))
      const scoreLosers = items.filter(item => item.matchScore < highScore)
      scoreLosers.forEach(item => {
        selected.delete(item.id)
        dropped.set(item.id, `组“${group}”评分淘汰：${item.matchScore} < ${highScore}`)
      })
      items = items.filter(item => item.matchScore === highScore)
    }
    if (items.length <= 1) continue

    const prioritized = items.filter(item => item.groupOverride)
    let winner: ActivatedLorebookEntry
    if (prioritized.length) {
      winner = prioritized.sort((a, b) => entryOrder(b) - entryOrder(a))[0]
    } else {
      const total = items.reduce((sum, item) => sum + Math.max(1, item.groupWeight || 100), 0)
      let point = Math.random() * total
      winner = items[0]
      for (const item of items) {
        point -= Math.max(1, item.groupWeight || 100)
        if (point <= 0) {
          winner = item
          break
        }
      }
    }
    for (const item of items) {
      if (item.id === winner.id) continue
      selected.delete(item.id)
      dropped.set(item.id, `包含组“${group}”由“${winner.title}”胜出`)
    }
  }
  return { rows: rows.filter(item => selected.has(item.id)), dropped }
}

function timedPhase(entry: LorebookEntry, runtime: LorebookRuntimeState | undefined, messageCount: number) {
  const state = runtime?.[entry.id]
  if (!state || state.entryUpdatedAt !== entry.updatedAt) return { phase: 'none' as const }
  if ((state.stickyUntilMessageCount ?? -1) >= messageCount && messageCount > state.activatedAtMessageCount) {
    return { phase: 'sticky' as const, state }
  }
  if ((state.cooldownUntilMessageCount ?? -1) >= messageCount && messageCount > (state.stickyUntilMessageCount ?? state.activatedAtMessageCount)) {
    return { phase: 'cooldown' as const, state }
  }
  return { phase: 'none' as const, state }
}

function makeCandidate(entry: LorebookEntry, options: {
  reason: string
  kind: LorebookActivationKind
  score?: number
  recursionDepth?: number
  content?: string
}): ActivatedLorebookEntry {
  return {
    ...entry,
    activationReason: options.reason,
    activationKind: options.kind,
    matchScore: options.score ?? 0,
    recursionDepth: options.recursionDepth ?? 0,
    estimatedTokens: estimateLorebookTokens(options.content ?? entry.content)
  }
}

function positionCode(value: LorebookEntry['position']) {
  if (typeof value === 'number') return value
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (!normalized || ['beforechar', 'beforechardefs', 'before', '0'].includes(normalized)) return 0
  if (['afterchar', 'afterchardefs', 'after', '1'].includes(normalized)) return 1
  if (['antop', 'authornotetop', '2'].includes(normalized)) return 2
  if (['anbottom', 'authornotebottom', '3'].includes(normalized)) return 3
  if (['atdepth', 'depth', 'inchat', '4'].includes(normalized)) return 4
  if (['emtop', 'beforeexamples', '5'].includes(normalized)) return 5
  if (['embottom', 'afterexamples', '6'].includes(normalized)) return 6
  if (['outlet', '7'].includes(normalized)) return 7
  return 0
}

function depthRole(value: LorebookEntry['role']): 'system' | 'user' | 'assistant' {
  if (value === 1 || String(value).toLowerCase() === 'user') return 'user'
  if (value === 2 || ['assistant', 'ai'].includes(String(value).toLowerCase())) return 'assistant'
  return 'system'
}

function outletName(entry: LorebookEntry) {
  const raw = entry.rawExtensions || {}
  const value = raw.outletName ?? raw.outlet_name ?? raw.outlet
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function activationBudgetRank(item: ActivatedLorebookEntry) {
  if (item.activationKind === 'focus' || item.activationKind === 'session') return 600
  if (looksLikeMandatoryPerReplyContract(item)) return 550
  if (item.constant) return 500
  if (item.activationKind === 'keyword') return 400
  if (item.activationKind === 'sticky') return 350
  if (item.activationKind === 'recursive') return 300
  return 200
}

function selectWithinBudgets(options: {
  rows: ActivatedLorebookEntry[]
  books: Map<string, LorebookResource>
  maxEntries: number
}) {
  const usedByBook = new Map<string, number>()
  const selected: ActivatedLorebookEntry[] = []
  const dropped = new Map<string, string>()
  const sorted = [...options.rows].sort((a, b) =>
    activationBudgetRank(b) - activationBudgetRank(a)
    || entryOrder(b) - entryOrder(a)
    || b.matchScore - a.matchScore
  )

  for (const item of sorted) {
    const book = item.lorebookId ? options.books.get(item.lorebookId) : undefined
    const budget = book?.tokenBudget && book.tokenBudget > 0 ? book.tokenBudget : undefined
    const used = item.lorebookId ? (usedByBook.get(item.lorebookId) || 0) : 0
    const protectedEntry = item.activationKind === 'focus' || item.activationKind === 'session' || looksLikeMandatoryPerReplyContract(item)
    if (budget && used + item.estimatedTokens > budget && !protectedEntry) {
      dropped.set(item.id, `生成前 Token 预算不足：约 ${used + item.estimatedTokens}/${budget} Token`)
      continue
    }
    if (selected.length >= options.maxEntries && !protectedEntry) {
      dropped.set(item.id, `超过本轮最大激活条目数 ${options.maxEntries}`)
      continue
    }
    selected.push(item)
    if (item.lorebookId) usedByBook.set(item.lorebookId, used + item.estimatedTokens)
  }

  return {
    rows: selected.sort((a, b) => entryOrder(a) - entryOrder(b)),
    dropped,
    usedByBook
  }
}

function nextTimedRuntime(options: {
  current?: LorebookRuntimeState
  entries: LorebookEntry[]
  activated: ActivatedLorebookEntry[]
  messageCount: number
  latestMessageId?: string
}) {
  const byId = new Map(options.entries.map(entry => [entry.id, entry]))
  const next: LorebookRuntimeState = {}
  for (const [id, state] of Object.entries(options.current || {})) {
    const entry = byId.get(id)
    if (!entry || entry.updatedAt !== state.entryUpdatedAt) continue
    const effectUntil = Math.max(state.stickyUntilMessageCount ?? -1, state.cooldownUntilMessageCount ?? -1)
    if (effectUntil >= options.messageCount) next[id] = { ...state }
  }

  for (const item of options.activated) {
    if (!(item.sticky || item.cooldown)) continue
    const phase = timedPhase(item, options.current, options.messageCount).phase
    if (phase === 'sticky') continue
    const sticky = Math.max(0, item.sticky || 0)
    const cooldown = Math.max(0, item.cooldown || 0)
    const stickyUntil = sticky > 0 ? options.messageCount + sticky : undefined
    const cooldownBase = stickyUntil ?? options.messageCount
    next[item.id] = {
      entryUpdatedAt: item.updatedAt,
      activatedAt: new Date().toISOString(),
      activatedAtMessageId: options.latestMessageId,
      activatedAtMessageCount: options.messageCount,
      stickyUntilMessageCount: stickyUntil,
      cooldownUntilMessageCount: cooldown > 0 ? cooldownBase + cooldown : undefined,
      activationCount: (options.current?.[item.id]?.activationCount || 0) + 1
    }
  }
  return next
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
    .sort((a, b) => entryOrder(a) - entryOrder(b) || b.updatedAt.localeCompare(a.updatedAt))
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
  runtimeState?: LorebookRuntimeState
}): Promise<{
  prompt: string
  beforePrompt: string
  afterPrompt: string
  beforeCharacterPrompt: string
  afterCharacterPrompt: string
  authorNoteTopPrompt: string
  authorNoteBottomPrompt: string
  beforeExamplesPrompt: string
  afterExamplesPrompt: string
  depthInjections: LorebookDepthInjection[]
  outlets: Record<string, string>
  activated: ActivatedLorebookEntry[]
  focused: ActivatedLorebookEntry[]
  deferred: ActivatedLorebookEntry[]
  routingDecisions: ResourceRoutingDecision[]
  estimatedSavedCharacters: number
  nextRuntimeState: LorebookRuntimeState
  engineDebug: LorebookEngineDebug
  resourceSession: { entryId?: string; title?: string; continued: boolean; exitRequested: boolean }
}> {
  const activeIds = await activeLorebookIds(options.characterId)
  const allowedBookIds = new Set(activeIds)
  const bookRows = activeIds.length ? await db.lorebooks.bulkGet(activeIds) : []
  const books = new Map(bookRows.filter((item): item is LorebookResource => Boolean(item)).map(item => [item.id, item]))
  const all = await db.lorebookEntries.toArray() as LorebookEntry[]
  const entries = all.filter(item => item.worldId === options.worldId)
    .filter(item => {
      if (!item.lorebookId) return !item.characterId || item.characterId === options.characterId
      return allowedBookIds.has(item.lorebookId)
    })

  const latestText = options.latestText || ''
  const messageCount = options.messages.filter(message => !message.recalledAt).length
  const latestMessageId = [...options.messages].reverse().find(message => !message.recalledAt)?.id
  const explicitIntent = routeLorebookIntent(entries, latestText)
  const activeSessionEntry = options.activeResourceEntryId
    ? entries.find(item => item.id === options.activeResourceEntryId && item.enabled)
    : undefined
  const staleActiveSession = Boolean(options.activeResourceEntryId && !activeSessionEntry)
  const exitRequested = staleActiveSession || shouldExitResourceSession(latestText, activeSessionEntry)
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

  const deferredMap = new Map<string, ActivatedLorebookEntry>()
  const candidateMap = new Map<string, ActivatedLorebookEntry>()
  const stickyActive: string[] = []
  const cooldownBlocked: string[] = []
  const delayBlocked: string[] = []

  const defer = (entry: LorebookEntry, reason: string, kind: LorebookActivationKind = 'keyword') => {
    if (!deferredMap.has(entry.id)) deferredMap.set(entry.id, makeCandidate(entry, { reason, kind }))
  }
  const addCandidate = (candidate: ActivatedLorebookEntry) => {
    const existing = candidateMap.get(candidate.id)
    if (!existing || activationBudgetRank(candidate) > activationBudgetRank(existing) || candidate.matchScore > existing.matchScore) {
      candidateMap.set(candidate.id, candidate)
    }
    deferredMap.delete(candidate.id)
  }

  for (const item of entries.filter(entry => entry.enabled)) {
    const book = item.lorebookId ? books.get(item.lorebookId) : undefined
    const phase = timedPhase(item, options.runtimeState, messageCount)
    if (phase.phase === 'sticky') {
      stickyActive.push(item.title)
      addCandidate(makeCandidate(item, { reason: `Sticky 延续至第 ${phase.state?.stickyUntilMessageCount} 条消息`, kind: 'sticky' }))
      continue
    }
    if (phase.phase === 'cooldown') {
      cooldownBlocked.push(item.title)
      defer(item, `Cooldown：第 ${phase.state?.cooldownUntilMessageCount} 条消息后可再次触发`)
      continue
    }
    const delay = Math.max(0, item.delay || 0)
    if (delay > 0 && messageCount < delay) {
      delayBlocked.push(item.title)
      defer(item, `Delay：当前 ${messageCount} 条消息，至少 ${delay} 条后可触发`)
      continue
    }

    const focusedAlias = focusedAliases.get(item.id)
    if (focusedIds.has(item.id)) {
      const session = continueSession && activeSessionEntry?.id === item.id
      addCandidate(makeCandidate(item, {
        reason: session ? `资源会话延续：${item.title}` : `用户意图 Focus：${focusedAlias || item.title}`,
        kind: session ? 'session' : 'focus',
        score: 1000,
        content: session ? buildResourceSessionContinuationContent(item) : item.content
      }))
      continue
    }

    if (item.delayUntilRecursion) {
      defer(item, '等待递归扫描触发', 'recursive')
      continue
    }

    const initialMode = initialLorebookEntryMode(item)
    if (initialMode === 'mandatory') {
      if (probabilityPasses(item)) addCandidate(makeCandidate(item, { reason: '作者每轮强制输出合同', kind: 'constant', score: 900 }))
      continue
    }

    // SillyTavern 的 use_regex 只决定关键词如何匹配；constant 条目与关键词无关。
    if (initialMode === 'constant') {
      if (item.constant && looksLikeLargeFeatureModule(item) && looksLikeOnDemandFeatureModule(item) && !looksLikeMandatoryPerReplyContract(item)) {
        defer(item, '大型功能模块：本轮未明确调用，已按需休眠', 'constant')
        continue
      }
      if (probabilityPasses(item)) addCandidate(makeCandidate(item, { reason: '常驻条目', kind: 'constant', score: 0 }))
      continue
    }

    if (initialMode !== 'keyword') continue
    const source = buildScanSource({ entry: item, messages: options.messages, latestText, bookScanDepth: book?.scanDepth, character: options.character, persona: options.persona })
    const details = matchKeys(item, source)
    if (details.matched && probabilityPasses(item)) {
      addCandidate(makeCandidate(item, {
        reason: `${item.useRegex ? '命中正则' : '命中关键词'}：${details.primaryKeys.slice(0, 3).join('、')}${details.secondaryKeys.length ? `；辅助：${details.secondaryKeys.slice(0, 3).join('、')}` : ''}`,
        kind: 'keyword',
        score: details.score
      }))
    }
  }

  const groupedInitial = applyGroups([...candidateMap.values()])
  const groupDropped = [...groupedInitial.dropped.values()]
  for (const [id, reason] of groupedInitial.dropped) {
    const entry = entries.find(item => item.id === id)
    if (entry) defer(entry, reason)
  }
  candidateMap.clear()
  groupedInitial.rows.forEach(item => candidateMap.set(item.id, item))

  const initialActivated = candidateMap.size
  let recursionSteps = 0
  let recursiveActivated = 0
  const maxRecursionSteps = 8
  const recursionSourceEnabled = (item: ActivatedLorebookEntry) => {
    const book = item.lorebookId ? books.get(item.lorebookId) : undefined
    return book?.recursiveScanning !== false
  }
  let recursionFrontier = groupedInitial.rows.filter(item => !item.preventRecursion && recursionSourceEnabled(item))

  while (recursionFrontier.length && recursionSteps < maxRecursionSteps) {
    recursionSteps += 1
    const recursionSource = recursionFrontier.map(item => item.content).join('\n')
    const wave: ActivatedLorebookEntry[] = []
    for (const item of entries.filter(entry => entry.enabled && !candidateMap.has(entry.id))) {
      const book = item.lorebookId ? books.get(item.lorebookId) : undefined
      if (book?.recursiveScanning === false || item.excludeRecursion) continue
      const phase = timedPhase(item, options.runtimeState, messageCount)
      if (phase.phase === 'cooldown') continue
      const delay = Math.max(0, item.delay || 0)
      if (delay > 0 && messageCount < delay) continue
      if (!item.keywords.length && !item.constant) continue

      const details = item.constant && item.delayUntilRecursion
        ? { matched: true, primaryKeys: [], secondaryKeys: [], score: 0 }
        : matchKeys(item, recursionSource)
      if (!details.matched) continue
      if (!probabilityPasses(item)) continue
      wave.push(makeCandidate(item, {
        reason: `递归第 ${recursionSteps} 层${details.primaryKeys.length ? `：${details.primaryKeys.slice(0, 3).join('、')}` : ''}`,
        kind: 'recursive',
        score: details.score,
        recursionDepth: recursionSteps
      }))
    }
    if (!wave.length) break
    const groupedWave = applyGroups(wave)
    groupDropped.push(...groupedWave.dropped.values())
    for (const [id, reason] of groupedWave.dropped) {
      const entry = entries.find(item => item.id === id)
      if (entry) defer(entry, reason, 'recursive')
    }
    const fresh = groupedWave.rows.filter(item => !candidateMap.has(item.id))
    if (!fresh.length) break
    fresh.forEach(item => addCandidate(item))
    recursiveActivated += fresh.length
    recursionFrontier = fresh.filter(item => !item.preventRecursion && recursionSourceEnabled(item))
  }

  const budgetSelection = selectWithinBudgets({
    rows: [...candidateMap.values()],
    books,
    maxEntries: options.maxEntries ?? 24
  })
  for (const [id, reason] of budgetSelection.dropped) {
    const entry = candidateMap.get(id)
    if (entry) defer(entry, reason, entry.activationKind)
  }

  const activated = budgetSelection.rows
  const focused = activated.filter(item => item.activationKind === 'focus' || item.activationKind === 'session')
  const normal = activated.filter(item => !focused.includes(item))
  const promptContent = (entry: ActivatedLorebookEntry) =>
    entry.activationKind === 'session' ? buildResourceSessionContinuationContent(entry) : entry.content
  const section = (rows: ActivatedLorebookEntry[]) => rows.map((entry, index) => `${index + 1}. ${entry.title}\n${promptContent(entry)}`).join('\n\n')
  const byPosition = (position: number) => normal.filter(entry => positionCode(entry.position) === position)
  const labelSection = (label: string, rows: ActivatedLorebookEntry[]) => rows.length ? `【${label}】\n\n${section(rows)}` : ''

  const beforeCharacterPrompt = labelSection('本轮触发的世界书 · Before Char', byPosition(0))
  const afterCharacterPrompt = labelSection('本轮触发的世界书 · After Char', byPosition(1))
  const authorNoteTopPrompt = labelSection('本轮触发的世界书 · Author Note Top', byPosition(2))
  const authorNoteBottomPrompt = labelSection('本轮触发的世界书 · Author Note Bottom', byPosition(3))
  const beforeExamplesPrompt = labelSection('本轮触发的世界书 · Example Messages Top', byPosition(5))
  const afterExamplesPrompt = labelSection('本轮触发的世界书 · Example Messages Bottom', byPosition(6))
  const depthInjections: LorebookDepthInjection[] = byPosition(4).map(entry => ({
    entryId: entry.id,
    title: entry.title,
    content: promptContent(entry),
    role: depthRole(entry.role),
    depth: Math.max(0, entry.depth ?? 4),
    order: entryOrder(entry)
  }))
  const outlets: Record<string, string> = {}
  for (const entry of byPosition(7)) {
    const name = outletName(entry)
    if (!name) continue
    outlets[name] = [outlets[name], promptContent(entry)].filter(Boolean).join('\n\n')
  }

  const focusPrompt = focused.length
    ? `${buildResourceFocusInstruction(focused)}\n\n${section(focused)}`
    : ''
  const beforePrompt = [focusPrompt, beforeCharacterPrompt].filter(Boolean).join('\n\n')
  const afterPrompt = [afterCharacterPrompt, authorNoteTopPrompt, authorNoteBottomPrompt, beforeExamplesPrompt, afterExamplesPrompt].filter(Boolean).join('\n\n')
  const prompt = [
    focusPrompt,
    beforeCharacterPrompt,
    afterCharacterPrompt,
    authorNoteTopPrompt,
    authorNoteBottomPrompt,
    beforeExamplesPrompt,
    afterExamplesPrompt,
    activated.length ? '以上设定是当前启用资源产生的世界事实或玩法规则。自然遵守，不要向用户解释“世界书”或触发过程。' : ''
  ].filter(Boolean).join('\n\n')

  const deferred = [...deferredMap.values()]
  const routingDecisions: ResourceRoutingDecision[] = [
    ...focused.map(item => ({ id: item.id, title: item.title, status: 'focused' as const, reason: item.activationReason, characters: promptContent(item).length })),
    ...normal.map(item => ({ id: item.id, title: item.title, status: 'activated' as const, reason: item.activationReason, characters: promptContent(item).length })),
    ...deferred.map(item => ({ id: item.id, title: item.title, status: 'deferred' as const, reason: item.activationReason, characters: item.content.length }))
  ]
  const sessionSavedCharacters = focused.reduce((sum, item) => {
    if (item.activationKind !== 'session') return sum
    return sum + Math.max(0, item.content.length - promptContent(item).length)
  }, 0)
  const estimatedSavedCharacters = deferred.reduce((sum, item) => sum + item.content.length, 0) + sessionSavedCharacters
  const sessionCandidate = focused.find(item => looksLikeOnDemandFeatureModule(item))
  const nextRuntimeState = nextTimedRuntime({
    current: options.runtimeState,
    entries,
    activated,
    messageCount,
    latestMessageId
  })
  const explicitBudgets = [...books.values()].map(book => book.tokenBudget || 0).filter(value => value > 0)
  const estimatedUsedTokens = activated.reduce((sum, item) => sum + item.estimatedTokens, 0)
  const routingById = new Map(routingDecisions.map(item => [item.id, item]))
  const engineDecisions: LorebookEngineDebugDecision[] = entries
    .filter(item => item.enabled)
    .map(item => {
      const routing = routingById.get(item.id)
      if (routing) {
        return {
          id: item.id,
          title: item.title,
          status: routing.status === 'focused' ? 'focused' : routing.status === 'activated' ? 'activated' : 'deferred',
          reason: routing.reason
        }
      }
      const mode = initialLorebookEntryMode(item)
      return {
        id: item.id,
        title: item.title,
        status: 'not-triggered',
        reason: mode === 'keyword'
          ? '本轮扫描范围内未命中主关键词 / 辅助关键词，未进入候选。'
          : mode === 'constant'
            ? '常驻条目未进入候选：可能未通过概率、递归限制或按需资源路由。'
            : '本轮未进入激活候选。'
      }
    })

  const engineDebug: LorebookEngineDebug = {
    evaluatedEntries: entries.filter(item => item.enabled).length,
    initialActivated,
    recursiveActivated,
    recursionSteps,
    estimatedBudgetTokens: explicitBudgets.length ? explicitBudgets.reduce((sum, value) => sum + value, 0) : undefined,
    estimatedUsedTokens,
    droppedByBudget: budgetSelection.dropped.size,
    stickyActive,
    cooldownBlocked,
    delayBlocked,
    groupDropped,
    depthInjections: depthInjections.map(item => ({ title: item.title, depth: item.depth, role: item.role })),
    decisions: engineDecisions
  }

  return {
    prompt,
    beforePrompt,
    afterPrompt,
    beforeCharacterPrompt,
    afterCharacterPrompt,
    authorNoteTopPrompt,
    authorNoteBottomPrompt,
    beforeExamplesPrompt,
    afterExamplesPrompt,
    depthInjections,
    outlets,
    activated,
    focused,
    deferred,
    routingDecisions,
    estimatedSavedCharacters,
    nextRuntimeState,
    engineDebug,
    resourceSession: {
      entryId: exitRequested ? undefined : sessionCandidate?.id || (continueSession ? activeSessionEntry?.id : undefined),
      title: exitRequested ? undefined : sessionCandidate?.title || (continueSession ? activeSessionEntry?.title : undefined),
      continued: continueSession,
      exitRequested
    }
  }
}
