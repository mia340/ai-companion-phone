import { describe, expect, it } from 'vitest'
import { createDefaultChatSettings, createDefaultConversationState } from '../../services/chatSettings'
import { parseCompanionOutput } from '../../services/interactionProtocol'
import type { Character } from '../../types/domain'
import {
  applyVisibleMacrosToParsedOutput,
  buildRegexPipelineDebug,
  finalizeAssistantReply,
  planAssistantReplyPersistence,
  prepareParsedAssistantOutput
} from './assistantReplyFinalizationRuntime'

const character: Character = {
  id: 'char', worldId: 'world', name: '林川', avatar: '🙂', persona: '克制', relationship: '朋友',
  mood: '平静', activity: '看书', groups: [], replySpeed: 'natural', createdAt: '2026-01-01T00:00:00.000Z'
}

function runtimeProfile(overrides: Partial<{ allowNativeMessageReshaping: boolean; useNativeInteractionProtocol: boolean; preserveCardOutput: boolean }> = {}) {
  return {
    allowNativeMessageReshaping: true,
    useNativeInteractionProtocol: true,
    preserveCardOutput: false,
    ...overrides
  }
}

function finalize(overrides: Partial<Parameters<typeof finalizeAssistantReply>[0]> = {}) {
  const settings = createDefaultChatSettings('conversation')
  const parsedOutput = parseCompanionOutput('你好。')
  return finalizeAssistantReply({
    parsedOutput,
    regexDisplayText: '你好。',
    regexStorageApplied: [],
    regexDisplayApplied: [],
    richReplyHtml: '',
    communityUiText: '',
    communityUiActive: false,
    canonicalText: '你好。',
    character,
    settings,
    conversationState: createDefaultConversationState('conversation'),
    runtimeProfile: runtimeProfile(),
    userName: '小白',
    personaName: '小白',
    macroCharacterName: '林川',
    useStreaming: false,
    ...overrides
  })
}

