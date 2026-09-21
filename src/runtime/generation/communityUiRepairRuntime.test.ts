import { describe, expect, it, vi } from 'vitest'
import type { ChatRequest } from '../../services/ai/provider'
import type { CommunityUiContract } from '../../services/communityUiRuntime'
import type { Character, Message, UserPersona } from '../../types/domain'
import { createCommunityUiRepairRuntime, type CommunityUiCompiledCandidate } from './communityUiRepairRuntime'

const character = {
  id: 'char-1',
  worldId: 'world-1',
  name: '角色',
  avatar: '',
  persona: '角色设定',
  relationship: '朋友',
  mood: '平静',
  activity: '聊天',
  replySpeed: 'natural',
  createdAt: '2026-09-20T00:00:00.000Z'
} as Character

const persona: UserPersona = {
  id: 'persona-1',
  name: '用户',
  avatar: '',
  description: '用户描述',
  isDefault: true,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z'
}

const contract = (patch: Partial<CommunityUiContract> = {}): CommunityUiContract => ({
  active: true,
  mode: 'structured-contract',
  reasons: ['test'],
  requiredTagNames: ['state'],
  requiredHtmlTags: [],
  requiredUiLabels: [],
  requiredRegexNames: [],
  requiredLiteralTokens: [],
  ...patch
})

function candidate(text: string, rich = false): CommunityUiCompiledCandidate {
  return {
    rawText: text,
    canonicalText: text,
    displayText: text,
    storageApplied: [],
    displayApplied: [],
    traces: [],
    rich
  }
}

function baseOptions(patch: Record<string, unknown> = {}) {
  const providerChat = vi.fn().mockResolvedValue({ text: 'AI_OK' })
  const collectTokenUsage = vi.fn()
  const createGeneralRepairRequest = vi.fn((): ChatRequest => ({
    model: 'test-model',
    temperature: 0.8,
    messages: [{ role: 'user', content: '原请求' }]
  }))
  return {
    contract: contract(),
    initialResponseText: 'RAW',
    initialCandidate: candidate('RAW'),
    compileCandidate: (text: string) => candidate(text, text.includes('HTML')),
    presentationHidesCommunityUi: false,
    persona,
    macroCharacterName: '角色',
    character,
    previousMessages: [
      { senderId: 'user', content: '真实用户消息' },
      { senderId: 'char-1', content: 'OLD_OK' }
    ] as Array<Pick<Message, 'senderId' | 'recalledAt' | 'rawContent' | 'content'>>,
    activatedLorebook: [],
    applyWorldRegex: (text: string) => text,
    conversationState: undefined,
    latestUserText: '你好',
    modelSettings: { model: 'test-model', temperature: 0.8 },
    signal: new AbortController().signal,
    providerChat,
    createGeneralRepairRequest,
    collectTokenUsage,
    ...patch
  }
}

function dependencyHarness() {
  return {
    outputConforms: vi.fn(({ rawText }: { rawText: string }) => rawText.includes('OK')),
    carryForward: vi.fn(() => ({ repaired: false, text: '', reason: '' })),
    localRepair: vi.fn(() => ({ repaired: false, text: '', reason: '' })),
    mergeStateRepair: vi.fn(() => ({ repaired: false, text: '', addedTags: [] as string[] })),
    buildStateRepairPrompt: vi.fn(() => 'STATE_REPAIR_PROMPT'),
    buildRepairPrompt: vi.fn(() => 'GENERAL_REPAIR_PROMPT'),
    normalizeRichHtml: vi.fn((text: string) => text),
    sanitizeCommunityUiText: vi.fn((text: string) => text),
    looksLikeRichHtml: vi.fn((text: string) => text.includes('HTML')),
    renderRoleplayText: vi.fn((text?: string) => text || ''),
    enforceUserMessageOwnership: vi.fn((html: string) => html),
    isTokenLimitError: vi.fn(() => false)
  }
}

