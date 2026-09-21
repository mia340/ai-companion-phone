import { renderRoleplayText } from '../../services/textMacroService'
import {
  parseCompanionOutput,
  shapeCompanionActions,
  type CompanionActionMessage,
  type ParsedCompanionOutput
} from '../../services/interactionProtocol'
import type {
  Character,
  ChatSettings,
  ConversationState,
  Message,
  PromptDebugTrace
} from '../../types/domain'

export interface AssistantReplyRuntimeProfile {
  allowNativeMessageReshaping: boolean
  useNativeInteractionProtocol: boolean
  preserveCardOutput: boolean
}

export interface RegexExecutionTraceLike {
  name: string
  source: string
  phase: string
  applied: boolean
  reason?: string
}

export type AssistantReplyPersistenceMode =
  | 'alternative'
  | 'rich'
  | 'canonical-display'
  | 'streaming'
  | 'actions'

export interface AssistantReplyFinalizationResult {
  parsedOutput: ParsedCompanionOutput
  projectedActions: CompanionActionMessage[]
  projectedVisibleText: string
  finalVisibleOutput: string
  visibleRoleCardUi?: Message['roleCardUi']
  regexApplied: NonNullable<Message['regexApplied']>
  hasDisplayOnlyProjection: boolean
  persistenceMode: AssistantReplyPersistenceMode
  displayContent?: string
}

export function prepareParsedAssistantOutput(options: {
  text: string
  useNativeInteractionProtocol: boolean
  userName: string
  personaName: string
  macroCharacterName: string
  preserveCardOutput: boolean
  communityUiActive: boolean
}): ParsedCompanionOutput {
  const parsed = parseCompanionOutput(options.text, {
    interpretNativeProtocol: options.useNativeInteractionProtocol,
    userName: options.userName
  })
  return applyVisibleMacrosToParsedOutput(parsed, {
    personaName: options.personaName,
    macroCharacterName: options.macroCharacterName,
    suppressRoleCardUi: options.preserveCardOutput || options.communityUiActive
  })
}

export function applyVisibleMacrosToParsedOutput(
  source: ParsedCompanionOutput,
  options: {
    personaName: string
    macroCharacterName: string
    suppressRoleCardUi?: boolean
  }
): ParsedCompanionOutput {
  const replace = (value?: string) => renderRoleplayText(value, options.personaName, options.macroCharacterName)
  const result: ParsedCompanionOutput = {
    ...source,
    visibleText: replace(source.visibleText) || '',
    messages: source.messages.map(item => ({ ...item, content: replace(item.content) || '' })),
    roleCardUi: source.roleCardUi ? {
      ...source.roleCardUi,
      date: replace(source.roleCardUi.date),
      time: replace(source.roleCardUi.time),
      location: replace(source.roleCardUi.location),
      inner: replace(source.roleCardUi.inner),
      surroundings: replace(source.roleCardUi.surroundings),
      todos: source.roleCardUi.todos?.map(item => replace(item) || item)
    } : undefined,
    status: source.status ? {
      ...source.status,
      mood: replace(source.status.mood),
      activity: replace(source.status.activity),
      location: replace(source.status.location),
      relationshipNote: replace(source.status.relationshipNote),
      innerThought: replace(source.status.innerThought),
      timePeriod: replace(source.status.timePeriod),
      unresolvedTopics: source.status.unresolvedTopics?.map(item => replace(item) || item),
      pendingEvents: source.status.pendingEvents?.map(item => replace(item) || item),
      shortTermGoals: source.status.shortTermGoals?.map(item => replace(item) || item),
      completedEvent: replace(source.status.completedEvent)
    } : undefined
  }
  return options.suppressRoleCardUi ? { ...result, roleCardUi: undefined } : result
}