describe('assistant reply finalization runtime', () => {
  it('applies stable user/character macros across visible messages and status fields', () => {
    const source = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"text","content":"{{user}}，我是{{char}}。"}],"status":{"mood":"在等{{user}}","relationshipNote":"{{char}}更信任{{user}}"}}</companion_packet>')
    const result = applyVisibleMacrosToParsedOutput(source, { personaName: '小白', macroCharacterName: '林川' })
    expect(result.messages[0].content).toBe('小白，我是林川。')
    expect(result.status?.mood).toBe('在等小白')
    expect(result.status?.relationshipNote).toBe('林川更信任小白')
  })

  it('suppresses role-card UI when the card/community runtime owns presentation', () => {
    const prepared = prepareParsedAssistantOutput({
      text: '{日期:2026-09-21|时间:晚上}\n{地点:书房}\n正文',
      useNativeInteractionProtocol: false,
      userName: '小白',
      personaName: '小白',
      macroCharacterName: '林川',
      preserveCardOutput: true,
      communityUiActive: false
    })
    expect(prepared.roleCardUi).toBeUndefined()
    expect(prepared.visibleText).toContain('正文')
  })

  it('reparses display projection when Regex changes the visible assistant output', () => {
    const result = finalize({
      parsedOutput: parseCompanionOutput('原始文本'),
      regexDisplayText: '<companion_packet>{"messages":[{"kind":"text","content":"投影后的文本"}]}</companion_packet>',
      regexDisplayApplied: ['display-script']
    })
    expect(result.projectedVisibleText).toBe('投影后的文本')
    expect(result.regexApplied.display).toEqual(['display-script'])
    expect(result.persistenceMode).toBe('canonical-display')
  })

  it('does not let display Regex overwrite canonical storage metadata', () => {
    const result = finalize({
      canonicalText: '原始规范文本',
      regexDisplayText: '只用于显示',
      regexDisplayApplied: ['markdown-only']
    })
    expect(result.displayContent).toBe('只用于显示')
    expect(result.regexApplied.storage).toEqual([])
  })

  it('manual presence setting overrides inferred presence and reports conflict', () => {
    const settings = { ...createDefaultChatSettings('conversation'), presenceMode: 'remote' as const }
    const parsedOutput = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"text","content":"抱紧你。"}],"status":{"presence":"together"}}</companion_packet>')
    const result = finalize({ settings, parsedOutput })
    expect(result.parsedOutput.status?.presence).toBe('remote')
    expect(result.parsedOutput.presenceResolution?.source).toBe('manual')
    expect(result.parsedOutput.presenceResolution?.conflict).toBe(true)
  })

  it('uses native action shaping for scene-merged output when enabled', () => {
    const parsedOutput = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"scene_action","content":"抬眼看你。"},{"kind":"text","content":"过来。"}]}</companion_packet>')
    const result = finalize({ parsedOutput })
    expect(result.projectedActions).toHaveLength(1)
    expect(result.projectedVisibleText).toContain('（抬眼看你。）')
    expect(result.projectedVisibleText).toContain('过来。')
  })

  it('preserves raw action boundaries when native reshaping is disabled', () => {
    const parsedOutput = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"scene_action","content":"抬眼看你。"},{"kind":"text","content":"过来。"}]}</companion_packet>')
    const result = finalize({
      parsedOutput,
      runtimeProfile: runtimeProfile({ allowNativeMessageReshaping: false })
    })
    expect(result.projectedActions.map(item => item.kind)).toEqual(['scene_action', 'text'])
  })

  it('rejects phone-text output that contains no visible character text', () => {
    const settings = { ...createDefaultChatSettings('conversation'), conversationPresentationMode: 'phone-text' as const }
    const parsedOutput = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"scene_action","content":"抬眼。"}]}</companion_packet>')
    expect(() => finalize({ settings, parsedOutput })).toThrow('纯手机模式下模型没有返回可显示的角色语句。')
  })

  it('allows rich UI to own final visible output even when parsed messages are empty', () => {
    const parsedOutput = parseCompanionOutput('')
    const result = finalize({ parsedOutput, richReplyHtml: '<div>互动卡片</div>' })
    expect(result.finalVisibleOutput).toBe('<div>互动卡片</div>')
    expect(result.persistenceMode).toBe('rich')
  })

  it('allows community UI text to own final visible output', () => {
    const parsedOutput = parseCompanionOutput('')
    const result = finalize({ parsedOutput, communityUiActive: true, communityUiText: '社区 UI 文本' })
    expect(result.finalVisibleOutput).toBe('社区 UI 文本')
    expect(result.persistenceMode).toBe('canonical-display')
  })

  it('chooses persistence modes in strict precedence order', () => {
    expect(planAssistantReplyPersistence({ alternativeTargetId: 'm1', richReplyHtml: '<b>x</b>', communityUiActive: true, hasDisplayOnlyProjection: true, useStreaming: true })).toBe('alternative')
    expect(planAssistantReplyPersistence({ richReplyHtml: '<b>x</b>', communityUiActive: true, hasDisplayOnlyProjection: true, useStreaming: true })).toBe('rich')
    expect(planAssistantReplyPersistence({ richReplyHtml: '', communityUiActive: true, hasDisplayOnlyProjection: false, useStreaming: true })).toBe('canonical-display')
    expect(planAssistantReplyPersistence({ richReplyHtml: '', communityUiActive: false, hasDisplayOnlyProjection: true, useStreaming: true })).toBe('canonical-display')
    expect(planAssistantReplyPersistence({ richReplyHtml: '', communityUiActive: false, hasDisplayOnlyProjection: false, useStreaming: true })).toBe('streaming')
    expect(planAssistantReplyPersistence({ richReplyHtml: '', communityUiActive: false, hasDisplayOnlyProjection: false, useStreaming: false })).toBe('actions')
  })

  it('keeps role-card UI only in scene-merged presentation', () => {
    const parsedOutput = parseCompanionOutput('{日期:2026年9月21日|时间:晚上}\n{地点:书房}\n正文', { interpretNativeProtocol: false })
    const merged = finalize({ parsedOutput })
    const phone = finalize({
      parsedOutput,
      settings: { ...createDefaultChatSettings('conversation'), conversationPresentationMode: 'phone-text' as const }
    })
    expect(merged.visibleRoleCardUi).toBeDefined()
    expect(phone.visibleRoleCardUi).toBeUndefined()
  })

  it('builds deduplicated Regex pipeline debug data from execution traces', () => {
    const traces = [
      { scriptId: 'a', name: 'storage-a', source: 'assistant-output', phase: 'storage', applied: true },
      { scriptId: 'a', name: 'storage-a', source: 'assistant-output', phase: 'storage', applied: true },
      { scriptId: 'b', name: 'display-b', source: 'assistant-output', phase: 'display', applied: true },
      { scriptId: 'c', name: 'world-c', source: 'world-info', phase: 'outgoing-prompt', applied: true },
      { scriptId: 'd', name: 'depth-d', source: 'assistant-output', phase: 'display', applied: false, reason: 'depth' },
      { scriptId: 'e', name: 'unsupported-e', source: 'assistant-output', phase: 'storage', applied: false, reason: 'unsupported-placement' }
    ] as any
    const debug = buildRegexPipelineDebug({ traces, activeScriptIds: ['a', 'a', 'b', 'c'] })
    expect(debug.activeScripts).toBe(3)
    expect(debug.storageApplied).toEqual(['storage-a'])
    expect(debug.displayApplied).toEqual(['display-b'])
    expect(debug.worldInfoApplied).toEqual(['world-c'])
    expect(debug.depthSkipped).toEqual(['depth-d'])
    expect(debug.unsupported).toEqual(['unsupported-e'])
  })
})