describe('communityUiRepairRuntime', () => {
  it('contract 未激活时不调用任何 repair/provider，直接保留第一版候选', async () => {
    const deps = dependencyHarness()
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions({ contract: contract({ active: false, mode: 'none' }) })
    const result = await runtime.repair(options)
    expect(result.canonicalText).toBe('RAW')
    expect(result.fallbackToInitial).toBe(false)
    expect(options.providerChat).not.toHaveBeenCalled()
    expect(deps.carryForward).not.toHaveBeenCalled()
  })

  it('第一版已经符合合同就不会追加 repair 调用', async () => {
    const deps = dependencyHarness()
    deps.outputConforms.mockReturnValue(true)
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions()
    const result = await runtime.repair(options)
    expect(result.conforms).toBe(true)
    expect(options.providerChat).not.toHaveBeenCalled()
  })

  it('优先复用历史作者状态，成功后更新 canonical 且不调用 AI', async () => {
    const deps = dependencyHarness()
    deps.carryForward.mockReturnValue({ repaired: true, text: 'CARRIED_OK', reason: '沿用历史状态' })
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions()
    const result = await runtime.repair(options)
    expect(result.canonicalText).toBe('CARRIED_OK')
    expect(result.warnings).toContain('沿用历史状态')
    expect(options.providerChat).not.toHaveBeenCalled()
  })

  it('历史状态不能修时尝试本地 compiler，成功则保留原 canonical 但使用 repaired UI', async () => {
    const deps = dependencyHarness()
    deps.localRepair.mockReturnValue({ repaired: true, text: 'LOCAL_OK_HTML', reason: '本地修复成功' })
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const result = await runtime.repair(baseOptions())
    expect(result.canonicalText).toBe('RAW')
    expect(result.richReplyHtml).toBe('LOCAL_OK_HTML')
    expect(result.warnings).toContain('本地修复成功')
  })

  it('regex-html 缺作者字段时只发送紧凑状态补全请求，合并成功后更新 canonical', async () => {
    const deps = dependencyHarness()
    deps.mergeStateRepair.mockReturnValue({ repaired: true, text: 'MERGED_OK', addedTags: ['state', 'time'] })
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions({
      contract: contract({ mode: 'regex-html', requiredTagNames: ['state', 'time'] }),
      activatedLorebook: [{ content: '<state>作者每轮必须输出</state>', activationReason: '作者每轮' }]
    })
    const result = await runtime.repair(options)
    expect(options.providerChat).toHaveBeenCalledTimes(1)
    const request = options.providerChat.mock.calls[0][0]
    expect(request.temperature).toBe(0.25)
    expect(request.messages).toEqual([{ role: 'system', content: 'STATE_REPAIR_PROMPT' }])
    expect(options.createGeneralRepairRequest).not.toHaveBeenCalled()
    expect(result.canonicalText).toBe('MERGED_OK')
    expect(result.warnings.join('\n')).toContain('仅补 2 个作者状态字段')
  })

  it('regex-html 补全遇到 token limit 时保留第一版并返回用户提示', async () => {
    const deps = dependencyHarness()
    deps.isTokenLimitError.mockReturnValue(true)
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions({
      contract: contract({ mode: 'regex-html', requiredTagNames: ['state'] }),
      providerChat: vi.fn().mockRejectedValue(new Error('token limit'))
    })
    const result = await runtime.repair(options)
    expect(result.fallbackToInitial).toBe(true)
    expect(result.canonicalText).toBe('RAW')
    expect(result.noticeMessage).toContain('第一版回复')
    expect(result.warnings.join('\n')).toContain('Token / 上下文 / 额度限制')
  })

  it('非 regex-html 合同使用一次完整内容纠偏，修复成功不改第一版 canonical', async () => {
    const deps = dependencyHarness()
    deps.localRepair
      .mockReturnValueOnce({ repaired: false, text: '', reason: '' })
      .mockReturnValueOnce({ repaired: true, text: 'GENERAL_OK_HTML', reason: '未追加第二次 AI 调用，本地修复' })
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions({ providerChat: vi.fn().mockResolvedValue({ text: 'AI_REPAIR' }) })
    const result = await runtime.repair(options)
    expect(options.createGeneralRepairRequest).toHaveBeenCalledTimes(1)
    const request = options.providerChat.mock.calls[0][0]
    expect(request.temperature).toBe(0.35)
    expect(request.messages.at(-1)).toEqual({ role: 'system', content: 'GENERAL_REPAIR_PROMPT' })
    expect(result.canonicalText).toBe('RAW')
    expect(result.richReplyHtml).toBe('GENERAL_OK_HTML')
    expect(result.warnings.join('\n')).toContain('使用一次 AI 内容纠偏后由本地编译完成')
  })

  it('所有修复均失败时明确降级到第一版真实回复', async () => {
    const deps = dependencyHarness()
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const options = baseOptions({ providerChat: vi.fn().mockResolvedValue({ text: 'STILL_BAD' }) })
    const result = await runtime.repair(options)
    expect(result.fallbackToInitial).toBe(true)
    expect(result.canonicalText).toBe('RAW')
    expect(result.warnings.at(-1)).toContain('保留第一版真实 AI 回复')
  })

  it('rich UI 最终统一执行用户消息所有权过滤', async () => {
    const deps = dependencyHarness()
    deps.outputConforms.mockReturnValue(true)
    deps.enforceUserMessageOwnership.mockReturnValue('FILTERED_HTML')
    const runtime = createCommunityUiRepairRuntime(deps as never)
    const result = await runtime.repair(baseOptions({ initialCandidate: candidate('HTML_OK', true) }))
    expect(deps.enforceUserMessageOwnership).toHaveBeenCalledWith('HTML_OK', ['真实用户消息'])
    expect(result.richReplyHtml).toBe('FILTERED_HTML')
  })
})
