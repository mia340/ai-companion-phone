import { getModelSettings, getVisionCapability } from '../../services/modelSettings'
import { getPersonaForChat } from '../../services/personaService'
import { getActivePromptPreset, composeWithPromptPreset } from '../../services/presetRuntime'
import {
  listActiveRegexScripts,
  regexScriptsForDynamicDepthPhase,
  regexScriptsForStage,
  type RegexExecutionTrace
} from '../../services/regexRuntime'
import {
  compileOutgoingMessageRegex,
  compileWorldInfoRegex
} from '../../services/regexPipelineService'
import {
  buildMemoryPrompt,
  recordMemoryHits,
  selectMemoryHitsDetailed
} from '../../services/memoryService'
import { buildLorebookPrompt } from '../../services/lorebookService'
import {
  buildCommunityUiPriorityPrompt,
  detectCommunityUiContract,
  regexProducesRichUi
} from '../../services/communityUiRuntime'
import { resolveCharacterRuntimeProfile } from '../../services/characterRuntimeProfile'
import {
  buildCharacterRuntimeManifest,
  characterMacroName
} from '../../services/characterCardCompatibility'
import { composeRoleplaySystemPrompt } from '../../services/promptComposer'
import {
  buildPresentationOverridePrompt,
  resolvePresenceMode
} from '../../services/interactionProtocol'
import {
  buildConversationStatePrompt,
  buildUserSceneTransitionPrompt,
  deriveUserSceneTransition
} from '../../services/stateHistoryService'
import { getMessageImageUrls } from '../../services/messageImageService'
import type { ChatRequest, ChatTurn } from '../../services/ai/provider'
import type {
  Character,
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  UserPersona
} from '../../types/domain'
import {
  buildDeviceTimeContext,
  createGenerationInputSnapshot,
  imagePromptContent,
  messagePromptText,
  type GenerationRequestOptions
} from './generationContext'

export interface BuildGenerationContextOptions {
  conversation: Conversation
  character: Character
  settings: ChatSettings
  conversationState?: ConversationState
  messages: Message[]
  memories: CharacterMemory[]
  activePersona?: UserPersona
  signal: AbortSignal
  requestOptions?: GenerationRequestOptions
  generationId?: string
  now?: Date
}

function emptyLorebookResult(state?: ConversationState): Awaited<ReturnType<typeof buildLorebookPrompt>> {
  return {
    prompt: '',
    beforePrompt: '',
    afterPrompt: '',
    beforeCharacterPrompt: '',
    afterCharacterPrompt: '',
    authorNoteTopPrompt: '',
    authorNoteBottomPrompt: '',
    beforeExamplesPrompt: '',
    afterExamplesPrompt: '',
    depthInjections: [],
    outlets: {},
    activated: [],
    focused: [],
    deferred: [],
    routingDecisions: [],
    estimatedSavedCharacters: 0,
    nextRuntimeState: state?.lorebookRuntime || {},
    engineDebug: {
      evaluatedEntries: 0,
      initialActivated: 0,
      recursiveActivated: 0,
      recursionSteps: 0,
      estimatedUsedTokens: 0,
      droppedByBudget: 0,
      stickyActive: [],
      cooldownBlocked: [],
      delayBlocked: [],
      groupDropped: [],
      depthInjections: []
    },
    resourceSession: { continued: false, exitRequested: false }
  }
}

