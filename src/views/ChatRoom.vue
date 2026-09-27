<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ChatHeader from '../components/chat/ChatHeader.vue'
import ChatMessageList from '../components/chat/ChatMessageList.vue'
import ChatMessageEditor from '../components/chat/ChatMessageEditor.vue'
import ChatSettingsPanel from '../components/chat/ChatSettingsPanel.vue'
import ChatActionSheet from '../components/chat/ChatActionSheet.vue'
import ChatImagePreview from '../components/chat/ChatImagePreview.vue'
import ChatThoughtPanel from '../components/chat/ChatThoughtPanel.vue'
import ChatMusicPanel from '../components/chat/ChatMusicPanel.vue'
import ChatGreetingPicker from '../components/chat/ChatGreetingPicker.vue'
import { useBottomPanel } from '../composables/useBottomPanel'
import { useChatScroll, type ChatMessageListHandle } from '../composables/useChatScroll'
import { useChatSpeech } from '../composables/useChatSpeech'

import { db } from '../db/database'
import { deleteConversationMessagesConsistently, resetConversationRuntime, truncateConversationAfterMessage } from '../runtime/conversation/conversationMutationService'
import { createConversationBranch } from '../runtime/conversation/conversationBranchService'
import { installConversationGreeting, switchConversationToFreeOpening } from '../runtime/conversation/conversationOpeningService'
import { rebuildAndPersistConversationState } from '../runtime/conversation/conversationStateReplayService'
import { buildGenerationContext } from '../runtime/generation/generationContextBuilder'
import {
  cloneChatRequest,
  type GenerationRequestOptions
} from '../runtime/generation/generationContext'
import {
  accumulateGenerationTokenUsage,
  createGenerationTokenUsage,
  runGenerationProvider
} from '../runtime/generation/generationOrchestrator'
import {
  createStreamingReplyRuntime,
  createStreamingReplySession
} from '../runtime/generation/streamingReplyRuntime'
import {
  finalizeAssistantReply,
  prepareParsedAssistantOutput
} from '../runtime/generation/assistantReplyFinalizationRuntime'
import { createCommunityUiRepairRuntime } from '../runtime/generation/communityUiRepairRuntime'
import { createAssistantStateEffectsRuntime } from '../runtime/generation/assistantStateEffectsRuntime'
import { createAssistantReplyPersistenceRuntime } from '../runtime/generation/assistantReplyPersistenceRuntime'
import { createPromptDebugRuntime } from '../runtime/generation/promptDebugRuntime'
import { createGenerationLifecycleRuntime } from '../runtime/generation/generationLifecycleRuntime'
import {
  isTokenLimitError,
  type ChatRequest,
  type ChatResponse
} from '../services/ai/provider'
import { createProvider } from '../services/ai/providerFactory'
import { getModelSettings, getVisionCapability } from '../services/modelSettings'
import {
  MAX_CHAT_IMAGES,
  prepareChatImage,
  prepareChatImageBatch,
  prepareOriginalChatImage,
  type ImageBatchProgress,
  type ImagePreparationFailure,
  type PreparedChatImage
} from '../services/imageService'
import { getMessageImages, getMessageImageUrls } from '../services/messageImageService'
import {
  getChatSettings,
  getConversationState,
  createDefaultConversationState,
  getMusicState,
  patchConversationState,
  saveChatSettings,
  saveMusicState
} from '../services/chatSettings'
import {
  listConversationMemoryContext,
  rememberFromMessageDetailed,
  buildMemoryWriteNotice
} from '../services/memoryService'
import {
  consolidateConversationMemories,
  decayStaleMemories
} from '../services/memoryConsolidationService'
import { generateVisibleCharacterState } from '../services/characterStateService'
import { inferCardInitialActivity, inferCardInitialRelationship } from '../services/characterInitialStateService'
import { collectCharacterGreetings } from '../services/characterGreetingService'
import { planProactiveMessage } from '../services/proactiveMessageService'
import { loadSharedTimeline, loadSharedTimelinePreferences } from '../services/sharedTimelineService'
import { selectSharedTimelineRecallEvent } from '../services/sharedTimelineEventService'
import { getOrCreateUserProfile } from '../services/userProfile'
import { getPersonaForChat, listPersonas } from '../services/personaService'
import { listActiveRegexScripts, looksLikeRichHtml, normalizeCommunityPlainText, normalizeRichHtml, type RegexExecutionTrace } from '../services/regexRuntime'
import { compileIncomingMessageRegex, compileWorldInfoRegex } from '../services/regexPipelineService'
import { detectCommunityUiContract, regexProducesRichUi, tryRepairCommunityUiLocally } from '../services/communityUiRuntime'
import { getActivePromptPreset } from '../services/presetRuntime'
import { buildLorebookPrompt } from '../services/lorebookService'
import { resolveCharacterRuntimeProfile } from '../services/characterRuntimeProfile'
import { characterMacroName, detectCharacterCardFamily } from '../services/characterCardCompatibility'
import { renderCharacterCardPromptText } from '../services/textMacroService'
import { parseCompanionOutput, resolvePresenceMode, shapeCompanionActions, visibleStreamingText } from '../services/interactionProtocol'
import { extractRoleCardUiHints, parseRoleCardUi, resolvePresenceFromRoleCardScene, roleCardUiToConversationPatch } from '../services/roleCardUiService'
import { deriveUserSceneTransition, deriveUserStatePatch, recordConversationStateChanges } from '../services/stateHistoryService'
import type {
  Character,
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  MessageReplyReference,
  MusicState,
  UserProfile,
  UserPersona
} from '../types/domain'
import type { ModelSettings } from '../types/modelSettings'

const route = useRoute()
const router = useRouter()
const conversation = ref<Conversation>()
const character = ref<Character>()
const userProfile = ref<UserProfile>()
const personas = ref<UserPersona[]>([])
const activePersona = ref<UserPersona>()
const messages = ref<Message[]>([])
const memories = ref<CharacterMemory[]>([])
const chatSettings = ref<ChatSettings>()
const conversationState = ref<ConversationState>()
const musicState = ref<MusicState>()
const modelSettings = ref<ModelSettings>()
const draft = ref('')
const isSending = ref(false)
const streamingMessageId = ref('')
const isLoadingThought = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const settingsTab = ref<'chat' | 'roleplay' | 'memory' | 'advanced'>('chat')
const activePanel = ref<'thought' | 'music' | 'settings' | 'message' | 'editor' | 'greeting' | null>(null)
const selectedMessage = ref<Message>()
const editMessageDraft = ref('')
const isSavingMessageEdit = ref(false)
const replyTarget = ref<Message>()
const previewImages = ref<string[]>([])
const previewImageIndex = ref(0)
const pendingImages = ref<PreparedChatImage[]>([])
const failedImages = ref<ImagePreparationFailure[]>([])
const imageProgress = ref<ImageBatchProgress>()
const isPreparingImage = ref(false)
type VisionStage = 'idle' | 'sent' | 'checking' | 'analyzing' | 'replying' | 'text-only'
const visionStage = ref<VisionStage>('idle')
const visionImageCount = ref(0)

interface ChatComposerHandle {
  focus: () => void
  resize: () => void
}
interface ChatMusicPanelHandle {
  getAudioElement: () => HTMLAudioElement | undefined
}
const messageListRef = ref<ChatMessageListHandle>()
const chatComposerRef = ref<ChatComposerHandle>()
const musicPanelRef = ref<ChatMusicPanelHandle>()
let abortController: AbortController | undefined
let manualStopRequested = false
let noticeTimer: number | undefined
let streamScrollFrame: number | undefined
let localAudioObjectUrl = ''
let lastMusicSaveSecond = -1
let conversationLoadEpoch = 0

const title = computed(() => character.value?.name || conversation.value?.title || '聊天')
const displayedConversationState = computed<ConversationState | undefined>(() => {
  if (!conversationState.value) return undefined
  if (!chatSettings.value) return conversationState.value
  return {
    ...conversationState.value,
    presence: resolvePresenceMode(chatSettings.value, conversationState.value)
  }
})
const displayUserProfile = computed<UserProfile | undefined>(() => {
  const persona = activePersona.value
  if (!persona) return userProfile.value
  return {
    id: persona.id,
    name: persona.name,
    avatar: persona.avatar,
    identity: persona.identity,
    bio: persona.personality || persona.background,
    createdAt: persona.createdAt,
    updatedAt: persona.updatedAt
  }
})
const availableGreetings = computed(() => collectCharacterGreetings(
  character.value?.firstMessage,
  character.value?.alternateGreetings
))
const requiresInitialGreetingChoice = computed(() => Boolean(
  conversation.value &&
  character.value &&
  conversation.value.openingMode === 'pending' &&
  messages.value.every(item => item.senderId !== 'user')
))
const currentTrackLabel = computed(() => {
  const music = musicState.value
  if (!music?.title) return ''
  return music.artist ? `${music.title} · ${music.artist}` : music.title
})
const providerLabel = computed(() => {
  const settings = modelSettings.value
  if (!settings) return '尚未读取'
  if (settings.provider === 'deepseek') return 'DeepSeek'
  if (settings.provider === 'openai-compatible') return 'OpenAI 兼容接口'
  return '未配置真实模型'
})
const canSend = computed(() => Boolean(draft.value.trim() || pendingImages.value.length) && !failedImages.value.length && !isSending.value && !isPreparingImage.value)
const sendingHint = computed(() => {
  const count = visionImageCount.value
  if (count > 0) {
    if (visionStage.value === 'sent') return `${count} 张图片已发送，正在准备交给 AI…`
    if (visionStage.value === 'checking') return `正在检查模型能否理解这 ${count} 张图片…`
    if (visionStage.value === 'analyzing') return `AI 正在查看这 ${count} 张图片…`
    if (visionStage.value === 'replying') return '图片已读取，正在组织回复…'
    if (visionStage.value === 'text-only') return '当前模型无法读取图片，正在根据文字说明回应…'
  }
  const latest = [...messages.value].reverse().find(item => item.senderId === 'user')
  return latest?.type === 'image' ? '正在认真看你发来的图片…' : '正在想该怎么回应你…'
})
const visionCapabilityLabel = computed(() => {
  const settings = modelSettings.value
  if (!settings) return '尚未检测'
  const capability = getVisionCapability(settings)
  if (capability === 'supported') return '可理解图片'
  if (capability === 'unsupported') return '不解析图片，仅把文字部分交给当前 AI'
  return '首次发送图片时自动检测'
})

const { panelStyle, beginPanelDrag, movePanelDrag, endPanelDrag } = useBottomPanel(activePanel)
const {
  showScrollButton,
  scrollToBottom,
  updateScrollButton,
  handleMessageScroll,
  rememberScrollPosition,
  restoreScrollPosition,
  handleComposerFocus
} = useChatScroll({ messageListRef, getConversationId: () => conversation.value?.id })
const {
  voiceInputAvailable,
  speechPlaybackAvailable,
  isRecording,
  isRecognizingSpeech,
  recordingSeconds,
  speechVoices,
  startVoiceRecording,
  stopVoiceRecording,
  cancelVoiceRecording,
  stopSpeechPlayback,
  speakText,
  previewCurrentVoice,
  toggleMessageSpeech,
  speechStateForMessage
} = useChatSpeech({
  draft,
  title,
  chatSettings,
  character,
  noticeMessage,
  afterDraftUpdated: () => {
    chatComposerRef.value?.focus()
    chatComposerRef.value?.resize()
  }
})

function draftStorageKey(conversationId: string) {
  return `ai-companion-draft:${conversationId}`
}

function messagePreview(message: Message, maxLength = 42) {
  if (message.recalledAt) return '[已撤回的消息]'
  const visibleContent = message.displayContent ?? message.content
  if (message.type === 'action') return `[动作] ${visibleContent}`
  if (message.type === 'image') {
    const caption = visibleContent.trim()
    return caption ? `[图片] ${caption}` : '[图片]'
  }
  if (message.type === 'voice') return `[语音] ${visibleContent}`
  if (message.type === 'emoji') return `[表情] ${visibleContent}`
  const text = visibleContent.replace(/\s+/g, ' ').trim()
  return text.length > maxLength
    ? `${text.slice(0, maxLength)}…`
    : text
}