function applyDisplayProjection(options: {
  parsedOutput: ParsedCompanionOutput
  regexDisplayText: string
  regexAppliedCount: number
  communityUiActive: boolean
  richReplyHtml: string
  runtimeProfile: Pick<AssistantReplyRuntimeProfile, 'useNativeInteractionProtocol' | 'preserveCardOutput'>
  userName: string
  personaName: string
  macroCharacterName: string
}) {
  if (options.communityUiActive || options.richReplyHtml || options.regexAppliedCount === 0) {
    return options.parsedOutput
  }
  const transformed = prepareParsedAssistantOutput({
    text: options.regexDisplayText,
    useNativeInteractionProtocol: options.runtimeProfile.useNativeInteractionProtocol,
    userName: options.userName,
    personaName: options.personaName,
    macroCharacterName: options.macroCharacterName,
    preserveCardOutput: options.runtimeProfile.preserveCardOutput,
    communityUiActive: options.communityUiActive
  })
  return {
    ...options.parsedOutput,
    messages: transformed.messages,
    visibleText: transformed.visibleText,
    actionSummary: transformed.actionSummary,
    status: transformed.status || options.parsedOutput.status,
    roleCardUi: transformed.roleCardUi || options.parsedOutput.roleCardUi,
    presenceResolution: transformed.presenceResolution?.resolvedPresence
      ? transformed.presenceResolution
      : options.parsedOutput.presenceResolution
  }
}

function applyManualPresenceOverride(parsedOutput: ParsedCompanionOutput, settings: ChatSettings): ParsedCompanionOutput {
  if (settings.presenceMode !== 'together' && settings.presenceMode !== 'remote') return parsedOutput
  const forcedPresence = settings.presenceMode
  const inferred = parsedOutput.presenceResolution
  return {
    ...parsedOutput,
    status: { ...(parsedOutput.status || {}), presence: forcedPresence },
    presenceResolution: {
      reportedPresence: inferred?.reportedPresence,
      resolvedPresence: forcedPresence,
      source: 'manual',
      conflict: Boolean(inferred?.resolvedPresence && inferred.resolvedPresence !== forcedPresence),
      uiSurroundings: inferred?.uiSurroundings,
      reason: `聊天设置手动指定为${forcedPresence === 'together' ? '同场景' : '远程'}，优先于自动场景推断。`
    }
  }
}

function projectedVisibleText(actions: CompanionActionMessage[]) {
  return actions
    .filter(item => !['typing_pause', 'recall_message', 'react_to_message'].includes(item.kind))
    .map(item => item.kind === 'scene_action' ? `（${item.content}）` : item.content)
    .filter(Boolean)
    .join('\n\n')
}

export function planAssistantReplyPersistence(options: {
  alternativeTargetId?: string
  richReplyHtml: string
  communityUiActive: boolean
  hasDisplayOnlyProjection: boolean
  useStreaming: boolean
}): AssistantReplyPersistenceMode {
  if (options.alternativeTargetId) return 'alternative'
  if (options.richReplyHtml) return 'rich'
  if (options.communityUiActive || options.hasDisplayOnlyProjection) return 'canonical-display'
  if (options.useStreaming) return 'streaming'
  return 'actions'
}

