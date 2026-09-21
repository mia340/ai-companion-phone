import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

async function chatRoomSource() {
  return readFile(new URL('../../views/ChatRoom.vue', import.meta.url), 'utf8')
}

describe('ChatRoom Generation Runtime boundary', () => {
  it('Community UI repair orchestration 由 Runtime 接管', async () => {
    const source = await chatRoomSource()
    expect(source).toContain('createCommunityUiRepairRuntime')
    expect(source).toContain('communityUiRepairRuntime.repair')
    expect(source).not.toContain('buildCommunityUiStateRepairPrompt(')
    expect(source).not.toContain('mergeCommunityUiStateRepair(')
    expect(source).not.toContain('tryCarryForwardCommunityUiState(')
  })

  it('generation 后 state/memory/character side effects 由 Runtime 接管', async () => {
    const source = await chatRoomSource()
    expect(source).toContain('createAssistantStateEffectsRuntime')
    expect(source).toContain('assistantStateEffectsRuntime.apply')
    expect(source).not.toContain('rememberCharacterObservation({')
    expect(source).not.toContain('mergeStatusIntoConversationState(beforeState')
  })

  it('最终 persistence 分支由统一 Runtime 接管', async () => {
    const source = await chatRoomSource()
    expect(source).toContain('createAssistantReplyPersistenceRuntime')
    expect(source).toContain('assistantReplyPersistenceRuntime.persist')
    expect(source).not.toContain('switch (finalization.persistenceMode)')
    expect(source).not.toContain('finishStreamingMessage(')
    expect(source).not.toContain('saveRichAssistantMessage(')
  })

  it('Prompt Debug 创建/完成/HTTP 错误诊断由旁路 Runtime 接管', async () => {
    const source = await chatRoomSource()
    expect(source).toContain('createPromptDebugRuntime')
    expect(source).toContain('promptDebugRuntime.begin')
    expect(source).toContain('promptDebugRuntime.complete')
    expect(source).toContain('promptDebugRuntime.recordHttpError')
    expect(source).not.toContain('savePromptDebugTrace(')
    expect(source).not.toContain('patchPromptDebugTrace(')
  })

  it('generation success/failure bookkeeping 由 Lifecycle Runtime 接管', async () => {
    const source = await chatRoomSource()
    expect(source).toContain('createGenerationLifecycleRuntime')
    expect(source).toContain('generationLifecycleRuntime.complete')
    expect(source).toContain('generationLifecycleRuntime.fail')
    expect(source).not.toContain('async function updateSummaryIfNeeded(')
    expect(source).not.toContain("lastTechnicalError: technical")
  })

  it('最终 canonical 在 repair 后才进入 protocol parse/finalization', async () => {
    const source = await chatRoomSource()
    const repair = source.indexOf('const communityUiRepair = await communityUiRepairRuntime.repair')
    const parse = source.indexOf('let parsedOutput = prepareParsedAssistantOutput', repair)
    const finalize = source.indexOf('const finalization = finalizeAssistantReply', parse)
    const persistence = source.indexOf('await assistantReplyPersistenceRuntime.persist', finalize)
    expect(repair).toBeGreaterThan(0)
    expect(parse).toBeGreaterThan(repair)
    expect(finalize).toBeGreaterThan(parse)
    expect(persistence).toBeGreaterThan(finalize)
  })

  it('ChatRoom 保持在 3700 行以内，避免 Runtime 逻辑重新回流 View', async () => {
    const source = await chatRoomSource()
    expect(source.split(/\r?\n/).length).toBeLessThan(3700)
  })
})