function messageSenderName(message: Message) {
  return message.senderId === 'user'
    ? (activePersona.value?.name || userProfile.value?.name || '我')
    : title.value
}

function createReplyReference(message: Message): MessageReplyReference {
  return {
    messageId: message.id,
    senderName: messageSenderName(message),
    preview: messagePreview(message),
    type: message.type === 'image'
      ? 'image'
      : message.type === 'music'
        ? 'music'
        : 'text'
  }
}

function openImagePreview(urls: string[], index: number) {
  previewImages.value = urls
  previewImageIndex.value = Math.min(Math.max(0, index), Math.max(0, urls.length - 1))
}

function previewPendingImages(index: number) {
  openImagePreview(pendingImages.value.map(image => image.dataUrl).filter(Boolean), index)
}

function downloadPreviewImage(url: string, index: number) {
  if (!url) return
  const mime = /^data:image\/([^;,]+)/i.exec(url)?.[1]?.toLowerCase() || 'jpeg'
  const extension = mime === 'jpeg' ? 'jpg' : mime.replace(/[^a-z0-9]/g, '') || 'jpg'
  const link = document.createElement('a')
  link.href = url
  link.download = `chat-image-${Date.now()}-${index + 1}.${extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  noticeMessage.value = '图片已开始保存。'
}

function openMessageMenu(message: Message) {
  selectedMessage.value = message
  activePanel.value = 'message'
  if ('vibrate' in navigator) navigator.vibrate?.(12)
}

function hasAcceptedImagePrivacy() {
  return localStorage.getItem('ai-companion-image-privacy-accepted') === 'yes'
}

function confirmImagePrivacy() {
  if (hasAcceptedImagePrivacy()) return true

  const accepted = window.confirm([
    '图片理解需要把图片发送给你当前配置的模型服务。',
    '',
    '请避免上传身份证、银行卡、私密文件等敏感内容。',
    '',
    '是否继续选择图片？'
  ].join('\n'))

  if (accepted) {
    localStorage.setItem('ai-companion-image-privacy-accepted', 'yes')
  }

  return accepted
}

function removePendingImage(index: number) {
  pendingImages.value.splice(index, 1)
}

function movePendingImage(index: number, offset: number) {
  const target = index + offset
  if (index < 0 || target < 0 || index >= pendingImages.value.length || target >= pendingImages.value.length) return
  const [image] = pendingImages.value.splice(index, 1)
  pendingImages.value.splice(target, 0, image)
}

async function useOriginalPendingImage(index: number) {
  const current = pendingImages.value[index]
  if (!current?.sourceFile || isPreparingImage.value) return
  isPreparingImage.value = true
  imageProgress.value = {
    completed: 0,
    total: 1,
    currentName: current.name,
    status: 'processing'
  }
  try {
    const original = await prepareOriginalChatImage(current.sourceFile, current.attempts)
    pendingImages.value.splice(index, 1, original)
    noticeMessage.value = `${current.name} 已切换为原图。`
  } catch (error) {
    noticeMessage.value = error instanceof Error ? error.message : '原图读取失败。'
  } finally {
    isPreparingImage.value = false
    imageProgress.value = undefined
  }
}

function removeFailedImage(id: string) {
  failedImages.value = failedImages.value.filter(item => item.id !== id)
}

async function retryFailedImage(id: string, forceOriginal = false) {
  const failure = failedImages.value.find(item => item.id === id)
  if (!failure || isPreparingImage.value) return

  isPreparingImage.value = true
  imageProgress.value = {
    completed: 0,
    total: 1,
    currentName: failure.name,
    status: 'processing'
  }

  try {
    const prepared = forceOriginal
      ? await prepareOriginalChatImage(failure.file, failure.attempts)
      : await prepareChatImage(failure.file, { allowOriginalFallback: true })
    failedImages.value = failedImages.value.filter(item => item.id !== id)
    pendingImages.value.push(prepared)
    noticeMessage.value = `${failure.name} 已重新处理成功。`
  } catch (error) {
    const reason = error instanceof Error ? error.message : '图片处理失败。'
    failedImages.value = failedImages.value.map(item => item.id === id
      ? { ...item, reason }
      : item)
    noticeMessage.value = `${failure.name} 仍无法处理：${reason}`
  } finally {
    isPreparingImage.value = false
    imageProgress.value = undefined
  }
}

function clearPendingImages() {
  pendingImages.value = []
  failedImages.value = []
  imageProgress.value = undefined
}

async function recoverInterruptedMessages(
  rows: Message[]
) {
  const interruptedAssistantIds: string[] = []
  const recovered: Message[] = []
  const userUpdates: Message[] = []

  for (const message of rows) {
    if (message.status !== 'pending') {
      recovered.push(message)
      continue
    }

    if (message.senderId !== 'user') {
      // 页面刷新/崩溃/断线留下的 pending 角色消息没有完整性证明。
      // 无论已经流出了多少文字都删除，不能把半截 AI 输出当作正式角色回复。
      interruptedAssistantIds.push(message.id)
      continue
    }

    const next: Message = {
      ...message,
      status: 'cancelled',
      errorText: undefined
    }
    recovered.push(next)
    userUpdates.push(next)
  }

  if (interruptedAssistantIds.length || userUpdates.length) {
    await db.transaction('rw', db.messages, async () => {
      if (interruptedAssistantIds.length) {
        await db.messages.bulkDelete(interruptedAssistantIds)
      }
      if (userUpdates.length) {
        await db.messages.bulkPut(userUpdates)
      }
    })
  }

  return recovered
}


async function normalizeLegacyCommunityPlainMessages(rows: Message[]) {
  const normalized: Message[] = []
  for (const row of rows) {
    if (
      row.senderId === 'user' ||
      row.type === 'rich' ||
      row.richHtml ||
      !/<br\s*\/?\s*>/i.test(row.content)
    ) {
      normalized.push(row)
      continue
    }

    const content = normalizeCommunityPlainText(row.content)
    if (content === row.content) {
      normalized.push(row)
      continue
    }

    const next = { ...row, content }
    await db.messages.update(row.id, { content })
    normalized.push(next)
  }
  return normalized
}


async function resolveOpeningCommunityUiRuntime(options: {
  conversation: Conversation
  character: Character
  settings: ChatSettings
  persona?: UserPersona
  greetingText: string
}) {
  const userName = options.persona?.name?.trim() || '你'
  const charName = characterMacroName(options.character)
  const [assistantRegex, worldRegex, preset] = await Promise.all([
    listActiveRegexScripts(options.character.id, 'assistant-output'),
    listActiveRegexScripts(options.character.id, 'world-info'),
    getActivePromptPreset(options.character.id)
  ])

  let contract = detectCommunityUiContract({
    character: options.character,
    preset,
    assistantRegex
  })

  if (options.settings.lorebookEnabled !== false) {
    const lorebook = await buildLorebookPrompt({
      worldId: options.conversation.worldId,
      characterId: options.character.id,
      messages: [],
      latestText: options.greetingText,
      character: options.character,
      persona: options.persona
    })
    const applyWorldRegex = (value: string) => {
      if (!value || !worldRegex.length) return value
      return compileWorldInfoRegex({
        text: value,
        scripts: worldRegex,
        macros: { user: userName, char: charName }
      }).text
    }
    const lorebookContractSource = [
      lorebook.prompt,
      ...lorebook.depthInjections.map(item => item.content),
      ...Object.values(lorebook.outlets)
    ].filter(Boolean).map(applyWorldRegex).join('\n\n')
    contract = detectCommunityUiContract({
      character: options.character,
      lorebookPrompt: lorebookContractSource,
      preset,
      assistantRegex
    })
  }

  return { contract, assistantRegex }
}

async function repairExistingGreetingCommunityUi(options: {
  rows: Message[]
  conversation: Conversation
  character?: Character
  settings: ChatSettings
  persona?: UserPersona
}) {
  if (!options.character || options.settings.conversationPresentationMode !== 'scene-merged') return options.rows
  const greetingRows = options.rows.filter(row => row.isGreetingSeed && row.senderId !== 'user' && row.type !== 'rich')
  if (!greetingRows.length) return options.rows

  const firstGreetingText = greetingRows[0].rawContent || greetingRows[0].content
  const runtime = await resolveOpeningCommunityUiRuntime({
    conversation: options.conversation,
    character: options.character,
    settings: options.settings,
    persona: options.persona,
    greetingText: firstGreetingText
  })
  if (!runtime.contract.active && !runtime.assistantRegex.some(regexProducesRichUi)) return options.rows

  const richRegexNames = new Set(runtime.assistantRegex.filter(regexProducesRichUi).map(item => item.name))
  const nextRows: Message[] = []
  for (const row of options.rows) {
    if (!row.isGreetingSeed || row.senderId === 'user' || row.type === 'rich') {
      nextRows.push(row)
      continue
    }

    const source = row.rawContent || row.content
    const regexView = compileIncomingMessageRegex({
      rawText: source,
      source: 'assistant-output',
      scripts: [],
      displayScripts: runtime.assistantRegex,
      depth: 0,
      macros: { user: options.persona?.name || '你', char: characterMacroName(options.character) }
    })
    const applied = regexView.displayApplied
    const fromRichRegex = applied.some(name => richRegexNames.has(name))
    let html = regexView.rich || looksLikeRichHtml(regexView.displayText)
      ? normalizeRichHtml(regexView.displayText)
      : ''
    let sourceKind: Message['richSource'] | undefined = html
      ? (fromRichRegex ? 'regex' : runtime.contract.active ? 'worldbook-ui' : 'card-ui')
      : undefined

    if (!html && runtime.contract.active) {
      const repaired = tryRepairCommunityUiLocally(runtime.contract, regexView.displayText)
      if (repaired.repaired) {
        html = normalizeRichHtml(repaired.text)
        sourceKind = 'worldbook-ui'
      }
    }

    if (!html) {
      nextRows.push(row)
      continue
    }

    const preview = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 280) || '角色卡 UI'
    const next: Message = {
      ...row,
      type: 'rich',
      content: preview,
      displayContent: undefined,
      richHtml: html,
      richSource: sourceKind,
      roleCardUi: undefined
    }
    await db.messages.update(row.id, {
      type: next.type,
      content: next.content,
      displayContent: undefined,
      richHtml: next.richHtml,
      richSource: next.richSource,
      roleCardUi: undefined
    })
    nextRows.push(next)
  }
  return nextRows
}

async function removeLegacySyntheticPhoneActions(rows: Message[]) {
  const removedIds = rows
    .filter(row => row.senderId !== 'user' && row.type === 'action' && /低头看着手机屏幕，停了一会儿才继续回复[。.!！]?/.test(row.content))
    .map(row => row.id)
  if (removedIds.length) await db.messages.bulkDelete(removedIds)
  return rows.filter(row => !removedIds.includes(row.id))
}

async function normalizeLegacySceneActionMessages(
  rows: Message[],
  conversationId: string,
  activeCharacter: Character | undefined,
  settings: ChatSettings,
  state: ConversationState
) {
  if (activeCharacter && resolveCharacterRuntimeProfile({ character: activeCharacter, settings }).compatibilityMode === 'card-first') {
    return { rows, state: undefined }
  }
  const lastAssistantId = [...rows].reverse().find(row => row.senderId !== 'user')?.id
  const normalized: Message[] = []
  let latestPresencePatch: Partial<ConversationState> = {}

  for (const row of rows) {
    if (row.senderId === 'user' || !/<\s*\/?\s*scene(?:[_-]?action)?/i.test(row.content)) {
      normalized.push(row)
      continue
    }

    const parsed = parseCompanionOutput(row.content)
    if (!parsed.messages.length) {
      const clean = visibleStreamingText(row.content).trim()
      const next = { ...row, content: clean }
      await db.messages.update(row.id, { content: clean })
      normalized.push(next)
      continue
    }

    const renderState = parsed.status?.presence
      ? ({ ...state, presence: parsed.status.presence } as ConversationState)
      : state
    const shaped = activeCharacter
      ? shapeCompanionActions(parsed.messages, activeCharacter, settings, Boolean(parsed.rawPacket), renderState)
      : parsed.messages
    const visible = shaped.filter(action => action.kind !== 'typing_pause' && action.kind !== 'recall_message' && action.kind !== 'react_to_message')
    const content = visible.map(action => action.kind === 'scene_action' ? `（${action.content}）` : action.content).filter(Boolean).join('\n')
    const type: Message['type'] = visible.length === 1 && visible[0].kind === 'scene_action' ? 'action' : 'text'
    const roleCardUi = row.roleCardUi || parsed.roleCardUi
    const next = { ...row, content, type, roleCardUi }
    await db.messages.update(row.id, { content, type, roleCardUi })
    normalized.push(next)

    if (row.id === lastAssistantId && parsed.status?.presence) {
      latestPresencePatch = {
        presence: parsed.status.presence,
        reportedPresence: parsed.presenceResolution?.reportedPresence,
        presenceResolutionReason: parsed.presenceResolution?.reason,
        presenceResolutionSource: parsed.presenceResolution?.source
      }
    }
  }

  const nextState = Object.keys(latestPresencePatch).length
    ? await patchConversationState(conversationId, latestPresencePatch)
    : undefined
  return { rows: normalized, state: nextState }
}

let lastConsolidateCount = 0
let isConsolidating = false
const CONSOLIDATE_EVERY = 40

async function maybeConsolidate() {
  if (isConsolidating) return
  if (!conversation.value || !character.value) return
  const total = messages.value.length
  if (total - lastConsolidateCount < CONSOLIDATE_EVERY) return
  isConsolidating = true
  lastConsolidateCount = total
  try {
    decayStaleMemories(conversation.value.id).catch(() => {})
    const result = await consolidateConversationMemories(
      conversation.value.id,
      character.value.id
    )
    if (result.summarized > 0) {
      noticeMessage.value = `已把较早的零散细节巩固为 ${result.summarized} 条长期记忆。`
      await refreshMemoryList()
    }
  } finally {
    isConsolidating = false
  }
}

watch(
  () => messages.value.length,
  (next, previous) => {
    if (next > (previous ?? 0)) void maybeConsolidate()
  }
)
async function handleFeedback(message: Message, value: 'up' | 'down') {
  const next = message.feedback === value ? undefined : value
  const patch: Partial<Message> = next
    ? { feedback: next, feedbackAt: new Date().toISOString() }
    : { feedback: undefined, feedbackAt: undefined }
  await db.messages.update(message.id, patch)
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index >= 0) messages.value[index] = { ...messages.value[index], ...patch }
  if (next === 'down') {
    noticeMessage.value = '已记录反馈。若回复与记忆不符，可长按消息重新生成，或在记忆中心纠错。'
  }
}
async function scrollToLinkedMessage() {
  const messageId = typeof route.query.message === 'string' ? route.query.message : ''
  if (!messageId) return
  const index = messages.value.findIndex(item => item.id === messageId)
  if (index < 0) return
  await nextTick()
  await messageListRef.value?.scrollToMessageIndex?.(index, 'smooth')
  await nextTick()
  window.setTimeout(() => {
    const list = messageListRef.value?.getElement()
    const target = list
      ? [...list.querySelectorAll<HTMLElement>('[data-message-id]')].find(element => element.dataset.messageId === messageId)
      : undefined
    if (target && typeof target.animate === 'function') {
      target.animate([
        { opacity: .58, transform: 'scale(.985)' },
        { opacity: 1, transform: 'scale(1)' }
      ], { duration: 900, easing: 'ease-out' })
    }
  }, 320)
}

async function loadConversation(conversationId: string) {
  lastConsolidateCount = 0
  const loadEpoch = ++conversationLoadEpoch
  const isCurrentLoad = () => loadEpoch === conversationLoadEpoch && String(route.params.id || '') === conversationId

  errorMessage.value = ''
  pendingImages.value = []
  failedImages.value = []
  imageProgress.value = undefined
  previewImages.value = []
  replyTarget.value = undefined

  try {
    const conversationRow = await db.conversations.get(conversationId)
    if (!isCurrentLoad()) return

    if (!conversationRow) {
      conversation.value = undefined
      character.value = undefined
      messages.value = []
      errorMessage.value = '没有找到这个聊天会话。'
      return
    }

    const [
      messageRows,
      characterRow,
      profileRow,
      settingsRow,
      stateRow,
      musicRow,
      memoryRows,
      modelRow,
      personaRows
    ] = await Promise.all([
      db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('createdAt'),
      conversationRow.type === 'single'
        ? db.characters.get(conversationRow.memberIds[0])
        : Promise.resolve(undefined),
      getOrCreateUserProfile(),
      getChatSettings(conversationId),
      getConversationState(conversationId),
      getMusicState(conversationId),
      listConversationMemoryContext(conversationId, conversationRow.memberIds[0] || ''),
      getModelSettings(),
      listPersonas()
    ])
    if (!isCurrentLoad()) return

    const legacyPlainNormalized = await normalizeLegacyCommunityPlainMessages(messageRows)
    if (!isCurrentLoad()) return
    const withoutSyntheticPhoneActions = await removeLegacySyntheticPhoneActions(legacyPlainNormalized)
    if (!isCurrentLoad()) return
    const legacySceneNormalized = await normalizeLegacySceneActionMessages(withoutSyntheticPhoneActions, conversationId, characterRow, settingsRow, stateRow)
    if (!isCurrentLoad()) return
    const effectiveStateRow = legacySceneNormalized.state || stateRow
    const recoveredMessageRows = await recoverInterruptedMessages(legacySceneNormalized.rows)
    if (!isCurrentLoad()) return

    const loadedRuntimeProfile = characterRow
      ? resolveCharacterRuntimeProfile({ character: characterRow, settings: settingsRow })
      : undefined
    const activePersonaRow = await getPersonaForChat(settingsRow)
    if (!isCurrentLoad()) return
    const greetingUiRepairedRows = await repairExistingGreetingCommunityUi({
      rows: recoveredMessageRows,
      conversation: conversationRow,
      character: characterRow,
      settings: settingsRow,
      persona: activePersonaRow
    })
    if (!isCurrentLoad()) return
    const visibleMessageRows = greetingUiRepairedRows.map(row =>
      loadedRuntimeProfile?.preserveCardOutput && row.roleCardUi ? { ...row, roleCardUi: undefined } : row
    )

    const proactivePlan = characterRow && loadedRuntimeProfile?.compatibilityMode === 'phone-enhanced'
      ? await planProactiveMessage({
        character: characterRow,
        messages: visibleMessageRows,
        enabled: settingsRow.proactiveEnabled ?? true,
        intervalHours: settingsRow.proactiveIntervalHours ?? 12,
        frequency: settingsRow.proactiveFrequency,
        quietHoursEnabled: settingsRow.proactiveQuietHoursEnabled,
        quietStart: settingsRow.proactiveQuietStart,
        quietEnd: settingsRow.proactiveQuietEnd,
        allowedSources: settingsRow.proactiveAllowedSources,
        memories: memoryRows,
        state: effectiveStateRow,
        loadSharedTimelineRecall: async () => {
          const [timeline, timelinePreferences] = await Promise.all([
            loadSharedTimeline(conversationRow.worldId),
            loadSharedTimelinePreferences(conversationRow.worldId)
          ])
          return selectSharedTimelineRecallEvent(timeline, timelinePreferences, {
            characterId: characterRow.id,
            minAgeDays: 7
          })
        }
      })
      : null
    if (!isCurrentLoad()) return

    conversation.value = conversationRow
    messages.value = visibleMessageRows
    character.value = characterRow
    userProfile.value = profileRow
    chatSettings.value = settingsRow
    conversationState.value = effectiveStateRow
    musicState.value = musicRow.sourceType === 'local'
      ? { ...musicRow, audioUrl: '', isPlaying: false }
      : musicRow
    memories.value = memoryRows
    modelSettings.value = modelRow
    personas.value = personaRows.filter(item => !item.boundCharacterId || item.boundCharacterId === characterRow?.id)
    activePersona.value = activePersonaRow
    draft.value = localStorage.getItem(draftStorageKey(conversationId)) ?? ''

    if (conversationRow.unread > 0) {
      await db.conversations.update(conversationRow.id, { unread: 0 })
      if (!isCurrentLoad()) return
      conversation.value = { ...conversationRow, unread: 0 }
    }

    await restoreScrollPosition(conversationId)
    if (!isCurrentLoad()) return
    await nextTick()
    if (!isCurrentLoad()) return
    await scrollToLinkedMessage()
    if (!isCurrentLoad()) return

    const greetingRows = collectCharacterGreetings(characterRow?.firstMessage, characterRow?.alternateGreetings)
    const hasUserHistory = recoveredMessageRows.some(item => item.senderId === 'user')
    if (conversationRow.openingMode === 'pending' && !hasUserHistory) {
      if (greetingRows.length) activePanel.value = 'greeting'
      else {
        await db.conversations.update(conversationRow.id, { openingMode: 'free' })
        if (!isCurrentLoad()) return
        conversation.value = { ...conversationRow, openingMode: 'free' }
      }
    } else if (!conversationRow.openingMode && greetingRows.length > 1 && recoveredMessageRows.length <= 1 && !hasUserHistory) {
      // 旧版多开场会话继续兼容原逻辑。
      activePanel.value = 'greeting'
    }

    chatComposerRef.value?.resize()
    updateScrollButton()
    applyAudioState()
    if (proactivePlan && characterRow) {
      window.setTimeout(() => {
        if (!isCurrentLoad() || isSending.value) return
        void requestAssistantReply({
          proactivePrompt: proactivePlan.instruction,
          proactiveSource: proactivePlan.source
        })
      }, 0)
    }
  } catch (error) {
    if (!isCurrentLoad()) return
    console.error('读取聊天失败：', error)
    errorMessage.value = error instanceof Error
      ? `聊天加载失败：${error.message}`
      : '聊天加载失败。'
  }
}

async function refreshMemoryList() {
  if (!conversation.value) return
  memories.value = await listConversationMemoryContext(conversation.value.id, character.value?.id || '')
}

async function updateUserMessageState(
  messageId: string | undefined,
  status: Message['status'],
  patch?: Partial<Message>
) {
  if (!messageId) return

  await db.messages.update(messageId, {
    status,
    errorText: status === 'failed'
      ? patch?.errorText
      : undefined,
    ...patch
  })

  const index = messages.value.findIndex(item => item.id === messageId)
  if (index >= 0) {
    messages.value[index] = {
      ...messages.value[index],
      status,
      errorText: status === 'failed'
        ? patch?.errorText
        : undefined,
      ...patch
    }
  }
}


function clearStreamTimers() {
  streamingRuntime.clearPersistenceTimer()

  if (streamScrollFrame !== undefined) {
    window.cancelAnimationFrame(streamScrollFrame)
    streamScrollFrame = undefined
  }
}

function scheduleStreamScroll() {
  if (showScrollButton.value || streamScrollFrame !== undefined) return

  streamScrollFrame = window.requestAnimationFrame(() => {
    streamScrollFrame = undefined
    void scrollToBottom('auto')
  })
}

const streamingRuntime = createStreamingReplyRuntime({
  onMessageCreated(message) {
    messages.value = [...messages.value, message]
  },
  onMessagePatched(messageId, patch) {
    const index = messages.value.findIndex(item => item.id === messageId)
    if (index < 0) return
    messages.value[index] = {
      ...messages.value[index],
      ...patch
    }
  },
  onMessageRemoved(messageId) {
    messages.value = messages.value.filter(item => item.id !== messageId)
  },
  onStreamingMessageChanged(messageId) {
    streamingMessageId.value = messageId
  },
  onScrollRequested: scheduleStreamScroll
})

const communityUiRepairRuntime = createCommunityUiRepairRuntime()
const assistantStateEffectsRuntime = createAssistantStateEffectsRuntime()
const assistantReplyPersistenceRuntime = createAssistantReplyPersistenceRuntime()
const promptDebugRuntime = createPromptDebugRuntime()
const generationLifecycleRuntime = createGenerationLifecycleRuntime()

async function requestAssistantReply(options?: GenerationRequestOptions) {
  if (!conversation.value || !character.value || !chatSettings.value) return

  manualStopRequested = false
  abortController = new AbortController()
  const signal = abortController.signal
  isSending.value = true
  errorMessage.value = ''
  noticeMessage.value = ''

  const activeConversation = conversation.value
  const activeCharacter = character.value
  const settings = chatSettings.value
  const generationId = crypto.randomUUID()
  const streamSession = createStreamingReplySession({
    generationId,
    conversation: activeConversation,
    type: options?.type,
    proactiveSource: options?.proactiveSource
  })
  const useStreaming = settings.streamResponse && !options?.alternativeTargetId

  let visualMessage: Message | undefined
  let visionUsed = false
  let visionFallback = false
  let requestTraceId: string | undefined

  try {
    const generationContext = await buildGenerationContext({
      conversation: activeConversation,
      character: activeCharacter,
      settings,
      conversationState: conversationState.value,
      messages: messages.value,
      memories: memories.value,
      activePersona: activePersona.value,
      signal,
      requestOptions: options,
      generationId
    })
    modelSettings.value = generationContext.modelSettings
    activePersona.value = generationContext.persona

    const {
      persona,
      macroCharacterName,
      regexMacros,
      activeAssistantRegex,
      assistantStorageRegex,
      displayAssistantRegex,
      regexExecutionTraces,
      latestUserText,
      lorebook,
      communityUiContract,
      presentationHidesCommunityUi,
      runtimeProfile
    } = generationContext
    const rememberRegexTraces = <T extends { traces?: RegexExecutionTrace[] }>(result: T) => {
      if (result.traces?.length) regexExecutionTraces.push(...result.traces)
      return result
    }
    const provider = createProvider(generationContext.modelSettings)
    let currentModelSettings = generationContext.modelSettings
    let response: ChatResponse
    let providerId = provider.id
    let usedModel = currentModelSettings.model
    let providerNotice = ''
    const cumulativeTokenUsage = createGenerationTokenUsage()
    const collectTokenUsage = (result: ChatResponse) => {
      accumulateGenerationTokenUsage(cumulativeTokenUsage, result)
    }
    const createRequest = (includeVision: boolean): ChatRequest => cloneChatRequest(
      includeVision
        ? generationContext.requests.withVision
        : generationContext.requests.withoutVision
    )

    streamSession.preserveRawOutput = generationContext.preserveRawOutput
    streamSession.suppressPreview = generationContext.suppressStreamingPreview
    visualMessage = generationContext.visualMessage
    visionUsed = generationContext.mayUseVision
    visionFallback = Boolean(visualMessage) && !generationContext.mayUseVision

    if (visualMessage) {
      visionImageCount.value = getMessageImageUrls(visualMessage).length
      visionStage.value = 'checking'
    }
    if (visualMessage && !generationContext.mayUseVision) {
      visionStage.value = 'text-only'
      noticeMessage.value = '当前模型已标记为不支持图片理解，将根据图片说明继续回应。'
    }

    const providerRun = await runGenerationProvider({
      context: generationContext,
      provider,
      useStreaming,
      usage: cumulativeTokenUsage,
      onBeforeRequest: async (activeProvider, request) => {
        streamSession.provider = activeProvider.id
        streamSession.model = request.model
        if (!requestTraceId) {
          requestTraceId = await promptDebugRuntime.begin({
            enabled: settings.promptDebugEnabled,
            context: generationContext,
            request,
            providerId: activeProvider.id,
            sourceMessageId: options?.sourceMessageId
          })
        }
      },
      onDelta: chunk => streamingRuntime.appendChunk(streamSession, chunk),
      onVisionStage: stage => {
        visionStage.value = stage
      },
      canRetryWithoutVision: () => !streamSession.text
    })
    response = providerRun.response
    providerId = providerRun.providerId
    usedModel = providerRun.model
    currentModelSettings = providerRun.modelSettings
    modelSettings.value = currentModelSettings
    providerNotice = providerRun.providerNotice
    visionUsed = providerRun.visionUsed
    visionFallback = providerRun.visionFallback
    streamSession.provider = providerId
    streamSession.model = usedModel
    if (providerNotice) noticeMessage.value = providerNotice

    if (options?.proactivePrompt && /<no_proactive_message\s*\/?\s*>/i.test(response.text)) {
      await streamingRuntime.discard(streamSession)
      conversationState.value = await patchConversationState(activeConversation.id, {
        lastProactiveAt: new Date().toISOString()
      })
      return
    }

    const initialAiResponse = response

    // 第一版真实 AI 回复永远保留。Community UI 的状态延续、本地修复、紧凑 AI 补全与失败降级
    // 已下沉到 Generation Runtime；ChatRoom 只提供冻结上下文、Provider 与 Regex 编译能力。
    const compileAssistantCandidate = (rawText: string, storageScripts = assistantStorageRegex) => rememberRegexTraces(compileIncomingMessageRegex({
      rawText,
      source: 'assistant-output',
      scripts: storageScripts,
      displayScripts: displayAssistantRegex,
      depth: 0,
      macros: regexMacros
    }))
    let assistantRegexView = compileAssistantCandidate(response.text)
    const communityUiRepair = await communityUiRepairRuntime.repair({
      contract: communityUiContract,
      initialResponseText: response.text,
      initialCandidate: assistantRegexView,
      compileCandidate: text => compileAssistantCandidate(text, []),
      presentationHidesCommunityUi,
      persona,
      macroCharacterName,
      character: activeCharacter,
      previousMessages: generationContext.messages,
      activatedLorebook: lorebook.activated,
      applyWorldRegex: generationContext.applyWorldRegex,
      conversationState: generationContext.conversationState,
      latestUserText,
      modelSettings: currentModelSettings,
      signal,
      providerChat: request => provider.chat(request),
      createGeneralRepairRequest: () => createRequest(visionUsed),
      collectTokenUsage
    })
    const assistantCanonicalText = communityUiRepair.canonicalText
    assistantRegexView = communityUiRepair.candidate
    const regexDisplay = {
      text: assistantRegexView.displayText,
      applied: [...assistantRegexView.storageApplied, ...assistantRegexView.displayApplied],
      rich: assistantRegexView.rich
    }
    let richReplyHtml = communityUiRepair.richReplyHtml
    let communityUiText = communityUiRepair.communityUiText
    if (communityUiRepair.noticeMessage) noticeMessage.value = communityUiRepair.noticeMessage

    // Repair Runtime 最终决定 canonical 后再解析协议，避免“rawContent 已修复但 status/actions 仍来自旧文本”的双轨状态。
    let parsedOutput = prepareParsedAssistantOutput({
      text: assistantCanonicalText,
      useNativeInteractionProtocol: runtimeProfile.useNativeInteractionProtocol,
      userName: persona.name,
      personaName: persona.name,
      macroCharacterName,
      preserveCardOutput: runtimeProfile.preserveCardOutput,
      communityUiActive: communityUiContract.active
    })
    parsedOutput.warnings.push(...communityUiRepair.warnings)

    // 角色回复内容到这里以后不再做本地语义重写。
    // 应用只校验原卡明确要求的结构；台词、动作、心理、用户事实判断均保留 AI 原始生成结果。
    const finalization = finalizeAssistantReply({
      parsedOutput,
      regexDisplayText: regexDisplay.text,
      regexStorageApplied: assistantRegexView.storageApplied,
      regexDisplayApplied: assistantRegexView.displayApplied,
      richReplyHtml,
      communityUiText,
      communityUiActive: communityUiContract.active,
      canonicalText: assistantCanonicalText,
      character: activeCharacter,
      settings,
      conversationState: generationContext.conversationState,
      runtimeProfile,
      userName: persona.name,
      personaName: persona.name,
      macroCharacterName,
      alternativeTargetId: options?.alternativeTargetId,
      useStreaming
    })
    parsedOutput = finalization.parsedOutput
    const finalVisibleOutput = finalization.finalVisibleOutput
    // Streaming preview may have shown partial raw output, but final persistence must use the canonical Regex storage view.
    streamSession.canonicalText = assistantCanonicalText

    await promptDebugRuntime.complete({
      traceId: requestTraceId,
      context: generationContext,
      providerId,
      model: usedModel,
      response,
      tokenUsage: cumulativeTokenUsage,
      finalVisibleOutput,
      parsedOutput,
      visualMessage
    })
    const stateEffects = await assistantStateEffectsRuntime.apply({
      conversationId: activeConversation.id,
      character: activeCharacter,
      settings,
      beforeState: generationContext.conversationState,
      parsedOutput,
      resourceSession: lorebook.resourceSession,
      nextLorebookRuntimeState: lorebook.nextRuntimeState,
      sourceMessageId: options?.sourceMessageId,
      alternativeTargetId: options?.alternativeTargetId
    }, {
      onMemoryChanged: refreshMemoryList
    })
    if (stateEffects.stateChanged && stateEffects.state) conversationState.value = stateEffects.state
    if (stateEffects.characterChanged) character.value = stateEffects.character

    await assistantReplyPersistenceRuntime.persist({
      conversation: activeConversation,
      character: activeCharacter,
      settings,
      finalization,
      provider: providerId,
      model: usedModel,
      generationId,
      type: options?.type,
      signal,
      streamSession,
      proactiveSource: options?.proactiveSource,
      alternativeTargetId: options?.alternativeTargetId,
      richReplyHtml,
      richSource: regexDisplay.applied.some(name => activeAssistantRegex.some(script => script.name === name && regexProducesRichUi(script)))
        ? 'regex'
        : communityUiContract.active
          ? 'worldbook-ui'
          : 'card-ui',
      canonicalText: assistantCanonicalText,
      modelOutput: initialAiResponse.text,
      communityUiActive: communityUiContract.active,
      communityUiText,
      regexDisplayText: assistantRegexView.displayText
    }, {
      onMessagesChanged(nextMessages) {
        messages.value = nextMessages
      },
      onScrollRequested: () => scrollToBottom(),
      onStreamingMessageChanged(messageId) {
        streamingMessageId.value = messageId
      },
      onClearStreamTimers: clearStreamTimers,
      onNotice(message) {
        noticeMessage.value = message
      }
    })

    // 记忆效果可视化：把本轮召回并注入的记忆记录到生成的助手消息上。
    const recalledMemorySummary = generationContext.memoryHitDetails.map(hit => ({
      id: hit.memory.id,
      content: hit.memory.content,
      layer: hit.memory.layer,
      importance: hit.memory.importance,
      score: hit.score,
      reason: hit.reasons[0]
    }))
    if (recalledMemorySummary.length) {
      const generatedIds = messages.value
        .filter(item => item.generationId === generationId)
        .map(item => item.id)
      if (generatedIds.length) {
        await db.transaction('rw', db.messages, async () => {
          for (const id of generatedIds) {
            await db.messages.update(id, { recalledMemories: recalledMemorySummary })
          }
        })
        messages.value = messages.value.map(item =>
          generatedIds.includes(item.id)
            ? { ...item, recalledMemories: recalledMemorySummary }
            : item
        )
      }
    }

    conversationState.value = await generationLifecycleRuntime.complete({
      conversation: activeConversation,
      settings,
      currentState: conversationState.value,
      messages: messages.value,
      sourceMessageId: options?.sourceMessageId,
      proactiveSource: options?.proactiveSource,
      providerNotice,
      visualMessagePresent: Boolean(visualMessage),
      visionUsed,
      visionFallback
    }, {
      updateUserMessageState
    })

    if (settings.autoReadAloud && speechPlaybackAvailable.value) {
      const latestAssistant = [...messages.value]
        .reverse()
        .find(message => message.senderId !== 'user' && message.type !== 'action' && message.status === 'delivered')
      const spokenText = parsedOutput.messages.filter(item => item.kind === 'text' || item.kind === 'voice').map(item => item.content).filter(Boolean).join('\n') || parsedOutput.visibleText
      speakText(spokenText, latestAssistant?.id ?? '')
    }
  } catch (error) {
    await promptDebugRuntime.recordHttpError(requestTraceId, error)
    const failure = await generationLifecycleRuntime.fail({
      error,
      manualStopRequested,
      conversation: activeConversation,
      sourceMessageId: options?.sourceMessageId,
      visualMessagePresent: Boolean(visualMessage),
      visionUsed,
      visionFallback
    }, {
      updateUserMessageState,
      preserveInterrupted: () => streamingRuntime.preserveInterrupted(streamSession, 'cancelled'),
      discardStream: () => streamingRuntime.discard(streamSession)
    })

    if (!failure.aborted && !isTokenLimitError(error)) {
      console.error('获取角色回复失败：', error)
    }
    if (failure.errorMessage) errorMessage.value = failure.errorMessage
    if (failure.noticeMessage) noticeMessage.value = failure.noticeMessage
    if (failure.state) conversationState.value = failure.state
  } finally {
    isSending.value = false
    manualStopRequested = false
    streamingMessageId.value = ''
    clearStreamTimers()
    abortController = undefined
    visionStage.value = 'idle'
    visionImageCount.value = 0
  }
}

async function send() {
  const text = draft.value.trim()
  const images = pendingImages.value.slice()
  const activeChatSettings = chatSettings.value
  if (
    (!text && !images.length) ||
    failedImages.value.length ||
    !conversation.value ||
    !character.value ||
    !activeChatSettings ||
    isSending.value ||
    isPreparingImage.value
  ) return
  const activeConversation = conversation.value
  const sendPersona = activePersona.value ?? await getPersonaForChat(activeChatSettings)
  activePersona.value = sendPersona
  const sendUserRegex = await listActiveRegexScripts(character.value.id, 'user-input')
  const sendRegexMacros = { user: sendPersona.name, char: characterMacroName(character.value) }
  const userRegexView = compileIncomingMessageRegex({
    rawText: text,
    source: 'user-input',
    scripts: sendUserRegex,
    depth: 0,
    macros: sendRegexMacros
  })
  const canonicalUserText = userRegexView.canonicalText
  const displayUserText = userRegexView.displayText
  const messageId = crypto.randomUUID()
  const now = new Date().toISOString()
  const replyReference = replyTarget.value ? createReplyReference(replyTarget.value) : undefined
  const firstImage = images[0]
  const message: Message = {
    id: messageId,
    worldId: activeConversation.worldId,
    conversationId: activeConversation.id,
    senderId: 'user',
    type: images.length ? 'image' : 'text',
    content: canonicalUserText,
    rawContent: text !== canonicalUserText ? text : undefined,
    displayContent: displayUserText !== canonicalUserText ? displayUserText : undefined,
    regexPipelineVersion: sendUserRegex.length ? 2 : undefined,
    regexApplied: sendUserRegex.length ? { storage: userRegexView.storageApplied, display: userRegexView.displayApplied } : undefined,
    status: 'pending',
    createdAt: now,
    replyTo: replyReference,
    images: images.map(image => ({
      dataUrl: image.dataUrl,
      name: image.name,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
      originalBytes: image.originalBytes,
      originalType: image.originalType,
      outputType: image.outputType,
      processingMode: image.processingMode
    })),
    imageDataUrl: firstImage?.dataUrl,
    imageName: firstImage?.name,
    imageWidth: firstImage?.width,
    imageHeight: firstImage?.height,
    imageBytes: firstImage?.bytes
  }
  draft.value = ''
  pendingImages.value = []
  failedImages.value = []
  imageProgress.value = undefined
  replyTarget.value = undefined
  localStorage.removeItem(draftStorageKey(activeConversation.id))
  chatComposerRef.value?.resize()
  try {
    await db.transaction('rw', db.messages, db.conversations, async () => {
      await db.messages.add(message)
      await db.conversations.update(activeConversation.id, { updatedAt: now })
    })
    await updateUserMessageState(messageId, 'delivered')
    messages.value = await db.messages.where('conversationId').equals(activeConversation.id).sortBy('createdAt')
    await scrollToBottom()
    const sendRuntimeProfile = resolveCharacterRuntimeProfile({
      character: character.value,
      settings: activeChatSettings
    })
    if (canonicalUserText && conversationState.value) {
      const transition = deriveUserSceneTransition(canonicalUserText, conversationState.value)
      if (transition) {
        const beforeState = conversationState.value
        const nextState = await patchConversationState(activeConversation.id, {
          presence: transition.presence,
          presenceResolutionSource: 'user-transition',
          presenceResolutionReason: `${transition.reason}：${transition.evidence}`,
          statusUpdatedAt: now
        })
        await recordConversationStateChanges({ conversationId: activeConversation.id, characterId: character.value.id, before: beforeState, after: nextState, sourceMessageId: messageId })
        conversationState.value = nextState
        if (chatSettings.value && chatSettings.value.presenceMode !== 'auto') {
          chatSettings.value = { ...chatSettings.value, presenceMode: 'auto' }
          await saveChatSettings(chatSettings.value)
        }
        noticeMessage.value = transition.presence === 'together' ? '已根据你的动作更新为同一现场。' : '已根据你的动作更新为远程 / 不在同一现场。'
      }
    }
    if (canonicalUserText && conversationState.value && sendRuntimeProfile.compatibilityMode === 'phone-enhanced') {
      // 只有用户明确开启“小手机增强”时才运行本地话题/待办抽取。
      // 自动/card-first 模式不基于关键词替角色推断剧情目标，避免固定规则污染原卡。
      const beforeState = conversationState.value
      const derivedPatch = deriveUserStatePatch(canonicalUserText, beforeState)
      const nextState = await patchConversationState(activeConversation.id, derivedPatch)
      await recordConversationStateChanges({ conversationId: activeConversation.id, characterId: character.value.id, before: beforeState, after: nextState, sourceMessageId: messageId })
      conversationState.value = nextState
    }
    let memoryWriteNotice = ''
    if (chatSettings.value?.memoryEnabled && canonicalUserText) {
      const memoryWrite = await rememberFromMessageDetailed({
        conversationId: activeConversation.id,
        characterId: character.value.id,
        sourceMessageId: messageId,
        text: canonicalUserText,
        strength: chatSettings.value.memoryStrength
      })
      memoryWriteNotice = buildMemoryWriteNotice(memoryWrite, canonicalUserText)
      await refreshMemoryList()
      if (memoryWrite.conflicts.length) noticeMessage.value = '发现一组记忆冲突，可在主屏幕“记忆”中确认正确版本。'
      // 向量记忆：异步为新记忆生成 embedding，不阻塞发送流程。
      const newMemoryRows = [...memoryWrite.created, ...memoryWrite.merged]
      if (newMemoryRows.length && modelSettings.value?.embeddingEnabled) {
        void import('../services/memoryService').then(({ embedMemories }) =>
          embedMemories(newMemoryRows, modelSettings.value!)
        )
      }
    }
    if (images.length) {
      visionImageCount.value = images.length
      visionStage.value = 'sent'
    }
    await requestAssistantReply({ sourceMessageId: messageId, visualMessageId: images.length ? messageId : undefined, memoryWriteNotice })
  } catch (error) {
    await updateUserMessageState(messageId, 'failed', {
      errorText: error instanceof Error ? error.message : '消息发送失败。'
    })
    noticeMessage.value = error instanceof Error ? error.message : '消息发送失败。'
  }
}

async function handleImagesSelected(files: File[]) {
  if (isSending.value || isPreparingImage.value || !files.length) return
  if (!confirmImagePrivacy()) return

  const occupied = pendingImages.value.length + failedImages.value.length
  const remaining = MAX_CHAT_IMAGES - occupied
  if (remaining <= 0) {
    noticeMessage.value = `已经达到 ${MAX_CHAT_IMAGES} 张上限。`
    return
  }

  const selected = files.slice(0, remaining)
  isPreparingImage.value = true
  imageProgress.value = {
    completed: 0,
    total: selected.length,
    currentName: selected[0]?.name || '图片',
    status: 'processing'
  }

  try {
    const result = await prepareChatImageBatch(selected, {
      maxCount: remaining,
      onProgress: progress => {
        imageProgress.value = progress
      }
    })

    const existingKeys = new Set([
      ...pendingImages.value.map(image => `${image.name}:${image.originalBytes}:${image.originalType}`),
      ...failedImages.value.map(image => `${image.name}:${image.originalBytes}:${image.originalType}`)
    ])

    const uniquePrepared = result.prepared.filter(image => {
      const key = `${image.name}:${image.originalBytes}:${image.originalType}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })
    const uniqueRejected = result.rejected.filter(image => {
      const key = `${image.name}:${image.originalBytes}:${image.originalType}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })

    pendingImages.value.push(...uniquePrepared)
    failedImages.value.push(...uniqueRejected)

    const skippedByLimit = Math.max(0, files.length - remaining)
    const duplicateCount = result.prepared.length + result.rejected.length - uniquePrepared.length - uniqueRejected.length
    const notes: string[] = []
    if (uniquePrepared.length) notes.push(`成功 ${uniquePrepared.length} 张`)
    if (uniqueRejected.length) {
      const failedNames = uniqueRejected.slice(0, 2).map(item => item.name).join('、')
      notes.push(`失败 ${uniqueRejected.length} 张（${failedNames}${uniqueRejected.length > 2 ? '等' : ''}）`)
    }
    if (duplicateCount) notes.push(`重复 ${duplicateCount} 张已跳过`)
    if (skippedByLimit) notes.push(`超出上限 ${skippedByLimit} 张已跳过`)
    noticeMessage.value = notes.join('，') || '没有添加新图片。'

    await nextTick()
    chatComposerRef.value?.focus()
    chatComposerRef.value?.resize()
  } catch (error) {
    noticeMessage.value = error instanceof Error ? error.message : '图片读取失败。'
  } finally {
    isPreparingImage.value = false
    imageProgress.value = undefined
  }
}

function stopGeneration() {
  manualStopRequested = true
  abortController?.abort()
}


async function openThoughtPanel() {
  activePanel.value = 'thought'

  if (!conversationState.value?.thoughtUpdatedAt) {
    await refreshThought()
  }
}

async function refreshThought() {
  if (
    !conversation.value ||
    !character.value ||
    !chatSettings.value ||
    isLoadingThought.value
  ) return

  if (chatSettings.value.innerThoughtVisibility === 'off') return

  isLoadingThought.value = true

  try {
    const currentModel = await getModelSettings()
    const state = await generateVisibleCharacterState({
      provider: createProvider(currentModel),
      model: currentModel.model,
      character: character.value,
      profile: displayUserProfile.value,
      messages: messages.value,
      visibility: chatSettings.value.innerThoughtVisibility
    })

    conversationState.value = await patchConversationState(
      conversation.value.id,
      {
        innerMood: state.mood,
        innerActivity: state.activity,
        innerThought: state.thought,
        thoughtUpdatedAt: new Date().toISOString()
      }
    )
  } catch (error) {
    const technical = error instanceof Error ? error.message : '未知错误'
    errorMessage.value = isTokenLimitError(error)
      ? technical
      : `AI 状态生成失败：${technical}`
    noticeMessage.value = isTokenLimitError(error)
      ? 'Token 不足，本次心理状态生成已停止；没有写入任何本地预设内容。'
      : '本次没有更新心理状态；小手机不会用本地文案补写。'
  } finally {
    isLoadingThought.value = false
  }
}

function openSettings(tab: 'chat' | 'roleplay' | 'memory' | 'advanced' = 'chat') {
  settingsTab.value = tab
  activePanel.value = 'settings'
}

function isOnlyOpeningSeed() {
  if (!messages.value.length) return true
  if (messages.value.some(item => item.senderId === 'user')) return false
  if (messages.value.length === 1) return true
  return messages.value.every(item => item.isGreetingSeed)
}

async function applyCharacterGreeting(greeting: string, greetingIndex: number, source: 'picker' | 'settings' | 'community-ui' = 'settings') {
  if (!conversation.value || !character.value || !greeting.trim()) return

  const resetNeeded = messages.value.length > 0
  if (resetNeeded && !isOnlyOpeningSeed()) {
    const confirmed = window.confirm(
      '切换开场白会清空当前聊天记录、本会话记忆和剧情状态，并从所选开场重新开始。角色卡、Persona、世界书和 Regex 不会删除。\n\n确定切换吗？'
    )
    if (!confirmed) return
  }

  const rawGreeting = greeting.trim()
  const userName = activePersona.value?.name?.trim() || '你'
  const macroResolved = renderCharacterCardPromptText(
    rawGreeting,
    userName,
    characterMacroName(character.value),
    `${conversation.value.id}:greeting:${greetingIndex}`,
    { angleCharacterAliases: detectCharacterCardFamily(character.value) === 'v3' }
  ) || rawGreeting
  const plainSource = normalizeCommunityPlainText(macroResolved)
  const greetingRuntimeProfile = chatSettings.value
    ? resolveCharacterRuntimeProfile({ character: character.value, settings: chatSettings.value })
    : undefined
  const parsedUi = greetingRuntimeProfile?.compatibilityMode === 'card-first'
    ? { content: plainSource, ui: extractRoleCardUiHints(plainSource) }
    : parseRoleCardUi(plainSource)
  const greetingUi = parsedUi.ui || extractRoleCardUiHints(plainSource)
  const uiPatch = roleCardUiToConversationPatch(parsedUi.content, greetingUi, [userName])
  const openingPresence = resolvePresenceFromRoleCardScene(rawGreeting, greetingUi, undefined, [userName]).resolvedPresence
  if (openingPresence) uiPatch.presence = openingPresence
  const greetingActivity = inferCardInitialActivity(macroResolved)
  const greetingRelationship = inferCardInitialRelationship(macroResolved)
  const greetingPresentationHidesUi = chatSettings.value?.conversationPresentationMode !== 'scene-merged'
  const openingUiRuntime = await resolveOpeningCommunityUiRuntime({
    conversation: conversation.value,
    character: character.value,
    settings: chatSettings.value || await getChatSettings(conversation.value.id),
    persona: activePersona.value,
    greetingText: macroResolved
  })
  const greetingAssistantRegex = openingUiRuntime.assistantRegex
  const greetingCommunityUiContract = openingUiRuntime.contract

  const greetingDisplayScripts = greetingPresentationHidesUi
    ? greetingAssistantRegex.filter(item => !regexProducesRichUi(item))
    : greetingAssistantRegex
  const greetingRegexView = compileIncomingMessageRegex({
    rawText: macroResolved,
    source: 'assistant-output',
    scripts: greetingAssistantRegex,
    displayScripts: greetingDisplayScripts,
    depth: 0,
    macros: { user: userName, char: characterMacroName(character.value) }
  })
  const rawIsRich = greetingRegexView.rich || looksLikeRichHtml(greetingRegexView.displayText)
  const greetingAppliedRegex = [...greetingRegexView.storageApplied, ...greetingRegexView.displayApplied]
  const greetingRichRegexNames = new Set(
    greetingAssistantRegex.filter(regexProducesRichUi).map(item => item.name)
  )
  const greetingRichCameFromRegex = greetingAppliedRegex.some(name => greetingRichRegexNames.has(name))
  let isRich = !greetingPresentationHidesUi && rawIsRich
  let displayText = isRich ? greetingRegexView.displayText : normalizeCommunityPlainText(greetingRegexView.displayText)
  let richHtml = isRich ? normalizeRichHtml(displayText) : undefined
  let greetingRichSource: Message['richSource'] | undefined = isRich
    ? (greetingRichCameFromRegex ? 'regex' : greetingCommunityUiContract.active ? 'worldbook-ui' : 'card-ui')
    : undefined

  // Greeting UI Compatibility：如果作者的 WorldBook 声明了固定 HTML UI，而 first_mes 只是
  // 同一套状态数据的纯文本/<br> 版本，本地只把已有内容填回作者模板，不生成任何剧情。
  if (!greetingPresentationHidesUi && !isRich && greetingCommunityUiContract.active) {
    const repairedGreeting = tryRepairCommunityUiLocally(greetingCommunityUiContract, greetingRegexView.displayText)
    if (repairedGreeting.repaired) {
      displayText = repairedGreeting.text
      richHtml = normalizeRichHtml(repairedGreeting.text)
      isRich = true
      greetingRichSource = 'worldbook-ui'
    }
  }

  if (greetingPresentationHidesUi && chatSettings.value && greetingRuntimeProfile?.allowNativeMessageReshaping) {
    const parsedGreeting = parseCompanionOutput(greetingRegexView.displayText, { interpretNativeProtocol: true, userName })
    const shapedGreeting = shapeCompanionActions(
      parsedGreeting.messages,
      character.value,
      chatSettings.value,
      Boolean(parsedGreeting.rawPacket),
      { ...createDefaultConversationState(conversation.value.id), ...(uiPatch || {}), presence: openingPresence || uiPatch.presence } as ConversationState
    )
    displayText = shapedGreeting
      .filter(item => !['typing_pause', 'recall_message', 'react_to_message'].includes(item.kind))
      .map(item => item.kind === 'scene_action' ? `（${item.content}）` : item.content)
      .filter(Boolean)
      .join('\n\n')
      .trim() || normalizeCommunityPlainText(greetingRegexView.displayText)
    isRich = false
    richHtml = undefined
  }

  const preview = isRich
    ? displayText.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280) || '角色卡 UI'
    : displayText
  const canonicalGreeting = greetingRegexView.canonicalText
  const displayProjection = !isRich && displayText !== canonicalGreeting ? displayText : undefined

  const now = new Date().toISOString()
  const conversationId = conversation.value.id
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: conversation.value.worldId,
    conversationId,
    senderId: character.value.id,
    type: isRich ? 'rich' : 'text',
    content: isRich ? preview : canonicalGreeting,
    rawContent: canonicalGreeting,
    displayContent: displayProjection,
    regexPipelineVersion: 2,
    regexApplied: {
      storage: greetingRegexView.storageApplied,
      display: greetingRegexView.displayApplied
    },
    richHtml,
    richSource: isRich ? greetingRichSource : undefined,
    roleCardUi: !greetingPresentationHidesUi && greetingRuntimeProfile?.compatibilityMode === 'phone-enhanced' && !greetingCommunityUiContract.active && !isRich ? greetingUi : undefined,
    isGreetingSeed: true,
    greetingIndex,
    status: 'delivered',
    createdAt: now
  }

  const baseState = createDefaultConversationState(conversationId)
  const nextState: ConversationState = {
    ...baseState,
    innerActivity: '',
    innerThought: '',
    ...uiPatch,
    id: conversationId,
    summary: '',
    summaryMessageCount: 0,
    lastTechnicalError: '',
    lastProviderNotice: '',
    unresolvedTopics: [],
    pendingEvents: [],
    shortTermGoals: [],
    updatedAt: now
  }

  await installConversationGreeting({
    conversationId,
    characterId: character.value.id,
    greetingIndex,
    message,
    state: nextState,
    characterPatch: {
      activity: greetingActivity,
      ...(greetingRelationship ? { relationship: greetingRelationship } : {})
    },
    resetExisting: resetNeeded
  })

  messages.value = [message]
  memories.value = character.value
    ? await listConversationMemoryContext(conversationId, character.value.id)
    : []
  conversationState.value = nextState
  conversation.value = { ...conversation.value, openingMode: 'greeting', greetingIndex, updatedAt: now }
  character.value = {
    ...character.value,
    activity: greetingActivity,
    ...(greetingRelationship ? { relationship: greetingRelationship } : {}),
    updatedAt: now
  }
  activePanel.value = null
  noticeMessage.value = `${greetingIndex === 0 ? '默认开场' : `备用开场 ${greetingIndex}`}已启用${resetNeeded ? '，旧剧情分支已清空' : ''}。`
  await nextTick()
  await scrollToBottom()

  // 从社区开场主页点击 triggerStory(n) 时，不执行原 JS；本地完成同等的安全分支切换。
  if (source === 'community-ui') chatComposerRef.value?.focus()
}

async function useFreeOpening() {
  if (!conversation.value || !character.value) return
  const hasHistory = messages.value.some(item => item.senderId === 'user') || messages.value.some(item => !item.isGreetingSeed)
  if (hasHistory && !window.confirm('切换到自由开局会清空当前聊天、本会话记忆和剧情状态，但不会删除角色卡、Persona、世界书或 Regex。\n\n确定继续吗？')) return
  const id = conversation.value.id
  const result = await switchConversationToFreeOpening(id)
  messages.value = []
  memories.value = await listConversationMemoryContext(id, character.value.id)
  conversationState.value = result.state
  conversation.value = { ...conversation.value, openingMode: 'free', greetingIndex: undefined, updatedAt: result.updatedAt }
  activePanel.value = null
  noticeMessage.value = '已切换为自由开局。角色卡与共享资源仍然正常使用，从你的下一条消息建立当前场景。'
}

async function selectGreetingByIndex(index: number, source: 'picker' | 'settings' | 'community-ui' = 'picker') {
  const greeting = availableGreetings.value[index]
  if (!greeting) {
    noticeMessage.value = `没有找到开场 ${index}。`
    return
  }
  await applyCharacterGreeting(greeting, index, source)
}

async function useRandomGreeting() {
  if (!availableGreetings.value.length) {
    noticeMessage.value = '当前角色没有可用开场。'
    return
  }
  const index = Math.floor(Math.random() * availableGreetings.value.length)
  await selectGreetingByIndex(index, 'picker')
}

async function switchCharacterGreeting(greeting: string) {
  const index = availableGreetings.value.findIndex(item => item === greeting)
  if (index < 0) return
  await applyCharacterGreeting(greeting, index, 'settings')
}

async function persistChatSettings() {
  if (!chatSettings.value) return
  await saveChatSettings(chatSettings.value)
  if (conversation.value && conversationState.value) {
    if (chatSettings.value.presenceMode === 'together' || chatSettings.value.presenceMode === 'remote') {
      conversationState.value = await patchConversationState(conversation.value.id, {
        presence: chatSettings.value.presenceMode,
        presenceResolutionSource: 'manual',
        presenceResolutionReason: `用户手动指定当前相处状态为${chatSettings.value.presenceMode === 'together' ? '同一现场' : '远程 / 不在同一现场'}。`
      })
    } else if (conversationState.value.presenceResolutionSource === 'manual') {
      conversationState.value = await patchConversationState(conversation.value.id, {
        presenceResolutionSource: 'unknown',
        presenceResolutionReason: '已切换为自动场景判断，保留最近确认的相处状态作为连续性参考。'
      })
    }
  }
  activePersona.value = await getPersonaForChat(chatSettings.value)
}


async function clearConversationMessages() {
  if (!conversation.value || !character.value) return
  if (!window.confirm(
    `确定重新开始当前聊天吗？\n\n会删除当前聊天记录、自动生成的剧情记忆、状态历史和 Prompt Debug；手工/导入记忆、角色卡、Persona、世界书和 Regex 会保留。此操作无法撤销。`
  )) return

  const id = conversation.value.id
  const nextOpeningMode = availableGreetings.value.length ? 'pending' : 'free'
  const result = await resetConversationRuntime({
    conversationId: id,
    openingMode: nextOpeningMode,
    greetingIndex: undefined,
    memoryPolicy: 'automatic'
  })

  messages.value = []
  conversationState.value = result.state
  memories.value = await listConversationMemoryContext(id, character.value.id)
  conversation.value = {
    ...conversation.value,
    openingMode: nextOpeningMode,
    greetingIndex: undefined,
    updatedAt: result.updatedAt
  }
  replyTarget.value = undefined
  selectedMessage.value = undefined
  activePanel.value = nextOpeningMode === 'pending' ? 'greeting' : null
  noticeMessage.value = result.deletedMemoryIds.length
    ? `已重新开始聊天，并清理 ${result.deletedMemoryIds.length} 条自动剧情记忆。`
    : '已重新开始聊天。'
}


async function copySelectedMessage() {
  if (!selectedMessage.value) return
  await navigator.clipboard.writeText(selectedMessage.value.displayContent ?? selectedMessage.value.content)
  noticeMessage.value = '已复制。'
  activePanel.value = null
}

function openSelectedMessageEditor() {
  const message = selectedMessage.value
  if (!message) return
  editMessageDraft.value = message.type === 'rich'
    ? (message.rawContent || message.content)
    : message.content
  activePanel.value = 'editor'
}

async function saveSelectedMessageEdit() {
  const message = selectedMessage.value
  if (!message || !character.value || !chatSettings.value || isSavingMessageEdit.value) return

  const rawEdited = editMessageDraft.value.trim()
  if (!rawEdited && message.type !== 'image') {
    noticeMessage.value = '消息内容不能为空。'
    return
  }

  isSavingMessageEdit.value = true
  try {
    const persona = activePersona.value ?? await getPersonaForChat(chatSettings.value)
    activePersona.value = persona
    const source = message.senderId === 'user' ? 'user-input' as const : 'assistant-output' as const
    const scripts = await listActiveRegexScripts(character.value.id, source)
    const regexView = compileIncomingMessageRegex({
      rawText: rawEdited,
      source,
      scripts,
      depth: 0,
      event: 'edit',
      macros: { user: persona.name, char: characterMacroName(character.value) }
    })
    const isRichEdit = message.senderId !== 'user' && regexView.rich && looksLikeRichHtml(regexView.displayText)
    const displayProjection = !isRichEdit && regexView.displayText !== regexView.canonicalText
      ? regexView.displayText
      : undefined
    const patch: Partial<Message> = {
      type: isRichEdit ? 'rich' : (message.type === 'rich' ? 'text' : message.type),
      content: isRichEdit
        ? (regexView.displayText.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || '互动卡片')
        : regexView.canonicalText,
      rawContent: isRichEdit ? regexView.canonicalText : (rawEdited !== regexView.canonicalText ? rawEdited : undefined),
      displayContent: displayProjection,
      richHtml: isRichEdit ? normalizeRichHtml(regexView.displayText) : undefined,
      richSource: isRichEdit ? 'regex' : undefined,
      regexPipelineVersion: scripts.length ? 2 : message.regexPipelineVersion,
      regexApplied: scripts.length ? { storage: regexView.storageApplied, display: regexView.displayApplied } : undefined,
      alternatives: message.senderId === 'user' ? undefined : [regexView.canonicalText],
      activeAlternativeIndex: message.senderId === 'user' ? undefined : 0,
      editedAt: new Date().toISOString()
    }
    await db.messages.update(message.id, patch)
    const index = messages.value.findIndex(item => item.id === message.id)
    if (index >= 0) messages.value[index] = { ...messages.value[index], ...patch }
    selectedMessage.value = index >= 0 ? messages.value[index] : undefined
    const updatedMessage = index >= 0 ? messages.value[index] : undefined
    activePanel.value = null

    if (updatedMessage?.senderId === 'user') {
      noticeMessage.value = scripts.some(item => item.runOnEdit)
        ? '用户消息已编辑；已按作者 runOnEdit Regex 更新。正在从这条消息重新回复。'
        : '用户消息已编辑。正在从这条消息重新回复。'
      await regenerateFromUserMessage(updatedMessage, true)
      return
    }

    noticeMessage.value = scripts.some(item => item.runOnEdit)
      ? '角色消息已编辑；仅执行了作者标记为 runOnEdit 的 Regex。'
      : '角色消息已编辑。'
  } finally {
    isSavingMessageEdit.value = false
  }
}

async function continueSelectedReply() {
  const message = selectedMessage.value
  if (!message || message.senderId === 'user' || isSending.value) return
  activePanel.value = null
  await requestAssistantReply({
    musicPrompt: '<director_instruction>从上一条角色回复自然继续，不要重复已经说过的内容，也不要解释这条指令。</director_instruction>',
    type: message.type === 'music' ? 'music' : 'text'
  })
}

async function branchFromSelectedMessage() {
  const message = selectedMessage.value
  const activeConversation = conversation.value
  if (!message || !activeConversation) return

  const plan = await createConversationBranch({
    conversationId: activeConversation.id,
    selectedMessageId: message.id,
    personaName: activePersona.value?.name?.trim() || '你'
  })

  activePanel.value = null
  noticeMessage.value = '聊天分支已创建，正在进入新的独立剧情。'
  await router.push(`/chat/${plan.conversation.id}`)
}

function replyToSelectedMessage() {
  if (!selectedMessage.value) return
  replyTarget.value = selectedMessage.value
  activePanel.value = null
  void nextTick(() => chatComposerRef.value?.focus())
}

function cancelReply() {
  replyTarget.value = undefined
}

async function deleteSelectedMessage() {
  const message = selectedMessage.value
  if (!message || !conversation.value) return

  const ids = message.replyGroupId
    ? messages.value
      .filter(item => item.replyGroupId === message.replyGroupId)
      .map(item => item.id)
    : [message.id]
  const affectedRows = messages.value.filter(item => ids.includes(item.id))
  const affectedCreatedAt = affectedRows
    .map(item => item.createdAt)
    .sort((a, b) => a.localeCompare(b))[0] || message.createdAt

  await deleteConversationMessagesConsistently({
    conversationId: conversation.value.id,
    messageIds: ids,
    affectedCreatedAt
  })
  messages.value = messages.value.map(item =>
    item.replyTo?.messageId && ids.includes(item.replyTo.messageId)
      ? { ...item, replyTo: undefined }
      : item
  ).filter(item => !ids.includes(item.id))
  conversationState.value = await rebuildAndPersistConversationState({
    conversationId: conversation.value.id,
    retainedMessages: messages.value,
    personaName: activePersona.value?.name?.trim() || '你'
  })
  await refreshMemoryList()

  if (replyTarget.value && ids.includes(replyTarget.value.id)) {
    replyTarget.value = undefined
  }
  selectedMessage.value = undefined
  activePanel.value = null
}

function sourceMessageBefore(message: Message) {
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index < 0) return undefined

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = messages.value[cursor]
    if (candidate.senderId === 'user') return candidate
  }

  return undefined
}


async function applyEditedUserMessageRuntimeEffects(message: Message) {
  if (!conversation.value || !character.value || !chatSettings.value || !message.content.trim()) return
  let state = conversationState.value || await getConversationState(conversation.value.id)
  const now = new Date().toISOString()
  const transition = deriveUserSceneTransition(message.content, state)
  if (transition) {
    const before = state
    state = await patchConversationState(conversation.value.id, {
      presence: transition.presence,
      presenceResolutionSource: 'user-transition',
      presenceResolutionReason: `${transition.reason}：${transition.evidence}`,
      statusUpdatedAt: now
    })
    await recordConversationStateChanges({ conversationId: conversation.value.id, characterId: character.value.id, before, after: state, sourceMessageId: message.id })
    conversationState.value = state
    if (chatSettings.value.presenceMode !== 'auto') {
      chatSettings.value = { ...chatSettings.value, presenceMode: 'auto' }
      await saveChatSettings(chatSettings.value)
    }
  }

  const runtimeProfile = resolveCharacterRuntimeProfile({ character: character.value, settings: chatSettings.value })
  if (runtimeProfile.compatibilityMode === 'phone-enhanced') {
    const before = state
    state = await patchConversationState(conversation.value.id, deriveUserStatePatch(message.content, before))
    await recordConversationStateChanges({ conversationId: conversation.value.id, characterId: character.value.id, before, after: state, sourceMessageId: message.id })
    conversationState.value = state
  }

  if (chatSettings.value.memoryEnabled) {
    const editedMemoryWrite = await rememberFromMessageDetailed({
      conversationId: conversation.value.id,
      characterId: character.value.id,
      sourceMessageId: message.id,
      text: message.content,
      strength: chatSettings.value.memoryStrength
    })
    await refreshMemoryList()
    const editedMemoryRows = [...editedMemoryWrite.created, ...editedMemoryWrite.merged]
    if (editedMemoryRows.length && modelSettings.value?.embeddingEnabled) {
      void import('../services/memoryService').then(({ embedMemories }) =>
        embedMemories(editedMemoryRows, modelSettings.value!)
      )
    }
  }
}

async function regenerateFromUserMessage(message: Message, confirmTruncate = true) {
  if (!conversation.value || !character.value || !chatSettings.value || message.senderId !== 'user' || isSending.value) return
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index < 0) return
  const descendants = messages.value.slice(index + 1)
  if (confirmTruncate && descendants.length) {
    const confirmed = window.confirm('将从这条用户消息重新生成后续剧情。该消息之后现有的回复和后续消息会从当前聊天中移除；角色卡、Persona、资源绑定不会删除。\n\n确定继续吗？')
    if (!confirmed) return
  }

  await truncateConversationAfterMessage({
    conversationId: conversation.value.id,
    anchorMessageId: message.id
  })

  messages.value = messages.value.slice(0, index + 1)
  conversationState.value = await rebuildAndPersistConversationState({
    conversationId: conversation.value.id,
    retainedMessages: messages.value.slice(0, index),
    personaName: activePersona.value?.name?.trim() || '你'
  })
  await applyEditedUserMessageRuntimeEffects(message)
  await updateUserMessageState(message.id, 'delivered')
  activePanel.value = null
  noticeMessage.value = descendants.length ? '已回到编辑后的这条消息，正在重新生成后续回复。' : '正在根据这条消息生成回复。'
  await requestAssistantReply({
    sourceMessageId: message.id,
    visualMessageId: message.type === 'image' ? message.id : undefined
  })
}

async function regenerateSelectedMessage() {
  const message = selectedMessage.value
  if (!message || isSending.value) return
  if (message.senderId === 'user') {
    await regenerateFromUserMessage(message)
    return
  }

  const source = sourceMessageBefore(message)
  activePanel.value = null

  if (chatSettings.value?.swipeRepliesEnabled) {
    await requestAssistantReply({
      sourceMessageId: source?.id,
      visualMessageId: source?.type === 'image' ? source.id : undefined,
      alternativeTargetId: message.id
    })
    return
  }

  await deleteSelectedMessage()
  await requestAssistantReply({
    sourceMessageId: source?.id,
    visualMessageId: source?.type === 'image' ? source.id : undefined
  })
}

async function selectMessageAlternative(message: Message, offset: number) {
  if (message.senderId === 'user' || !message.alternatives?.length) return
  const current = message.activeAlternativeIndex ?? 0
  const next = Math.min(message.alternatives.length - 1, Math.max(0, current + offset))
  if (next === current) return
  const content = message.alternatives[next]
  const patch: Partial<Message> = {
    content,
    activeAlternativeIndex: next
  }
  await db.messages.update(message.id, patch)
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index >= 0) messages.value[index] = { ...messages.value[index], ...patch }
}

async function retryMessage(message: Message) {
  if (message.senderId !== 'user' || isSending.value) return

  await updateUserMessageState(message.id, 'pending')
  activePanel.value = null
  await requestAssistantReply({
    sourceMessageId: message.id,
    visualMessageId: message.type === 'image' ? message.id : undefined
  })
}

async function retrySelectedMessage() {
  const message = selectedMessage.value
  if (!message) return
  await retryMessage(message)
}

function downloadSelectedImage() {
  const message = selectedMessage.value
  const images = getMessageImages(message).filter(image => Boolean(image.dataUrl))
  if (!message || !images.length) return
  images.forEach((image, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a')
      link.href = image.dataUrl || ''
      link.download = image.name || `chat-image-${message.id}-${index + 1}.jpg`
      document.body.appendChild(link)
      link.click()
      link.remove()
    }, index * 160)
  })
  activePanel.value = null
}

function patchMusicState(patch: Partial<MusicState>) {
  if (!musicState.value) return
  musicState.value = { ...musicState.value, ...patch }
}

function seekMusic(value: number) {
  const audio = musicPanelRef.value?.getAudioElement()
  if (!audio || !musicState.value) return
  audio.currentTime = value
  musicState.value.currentTime = value
}

function openMusicPanel() {
  if (!musicState.value) return
  activePanel.value = 'music'
  void nextTick().then(applyAudioState)
}

function applyAudioState() {
  const audio = musicPanelRef.value?.getAudioElement()
  const music = musicState.value
  if (!audio || !music) return

  if (audio.getAttribute('src') !== music.audioUrl && music.audioUrl) {
    audio.src = music.audioUrl
  }

  audio.volume = music.volume
  if (music.currentTime > 0 && Number.isFinite(music.currentTime)) {
    try {
      audio.currentTime = music.currentTime
    } catch {
      // 部分音频在 metadata 加载前不能设置进度。
    }
  }
}

async function handleLocalAudio(file: File) {
  if (!musicState.value) return
  if (localAudioObjectUrl) URL.revokeObjectURL(localAudioObjectUrl)
  localAudioObjectUrl = URL.createObjectURL(file)
  musicState.value = {
    ...musicState.value,
    title: musicState.value.title || file.name.replace(/\.[^.]+$/, ''),
    audioUrl: localAudioObjectUrl,
    sourceType: 'local',
    currentTime: 0,
    isPlaying: false
  }
  await nextTick()
  applyAudioState()
}

async function useMusicUrl() {
  if (!musicState.value) return
  musicState.value.sourceType = 'url'
  musicState.value.currentTime = 0
  musicState.value.isPlaying = false
  await saveMusicState(musicState.value)
  await nextTick()
  applyAudioState()
}

async function toggleMusic() {
  const audio = musicPanelRef.value?.getAudioElement()
  const music = musicState.value
  if (!audio || !music) return

  if (!music.audioUrl) {
    noticeMessage.value = '请先填写音频地址或选择本地音频。'
    return
  }

  try {
    if (audio.paused) {
      await audio.play()
    } else {
      audio.pause()
    }
  } catch (error) {
    noticeMessage.value = error instanceof Error
      ? `无法播放：${error.message}`
      : '无法播放这个音频。'
  }
}

function handleMusicTimeUpdate() {
  const audio = musicPanelRef.value?.getAudioElement()
  const music = musicState.value
  if (!audio || !music) return

  music.currentTime = audio.currentTime
  music.duration = Number.isFinite(audio.duration) ? audio.duration : 0
  const second = Math.floor(audio.currentTime)

  if (second > 0 && second % 5 === 0 && second !== lastMusicSaveSecond) {
    lastMusicSaveSecond = second
    void saveMusicState(music)
  }
}

async function handleMusicPlayState(isPlaying: boolean) {
  if (!musicState.value) return
  musicState.value.isPlaying = isPlaying
  await saveMusicState(musicState.value)
}

async function handleMusicMetadata() {
  const audio = musicPanelRef.value?.getAudioElement()
  if (!audio || !musicState.value) return
  musicState.value.duration = Number.isFinite(audio.duration) ? audio.duration : 0
  applyAudioState()
  await saveMusicState(musicState.value)
}

async function askMusicReaction() {
  const music = musicState.value
  if (!music?.title || isSending.value) {
    noticeMessage.value = '先填写歌曲名称，再邀请对方说说感受。'
    return
  }

  const prompt = [
    `我们正在一起听《${music.title}》${music.artist ? `，歌手是${music.artist}` : ''}。`,
    '请以角色口吻自然地说一两句此刻的陪听感受。',
    '不要说你无法听歌，也不要解释技术限制。'
  ].join('\n')

  activePanel.value = null
  await requestAssistantReply({
    musicPrompt: prompt,
    type: 'music'
  })
}

function formatDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function shouldShowTime(index: number) {
  if (index === 0) return true
  const current = new Date(messages.value[index].createdAt).getTime()
  const previous = new Date(messages.value[index - 1].createdAt).getTime()
  return !Number.isFinite(previous) || current - previous > 5 * 60 * 1000
}

function formatMessageTime(value: string) {
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()

  return date.toLocaleString('zh-CN', sameDay
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

watch(
  () => route.query.message,
  () => { void scrollToLinkedMessage() }
)

watch(
  () => route.params.id,
  value => {
    if (value) {
      abortController?.abort()
      stopSpeechPlayback()
      cancelVoiceRecording()
      void loadConversation(String(value))
    }
  },
  { immediate: true }
)

watch(noticeMessage, value => {
  if (noticeTimer !== undefined) {
    window.clearTimeout(noticeTimer)
    noticeTimer = undefined
  }
  if (!value || value.startsWith('正在')) return
  const current = value
  noticeTimer = window.setTimeout(() => {
    if (noticeMessage.value === current) noticeMessage.value = ''
    noticeTimer = undefined
  }, 3200)
})

watch(draft, value => {
  if (!conversation.value) return
  const key = draftStorageKey(conversation.value.id)
  if (value) localStorage.setItem(key, value)
  else localStorage.removeItem(key)
})

onUnmounted(() => {
  conversationLoadEpoch += 1
  rememberScrollPosition()
  abortController?.abort()
  clearStreamTimers()
  if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
  stopSpeechPlayback()
  if (localAudioObjectUrl) URL.revokeObjectURL(localAudioObjectUrl)
})
</script>

<template>
  <PhoneFrame>
    <template #header>
      <ChatHeader
        :title="title"
        :character="character"
        @back="router.back()"
        @open-thought="openThoughtPanel"
        @open-music="openMusicPanel"
        @open-settings="openSettings()"
      />
    </template>

    <section class="chat-page">
      <button
        v-if="musicState?.isPlaying && currentTrackLabel"
        class="now-playing-pill"
        type="button"
        @click="openMusicPanel"
      >
        <span>♫</span>
        正在一起听 {{ currentTrackLabel }}
      </button>

      <button
        v-if="errorMessage"
        class="chat-error"
        type="button"
        @click="openSettings('advanced')"
      >
        {{ errorMessage }}
        <small>点击查看详情</small>
      </button>

      <Transition name="chat-notice">
        <div v-if="noticeMessage" class="chat-notice" role="status" aria-live="polite">
          <span>{{ noticeMessage }}</span>
          <button type="button" aria-label="关闭提示" @click="noticeMessage = ''">×</button>
        </div>
      </Transition>

      <ChatMessageList
        ref="messageListRef"
        :messages="messages"
        :conversation="conversation"
        :character="character"
        :user-profile="displayUserProfile"
        :is-sending="isSending"
        :show-typing="Boolean(chatSettings?.showTyping || visionImageCount)"
        :streaming-message-id="streamingMessageId"
        :sending-hint="sendingHint"
        :speech-available="speechPlaybackAvailable"
        :should-show-time="shouldShowTime"
        :format-message-time="formatMessageTime"
        :speech-state-for-message="speechStateForMessage"
        @scroll="handleMessageScroll"
        @open-menu="openMessageMenu"
        @open-images="openImagePreview"
        @toggle-speech="toggleMessageSpeech"
        @stop-speech="stopSpeechPlayback"
        @retry-message="retryMessage"
        @select-alternative="selectMessageAlternative"
        @select-greeting="selectGreetingByIndex($event, 'community-ui')"
        @feedback="handleFeedback"
      />

      <button
        v-if="showScrollButton"
        class="scroll-bottom-button"
        type="button"
        aria-label="回到最新消息"
        @click="scrollToBottom()"
      >
        ↓
      </button>

      <ChatComposer
        ref="chatComposerRef"
        v-model="draft"
        :pending-images="pendingImages"
        :failed-images="failedImages"
        :image-progress="imageProgress"
        :max-images="MAX_CHAT_IMAGES"
        :reply-sender="replyTarget ? messageSenderName(replyTarget) : undefined"
        :reply-preview="replyTarget ? messagePreview(replyTarget, 56) : undefined"
        :is-sending="isSending"
        :is-preparing-image="isPreparingImage"
        :can-send="canSend"
        :voice-input-available="voiceInputAvailable"
        :is-recording="isRecording"
        :is-recognizing="isRecognizingSpeech"
        :recording-seconds="recordingSeconds"
        @submit="send"
        @images-selected="handleImagesSelected"
        @remove-image="removePendingImage"
        @move-image="movePendingImage"
        @use-original-image="useOriginalPendingImage"
        @retry-failed-image="retryFailedImage($event)"
        @use-original-failed-image="retryFailedImage($event, true)"
        @remove-failed-image="removeFailedImage"
        @clear-images="clearPendingImages"
        @preview-images="previewPendingImages"
        @cancel-reply="cancelReply"
        @stop="stopGeneration"
        @focus="handleComposerFocus"
        @start-recording="startVoiceRecording"
        @stop-recording="stopVoiceRecording"
        @cancel-recording="cancelVoiceRecording"
      />

      <div
        v-if="activePanel"
        class="panel-backdrop"
        @click.self="activePanel !== 'greeting' && (activePanel = null)"
      >
        <ChatGreetingPicker
          v-if="activePanel === 'greeting'"
          :title="title"
          :greetings="availableGreetings"
          :required="requiresInitialGreetingChoice"
          :panel-style="panelStyle"
          @select="selectGreetingByIndex($event, 'picker')"
          @free="useFreeOpening"
          @random="useRandomGreeting"
          @close="activePanel = null"
        />

        <ChatThoughtPanel
          v-else-if="activePanel === 'thought'"
          :title="title"
          :character="character"
          :conversation-state="displayedConversationState"
          :chat-settings="chatSettings"
          :user-name="activePersona?.name"
          :is-loading="isLoadingThought"
          :panel-style="panelStyle"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @refresh="refreshThought"
          @close="activePanel = null"
        />

        <ChatMusicPanel
          v-else-if="activePanel === 'music'"
          ref="musicPanelRef"
          :title="title"
          :music-state="musicState"
          :is-sending="isSending"
          :panel-style="panelStyle"
          :format-duration="formatDuration"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @patch="patchMusicState"
          @local-audio="handleLocalAudio"
          @use-url="useMusicUrl"
          @toggle="toggleMusic"
          @time-update="handleMusicTimeUpdate"
          @play-state="handleMusicPlayState"
          @metadata="handleMusicMetadata"
          @seek="seekMusic"
          @reaction="askMusicReaction"
          @close="activePanel = null"
        />

        <ChatSettingsPanel
          v-else-if="activePanel === 'settings'"
          :title="title"
          :tab="settingsTab"
          :chat-settings="chatSettings"
          :speech-playback-available="speechPlaybackAvailable"
          :speech-voices="speechVoices"
          :provider-label="providerLabel"
          :vision-capability-label="visionCapabilityLabel"
          :model-settings="modelSettings"
          :conversation-state="displayedConversationState"
          :personas="personas"
          :greetings="availableGreetings"
          :panel-style="panelStyle"
          @update:tab="settingsTab = $event"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @close="activePanel = null"
          @persist="persistChatSettings"
          @preview-voice="previewCurrentVoice"
          @clear-conversation="clearConversationMessages"
          @open-model-settings="router.push('/settings/models')"
          @open-personas="router.push('/settings/personas')"
          @open-lorebook="router.push({ path: '/world', query: { character: character?.id || '', tab: 'lorebooks' } })"
          @open-character-card="character && router.push(`/characters/${character.id}/card`)"
          @open-prompt-debug="conversation && router.push(`/chat/${conversation.id}/debug`)"
          @use-greeting="switchCharacterGreeting"
          @use-free-greeting="useFreeOpening"
        />

        <ChatMessageEditor
          v-else-if="activePanel === 'editor'"
          v-model="editMessageDraft"
          :sender-label="selectedMessage?.senderId === 'user' ? '我发出的消息' : `${title} 的消息`"
          :is-saving="isSavingMessageEdit"
          :panel-style="panelStyle"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @save="saveSelectedMessageEdit"
          @close="activePanel = null"
        />

        <ChatActionSheet
          v-else-if="activePanel === 'message'"
          :message="selectedMessage"
          :preview="selectedMessage ? messagePreview(selectedMessage, 90) : ''"
          :is-sending="isSending"
          :swipe-replies-enabled="chatSettings?.swipeRepliesEnabled"
          :panel-style="panelStyle"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @reply="replyToSelectedMessage"
          @copy="copySelectedMessage"
          @edit="openSelectedMessageEditor"
          @continue-reply="continueSelectedReply"
          @branch="branchFromSelectedMessage"
          @download-image="downloadSelectedImage"
          @retry="retrySelectedMessage"
          @regenerate="regenerateSelectedMessage"
          @delete="deleteSelectedMessage"
          @close="activePanel = null"
        />
      </div>

      <ChatImagePreview
        :images="previewImages"
        :current-index="previewImageIndex"
        @update:current-index="previewImageIndex = $event"
        @download="downloadPreviewImage"
        @close="previewImages = []"
      />
    </section>
  </PhoneFrame>
</template>

<style scoped src="./ChatRoom.css"></style>