export function finalizeAssistantReply(options: {
  parsedOutput: ParsedCompanionOutput
  regexDisplayText: string
  regexStorageApplied: string[]
  regexDisplayApplied: string[]
  richReplyHtml: string
  communityUiText: string
  communityUiActive: boolean
  canonicalText: string
  character: Character
  settings: ChatSettings
  conversationState?: ConversationState
  runtimeProfile: AssistantReplyRuntimeProfile
  userName: string
  personaName: string
  macroCharacterName: string
  alternativeTargetId?: string
  useStreaming: boolean
}): AssistantReplyFinalizationResult {
  const regexAppliedCount = options.regexStorageApplied.length + options.regexDisplayApplied.length
  let parsedOutput = applyDisplayProjection({
    parsedOutput: options.parsedOutput,
    regexDisplayText: options.regexDisplayText,
    regexAppliedCount,
    communityUiActive: options.communityUiActive,
    richReplyHtml: options.richReplyHtml,
    runtimeProfile: options.runtimeProfile,
    userName: options.userName,
    personaName: options.personaName,
    macroCharacterName: options.macroCharacterName
  })

  if (!parsedOutput.messages.length && !options.richReplyHtml && !options.communityUiText) {
    throw new Error('模型没有返回可显示的角色回复。')
  }

  parsedOutput = applyManualPresenceOverride(parsedOutput, options.settings)

  const renderStateForDisplay = parsedOutput.status?.presence
    ? ({ ...(options.conversationState || {}), presence: parsedOutput.status.presence } as ConversationState)
    : options.conversationState
  const projectedActions = options.runtimeProfile.allowNativeMessageReshaping
    ? shapeCompanionActions(parsedOutput.messages.slice(), options.character, options.settings, Boolean(parsedOutput.rawPacket), renderStateForDisplay)
    : parsedOutput.messages.slice()
  const visibleText = projectedVisibleText(projectedActions)

  if (options.settings.conversationPresentationMode !== 'scene-merged' && !visibleText.trim()) {
    throw new Error(options.settings.conversationPresentationMode === 'phone-text'
      ? '纯手机模式下模型没有返回可显示的角色语句。'
      : '动作 / 台词分开模式下模型没有返回可显示的角色内容。')
  }

  const finalVisibleOutput = options.richReplyHtml
    || options.communityUiText
    || visibleText
    || (options.settings.conversationPresentationMode === 'scene-merged' ? parsedOutput.visibleText : '')
  const visibleRoleCardUi = options.settings.conversationPresentationMode === 'scene-merged'
    ? parsedOutput.roleCardUi
    : undefined
  const regexApplied: NonNullable<Message['regexApplied']> = {
    storage: options.regexStorageApplied,
    display: options.regexDisplayApplied
  }
  const hasDisplayOnlyProjection = options.regexDisplayApplied.length > 0
  const persistenceMode = planAssistantReplyPersistence({
    alternativeTargetId: options.alternativeTargetId,
    richReplyHtml: options.richReplyHtml,
    communityUiActive: options.communityUiActive,
    hasDisplayOnlyProjection,
    useStreaming: options.useStreaming
  })
  const displayContent = persistenceMode === 'canonical-display'
    ? (options.communityUiActive ? (options.communityUiText || options.regexDisplayText) : finalVisibleOutput)
    : undefined

  return {
    parsedOutput,
    projectedActions,
    projectedVisibleText: visibleText,
    finalVisibleOutput,
    visibleRoleCardUi,
    regexApplied,
    hasDisplayOnlyProjection,
    persistenceMode,
    displayContent: displayContent && displayContent !== options.canonicalText ? displayContent : undefined
  }
}

export function buildRegexPipelineDebug(options: {
  traces: RegexExecutionTraceLike[]
  activeScriptIds: string[]
}): NonNullable<PromptDebugTrace['regexPipeline']> {
  const uniqueTraceNames = (predicate: (trace: RegexExecutionTraceLike) => boolean) => Array.from(new Set(
    options.traces.filter(predicate).map(trace => trace.name)
  ))
  return {
    activeScripts: new Set(options.activeScriptIds).size,
    storageApplied: uniqueTraceNames(trace => trace.applied && trace.phase === 'storage'),
    displayApplied: uniqueTraceNames(trace => trace.applied && trace.phase === 'display'),
    promptApplied: uniqueTraceNames(trace => trace.applied && trace.phase === 'outgoing-prompt' && trace.source !== 'world-info'),
    worldInfoApplied: uniqueTraceNames(trace => trace.applied && trace.phase === 'outgoing-prompt' && trace.source === 'world-info'),
    depthSkipped: uniqueTraceNames(trace => !trace.applied && (trace.reason === 'depth' || trace.reason === 'invalid-depth')),
    unsupported: uniqueTraceNames(trace => !trace.applied && trace.reason === 'unsupported-placement'),
    notes: [
      'Regex 按 placement 作用于用户输入 / AI 回复 / 世界书，不再把 promptOnly 作用到整个 System Prompt。',
      'markdownOnly 只改变显示；promptOnly 只改变发给 AI 的临时视图；两者同时开启时两边改变但聊天存储保持原文。'
    ]
  }
}
