import { describe, expect, it, vi } from 'vitest'
import type { Character, ChatSettings, ConversationState } from '../../types/domain'
import type { ParsedCompanionOutput } from '../../services/interactionProtocol'
import {
  buildAssistantConversationStatePatch,
  buildAssistantObservation,
  buildAssistantResourceSessionPatch,
  createAssistantStateEffectsRuntime
} from './assistantStateEffectsRuntime'

const state: ConversationState = {
  id: 'state-1',
  summary: '',
  summaryMessageCount: 0,
  innerMood: '平静',
  innerActivity: '聊天',
  innerThought: '',
  updatedAt: '2026-09-20T00:00:00.000Z'
}

const character: Character = {
  id: 'char-1',
  worldId: 'world-1',
  name: '测试角色',
  avatar: '',
  persona: '',
  relationship: '',
  mood: '平静',
  activity: '聊天',
  replySpeed: 'natural',
  createdAt: '2026-09-20T00:00:00.000Z'
}

const settings = {
  lorebookEnabled: true,
  memoryEnabled: true
} as ChatSettings

const parsed = (patch: Partial<ParsedCompanionOutput> = {}): ParsedCompanionOutput => ({
  visibleText: '你好',
  messages: [{ kind: 'text', content: '你好' }],
  actionSummary: '回复用户',
  warnings: [],
  ...patch
})

describe('assistantStateEffectsRuntime', () => {
  it('资源退出会明确清空活动资源并更新时间', () => {
    expect(buildAssistantResourceSessionPatch({ continued: false, exitRequested: true }, 'now')).toEqual({
      activeResourceEntryId: undefined,
      activeResourceTitle: undefined,
      activeResourceUpdatedAt: 'now'
    })
  })

  it('资源进入会保存 entry/title', () => {
    expect(buildAssistantResourceSessionPatch({ entryId: 'entry-1', title: '档案', continued: true, exitRequested: false }, 'now')).toEqual({
      activeResourceEntryId: 'entry-1',
      activeResourceTitle: '档案',
      activeResourceUpdatedAt: 'now'
    })
  })

  it('无 status、无资源变化且 lorebook 关闭时不写状态', () => {
    const plan = buildAssistantConversationStatePatch({
      beforeState: state,
      parsedOutput: parsed(),
      resourceSession: { continued: false, exitRequested: false },
      lorebookEnabled: false,
      nextLorebookRuntimeState: {},
      now: 'now'
    })
    expect(plan).toEqual({ patch: {}, shouldPersist: false })
  })

  it('lorebook 开启时即使无 status 也持久化 timed runtime 与 action summary', () => {
    const plan = buildAssistantConversationStatePatch({
      beforeState: state,
      parsedOutput: parsed(),
      resourceSession: { continued: false, exitRequested: false },
      lorebookEnabled: true,
      nextLorebookRuntimeState: { lore: { entryUpdatedAt: 'u', activatedAt: 'a', activatedAtMessageCount: 3, stickyUntilMessageCount: 5, activationCount: 1 } },
      now: 'now'
    })
    expect(plan.shouldPersist).toBe(true)
    expect(plan.patch.lorebookRuntime).toEqual({ lore: { entryUpdatedAt: 'u', activatedAt: 'a', activatedAtMessageCount: 3, stickyUntilMessageCount: 5, activationCount: 1 } })
    expect(plan.patch.lastActionSummary).toBe('回复用户')
  })

  it('relationshipNote 优先生成 importance=4 的主观观察记忆', () => {
    expect(buildAssistantObservation({
      parsedOutput: parsed({ status: { relationshipNote: '更信任用户', innerThought: '有点开心' } }),
      memoryEnabled: true
    })).toEqual({
      content: '角色主观感受：更信任用户；有点开心',
      importance: 4
    })
  })

  it('只有 innerThought 时生成 importance=3 的主观观察记忆', () => {
    expect(buildAssistantObservation({
      parsedOutput: parsed({ status: { innerThought: '需要想一想' } }),
      memoryEnabled: true
    })).toEqual({ content: '角色主观感受：需要想一想', importance: 3 })
  })

  it('memory 关闭时不生成观察记忆', () => {
    expect(buildAssistantObservation({
      parsedOutput: parsed({ status: { relationshipNote: '记住了' } }),
      memoryEnabled: false
    })).toBeUndefined()
  })

  it('候选回复不会产生任何状态、记忆或角色 side effect', async () => {
    const patchState = vi.fn()
    const record = vi.fn()
    const remember = vi.fn()
    const updateCharacter = vi.fn()
    const runtime = createAssistantStateEffectsRuntime({
      patchConversationState: patchState,
      recordConversationStateChanges: record,
      rememberCharacterObservation: remember,
      updateCharacter,
      now: () => 'now'
    })
    const result = await runtime.apply({
      conversationId: 'conv-1',
      character,
      settings,
      beforeState: state,
      parsedOutput: parsed({ status: { mood: '开心', relationshipNote: '更亲近' } }),
      resourceSession: { continued: false, exitRequested: false },
      nextLorebookRuntimeState: {},
      alternativeTargetId: 'message-1'
    })
    expect(result.stateChanged).toBe(false)
    expect(patchState).not.toHaveBeenCalled()
    expect(record).not.toHaveBeenCalled()
    expect(remember).not.toHaveBeenCalled()
    expect(updateCharacter).not.toHaveBeenCalled()
  })

  it('正常回复统一完成状态历史、主观记忆与 Character mood/activity side effects', async () => {
    const nextState = { ...state, innerMood: '开心', relationshipNote: '更亲近', updatedAt: 'next' }
    const patchState = vi.fn().mockResolvedValue(nextState)
    const record = vi.fn().mockResolvedValue([])
    const remember = vi.fn().mockResolvedValue({ id: 'memory-1' })
    const updateCharacter = vi.fn().mockResolvedValue(undefined)
    const refreshMemory = vi.fn()
    const runtime = createAssistantStateEffectsRuntime({
      patchConversationState: patchState,
      recordConversationStateChanges: record,
      rememberCharacterObservation: remember,
      updateCharacter,
      now: () => '2026-09-21T00:00:00.000Z'
    })
    const result = await runtime.apply({
      conversationId: 'conv-1',
      character,
      settings,
      beforeState: state,
      parsedOutput: parsed({
        status: { mood: '开心', activity: '散步', relationshipNote: '更亲近', innerThought: '想继续聊' }
      }),
      resourceSession: { entryId: 'entry-1', title: '档案', continued: true, exitRequested: false },
      nextLorebookRuntimeState: {},
      sourceMessageId: 'user-message-1'
    }, { onMemoryChanged: refreshMemory })

    expect(patchState).toHaveBeenCalledTimes(1)
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ before: state, after: nextState }))
    expect(remember).toHaveBeenCalledWith(expect.objectContaining({
      content: '角色主观感受：更亲近；想继续聊',
      importance: 4
    }))
    expect(refreshMemory).toHaveBeenCalledTimes(1)
    expect(updateCharacter).toHaveBeenCalledWith('char-1', {
      mood: '开心',
      activity: '散步',
      updatedAt: '2026-09-21T00:00:00.000Z'
    })
    expect(result.state).toEqual(nextState)
    expect(result.character.mood).toBe('开心')
    expect(result.memoryChanged).toBe(true)
    expect(result.characterChanged).toBe(true)
  })
})