export async function buildGenerationContext(options: BuildGenerationContextOptions) {
  const loadedModelSettings = await getModelSettings()
  const snapshot = createGenerationInputSnapshot({
    generationId: options.generationId,
    now: options.now,
    conversation: options.conversation,
    character: options.character,
    settings: options.settings,
    conversationState: options.conversationState,
    messages: options.messages,
    memories: options.memories,
    activePersona: options.activePersona,
    modelSettings: loadedModelSettings,
    requestOptions: options.requestOptions
  })
  const {
    conversation,
    character,
    settings,
    conversationState,
    messages,
    memories
  } = snapshot
  const requestOptions = snapshot.options
  const modelSettings = snapshot.modelSettings
  const resolvedPersona = snapshot.activePersona ?? await getPersonaForChat(settings)
  const persona: UserPersona = {
    ...resolvedPersona,
    tags: resolvedPersona.tags?.slice(),
    extraFields: resolvedPersona.extraFields ? { ...resolvedPersona.extraFields } : undefined
  }
  const activePreset = await getActivePromptPreset(character.id)
  const macroCharacterName = characterMacroName(character)
  const regexMacros = { user: persona.name, char: macroCharacterName }
  const [activeAssistantRegex, activeUserRegex, activeWorldRegex] = await Promise.all([
    listActiveRegexScripts(character.id, 'assistant-output'),
    listActiveRegexScripts(character.id, 'user-input'),
    listActiveRegexScripts(character.id, 'world-info')
  ])
  const assistantStorageRegex = regexScriptsForStage(activeAssistantRegex, {
    source: 'assistant-output',
    phase: 'storage',
    depth: 0
  })
  const assistantDisplayRegex = regexScriptsForStage(activeAssistantRegex, {
    source: 'assistant-output',
    phase: 'display',
    depth: 0
  })
  const assistantPromptRegex = regexScriptsForDynamicDepthPhase(activeAssistantRegex, {
    source: 'assistant-output',
    phase: 'outgoing-prompt'
  })
  const userPromptRegex = regexScriptsForDynamicDepthPhase(activeUserRegex, {
    source: 'user-input',
    phase: 'outgoing-prompt'
  })
  const assistantPromptContractRegex = assistantPromptRegex
  const assistantUiRegex = [...assistantStorageRegex, ...assistantDisplayRegex]
    .filter((item, index, rows) => rows.findIndex(row => row.id === item.id) === index)
  const regexExecutionTraces: RegexExecutionTrace[] = []
  const rememberRegexTraces = <T extends { traces?: RegexExecutionTrace[] }>(result: T) => {
    if (result.traces?.length) regexExecutionTraces.push(...result.traces)
    return result
  }

  const latestUserText = [...messages].reverse().find(item => item.senderId === 'user')?.content ?? ''
  const memoryQuery = [
    latestUserText,
    requestOptions.musicPrompt || '',
    conversationState?.unresolvedTopics?.join(' ') || ''
  ].filter(Boolean).join('\n')
  const memoryHitDetails = settings.memoryEnabled
    ? selectMemoryHitsDetailed(
      memories,
      memoryQuery,
      settings.memoryStrength === 'deep'
        ? 14
        : settings.memoryStrength === 'light'
          ? 6
          : 10
    )
    : []
  const memoryHits = memoryHitDetails.map(item => item.memory)
  const memoryPrompt = settings.memoryEnabled
    ? buildMemoryPrompt(memoryHits, conversationState?.summary ?? '')
    : ''
  if (memoryHitDetails.length) void recordMemoryHits(memoryHitDetails)

  const lorebook = settings.lorebookEnabled
    ? await buildLorebookPrompt({
      worldId: conversation.worldId,
      characterId: character.id,
      messages,
      latestText: [latestUserText, requestOptions.musicPrompt || ''].filter(Boolean).join('\n'),
      character,
      persona,
      activeResourceEntryId: conversationState?.activeResourceEntryId,
      runtimeState: conversationState?.lorebookRuntime
    })
    : emptyLorebookResult(conversationState)

  const applyWorldRegex = (value: string) => {
    if (!activeWorldRegex.length || !value) return value
    return rememberRegexTraces(compileWorldInfoRegex({
      text: value,
      scripts: activeWorldRegex,
      macros: regexMacros
    })).text
  }
  const runtimeLorebookPrompt = applyWorldRegex(lorebook.prompt)
  const runtimeLorebookBeforeCharacter = applyWorldRegex(lorebook.beforePrompt)
  const runtimeLorebookAfterCharacter = applyWorldRegex(lorebook.afterCharacterPrompt)
  const runtimeLorebookAuthorNoteTop = applyWorldRegex(lorebook.authorNoteTopPrompt)
  const runtimeLorebookAuthorNoteBottom = applyWorldRegex(lorebook.authorNoteBottomPrompt)
  const runtimeLorebookBeforeExamples = applyWorldRegex(lorebook.beforeExamplesPrompt)
  const runtimeLorebookAfterExamples = applyWorldRegex(lorebook.afterExamplesPrompt)
  const runtimeLorebookDepth = lorebook.depthInjections.map(item => ({
    ...item,
    content: applyWorldRegex(item.content)
  }))
  const runtimeLorebookOutlets = Object.fromEntries(
    Object.entries(lorebook.outlets).map(([key, value]) => [key, applyWorldRegex(value)])
  )
  const runtimeLorebookContractSource = [
    runtimeLorebookPrompt,
    ...runtimeLorebookDepth.map(item => item.content),
    ...Object.values(runtimeLorebookOutlets)
  ].filter(Boolean).join('\n\n')
  const detectedCommunityUiContract = detectCommunityUiContract({
    character,
    lorebookPrompt: runtimeLorebookContractSource,
    preset: activePreset,
    assistantRegex: assistantUiRegex,
    promptRegex: assistantPromptContractRegex
  })
  const presentationHidesCommunityUi = settings.conversationPresentationMode !== 'scene-merged'
  const communityUiContract = presentationHidesCommunityUi
    ? { ...detectedCommunityUiContract, active: false, mode: 'none' as const }
    : detectedCommunityUiContract
  const displayAssistantRegex = presentationHidesCommunityUi
    ? assistantDisplayRegex.filter(item => !regexProducesRichUi(item))
    : assistantDisplayRegex
  const runtimeProfile = resolveCharacterRuntimeProfile({
    character,
    settings,
    communityUiContract: detectedCommunityUiContract,
    resourceUiActive: Boolean(lorebook.resourceSession.entryId)
  })
  const suppressStreamingPreview = Boolean(
    presentationHidesCommunityUi ||
    communityUiContract.active ||
    assistantStorageRegex.length ||
    assistantDisplayRegex.length ||
    displayAssistantRegex.some(regexProducesRichUi) ||
    (runtimeProfile.useNativeInteractionProtocol &&
      settings.multiBubble &&
      resolvePresenceMode(settings, conversationState) === 'remote')
  )

  const visualMessage = requestOptions.visualMessageId
    ? messages.find(item => item.id === requestOptions.visualMessageId)
    : undefined
  const visionCapability = getVisionCapability(modelSettings)
  const mayUseVision = Boolean(
    visualMessage?.type === 'image' &&
    getMessageImageUrls(visualMessage).length > 0 &&
    visionCapability !== 'unsupported'
  )

  const applyDepthInjections = (turns: ChatTurn[]): ChatTurn[] => {
    if (!runtimeLorebookDepth.length) return turns
    const grouped = new Map<number, typeof runtimeLorebookDepth>()
    for (const injection of runtimeLorebookDepth) {
      const index = Math.max(
        0,
        Math.min(turns.length, turns.length - Math.max(0, injection.depth))
      )
      const list = grouped.get(index) || []
      list.push(injection)
      grouped.set(index, list)
    }
    const output: ChatTurn[] = []
    for (let index = 0; index <= turns.length; index += 1) {
      const rows = (grouped.get(index) || []).sort(
        (a, b) => a.order - b.order ||
          ({ user: 0, assistant: 1, system: 2 }[a.role] - { user: 0, assistant: 1, system: 2 }[b.role])
      )
      rows.forEach(row => output.push({ role: row.role, content: row.content }))
      if (index < turns.length) output.push(turns[index])
    }
    return output
  }

  const applyOutgoingRegexToContent = (
    content: ChatTurn['content'],
    source: 'user-input' | 'assistant-output',
    scripts: typeof activeUserRegex,
    depth: number,
    collectTrace: boolean
  ): ChatTurn['content'] => {
    if (!scripts.length) return content
    const apply = (text: string) => {
      const result = compileOutgoingMessageRegex({
        text,
        source,
        scripts,
        depth,
        macros: regexMacros
      })
      if (collectTrace) rememberRegexTraces(result)
      return result.text
    }
    if (typeof content === 'string') return apply(content)
    return content.map(part => part.type === 'text'
      ? { ...part, text: apply(part.text) }
      : part)
  }

  const buildRecentTurns = (includeVision: boolean, collectTrace: boolean): ChatTurn[] => {
    const alternativeIndex = requestOptions.alternativeTargetId
      ? messages.findIndex(item => item.id === requestOptions.alternativeTargetId)
      : -1
    const promptMessages = alternativeIndex >= 0
      ? messages.slice(0, alternativeIndex)
      : messages
    const rows = promptMessages
      .filter(message => message.type !== 'system' && !message.recalledAt)
      .slice(-settings.recentMessageLimit)
      .map(message => {
        const role = message.senderId === 'user' ? ('user' as const) : ('assistant' as const)
        const content = includeVision && message.id === visualMessage?.id
          ? imagePromptContent(message)
          : messagePromptText(message)
        return { role, content }
      })

    const turns: ChatTurn[] = rows.map((row, index) => {
      const depth = Math.max(0, rows.length - 1 - index)
      const source = row.role === 'user' ? ('user-input' as const) : ('assistant-output' as const)
      const scripts = row.role === 'user' ? userPromptRegex : assistantPromptRegex
      return {
        role: row.role,
        content: applyOutgoingRegexToContent(row.content, source, scripts, depth, collectTrace)
      }
    })
    if (requestOptions.musicPrompt) {
      turns.push({ role: 'user', content: requestOptions.musicPrompt })
    }
    return applyDepthInjections(turns)
  }

  const deviceTimeContext = buildDeviceTimeContext(options.now ?? new Date(snapshot.createdAt))
  const buildRuntimeSystemPrompt = (includeVision: boolean) => {
    const resolvedState = conversationState
      ? { ...conversationState, presence: resolvePresenceMode(settings, conversationState) }
      : undefined
    const base = composeWithPromptPreset(composeRoleplaySystemPrompt({
      character,
      persona,
      settings,
      memoryPrompt,
      lorebookPrompt: runtimeLorebookPrompt,
      lorebookBeforeCharacterPrompt: runtimeLorebookBeforeCharacter,
      lorebookAfterCharacterPrompt: runtimeLorebookAfterCharacter,
      lorebookAuthorNoteTopPrompt: runtimeLorebookAuthorNoteTop,
      lorebookAuthorNoteBottomPrompt: runtimeLorebookAuthorNoteBottom,
      lorebookBeforeExamplesPrompt: runtimeLorebookBeforeExamples,
      lorebookAfterExamplesPrompt: runtimeLorebookAfterExamples,
      currentSummary: conversationState?.summary || '',
      statePrompt: buildConversationStatePrompt(resolvedState),
      sceneTransitionPrompt: buildUserSceneTransitionPrompt(
        deriveUserSceneTransition(latestUserText, conversationState)
      ),
      conversationState: resolvedState,
      deviceTimeContext,
      memoryWriteNotice: requestOptions.memoryWriteNotice,
      hasImages: includeVision && Boolean(visualMessage),
      imageCount: includeVision && visualMessage
        ? getMessageImageUrls(visualMessage).length
        : 0,
      isAlternativeReply: Boolean(requestOptions.alternativeTargetId),
      communityUiContract,
      openingMode: conversation.openingMode
    }), activePreset, {
      char: macroCharacterName,
      user: persona.name,
      scenario: character.scenario || '',
      personality: character.cardPersonality || character.persona || '',
      persona: persona.description || persona.identity || '',
      description: character.cardDescription || character.background || character.identity || '',
      lastChatMessage: latestUserText,
      outlets: runtimeLorebookOutlets
    })
    const proactivePrompt = requestOptions.proactivePrompt?.trim()
    const withProactive = proactivePrompt ? `${base}\n\n${proactivePrompt}` : base
    const uiPriority = buildCommunityUiPriorityPrompt(communityUiContract)
    const withUiPriority = uiPriority ? `${withProactive}\n\n${uiPriority}` : withProactive
    const presentationOverride = buildPresentationOverridePrompt(settings)
    return presentationOverride
      ? `${withUiPriority}\n\n${presentationOverride}`
      : withUiPriority
  }

  const createRequest = (includeVision: boolean, collectTrace: boolean): ChatRequest => ({
    model: modelSettings.model,
    temperature: modelSettings.temperature,
    signal: options.signal,
    character: {
      characterName: character.name,
      userName: persona.name,
      identity: character.identity,
      persona: character.persona,
      speakingStyle: character.speakingStyle,
      background: character.background,
      relationship: character.relationship,
      mood: character.mood,
      activity: character.activity,
      likes: character.likes,
      dislikes: character.dislikes,
      scenario: character.scenario,
      roleplayMode: settings.roleplayMode,
      initiative: character.initiative,
      narrationStyle: character.narrationStyle,
      emojiFrequency: character.emojiFrequency,
      questionFrequency: character.questionFrequency
    },
    messages: [
      { role: 'system', content: buildRuntimeSystemPrompt(includeVision) },
      ...buildRecentTurns(includeVision, collectTrace)
    ]
  })

  const primaryIncludeVision = mayUseVision
  const primaryRequest = createRequest(primaryIncludeVision, true)
  const alternateRequest = createRequest(!primaryIncludeVision, false)
  const requestWithVision = primaryIncludeVision ? primaryRequest : alternateRequest
  const requestWithoutVision = primaryIncludeVision ? alternateRequest : primaryRequest

  return {
    snapshot: { ...snapshot, activePersona: persona },
    generationId: snapshot.generationId,
    contextCreatedAt: snapshot.createdAt,
    modelSettings,
    conversation,
    character,
    settings,
    conversationState,
    messages,
    memories,
    requestOptions,
    persona,
    activePreset,
    macroCharacterName,
    regexMacros,
    activeAssistantRegex,
    activeUserRegex,
    activeWorldRegex,
    assistantStorageRegex,
    assistantDisplayRegex,
    assistantPromptRegex,
    userPromptRegex,
    assistantUiRegex,
    displayAssistantRegex,
    regexExecutionTraces,
    memoryQuery,
    memoryHitDetails,
    memoryHits,
    memoryPrompt,
    latestUserText,
    lorebook,
    applyWorldRegex,
    runtimeLorebookPrompt,
    runtimeLorebookBeforeCharacter,
    runtimeLorebookAfterCharacter,
    runtimeLorebookAuthorNoteTop,
    runtimeLorebookAuthorNoteBottom,
    runtimeLorebookBeforeExamples,
    runtimeLorebookAfterExamples,
    runtimeLorebookDepth,
    runtimeLorebookOutlets,
    detectedCommunityUiContract,
    communityUiContract,
    presentationHidesCommunityUi,
    runtimeProfile,
    suppressStreamingPreview,
    preserveRawOutput: runtimeProfile.preserveCardOutput,
    visualMessage,
    visionCapability,
    mayUseVision,
    requests: {
      withVision: requestWithVision,
      withoutVision: requestWithoutVision
    },
    primaryRequest,
    cardRuntime: buildCharacterRuntimeManifest(character),
    deviceTimeContext
  }
}

export type GenerationContext = Awaited<ReturnType<typeof buildGenerationContext>>
