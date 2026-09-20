import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, LorebookEntry, LorebookResource, Message, UserPersona } from '../types/domain'

const mockRuntime = vi.hoisted(() => ({
  entries: [] as any[],
  books: [] as any[],
  activeBookIds: [] as string[]
}))

vi.mock('../db/database', () => ({
  db: {
    lorebookEntries: {
      toArray: vi.fn(async () => mockRuntime.entries)
    },
    lorebooks: {
      bulkGet: vi.fn(async (ids: string[]) => ids.map(id => mockRuntime.books.find(book => book.id === id)))
    }
  }
}))

vi.mock('./resourceBindingService', () => ({
  getCharacterResourceIds: vi.fn(async () => mockRuntime.activeBookIds)
}))

import { buildLorebookPrompt } from './lorebookService'

const NOW = '2026-09-20T00:00:00.000Z'

function entry(id: string, patch: Partial<LorebookEntry> = {}): LorebookEntry {
  return {
    id,
    worldId: 'world',
    title: `条目-${id}`,
    keywords: [],
    secondaryKeys: [],
    content: `内容-${id}`,
    enabled: true,
    constant: false,
    caseSensitive: false,
    matchWholeWords: false,
    useRegex: false,
    selective: false,
    priority: 50,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  }
}

function book(id: string, patch: Partial<LorebookResource> = {}): LorebookResource {
  return {
    id,
    worldId: 'world',
    name: `世界书-${id}`,
    createdAt: NOW,
    updatedAt: NOW,
    ...patch
  }
}

function message(id: string, content: string, patch: Partial<Message> = {}): Message {
  return {
    id,
    worldId: 'world',
    conversationId: 'conversation',
    senderId: 'user',
    type: 'text',
    content,
    status: 'delivered',
    createdAt: NOW,
    ...patch
  }
}

function install(entries: LorebookEntry[], books: LorebookResource[] = [], activeBookIds: string[] = []) {
  mockRuntime.entries = entries
  mockRuntime.books = books
  mockRuntime.activeBookIds = activeBookIds
}

async function run(options: {
  messages?: Message[]
  latestText?: string
  characterId?: string
  character?: Character
  persona?: UserPersona
  runtimeState?: Parameters<typeof buildLorebookPrompt>[0]['runtimeState']
  maxEntries?: number
} = {}) {
  return buildLorebookPrompt({
    worldId: 'world',
    characterId: options.characterId,
    messages: options.messages ?? [],
    latestText: options.latestText ?? '',
    character: options.character,
    persona: options.persona,
    runtimeState: options.runtimeState,
    maxEntries: options.maxEntries
  })
}

beforeEach(() => {
  install([])
  vi.restoreAllMocks()
})

describe('WorldBook engine direct runtime semantics', () => {
  it('普通关键词默认大小写不敏感，并记录主关键词命中', async () => {
    install([entry('keyword', { keywords: ['Moon'] })])

    const result = await run({ messages: [message('m1', 'the MOON is bright tonight')] })

    expect(result.activated.map(item => item.id)).toEqual(['keyword'])
    expect(result.activated[0]?.activationKind).toBe('keyword')
    expect(result.activated[0]?.primaryMatches).toEqual(['Moon'])
    expect(result.engineDebug.decisions[0]?.status).toBe('activated')
  })

  it('whole-word 与 caseSensitive 同时生效，不把子串或错误大小写算命中', async () => {
    install([
      entry('whole', { keywords: ['Cat'], matchWholeWords: true, caseSensitive: true, content: 'whole' })
    ])

    const substring = await run({ messages: [message('m1', 'Concatenate Catfish catalog')] })
    expect(substring.activated).toHaveLength(0)

    const exact = await run({ messages: [message('m2', 'A Cat appears.')] })
    expect(exact.activated.map(item => item.id)).toEqual(['whole'])
  })

  it('Regex 关键词支持 /pattern/flags，并让非法表达式安全不触发', async () => {
    install([
      entry('regex-ok', { keywords: ['/rain\\s+night/i'], useRegex: true }),
      entry('regex-bad', { keywords: ['['], useRegex: true })
    ])

    const result = await run({ messages: [message('m1', 'RAIN   NIGHT begins')] })

    expect(result.activated.map(item => item.id)).toEqual(['regex-ok'])
    expect(result.engineDebug.decisions.find(item => item.id === 'regex-bad')?.status).toBe('not-triggered')
  })

  it('selective and_any：主关键词命中后，任一辅助关键词即可激活', async () => {
    install([entry('selective', {
      keywords: ['alpha'], secondaryKeys: ['beta', 'gamma'], selective: true, selectiveLogic: 'and_any'
    })])

    const result = await run({ messages: [message('m1', 'alpha and beta are present')] })

    expect(result.activated.map(item => item.id)).toEqual(['selective'])
    expect(result.activated[0]?.secondaryMatches).toEqual(['beta'])
  })

  it('selective and_all：必须命中全部辅助关键词', async () => {
    install([entry('selective', {
      keywords: ['alpha'], secondaryKeys: ['beta', 'gamma'], selective: true, selectiveLogic: 'and_all'
    })])

    const partial = await run({ messages: [message('m1', 'alpha beta')] })
    expect(partial.activated).toHaveLength(0)

    const full = await run({ messages: [message('m2', 'alpha beta gamma')] })
    expect(full.activated.map(item => item.id)).toEqual(['selective'])
  })

  it('selective not_any / not_all 保持社区世界书的否定语义', async () => {
    install([
      entry('not-any', {
        keywords: ['alpha'], secondaryKeys: ['beta', 'gamma'], selective: true, selectiveLogic: 'not_any'
      }),
      entry('not-all', {
        keywords: ['alpha'], secondaryKeys: ['beta', 'gamma'], selective: true, selectiveLogic: 'not_all'
      })
    ])

    const noneSecondary = await run({ messages: [message('m1', 'alpha only')] })
    expect(noneSecondary.activated.map(item => item.id).sort()).toEqual(['not-all', 'not-any'])

    const oneSecondary = await run({ messages: [message('m2', 'alpha beta')] })
    expect(oneSecondary.activated.map(item => item.id)).toEqual(['not-all'])

    const allSecondary = await run({ messages: [message('m3', 'alpha beta gamma')] })
    expect(allSecondary.activated).toHaveLength(0)
  })

  it('scanDepth 只扫描指定最近消息，并排除 recalled 消息', async () => {
    install([
      entry('depth-1', { keywords: ['ancient-key'], scanDepth: 1 }),
      entry('depth-2', { keywords: ['ancient-key'], scanDepth: 2 }),
      entry('recalled', { keywords: ['recalled-key'], scanDepth: 10 })
    ])

    const result = await run({
      messages: [
        message('m1', 'ancient-key'),
        message('m2', 'recalled-key', { recalledAt: NOW }),
        message('m3', 'current message')
      ]
    })

    expect(result.activated.map(item => item.id)).toEqual(['depth-2'])
  })

  it('可按 Persona / Character 上下文字段匹配，而不会默认扫描这些字段', async () => {
    install([
      entry('scenario', { keywords: ['meteor'], matchScenario: true }),
      entry('persona', { keywords: ['archivist'], matchPersonaDescription: true }),
      entry('off', { keywords: ['meteor'] })
    ])

    const result = await run({
      character: { scenario: 'A meteor is crossing the city.' } as Character,
      persona: { description: 'The user is an archivist.' } as UserPersona
    })

    expect(result.activated.map(item => item.id).sort()).toEqual(['persona', 'scenario'])
    expect(result.engineDebug.decisions.find(item => item.id === 'off')?.status).toBe('not-triggered')
  })

  it('递归扫描可以从初始命中继续激活多层条目，并记录递归深度', async () => {
    install([
      entry('seed', { keywords: ['seed-key'], content: 'bridge-key' }),
      entry('bridge', { keywords: ['bridge-key'], content: 'final-key' }),
      entry('final', { keywords: ['final-key'], content: 'done' })
    ])

    const result = await run({ messages: [message('m1', 'seed-key')] })

    expect(result.activated.map(item => item.id)).toEqual(['seed', 'bridge', 'final'])
    expect(result.activated.find(item => item.id === 'bridge')?.activationKind).toBe('recursive')
    expect(result.activated.find(item => item.id === 'bridge')?.recursionDepth).toBe(1)
    expect(result.activated.find(item => item.id === 'final')?.recursionDepth).toBe(2)
    expect(result.engineDebug.recursiveActivated).toBe(2)
    expect(result.engineDebug.recursionSteps).toBeGreaterThanOrEqual(2)
  })

  it('preventRecursion / excludeRecursion 会阻止不允许的递归传播或递归激活', async () => {
    install([
      entry('source-stop', { keywords: ['start'], content: 'bridge', preventRecursion: true }),
      entry('blocked-target', { keywords: ['bridge'], content: 'never' }),
      entry('source', { keywords: ['other-start'], content: 'excluded-key' }),
      entry('excluded-target', { keywords: ['excluded-key'], excludeRecursion: true })
    ])

    const result = await run({ messages: [message('m1', 'start other-start')] })

    expect(result.activated.map(item => item.id).sort()).toEqual(['source', 'source-stop'])
  })

  it('Sticky 延续后进入 Cooldown；Delay 在消息数达到门槛前阻止触发', async () => {
    install([
      entry('timed', { keywords: ['event-key'], sticky: 1, cooldown: 2 }),
      entry('delayed', { keywords: ['event-key'], delay: 3 })
    ])

    const first = await run({ messages: [message('m1', 'event-key')] })
    expect(first.activated.map(item => item.id)).toEqual(['timed'])
    expect(first.engineDebug.delayBlocked).toContain('条目-delayed')

    const second = await run({
      messages: [message('m1', 'event-key'), message('m2', 'quiet')],
      runtimeState: first.nextRuntimeState
    })
    expect(second.activated.find(item => item.id === 'timed')?.activationKind).toBe('sticky')

    const third = await run({
      messages: [message('m1', 'event-key'), message('m2', 'quiet'), message('m3', 'quiet again')],
      runtimeState: second.nextRuntimeState
    })
    expect(third.activated.map(item => item.id)).toEqual(['delayed'])
    expect(third.engineDebug.cooldownBlocked).toContain('条目-timed')
    expect(third.deferred.find(item => item.id === 'timed')?.activationReason).toContain('Cooldown')
  })

  it('Group scoring 在同组条目中保留 matchScore 更高者，并记录淘汰原因', async () => {
    install([
      entry('winner', { keywords: ['alpha', 'beta'], group: 'scene', useGroupScoring: true }),
      entry('loser', { keywords: ['alpha'], group: 'scene', useGroupScoring: true })
    ])

    const result = await run({ messages: [message('m1', 'alpha beta')] })

    expect(result.activated.map(item => item.id)).toEqual(['winner'])
    expect(result.deferred.find(item => item.id === 'loser')?.activationReason).toContain('评分淘汰')
    expect(result.engineDebug.groupDropped.some(reason => reason.includes('评分淘汰'))).toBe(true)
  })

  it('Probability 使用 0-100 百分比边界，未通过时不进入激活候选', async () => {
    install([entry('probability', {
      keywords: ['chance-key'], useProbability: true, probability: 50
    })])

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.49)
    const pass = await run({ messages: [message('m1', 'chance-key')] })
    expect(pass.activated.map(item => item.id)).toEqual(['probability'])

    random.mockReturnValue(0.5)
    const fail = await run({ messages: [message('m2', 'chance-key')] })
    expect(fail.activated).toHaveLength(0)
  })

  it('Token budget 会丢弃超过书级预算的普通候选，并把原因写入 deferred/debug', async () => {
    const lorebook = book('book', { tokenBudget: 6 })
    install([
      entry('first', {
        lorebookId: 'book', keywords: ['budget-key'], insertionOrder: 20, content: '12345678901234567890'
      }),
      entry('second', {
        lorebookId: 'book', keywords: ['budget-key'], insertionOrder: 10, content: 'abcdefghijabcdefghij'
      })
    ], [lorebook], ['book'])

    const result = await run({ characterId: 'character', messages: [message('m1', 'budget-key')] })

    expect(result.activated.map(item => item.id)).toEqual(['first'])
    expect(result.deferred.find(item => item.id === 'second')?.activationReason).toContain('Token 预算不足')
    expect(result.engineDebug.droppedByBudget).toBe(1)
    expect(result.engineDebug.estimatedBudgetTokens).toBe(6)
  })

  it('At Depth 注入保留 role/depth/order，Outlet 按名称输出而不混进普通 prompt', async () => {
    install([
      entry('depth', {
        keywords: ['depth-key'], position: 4, role: 1, depth: 2, insertionOrder: 33, content: 'depth-content'
      }),
      entry('outlet', {
        keywords: ['outlet-key'], position: 7, content: 'outlet-content', rawExtensions: { outletName: 'status_panel' }
      })
    ])

    const result = await run({ messages: [message('m1', 'depth-key outlet-key')] })

    expect(result.depthInjections).toEqual([{
      entryId: 'depth',
      title: '条目-depth',
      content: 'depth-content',
      role: 'user',
      depth: 2,
      order: 33
    }])
    expect(result.outlets).toEqual({ status_panel: 'outlet-content' })
    expect(result.prompt).not.toContain('depth-content')
    expect(result.prompt).not.toContain('outlet-content')
    expect(result.engineDebug.depthInjections).toEqual([{ title: '条目-depth', depth: 2, role: 'user' }])
  })
})
