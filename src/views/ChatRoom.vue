<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ChatHeader from '../components/chat/ChatHeader.vue'
import ChatMessageList from '../components/chat/ChatMessageList.vue'
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
import {
  isTokenLimitError,
  isVisionUnsupportedError,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatTurn,
  type ModelProvider
} from '../services/ai/provider'
import { createProvider } from '../services/ai/providerFactory'
import { getModelSettings, getVisionCapability, saveVisionCapability } from '../services/modelSettings'
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
  addMemory,
  buildMemoryPrompt,
  clearMemories,
  createLocalSummary,
  listMemories,
  rememberCharacterObservation,
  rememberFromMessageDetailed,
  buildMemoryWriteNotice,
  removeMemory,
  recordMemoryHits,
  selectMemoryHitsDetailed
} from '../services/memoryService'
import { generateVisibleCharacterState } from '../services/characterStateService'
import { inferCardInitialActivity, inferCardInitialRelationship } from '../services/characterInitialStateService'
import { collectCharacterGreetings } from '../services/characterGreetingService'
import { planProactiveMessage } from '../services/proactiveMessageService'
import { getOrCreateUserProfile } from '../services/userProfile'
import { getPersonaForChat, listPersonas } from '../services/personaService'
import { buildLorebookPrompt } from '../services/lorebookService'
import { composeRoleplaySystemPrompt } from '../services/promptComposer'
import { applyRegexScripts, listActiveRegexScripts, looksLikeRichHtml, normalizeCommunityPlainText, normalizeRichHtml } from '../services/regexRuntime'
import { composeWithPromptPreset, getActivePromptPreset } from '../services/presetRuntime'
import { buildCommunityUiPriorityPrompt, buildCommunityUiRepairPrompt, communityUiOutputConforms, detectCommunityUiContract, enforceUserMessageOwnershipInRichHtml, regexProducesRichUi, sanitizeCommunityUiText, tryRepairCommunityUiLocally } from '../services/communityUiRuntime'
import { resolveCharacterRuntimeProfile } from '../services/characterRuntimeProfile'
import { renderRoleplayText } from '../services/textMacroService'
import { buildPresentationOverridePrompt, estimateVoiceDuration, mergeStatusIntoConversationState, naturalnessWarnings, parseCompanionOutput, resolvePresenceMode, scoreNaturalness, shapeCompanionActions, visibleStreamingText, type CompanionActionMessage, type ParsedCompanionOutput } from '../services/interactionProtocol'
import { extractRoleCardUiHints, parseRoleCardUi, resolvePresenceFromRoleCardScene, roleCardUiToConversationPatch } from '../services/roleCardUiService'
import { analyzePromptSections, buildRuleInfluences, buildTruncationNotes, estimatePromptCharacters, patchPromptDebugTrace, savePromptDebugTrace } from '../services/promptDebugService'
import { buildConversationStatePrompt, buildUserSceneTransitionPrompt, deriveUserSceneTransition, deriveUserStatePatch, recordConversationStateChanges } from '../services/stateHistoryService'
import type {
  Character,
  CharacterMemory,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  MessageReplyReference,
  PromptDebugTrace,
  ProactiveSource,
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
const newMemoryText = ref('')
const settingsTab = ref<'chat' | 'roleplay' | 'memory' | 'advanced'>('chat')
const activePanel = ref<'thought' | 'music' | 'settings' | 'message' | 'greeting' | null>(null)
const selectedMessage = ref<Message>()
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
let streamPersistTimer: number | undefined
let streamScrollFrame: number | undefined
let localAudioObjectUrl = ''
let lastMusicSaveSecond = -1

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

const memoryCategoryNames: Record<CharacterMemory['category'], string> = {
  profile: '个人信息',
  preference: '喜好',
  relationship: '关系',
  event: '事件',
  promise: '约定',
  other: '日常'
}

function draftStorageKey(conversationId: string) {
  return `ai-companion-draft:${conversationId}`
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === 'AbortError'
  ) || (
    error instanceof Error &&
    error.name === 'AbortError'
  )
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('请求已取消', 'AbortError'))
      },
      { once: true }
    )
  })
}

function messagePreview(message: Message, maxLength = 42) {
  if (message.recalledAt) return '[已撤回的消息]'
  if (message.type === 'action') return `[动作] ${message.content}`
  if (message.type === 'image') {
    const caption = message.content.trim()
    return caption ? `[图片] ${caption}` : '[图片]'
  }
  if (message.type === 'voice') return `[语音] ${message.content}`
  if (message.type === 'emoji') return `[表情] ${message.content}`
  const text = message.content.replace(/\s+/g, ' ').trim()
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

function chatTurnContentText(content: ChatTurn['content']) {
  if (typeof content === 'string') return content
  return content.filter(part => part.type === 'text').map(part => part.text).join('\n')
}

function formatMessageForPrompt(message: Message) {
  const promptContent = message.type === 'rich' ? (message.rawContent || message.content) : message.content
  const caption = promptContent.trim()
  const imageCount = getMessageImages(message).length
  const base = message.type === 'image' && message.placeholderImagePrompt
    ? `<shared_image_description>${message.placeholderImagePrompt}</shared_image_description>`
    : message.type === 'image'
    ? [
      `<image_share count="${imageCount || 1}" details="unavailable">`,
      caption ? `用户附言：${caption}` : '用户没有附言。',
      '图片细节当前不可用。只回应用户的附言、分享行为和关系语境；不要猜测细节，也不要解释技术原因。',
      '</image_share>'
    ].join('\n')
    : message.type === 'voice'
      ? `<voice_message>${message.content}</voice_message>`
      : message.type === 'action'
        ? `<scene_action>${message.content}</scene_action>`
      : message.type === 'emoji'
        ? `<emoji_message>${message.content}</emoji_message>`
        : /^(?:\/ooc\b|ooc\s*[：:])/i.test(promptContent.trim())
          ? `<director_instruction>${promptContent.trim().replace(/^(?:\/ooc\b|ooc\s*[：:])\s*/i, '')}</director_instruction>`
          : promptContent
  if (!message.replyTo) return base
  return `这条消息是在回复${message.replyTo.senderName}的“${message.replyTo.preview}”。\n${base}`
}

function imageMessageContent(message: Message): ChatTurn['content'] {
  const images = getMessageImages(message).filter(image => Boolean(image.dataUrl))
  const caption = message.content.trim()
  const text = [
    `<visual_input count="${images.length}">`,
    caption ? `用户附言：${caption}` : '用户没有附言。',
    '请在内部按顺序观察图片。最终只输出角色会自然发出的消息，不要先汇报图片数量、文件名、构图或分析过程。',
    '</visual_input>'
  ].join('\n')

  return [
    {
      type: 'text',
      text: message.replyTo
        ? `这条消息是在回复${message.replyTo.senderName}的“${message.replyTo.preview}”。\n${text}`
        : text
    },
    ...images.map(image => ({
      type: 'image_url' as const,
      image_url: { url: image.dataUrl || '', detail: 'auto' as const }
    }))
  ]
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

async function loadConversation(conversationId: string) {
  errorMessage.value = ''
  pendingImages.value = []
  failedImages.value = []
  imageProgress.value = undefined
  previewImages.value = []
  replyTarget.value = undefined

  try {
    const conversationRow = await db.conversations.get(conversationId)

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
      listMemories(conversationId),
      getModelSettings(),
      listPersonas()
    ])

    const legacyPlainNormalized = await normalizeLegacyCommunityPlainMessages(messageRows)
    const withoutSyntheticPhoneActions = await removeLegacySyntheticPhoneActions(legacyPlainNormalized)
    const legacySceneNormalized = await normalizeLegacySceneActionMessages(withoutSyntheticPhoneActions, conversationId, characterRow, settingsRow, stateRow)
    const effectiveStateRow = legacySceneNormalized.state || stateRow
    const recoveredMessageRows =
      await recoverInterruptedMessages(legacySceneNormalized.rows)
    const loadedRuntimeProfile = characterRow
      ? resolveCharacterRuntimeProfile({ character: characterRow, settings: settingsRow })
      : undefined
    const visibleMessageRows = recoveredMessageRows.map(row =>
      loadedRuntimeProfile?.preserveCardOutput && row.roleCardUi ? { ...row, roleCardUi: undefined } : row
    )

    conversation.value = conversationRow
    messages.value = visibleMessageRows
    character.value = characterRow
    userProfile.value = profileRow
    chatSettings.value = settingsRow
    conversationState.value = effectiveStateRow
    musicState.value = musicRow
    memories.value = memoryRows
    modelSettings.value = modelRow
    personas.value = personaRows.filter(item => !item.boundCharacterId || item.boundCharacterId === characterRow?.id)
    activePersona.value = await getPersonaForChat(settingsRow)
    draft.value = localStorage.getItem(draftStorageKey(conversationId)) ?? ''

    if (musicRow.sourceType === 'local') {
      musicState.value = {
        ...musicRow,
        audioUrl: '',
        isPlaying: false
      }
    }

    if (conversationRow.unread > 0) {
      await db.conversations.update(conversationRow.id, { unread: 0 })
      conversation.value = { ...conversationRow, unread: 0 }
    }

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
        state: effectiveStateRow
      })
      : null

    await restoreScrollPosition(conversationId)
    await nextTick()
    const greetingRows = collectCharacterGreetings(characterRow?.firstMessage, characterRow?.alternateGreetings)
    const hasUserHistory = recoveredMessageRows.some(item => item.senderId === 'user')
    if (conversationRow.openingMode === 'pending' && !hasUserHistory) {
      if (greetingRows.length) activePanel.value = 'greeting'
      else {
        await db.conversations.update(conversationRow.id, { openingMode: 'free' })
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
        if (conversation.value?.id !== conversationId || isSending.value) return
        void requestAssistantReply({
          proactivePrompt: proactivePlan.instruction,
          proactiveSource: proactivePlan.source
        })
      }, 0)
    }
  } catch (error) {
    console.error('读取聊天失败：', error)
    errorMessage.value = error instanceof Error
      ? `聊天加载失败：${error.message}`
      : '聊天加载失败。'
  }
}

async function refreshMemoryList() {
  if (!conversation.value) return
  memories.value = await listMemories(conversation.value.id)
}

async function updateSummaryIfNeeded() {
  if (!conversation.value || !conversationState.value || !chatSettings.value) return
  if (!chatSettings.value.memoryEnabled) return

  const count = messages.value.length
  const previousCount = conversationState.value.summaryMessageCount

  if (count < 28 || count - previousCount < 12) return

  const summary = createLocalSummary(messages.value)
  if (!summary) return

  conversationState.value = await patchConversationState(
    conversation.value.id,
    {
      summary,
      summaryMessageCount: count
    }
  )
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


interface StreamingReplySession {
  messageId?: string
  rawText: string
  text: string
  provider: string
  model: string
  type: Message['type']
  conversation: Conversation
  suppressPreview?: boolean
  preserveRawOutput?: boolean
  proactiveSource?: ProactiveSource
}

function clearStreamTimers() {
  if (streamPersistTimer !== undefined) {
    window.clearTimeout(streamPersistTimer)
    streamPersistTimer = undefined
  }

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

async function ensureStreamingMessage(
  session: StreamingReplySession
) {
  if (session.messageId) return

  const now = new Date().toISOString()
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: session.conversation.worldId,
    conversationId: session.conversation.id,
    senderId: session.conversation.memberIds[0],
    type: session.type,
    content: session.text,
    status: 'pending',
    createdAt: now,
    provider: session.provider,
    model: session.model,
    proactiveSource: session.proactiveSource,
    replyGroupId: crypto.randomUUID()
  }

  await db.transaction(
    'rw',
    db.messages,
    db.conversations,
    async () => {
      await db.messages.add(message)
      await db.conversations.update(
        session.conversation.id,
        { updatedAt: now }
      )
    }
  )

  session.messageId = message.id
  streamingMessageId.value = message.id
  messages.value = [...messages.value, message]
  scheduleStreamScroll()
}

function scheduleStreamPersistence(
  session: StreamingReplySession
) {
  if (!session.messageId) return

  if (streamPersistTimer !== undefined) {
    window.clearTimeout(streamPersistTimer)
  }

  streamPersistTimer = window.setTimeout(() => {
    streamPersistTimer = undefined

    if (!session.messageId) return

    void db.messages.update(
      session.messageId,
      {
        content: session.text,
        provider: session.provider,
        model: session.model,
      }
    )
  }, 140)
}

async function appendStreamChunk(
  session: StreamingReplySession,
  chunk: ChatStreamChunk
) {
  session.rawText = chunk.text
  session.text = session.preserveRawOutput ? chunk.text : visibleStreamingText(chunk.text)
  if (!session.text || session.suppressPreview) return

  await ensureStreamingMessage(session)

  const index = messages.value.findIndex(
    item => item.id === session.messageId
  )

  if (index >= 0) {
    messages.value[index] = {
      ...messages.value[index],
      content: session.text,
      provider: session.provider,
      model: session.model,
        status: 'pending'
    }
  }

  scheduleStreamPersistence(session)
  scheduleStreamScroll()
}

async function flushStreamingMessage(
  session: StreamingReplySession
) {
  if (streamPersistTimer !== undefined) {
    window.clearTimeout(streamPersistTimer)
    streamPersistTimer = undefined
  }

  if (!session.messageId) return

  await db.messages.update(
    session.messageId,
    {
      content: session.text,
      provider: session.provider,
      model: session.model,
    }
  )
}

async function finishStreamingMessage(
  session: StreamingReplySession,
  output: ParsedCompanionOutput,
  multiBubble: boolean,
  allowNativeMessageReshaping = true
) {
  const renderState = output.status?.presence
    ? ({ ...(conversationState.value || {}), presence: output.status.presence } as ConversationState)
    : conversationState.value
  const actions = character.value && chatSettings.value && allowNativeMessageReshaping
    ? shapeCompanionActions(output.messages.slice(), character.value, { ...chatSettings.value, multiBubble }, Boolean(output.rawPacket), renderState)
    : output.messages.slice()
  if (!actions.length) throw new Error('模型没有返回有效回复。')
  session.text = actions.map(item => item.content).join('\n\n')
  const canReuse = Boolean(session.messageId) && actions.length === 1 && actions[0].kind === 'text' && session.type !== 'voice' && session.type !== 'emoji'
  if (canReuse && session.messageId) {
    const visibleRoleCardUi = chatSettings.value?.conversationPresentationMode === 'scene-merged' ? output.roleCardUi : undefined
    await db.messages.update(session.messageId, { content: actions[0].content, rawContent: session.rawText || undefined, status: 'delivered', provider: session.provider, model: session.model, errorText: undefined, protocolVersion: output.rawPacket ? 2 : undefined, roleCardUi: visibleRoleCardUi, proactiveSource: session.proactiveSource })
  } else {
    const visibleRoleCardUi = chatSettings.value?.conversationPresentationMode === 'scene-merged' ? output.roleCardUi : undefined
    await saveAssistantActions({ actions, provider: session.provider, model: session.model, type: session.type, replaceMessageId: session.messageId, roleCardUi: visibleRoleCardUi, proactiveSource: session.proactiveSource, rawContent: session.rawText || undefined })
  }
  messages.value = await db.messages.where('conversationId').equals(session.conversation.id).sortBy('createdAt')
  streamingMessageId.value = ''
  session.messageId = undefined
  clearStreamTimers()
  await scrollToBottom('auto')
}

async function discardStreamingMessage(session: StreamingReplySession) {
  if (streamPersistTimer !== undefined) {
    window.clearTimeout(streamPersistTimer)
    streamPersistTimer = undefined
  }
  if (session.messageId) {
    await db.messages.delete(session.messageId)
    messages.value = messages.value.filter(item => item.id !== session.messageId)
  }
  streamingMessageId.value = ''
  session.messageId = undefined
  session.text = ''
  session.rawText = ''
  clearStreamTimers()
}

async function preserveInterruptedStream(
  session: StreamingReplySession,
  status: 'cancelled' | 'failed',
  errorText?: string
) {
  if (!session.messageId || !session.text.trim()) {
    if (session.messageId) {
      await db.messages.delete(session.messageId)
      messages.value = messages.value.filter(
        item => item.id !== session.messageId
      )
    }

    streamingMessageId.value = ''
    session.messageId = undefined
    clearStreamTimers()
    return false
  }

  await flushStreamingMessage(session)
  await db.messages.update(
    session.messageId,
    {
      content: session.text.trim(),
      status,
      errorText,
      provider: session.provider,
      model: session.model,
    }
  )

  const index = messages.value.findIndex(
    item => item.id === session.messageId
  )

  if (index >= 0) {
    messages.value[index] = {
      ...messages.value[index],
      content: session.text.trim(),
      status,
      errorText,
      provider: session.provider,
      model: session.model,
    }
  }

  streamingMessageId.value = ''
  session.messageId = undefined
  clearStreamTimers()
  return true
}

function actionMessageType(action: CompanionActionMessage, baseType?: Message['type']): Message['type'] {
  if (action.kind === 'scene_action') return 'action'
  if (action.kind === 'emoji') return 'emoji'
  if (action.kind === 'voice') return 'voice'
  if (action.kind === 'image_placeholder') return 'image'
  return baseType === 'music' ? 'music' : 'text'
}
function messagePacingDelay(action: CompanionActionMessage, index: number) {
  if (action.kind === 'typing_pause') return action.delayMs ?? 620
  if (index === 0 || !chatSettings.value?.naturalDelay) return action.delayMs ?? 0
  const pacing = chatSettings.value.messagePacing ?? 'natural'
  if (pacing === 'off') return action.delayMs ?? 0
  const speedFactor = character.value?.replySpeed === 'slow' ? 1.35 : character.value?.replySpeed === 'instant' ? .65 : 1
  const base = pacing === 'quick' ? 260 : pacing === 'slow' ? 760 : 430
  const perCharacter = action.kind === 'emoji' ? 0 : pacing === 'slow' ? 17 : 11
  return Math.max(action.delayMs ?? 0, Math.round((base + Math.min(1400, action.content.length * perCharacter)) * speedFactor))
}
function resolveActionTarget(targetMessageId: string | undefined, sender: 'user' | 'assistant') {
  if (targetMessageId && targetMessageId !== 'latest_user' && targetMessageId !== 'latest_assistant') {
    return messages.value.find(item => item.id === targetMessageId)
  }
  const wantUser = targetMessageId === 'latest_user' || sender === 'user'
  return [...messages.value].reverse().find(item => wantUser ? item.senderId === 'user' : item.senderId !== 'user')
}
async function saveAssistantActions(options: { actions: CompanionActionMessage[]; provider: string; model: string; type?: Message['type']; signal?: AbortSignal; replaceMessageId?: string; roleCardUi?: Message['roleCardUi']; proactiveSource?: ProactiveSource; rawContent?: string }) {
  if (!conversation.value || !options.actions.length) return
  const activeConversation = conversation.value
  const groupId = crypto.randomUUID()
  let roleCardUiAssigned = false
  let rawContentAssigned = false
  if (options.replaceMessageId) {
    await db.messages.delete(options.replaceMessageId)
    messages.value = messages.value.filter(item => item.id !== options.replaceMessageId)
  }

  for (let index = 0; index < options.actions.length; index += 1) {
    if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError')
    const action = options.actions[index]
    const delay = messagePacingDelay(action, index)
    if (delay > 0) await wait(delay, options.signal)

    if (action.kind === 'typing_pause') continue

    if (action.kind === 'recall_message') {
      const target = resolveActionTarget(action.targetMessageId, 'assistant')
      if (target && target.senderId !== 'user' && !target.recalledAt) {
        const recalledAt = new Date().toISOString()
        await db.messages.update(target.id, {
          recalledAt,
          recalledOriginalContent: target.content,
          content: '',
          alternatives: undefined,
          activeAlternativeIndex: undefined,
          protocolVersion: 2
        })
        const targetIndex = messages.value.findIndex(item => item.id === target.id)
        if (targetIndex >= 0) messages.value[targetIndex] = { ...messages.value[targetIndex], recalledAt, recalledOriginalContent: target.content, content: '', alternatives: undefined, activeAlternativeIndex: undefined, protocolVersion: 2 }
      }
      continue
    }

    if (action.kind === 'react_to_message') {
      const target = resolveActionTarget(action.targetMessageId || 'latest_user', 'user')
      if (target && action.content) {
        await db.messages.update(target.id, { reactionEmoji: action.content.slice(0, 8), reactionToMessageId: target.id, protocolVersion: 2 })
        const targetIndex = messages.value.findIndex(item => item.id === target.id)
        if (targetIndex >= 0) messages.value[targetIndex] = { ...messages.value[targetIndex], reactionEmoji: action.content.slice(0, 8), reactionToMessageId: target.id, protocolVersion: 2 }
      }
      continue
    }

    const now = new Date(Date.now() + index).toISOString()
    const type = actionMessageType(action, options.type)
    const message: Message = {
      id: crypto.randomUUID(),
      worldId: activeConversation.worldId,
      conversationId: activeConversation.id,
      senderId: activeConversation.memberIds[0],
      type,
      content: action.kind === 'image_placeholder' ? '' : action.content,
      rawContent: !rawContentAssigned && options.rawContent ? options.rawContent : undefined,
      status: 'delivered',
      createdAt: now,
      roleCardUi: !roleCardUiAssigned && options.roleCardUi ? options.roleCardUi : undefined,
      provider: options.provider,
      model: options.model,
      proactiveSource: options.proactiveSource,
      replyGroupId: groupId,
      replySequence: index,
      voiceDurationSeconds: type === 'voice' ? estimateVoiceDuration(action.content) : undefined,
      placeholderImagePrompt: action.kind === 'image_placeholder' ? action.content : undefined,
      protocolVersion: 2
    }
    if (message.roleCardUi) roleCardUiAssigned = true
    if (message.rawContent) rawContentAssigned = true
    await db.transaction('rw', db.messages, db.conversations, async () => {
      await db.messages.add(message)
      await db.conversations.update(activeConversation.id, { updatedAt: now })
    })
    messages.value = await db.messages.where('conversationId').equals(activeConversation.id).sortBy('createdAt')
    await scrollToBottom()
  }
}
async function saveRichAssistantMessage(options: { html: string; rawContent: string; provider: string; model: string; source?: Message['richSource']; replaceMessageId?: string; proactiveSource?: ProactiveSource }) {
  if (!conversation.value || !character.value) return
  const activeConversation = conversation.value
  if (options.replaceMessageId) {
    await db.messages.delete(options.replaceMessageId)
    messages.value = messages.value.filter(item => item.id !== options.replaceMessageId)
  }
  const now = new Date().toISOString()
  const preview = options.html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: activeConversation.worldId,
    conversationId: activeConversation.id,
    senderId: activeCharacterId(),
    type: 'rich',
    content: preview || '互动卡片',
    rawContent: options.rawContent,
    richHtml: options.html,
    richSource: options.source || 'regex',
    status: 'delivered',
    provider: options.provider,
    model: options.model,
    proactiveSource: options.proactiveSource,
    createdAt: now
  }
  await db.transaction('rw', db.messages, db.conversations, async () => {
    await db.messages.add(message)
    await db.conversations.update(activeConversation.id, { updatedAt: now })
  })
  messages.value = await db.messages.where('conversationId').equals(activeConversation.id).sortBy('createdAt')
  streamingMessageId.value = ''
  clearStreamTimers()
  await scrollToBottom('auto')
}

function activeCharacterId() {
  return conversation.value?.memberIds[0] || character.value?.id || ''
}

function buildDeviceTimeContext(now = new Date()) {
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]
  const date = now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const offsetMinutes = -now.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`
  return [
    `设备本地日期时间：${date} ${weekday} ${time}（UTC${offset}）`,
    '所有“现在、今天、明天、几点、还有多久、几小时后”等时间判断都以这条设备时间为准。',
    '如果要说“还有 X 小时/分钟”，必须按当前时间精确计算；不确定时只说具体时间，不要估算一个数字。'
  ].join('\n')
}

function includeVisionCount(request: ChatRequest) {
  return request.messages.reduce((total, turn) => typeof turn.content === 'string' ? total : total + turn.content.filter(part => part.type === 'image_url').length, 0)
}

async function requestAssistantReply(options?: {
  musicPrompt?: string
  type?: Message['type']
  sourceMessageId?: string
  visualMessageId?: string
  alternativeTargetId?: string
  memoryWriteNotice?: string
  proactivePrompt?: string
  proactiveSource?: ProactiveSource
}) {
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
  const streamSession: StreamingReplySession = {
    rawText: '',
    text: '',
    provider: '',
    model: '',
    type: options?.type ?? 'text',
    conversation: activeConversation,
    suppressPreview: false,
    proactiveSource: options?.proactiveSource
  }
  const useStreaming = settings.streamResponse && !options?.alternativeTargetId

  let visualMessage: Message | undefined
  let visionUsed = false
  let visionFallback = false

  try {
    let currentModelSettings = await getModelSettings()
    modelSettings.value = currentModelSettings
    const provider = createProvider(currentModelSettings)

    const persona = activePersona.value ?? await getPersonaForChat(settings)
    activePersona.value = persona
    const activePreset = await getActivePromptPreset(activeCharacter.id)
    const regexMacros = { user: persona.name, char: activeCharacter.name }
    const [activeAssistantRegex, activeUserRegex, activeWorldRegex, activePromptRegex] = await Promise.all([
      listActiveRegexScripts(activeCharacter.id, 'assistant-output'),
      listActiveRegexScripts(activeCharacter.id, 'user-input'),
      listActiveRegexScripts(activeCharacter.id, 'world-info'),
      listActiveRegexScripts(activeCharacter.id, 'prompt')
    ])
    if (activeAssistantRegex.some(regexProducesRichUi)) streamSession.suppressPreview = true
    const latestUserText = [...messages.value].reverse().find(item => item.senderId === 'user')?.content ?? ''
    const memoryQuery = [latestUserText, options?.musicPrompt || '', conversationState.value?.unresolvedTopics?.join(' ') || ''].filter(Boolean).join('\n')
    const memoryHitDetails = settings.memoryEnabled
      ? selectMemoryHitsDetailed(memories.value, memoryQuery, settings.memoryStrength === 'deep' ? 14 : settings.memoryStrength === 'light' ? 6 : 10)
      : []
    const memoryHits = memoryHitDetails.map(item => item.memory)
    const memoryPrompt = settings.memoryEnabled ? buildMemoryPrompt(memoryHits, conversationState.value?.summary ?? '') : ''
    if (memoryHitDetails.length) void recordMemoryHits(memoryHitDetails)

    const lorebook = settings.lorebookEnabled
      ? await buildLorebookPrompt({
        worldId: activeConversation.worldId,
        characterId: activeCharacter.id,
        messages: messages.value,
        latestText: [latestUserText, options?.musicPrompt || ''].filter(Boolean).join('\n'),
        character: activeCharacter,
        persona,
        activeResourceEntryId: conversationState.value?.activeResourceEntryId
      })
      : { prompt: '', beforePrompt: '', afterPrompt: '', activated: [], focused: [], deferred: [], routingDecisions: [], estimatedSavedCharacters: 0, resourceSession: { continued: false, exitRequested: false } }

    const runtimeLorebookPrompt = activeWorldRegex.length
      ? applyRegexScripts(lorebook.prompt, activeWorldRegex, regexMacros).text
      : lorebook.prompt
    const detectedCommunityUiContract = detectCommunityUiContract({
      character: activeCharacter,
      lorebookPrompt: runtimeLorebookPrompt,
      preset: activePreset,
      assistantRegex: activeAssistantRegex,
      promptRegex: activePromptRegex
    })
    const presentationHidesCommunityUi = settings.conversationPresentationMode !== 'scene-merged'
    const communityUiContract = presentationHidesCommunityUi
      ? { ...detectedCommunityUiContract, active: false, mode: 'none' as const }
      : detectedCommunityUiContract
    // 手机式呈现不运行“把整条回复变成 HTML UI”的 Regex；普通文本 Regex 继续生效。
    const displayAssistantRegex = presentationHidesCommunityUi
      ? activeAssistantRegex.filter(item => !regexProducesRichUi(item))
      : activeAssistantRegex
    const runtimeProfile = resolveCharacterRuntimeProfile({
      character: activeCharacter,
      settings,
      communityUiContract: detectedCommunityUiContract,
      resourceUiActive: Boolean(lorebook.resourceSession.entryId)
    })
    streamSession.preserveRawOutput = runtimeProfile.preserveCardOutput
    streamSession.suppressPreview = Boolean(
      presentationHidesCommunityUi ||
      communityUiContract.active ||
      displayAssistantRegex.some(regexProducesRichUi) ||
      (runtimeProfile.useNativeInteractionProtocol && settings.multiBubble && resolvePresenceMode(settings, conversationState.value) === 'remote')
    )

    visualMessage = options?.visualMessageId
      ? messages.value.find(item => item.id === options.visualMessageId)
      : undefined

    if (visualMessage) {
      visionImageCount.value = getMessageImageUrls(visualMessage).length
      visionStage.value = 'checking'
    }

    const visionCapability = getVisionCapability(currentModelSettings)
    const mayUseVision = Boolean(
      visualMessage?.type === 'image' &&
      getMessageImageUrls(visualMessage).length > 0 &&
      visionCapability !== 'unsupported'
    )

    visionUsed = mayUseVision
    visionFallback = Boolean(visualMessage) && !mayUseVision
    if (visualMessage && !mayUseVision) {
      visionStage.value = 'text-only'
      noticeMessage.value = '当前模型已标记为不支持图片理解，将根据图片说明继续回应。'
    }

    const buildRecentTurns = (includeVision: boolean): ChatTurn[] => {
      const alternativeIndex = options?.alternativeTargetId
        ? messages.value.findIndex(item => item.id === options.alternativeTargetId)
        : -1
      const promptMessages = alternativeIndex >= 0
        ? messages.value.slice(0, alternativeIndex)
        : messages.value
      const turns: ChatTurn[] = promptMessages
        .filter(message => message.type !== 'system' && !message.recalledAt)
        .slice(-settings.recentMessageLimit)
        .map(message => {
          const role = message.senderId === 'user' ? ('user' as const) : ('assistant' as const)
          const rawContent = includeVision && message.id === visualMessage?.id
            ? imageMessageContent(message)
            : formatMessageForPrompt(message)
          const content = role === 'user' && typeof rawContent === 'string' && activeUserRegex.length
            ? applyRegexScripts(rawContent, activeUserRegex, regexMacros).text
            : rawContent
          return { role, content }
        })

      if (options?.musicPrompt) {
        turns.push({
          role: 'user',
          content: activeUserRegex.length ? applyRegexScripts(options.musicPrompt, activeUserRegex, regexMacros).text : options.musicPrompt
        })
      }

      return turns
    }

    const buildRuntimeSystemPrompt = (includeVision: boolean) => {
      const base = composeWithPromptPreset(composeRoleplaySystemPrompt({
        character: activeCharacter,
        persona,
        settings,
        memoryPrompt,
        lorebookPrompt: runtimeLorebookPrompt,
        currentSummary: conversationState.value?.summary || '',
        statePrompt: buildConversationStatePrompt(conversationState.value ? { ...conversationState.value, presence: resolvePresenceMode(settings, conversationState.value) } : undefined),
        sceneTransitionPrompt: buildUserSceneTransitionPrompt(deriveUserSceneTransition(latestUserText, conversationState.value)),
        conversationState: conversationState.value ? { ...conversationState.value, presence: resolvePresenceMode(settings, conversationState.value) } : undefined,
        deviceTimeContext: buildDeviceTimeContext(),
        memoryWriteNotice: options?.memoryWriteNotice,
        hasImages: includeVision && Boolean(visualMessage),
        imageCount: includeVision && visualMessage ? getMessageImageUrls(visualMessage).length : 0,
        isAlternativeReply: Boolean(options?.alternativeTargetId),
        communityUiContract,
        openingMode: activeConversation.openingMode
      }), activePreset, {
        char: activeCharacter.name,
        user: persona.name,
        scenario: activeCharacter.scenario || '',
        personality: activeCharacter.cardPersonality || activeCharacter.persona || '',
        persona: persona.description || persona.identity || '',
        description: activeCharacter.cardDescription || activeCharacter.background || activeCharacter.identity || '',
        lastChatMessage: latestUserText
      })
      const transformed = activePromptRegex.length ? applyRegexScripts(base, activePromptRegex, regexMacros).text : base
      const proactivePrompt = options?.proactivePrompt?.trim()
      const withProactive = proactivePrompt ? `${transformed}\n\n${proactivePrompt}` : transformed
      const uiPriority = buildCommunityUiPriorityPrompt(communityUiContract)
      const withUiPriority = uiPriority ? `${withProactive}\n\n${uiPriority}` : withProactive
      const presentationOverride = buildPresentationOverridePrompt(settings)
      return presentationOverride ? `${withUiPriority}\n\n${presentationOverride}` : withUiPriority
    }

    const createRequest = (includeVision: boolean): ChatRequest => ({
      model: currentModelSettings.model,
      temperature: currentModelSettings.temperature,
      signal,
      character: {
        characterName: activeCharacter.name,
        userName: persona.name,
        identity: activeCharacter.identity,
        persona: activeCharacter.persona,
        speakingStyle: activeCharacter.speakingStyle,
        background: activeCharacter.background,
        relationship: activeCharacter.relationship,
        mood: activeCharacter.mood,
        activity: activeCharacter.activity,
        likes: activeCharacter.likes,
        dislikes: activeCharacter.dislikes,
        scenario: activeCharacter.scenario,
        roleplayMode: settings.roleplayMode,
        initiative: activeCharacter.initiative,
        narrationStyle: activeCharacter.narrationStyle,
        emojiFrequency: activeCharacter.emojiFrequency,
        questionFrequency: activeCharacter.questionFrequency
      },
      messages: [
        {
          role: 'system',
          content: buildRuntimeSystemPrompt(includeVision)
        },
        ...buildRecentTurns(includeVision)
      ]
    })

    let response: ChatResponse
    let debugTrace: PromptDebugTrace | undefined
    let providerId = provider.id
    let usedModel = currentModelSettings.model
    let providerNotice = ''
    const cumulativeTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, successfulCalls: 0 }
    const collectTokenUsage = (result: ChatResponse) => {
      cumulativeTokenUsage.successfulCalls += 1
      cumulativeTokenUsage.promptTokens += result.usage?.promptTokens || 0
      cumulativeTokenUsage.completionTokens += result.usage?.completionTokens || 0
      cumulativeTokenUsage.totalTokens += result.usage?.totalTokens || ((result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0))
    }

    const runProvider = async (
      activeProvider: ModelProvider,
      request: ChatRequest
    ) => {
      if (!debugTrace && settings.promptDebugEnabled) {
        const systemPrompt = chatTurnContentText(request.messages[0]?.content || '')
        const recentMessages = request.messages.slice(1).map(turn => ({ role: turn.role, content: chatTurnContentText(turn.content) }))
        const promptSections = analyzePromptSections(systemPrompt, recentMessages)
        try {
          debugTrace = await savePromptDebugTrace({
            conversationId: activeConversation.id,
            characterId: activeCharacter.id,
            provider: activeProvider.id,
            model: request.model,
            roleplayMode: settings.roleplayMode,
            personaName: persona.name,
            systemPrompt,
            recentMessages,
            activatedLorebook: lorebook.activated.map(item => ({ id: item.id, title: item.title, reason: item.activationReason })),
            resourceRouting: lorebook.routingDecisions,
            estimatedSavedCharacters: lorebook.estimatedSavedCharacters,
            memoryHits: memoryHitDetails.map(item => ({ id: item.memory.id, content: item.memory.content, importance: item.memory.importance, layer: item.memory.layer, score: item.score, reason: item.reasons.join('；') })),
            imageCount: includeVisionCount(request),
            estimatedCharacters: estimatePromptCharacters(systemPrompt, recentMessages),
            protocolEnabled: runtimeProfile.useNativeInteractionProtocol,
            promptSections,
            truncations: buildTruncationNotes({ allMessageCount: messages.value.length, includedMessageCount: recentMessages.length, systemPrompt, sections: promptSections }),
            ruleInfluences: buildRuleInfluences(systemPrompt)
          })
        } catch (debugError) {
          // Prompt 调试是旁路诊断能力，写库失败绝不能中断正常聊天。
          console.warn('保存 Prompt 调试记录失败：', debugError)
          debugTrace = undefined
        }
      }
      streamSession.provider = activeProvider.id
      streamSession.model = request.model

      if (visualMessage && visionUsed) visionStage.value = 'analyzing'

      if (!useStreaming) {
        const result = await activeProvider.chat(request)
        collectTokenUsage(result)
        if (visualMessage) visionStage.value = 'replying'
        return result
      }

      const result = await activeProvider.chatStream(
        request,
        {
          onDelta: chunk => {
            if (visualMessage) visionStage.value = 'replying'
            return appendStreamChunk(streamSession, chunk)
          }
        }
      )
      collectTokenUsage(result)
      return result
    }

    try {
      try {
        response = await runProvider(
          provider,
          createRequest(mayUseVision)
        )

        if (
          mayUseVision &&
          currentModelSettings.visionMode === 'auto'
        ) {
          currentModelSettings = await saveVisionCapability(
            currentModelSettings,
            true
          )
          modelSettings.value = currentModelSettings
        }
      } catch (providerError) {
        if (isAbortError(providerError)) throw providerError

        const canRetryWithoutVision =
          !streamSession.text &&
          mayUseVision &&
          currentModelSettings.visionMode === 'auto' &&
          isVisionUnsupportedError(providerError)

        if (!canRetryWithoutVision) throw providerError

        visionUsed = false
        visionFallback = true
        response = await runProvider(
          provider,
          createRequest(false)
        )
        currentModelSettings = await saveVisionCapability(
          currentModelSettings,
          false
        )
        modelSettings.value = currentModelSettings
        visionStage.value = 'text-only'
        providerNotice = '当前模型不支持图片理解，本次只把文字部分交给同一 AI 继续处理；没有使用本地角色回复。'
        noticeMessage.value = providerNotice
      }
    } catch (providerError) {
      if (isAbortError(providerError)) throw providerError
      // 真实 AI 失败就停止。本地不生成角色回复，也不使用任何模拟模型兜底。
      throw providerError
    }

    if (options?.proactivePrompt && /<no_proactive_message\s*\/?\s*>/i.test(response.text)) {
      await discardStreamingMessage(streamSession)
      conversationState.value = await patchConversationState(activeConversation.id, {
        lastProactiveAt: new Date().toISOString()
      })
      return
    }

    // 第一版真实 AI 回复永远保留为内容兜底。格式纠偏仍交给 AI，但纠偏失败不能吞掉第一版正文。
    const initialAiResponse = response
    let parsedOutput = parseCompanionOutput(response.text, { interpretNativeProtocol: runtimeProfile.useNativeInteractionProtocol, userName: persona.name })
    const applyVisibleMacrosToParsedOutput = () => {
      const replace = (value?: string) => renderRoleplayText(value, persona.name, activeCharacter.name)
      parsedOutput = {
        ...parsedOutput,
        visibleText: replace(parsedOutput.visibleText) || '',
        messages: parsedOutput.messages.map(item => ({ ...item, content: replace(item.content) || '' })),
        roleCardUi: parsedOutput.roleCardUi ? {
          ...parsedOutput.roleCardUi,
          date: replace(parsedOutput.roleCardUi.date),
          time: replace(parsedOutput.roleCardUi.time),
          location: replace(parsedOutput.roleCardUi.location),
          inner: replace(parsedOutput.roleCardUi.inner),
          surroundings: replace(parsedOutput.roleCardUi.surroundings),
          todos: parsedOutput.roleCardUi.todos?.map(item => replace(item) || item)
        } : undefined,
        status: parsedOutput.status ? {
          ...parsedOutput.status,
          mood: replace(parsedOutput.status.mood),
          activity: replace(parsedOutput.status.activity),
          location: replace(parsedOutput.status.location),
          relationshipNote: replace(parsedOutput.status.relationshipNote),
          innerThought: replace(parsedOutput.status.innerThought),
          timePeriod: replace(parsedOutput.status.timePeriod),
          unresolvedTopics: parsedOutput.status.unresolvedTopics?.map(item => replace(item) || item),
          pendingEvents: parsedOutput.status.pendingEvents?.map(item => replace(item) || item),
          shortTermGoals: parsedOutput.status.shortTermGoals?.map(item => replace(item) || item),
          completedEvent: replace(parsedOutput.status.completedEvent)
        } : undefined
      }
      if (runtimeProfile.preserveCardOutput || communityUiContract.active) {
        // 原卡优先时，状态提示只用于场景推断；界面不额外叠加小手机固定状态卡。
        parsedOutput = { ...parsedOutput, roleCardUi: undefined }
      }
    }
    applyVisibleMacrosToParsedOutput()
    let regexDisplay = applyRegexScripts(response.text, displayAssistantRegex, regexMacros)
    let richReplyHtml = !presentationHidesCommunityUi && (regexDisplay.rich || looksLikeRichHtml(regexDisplay.text))
      ? (renderRoleplayText(normalizeRichHtml(regexDisplay.text), persona.name, activeCharacter.name) || '')
      : ''
    let communityUiText = !presentationHidesCommunityUi && communityUiContract.active && !richReplyHtml
      ? (renderRoleplayText(sanitizeCommunityUiText(regexDisplay.text), persona.name, activeCharacter.name) || '')
      : ''

    const communityUiConforms = () => communityUiOutputConforms({
      contract: communityUiContract,
      rawText: response.text,
      renderedText: richReplyHtml || communityUiText || regexDisplay.text,
      appliedRegex: regexDisplay.applied
    })

    if (communityUiContract.active && !communityUiConforms() && !signal.aborted) {
      const localRepair = tryRepairCommunityUiLocally(communityUiContract, response.text)
      if (localRepair.repaired) {
        richReplyHtml = renderRoleplayText(normalizeRichHtml(localRepair.text), persona.name, activeCharacter.name) || ''
        communityUiText = ''
        parsedOutput.warnings.push(localRepair.reason)
      } else {
        // 只有本地无法确认“只是格式问题”时，才允许一次模型纠偏。
        const uiRepairRequest = createRequest(visionUsed)
        uiRepairRequest.temperature = Math.min(uiRepairRequest.temperature ?? 0.8, 0.35)
        uiRepairRequest.messages = [
          ...uiRepairRequest.messages,
          { role: 'system', content: buildCommunityUiRepairPrompt(communityUiContract, response.text) }
        ]
        try {
          response = await provider.chat(uiRepairRequest)
          collectTokenUsage(response)
          parsedOutput = parseCompanionOutput(response.text, { interpretNativeProtocol: runtimeProfile.useNativeInteractionProtocol, userName: persona.name })
          applyVisibleMacrosToParsedOutput()
          regexDisplay = applyRegexScripts(response.text, displayAssistantRegex, regexMacros)
          richReplyHtml = !presentationHidesCommunityUi && (regexDisplay.rich || looksLikeRichHtml(regexDisplay.text))
            ? (renderRoleplayText(normalizeRichHtml(regexDisplay.text), persona.name, activeCharacter.name) || '')
            : ''
          communityUiText = !presentationHidesCommunityUi && communityUiContract.active && !richReplyHtml
            ? (renderRoleplayText(sanitizeCommunityUiText(regexDisplay.text), persona.name, activeCharacter.name) || '')
            : ''
          if (!communityUiConforms()) {
            const repairedAfterAi = tryRepairCommunityUiLocally(communityUiContract, response.text)
            if (repairedAfterAi.repaired) {
              richReplyHtml = renderRoleplayText(normalizeRichHtml(repairedAfterAi.text), persona.name, activeCharacter.name) || ''
              communityUiText = ''
              parsedOutput.warnings.push(repairedAfterAi.reason.replace('未追加第二次 AI 调用', '使用一次 AI 内容纠偏后由本地编译完成'))
            }
          }
        } catch (uiRepairError) {
          if (isAbortError(uiRepairError)) throw uiRepairError
          if (isTokenLimitError(uiRepairError)) {
            parsedOutput.warnings.push('社区 UI 自动纠偏因 Token / 上下文 / 额度限制未完成；第一版真实 AI 回复已保留。')
            noticeMessage.value = 'AI 已完成第一版回复，但社区 UI 格式纠偏因 Token / 上下文 / 额度限制未完成；正文已保留，未使用本地补写。'
          } else {
            parsedOutput.warnings.push(uiRepairError instanceof Error ? `社区 UI 自动纠偏失败：${uiRepairError.message}` : '社区 UI 自动纠偏失败。')
          }
        }
      }
    }

    if (communityUiContract.active && !communityUiConforms()) {
      // 格式纠偏没有成功时，恢复第一版真实 AI 回复。UI 可以降级，正文不能被静默丢弃。
      response = initialAiResponse
      parsedOutput = parseCompanionOutput(response.text, { interpretNativeProtocol: runtimeProfile.useNativeInteractionProtocol, userName: persona.name })
      applyVisibleMacrosToParsedOutput()
      regexDisplay = applyRegexScripts(response.text, displayAssistantRegex, regexMacros)
      richReplyHtml = !presentationHidesCommunityUi && (regexDisplay.rich || looksLikeRichHtml(regexDisplay.text))
        ? (renderRoleplayText(normalizeRichHtml(regexDisplay.text), persona.name, activeCharacter.name) || '')
        : ''
      communityUiText = !presentationHidesCommunityUi && !richReplyHtml
        ? (renderRoleplayText(sanitizeCommunityUiText(response.text), persona.name, activeCharacter.name) || '')
        : ''
      parsedOutput.warnings.push('社区 UI 未完全匹配原卡格式：已保留第一版真实 AI 回复，未因 UI/Regex 失败丢弃正文。')
    }

    if (richReplyHtml) {
      const realUserMessages = messages.value
        .filter(item => item.senderId === 'user' && !item.recalledAt)
        .slice(-24)
        .map(item => item.content)
      richReplyHtml = enforceUserMessageOwnershipInRichHtml(richReplyHtml, realUserMessages)
    }

    if (!communityUiContract.active && !richReplyHtml && regexDisplay.applied.length) {
      const transformed = parseCompanionOutput(regexDisplay.text, { interpretNativeProtocol: runtimeProfile.useNativeInteractionProtocol, userName: persona.name })
      parsedOutput = { ...parsedOutput, messages: transformed.messages, visibleText: transformed.visibleText, actionSummary: transformed.actionSummary, status: transformed.status || parsedOutput.status, roleCardUi: transformed.roleCardUi || parsedOutput.roleCardUi, presenceResolution: transformed.presenceResolution?.resolvedPresence ? transformed.presenceResolution : parsedOutput.presenceResolution }
      applyVisibleMacrosToParsedOutput()
    }
    if (!parsedOutput.messages.length && !richReplyHtml && !communityUiText) throw new Error('模型没有返回可显示的角色回复。')

    // 角色回复内容到这里以后不再做本地语义重写。
    // 应用只校验原卡明确要求的结构；台词、动作、心理、用户事实判断均保留 AI 原始生成结果。

    if (settings.presenceMode === 'together' || settings.presenceMode === 'remote') {
      const forcedPresence = settings.presenceMode
      const inferred = parsedOutput.presenceResolution
      parsedOutput = {
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

    const renderStateForDisplay = parsedOutput.status?.presence
      ? ({ ...(conversationState.value || {}), presence: parsedOutput.status.presence } as ConversationState)
      : conversationState.value
    const projectedActions = runtimeProfile.allowNativeMessageReshaping
      ? shapeCompanionActions(parsedOutput.messages.slice(), activeCharacter, settings, Boolean(parsedOutput.rawPacket), renderStateForDisplay)
      : parsedOutput.messages.slice()
    const projectedVisibleText = projectedActions
      .filter(item => !['typing_pause', 'recall_message', 'react_to_message'].includes(item.kind))
      .map(item => item.kind === 'scene_action' ? `（${item.content}）` : item.content)
      .filter(Boolean)
      .join('\n\n')
    if (settings.conversationPresentationMode !== 'scene-merged' && !projectedVisibleText.trim()) {
      throw new Error(settings.conversationPresentationMode === 'phone-text'
        ? '纯手机模式下模型没有返回可显示的角色语句。'
        : '动作 / 台词分开模式下模型没有返回可显示的角色内容。')
    }
    const finalVisibleOutput = richReplyHtml || communityUiText || projectedVisibleText || (settings.conversationPresentationMode === 'scene-merged' ? parsedOutput.visibleText : '')
    const visibleRoleCardUi = settings.conversationPresentationMode === 'scene-merged' ? parsedOutput.roleCardUi : undefined

    if (debugTrace) {
      try {
        await patchPromptDebugTrace(debugTrace.id, {
          provider: providerId,
          model: usedModel,
          tokenUsage: { ...cumulativeTokenUsage },
          rawOutput: response.text,
          visibleOutput: finalVisibleOutput,
          actionSummary: parsedOutput.actionSummary,
          presenceResolution: parsedOutput.presenceResolution,
          naturalnessWarnings: [...parsedOutput.warnings, ...naturalnessWarnings(finalVisibleOutput)],
          naturalnessScore: scoreNaturalness({
            text: finalVisibleOutput,
            character: activeCharacter,
            latestUserText,
            relationshipNote: conversationState.value?.relationshipNote,
            imageCount: visualMessage ? getMessageImageUrls(visualMessage).length : 0,
            recentAssistantMessages: messages.value.filter(item => item.senderId !== 'user')
          })
        })
      } catch (debugError) {
        // 更新调试记录失败同样只降级调试能力，不影响角色回复与消息入库。
        console.warn('更新 Prompt 调试记录失败：', debugError)
      }
    }
    const resourceSessionPatch: Partial<ConversationState> = lorebook.resourceSession.exitRequested
      ? { activeResourceEntryId: undefined, activeResourceTitle: undefined, activeResourceUpdatedAt: new Date().toISOString() }
      : lorebook.resourceSession.entryId
        ? {
          activeResourceEntryId: lorebook.resourceSession.entryId,
          activeResourceTitle: lorebook.resourceSession.title,
          activeResourceUpdatedAt: new Date().toISOString()
        }
        : {}

    if (!options?.alternativeTargetId && conversationState.value && (parsedOutput.status || Object.keys(resourceSessionPatch).length)) {
      const beforeState = conversationState.value
      const statePatch = {
        ...(parsedOutput.status ? mergeStatusIntoConversationState(beforeState, parsedOutput.status, parsedOutput.presenceResolution) : {}),
        ...resourceSessionPatch,
        lastActionSummary: parsedOutput.actionSummary
      }
      const nextState = await patchConversationState(activeConversation.id, statePatch)
      await recordConversationStateChanges({
        conversationId: activeConversation.id,
        characterId: activeCharacter.id,
        before: beforeState,
        after: nextState,
        sourceMessageId: options?.sourceMessageId
      })
      conversationState.value = nextState
      if (parsedOutput.status && settings.memoryEnabled && (parsedOutput.status.relationshipNote || parsedOutput.status.innerThought)) {
        const observation = [parsedOutput.status.relationshipNote, parsedOutput.status.innerThought]
          .filter(Boolean)
          .join('；')
        await rememberCharacterObservation({
          conversationId: activeConversation.id,
          characterId: activeCharacter.id,
          content: `角色主观感受：${observation}`,
          sourceMessageId: options?.sourceMessageId,
          importance: parsedOutput.status.relationshipNote ? 4 : 3
        })
        await refreshMemoryList()
      }
      if (parsedOutput.status) {
        const characterPatch: Partial<Character> = { mood: parsedOutput.status.mood || activeCharacter.mood, activity: parsedOutput.status.activity || activeCharacter.activity, updatedAt: new Date().toISOString() }
        await db.characters.update(activeCharacter.id, characterPatch)
        character.value = { ...activeCharacter, ...characterPatch }
      }
    }
    if (options?.alternativeTargetId) {
      const target = messages.value.find(item => item.id === options.alternativeTargetId)
      if (!target) throw new Error('没有找到需要添加候选回复的消息。')
      const baseAlternatives = target.alternatives?.length ? target.alternatives.slice() : [target.content]
      const candidate = finalVisibleOutput.trim()
      const alternatives = baseAlternatives.includes(candidate) ? baseAlternatives : [...baseAlternatives, candidate]
      const activeAlternativeIndex = Math.max(0, alternatives.indexOf(candidate))
      const patch: Partial<Message> = { content: candidate, alternatives, activeAlternativeIndex, provider: providerId, model: usedModel, status: 'delivered' }
      await db.messages.update(target.id, patch)
      const targetIndex = messages.value.findIndex(item => item.id === target.id)
      if (targetIndex >= 0) messages.value[targetIndex] = { ...messages.value[targetIndex], ...patch }
      noticeMessage.value = `已生成第 ${activeAlternativeIndex + 1} 个候选回复。`
    } else if (richReplyHtml) {
      await saveRichAssistantMessage({ html: richReplyHtml, rawContent: response.text, provider: providerId, model: usedModel, source: regexDisplay.applied.length ? 'regex' : 'worldbook-ui', replaceMessageId: streamSession.messageId, proactiveSource: options?.proactiveSource })
      streamSession.messageId = undefined
    } else if (communityUiContract.active) {
      const preserved = communityUiText || sanitizeCommunityUiText(response.text)
      await saveAssistantActions({
        actions: [{ kind: 'text', content: preserved }],
        provider: providerId,
        model: usedModel,
        type: options?.type,
        signal,
        replaceMessageId: streamSession.messageId,
        roleCardUi: visibleRoleCardUi,
        proactiveSource: options?.proactiveSource,
        rawContent: response.text
      })
      streamSession.messageId = undefined
    } else if (useStreaming) {
      streamSession.provider = providerId; streamSession.model = usedModel
      await finishStreamingMessage(streamSession, parsedOutput, settings.multiBubble, runtimeProfile.allowNativeMessageReshaping)
    } else {
      if (settings.naturalDelay) await wait(240 + Math.min(900, parsedOutput.visibleText.length * 9), signal)
      await saveAssistantActions({ actions: projectedActions, provider: providerId, model: usedModel, type: options?.type, signal, roleCardUi: visibleRoleCardUi, proactiveSource: options?.proactiveSource, rawContent: response.text })
    }

    if (options?.proactiveSource) {
      conversationState.value = await patchConversationState(activeConversation.id, {
        lastProactiveAt: new Date().toISOString()
      })
    }

    await updateUserMessageState(
      options?.sourceMessageId,
      'read',
      {
        visionUsed: visualMessage ? visionUsed : undefined,
        visionFallback: visualMessage ? visionFallback : undefined
      }
    )

    conversationState.value = await patchConversationState(
      activeConversation.id,
      {
        lastTechnicalError: '',
        lastProviderNotice: providerNotice
      }
    )

    await updateSummaryIfNeeded()

    if (settings.autoReadAloud && speechPlaybackAvailable.value) {
      const latestAssistant = [...messages.value]
        .reverse()
        .find(message => message.senderId !== 'user' && message.type !== 'action' && message.status === 'delivered')
      const spokenText = parsedOutput.messages.filter(item => item.kind === 'text' || item.kind === 'voice').map(item => item.content).filter(Boolean).join('\n') || parsedOutput.visibleText
      speakText(spokenText, latestAssistant?.id ?? '')
    }
  } catch (error) {
    if (isAbortError(error)) {
      if (manualStopRequested) {
        const preserved = await preserveInterruptedStream(
          streamSession,
          'cancelled'
        )
        await updateUserMessageState(
          options?.sourceMessageId,
          preserved ? 'read' : 'cancelled',
          {
            visionUsed: visualMessage ? visionUsed : undefined,
            visionFallback: visualMessage ? visionFallback : undefined
          }
        )
        noticeMessage.value = preserved
          ? '已按你的操作停止生成，已经出现的真实 AI 内容已保留。'
          : '已停止等待回复，可长按消息重新发送。'
      } else {
        await discardStreamingMessage(streamSession)
        await updateUserMessageState(
          options?.sourceMessageId,
          'cancelled',
          {
            visionUsed: visualMessage ? visionUsed : undefined,
            visionFallback: visualMessage ? visionFallback : undefined
          }
        )
      }
      return
    }

    if (isTokenLimitError(error)) {
      const technical = error.message
      await discardStreamingMessage(streamSession)
      await updateUserMessageState(
        options?.sourceMessageId,
        'failed',
        {
          errorText: technical,
          visionUsed: visualMessage ? visionUsed : undefined,
          visionFallback: visualMessage ? visionFallback : undefined
        }
      )
      errorMessage.value = technical
      noticeMessage.value = '本轮已停止，未保存任何不完整的角色回复。'
      conversationState.value = await patchConversationState(
        activeConversation.id,
        {
          lastTechnicalError: technical,
          lastProviderNotice: ''
        }
      )
      return
    }

    console.error('获取角色回复失败：', error)
    const technical = error instanceof Error
      ? error.message
      : '未知错误'

    await discardStreamingMessage(streamSession)

    await updateUserMessageState(
      options?.sourceMessageId,
      'failed',
      {
        errorText: technical,
        visionUsed: visualMessage ? visionUsed : undefined,
        visionFallback: visualMessage ? visionFallback : undefined
      }
    )

    errorMessage.value = `AI 请求失败：${technical}`
    noticeMessage.value = '本轮已停止，未保存中断或不完整的角色回复；小手机不会使用本地内容续写。'

    conversationState.value = await patchConversationState(
      activeConversation.id,
      {
        lastTechnicalError: technical,
        lastProviderNotice: ''
      }
    )
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
    content: text,
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
    if (text && conversationState.value) {
      const transition = deriveUserSceneTransition(text, conversationState.value)
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
    if (text && conversationState.value && sendRuntimeProfile.compatibilityMode === 'phone-enhanced') {
      // 只有用户明确开启“小手机增强”时才运行本地话题/待办抽取。
      // 自动/card-first 模式不基于关键词替角色推断剧情目标，避免固定规则污染原卡。
      const beforeState = conversationState.value
      const derivedPatch = deriveUserStatePatch(text, beforeState)
      const nextState = await patchConversationState(activeConversation.id, derivedPatch)
      await recordConversationStateChanges({ conversationId: activeConversation.id, characterId: character.value.id, before: beforeState, after: nextState, sourceMessageId: messageId })
      conversationState.value = nextState
    }
    let memoryWriteNotice = ''
    if (chatSettings.value?.memoryEnabled && text) {
      const memoryWrite = await rememberFromMessageDetailed({
        conversationId: activeConversation.id,
        characterId: character.value.id,
        sourceMessageId: messageId,
        text,
        strength: chatSettings.value.memoryStrength
      })
      memoryWriteNotice = buildMemoryWriteNotice(memoryWrite, text)
      await refreshMemoryList()
      if (memoryWrite.conflicts.length) noticeMessage.value = '发现一组记忆冲突，可在“记忆管理”中确认正确版本。'
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
  const macroResolved = rawGreeting
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{char\}\}/gi, character.value.name)
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
  const greetingAssistantRegex = await listActiveRegexScripts(character.value.id, 'assistant-output')
  const greetingDisplayRegex = greetingPresentationHidesUi
    ? greetingAssistantRegex.filter(item => !regexProducesRichUi(item))
    : greetingAssistantRegex
  const regexDisplay = applyRegexScripts(macroResolved, greetingDisplayRegex, { user: userName, char: character.value.name })
  const rawIsRich = regexDisplay.rich || looksLikeRichHtml(regexDisplay.text)
  let isRich = !greetingPresentationHidesUi && rawIsRich
  let displayText = isRich ? regexDisplay.text : normalizeCommunityPlainText(regexDisplay.text)
  let richHtml = isRich ? normalizeRichHtml(displayText) : undefined

  if (greetingPresentationHidesUi && chatSettings.value && greetingRuntimeProfile?.allowNativeMessageReshaping) {
    const parsedGreeting = parseCompanionOutput(regexDisplay.text, { interpretNativeProtocol: true, userName })
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
      .trim() || normalizeCommunityPlainText(regexDisplay.text)
    isRich = false
    richHtml = undefined
  }

  const preview = isRich
    ? displayText.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280) || '角色卡 UI'
    : displayText

  const now = new Date().toISOString()
  const conversationId = conversation.value.id
  const message: Message = {
    id: crypto.randomUUID(),
    worldId: conversation.value.worldId,
    conversationId,
    senderId: character.value.id,
    type: isRich ? 'rich' : 'text',
    content: preview,
    rawContent: rawGreeting,
    richHtml,
    richSource: isRich ? (regexDisplay.applied.length ? 'regex' : 'card-ui') : undefined,
    roleCardUi: !greetingPresentationHidesUi && greetingRuntimeProfile?.compatibilityMode === 'phone-enhanced' && isRich ? greetingUi : undefined,
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

  await db.transaction(
    'rw',
    [db.messages, db.memories, db.conversationStates, db.conversationStateHistory, db.promptDebugTraces, db.conversations, db.characters],
    async () => {
      if (resetNeeded) {
        await db.messages.where('conversationId').equals(conversationId).delete()
        await db.memories.where('conversationId').equals(conversationId).delete()
        await db.conversationStateHistory.where('conversationId').equals(conversationId).delete()
        await db.promptDebugTraces.where('conversationId').equals(conversationId).delete()
      }
      await db.conversationStates.put(nextState)
      await db.messages.add(message)
      await db.conversations.update(conversationId, { openingMode: 'greeting', greetingIndex, updatedAt: now })
      await db.characters.update(character.value!.id, {
        activity: greetingActivity,
        ...(greetingRelationship ? { relationship: greetingRelationship } : {}),
        updatedAt: now
      })
    }
  )

  messages.value = [message]
  memories.value = []
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
  const now = new Date().toISOString()
  await db.transaction('rw', db.messages, db.memories, db.conversationStates, db.conversationStateHistory, db.conversations, async () => {
    await db.messages.where('conversationId').equals(id).delete()
    await db.memories.where('conversationId').equals(id).delete()
    await db.conversationStateHistory.where('conversationId').equals(id).delete()
    await db.conversationStates.delete(id)
    await db.conversations.update(id, { openingMode: 'free', greetingIndex: undefined, updatedAt: now })
  })
  messages.value = []
  memories.value = []
  conversationState.value = createDefaultConversationState(id)
  conversation.value = { ...conversation.value, openingMode: 'free', greetingIndex: undefined, updatedAt: now }
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

async function addManualMemory() {
  if (!conversation.value || !character.value) return
  const content = newMemoryText.value.trim()
  if (!content) return

  await addMemory({
    conversationId: conversation.value.id,
    characterId: character.value.id,
    content
  })

  newMemoryText.value = ''
  await refreshMemoryList()
}

async function deleteMemory(id: string) {
  await removeMemory(id)
  await refreshMemoryList()
}

async function clearAllMemories() {
  if (!conversation.value) return
  if (!window.confirm('确定清除这个角色记住的全部内容吗？')) return

  await clearMemories(conversation.value.id)
  conversationState.value = await patchConversationState(
    conversation.value.id,
    {
      summary: '',
      summaryMessageCount: 0
    }
  )
  await refreshMemoryList()
}

async function clearConversationMessages() {
  if (!conversation.value) return
  if (!window.confirm('确定清空当前聊天记录吗？此操作无法撤销。')) return

  await db.messages
    .where('conversationId')
    .equals(conversation.value.id)
    .delete()

  messages.value = []
  conversationState.value = await patchConversationState(
    conversation.value.id,
    {
      summary: '',
      summaryMessageCount: 0,
      lastTechnicalError: '',
      lastProviderNotice: ''
    }
  )
  const nextOpeningMode = availableGreetings.value.length ? 'pending' : 'free'
  await db.conversations.update(conversation.value.id, { openingMode: nextOpeningMode, greetingIndex: undefined, updatedAt: new Date().toISOString() })
  conversation.value = { ...conversation.value, openingMode: nextOpeningMode, greetingIndex: undefined }
  activePanel.value = nextOpeningMode === 'pending' ? 'greeting' : null
}


async function copySelectedMessage() {
  if (!selectedMessage.value) return
  await navigator.clipboard.writeText(selectedMessage.value.content)
  noticeMessage.value = '已复制。'
  activePanel.value = null
}

async function editSelectedMessage() {
  const message = selectedMessage.value
  if (!message) return
  const next = window.prompt('编辑这条消息', message.content)
  if (next === null) return
  const content = next.trim()
  if (!content && message.type !== 'image') return
  const patch: Partial<Message> = {
    content,
    alternatives: message.senderId === 'user' ? undefined : [content],
    activeAlternativeIndex: message.senderId === 'user' ? undefined : 0,
    editedAt: new Date().toISOString()
  }
  await db.messages.update(message.id, patch)
  const index = messages.value.findIndex(item => item.id === message.id)
  if (index >= 0) messages.value[index] = { ...messages.value[index], ...patch }
  selectedMessage.value = index >= 0 ? messages.value[index] : undefined
  noticeMessage.value = '消息已编辑。后续回复不会自动重算。'
  activePanel.value = null
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
  if (!message || !activeConversation || !character.value) return

  const messageIndex = messages.value.findIndex(item => item.id === message.id)
  if (messageIndex < 0) return

  const now = new Date().toISOString()
  const newConversationId = crypto.randomUUID()
  const idMap = new Map<string, string>()
  const sourceRows = messages.value.slice(0, messageIndex + 1)
  for (const row of sourceRows) idMap.set(row.id, crypto.randomUUID())

  const copiedMessages: Message[] = sourceRows.map(row => ({
    ...row,
    id: idMap.get(row.id) || crypto.randomUUID(),
    conversationId: newConversationId,
    replyGroupId: row.replyGroupId ? `${row.replyGroupId}-${newConversationId}` : undefined,
    replyTo: row.replyTo
      ? {
        ...row.replyTo,
        messageId: idMap.get(row.replyTo.messageId) || row.replyTo.messageId
      }
      : undefined
  }))

  const [sourceMemories, sourceHistory, sourceMusic] = await Promise.all([
    db.memories.where('conversationId').equals(activeConversation.id).toArray(),
    db.conversationStateHistory.where('conversationId').equals(activeConversation.id).toArray(),
    db.musicStates.get(activeConversation.id)
  ])
  const copiedMemories = sourceMemories
    .filter(row => !row.sourceMessageId || idMap.has(row.sourceMessageId))
    .map(row => ({
      ...row,
      id: crypto.randomUUID(),
      conversationId: newConversationId,
      sourceMessageId: row.sourceMessageId ? idMap.get(row.sourceMessageId) : undefined,
      createdAt: row.createdAt,
      updatedAt: now
    }))
  const copiedHistory = sourceHistory
    .filter(row => !row.sourceMessageId || idMap.has(row.sourceMessageId))
    .map(row => ({
      ...row,
      id: crypto.randomUUID(),
      conversationId: newConversationId,
      sourceMessageId: row.sourceMessageId ? idMap.get(row.sourceMessageId) : undefined
    }))

  const selectedCreatedAt = message.createdAt
  const relevantHistory = sourceHistory
    .filter(row => !row.sourceMessageId || idMap.has(row.sourceMessageId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const branchState: ConversationState = createDefaultConversationState(newConversationId)
  for (const row of relevantHistory) {
    if (row.field === 'location') branchState.location = row.nextValue
    else if (row.field === 'presence' && (row.nextValue === 'together' || row.nextValue === 'remote')) branchState.presence = row.nextValue
    else if (row.field === 'timePeriod') branchState.timePeriod = row.nextValue
    else if (row.field === 'energy') branchState.energy = row.nextValue
    else if (row.field === 'mood') branchState.innerMood = row.nextValue
    else if (row.field === 'activity') branchState.innerActivity = row.nextValue
    else if (row.field === 'relationship') branchState.relationshipNote = row.nextValue
    else if (row.field === 'topic') branchState.unresolvedTopics = Array.from(new Set([...(branchState.unresolvedTopics || []), row.nextValue])).slice(-6)
    else if (row.field === 'goal') branchState.shortTermGoals = Array.from(new Set([...(branchState.shortTermGoals || []), row.nextValue])).slice(-6)
    else if (row.field === 'event' && row.label === '等待中的事件') branchState.pendingEvents = Array.from(new Set([...(branchState.pendingEvents || []), row.nextValue])).slice(-6)
    else if (row.field === 'event') branchState.lastCompletedEvent = row.nextValue
  }
  if (conversationState.value?.activeResourceEntryId && conversationState.value.activeResourceUpdatedAt && conversationState.value.activeResourceUpdatedAt <= selectedCreatedAt) {
    branchState.activeResourceEntryId = conversationState.value.activeResourceEntryId
    branchState.activeResourceTitle = conversationState.value.activeResourceTitle
    branchState.activeResourceUpdatedAt = conversationState.value.activeResourceUpdatedAt
  }
  if (conversationState.value?.thoughtUpdatedAt && conversationState.value.thoughtUpdatedAt <= selectedCreatedAt) {
    branchState.innerThought = conversationState.value.innerThought
    branchState.thoughtUpdatedAt = conversationState.value.thoughtUpdatedAt
  }
  branchState.summary = ''
  branchState.summaryMessageCount = 0
  branchState.presenceResolutionSource = 'unknown'
  branchState.presenceResolutionReason = '由分支节点之前的状态历史重建；后续场景从该节点继续判断。'
  branchState.updatedAt = now

  const rootConversationId = activeConversation.rootConversationId || activeConversation.id
  const branchConversation: Conversation = {
    ...activeConversation,
    id: newConversationId,
    title: `${activeConversation.title.replace(/ · 分支(?: \d+)?$/, '')} · 分支`,
    pinned: false,
    unread: 0,
    parentConversationId: activeConversation.id,
    rootConversationId,
    branchFromMessageId: message.id,
    createdAt: now,
    updatedAt: now
  }

  await db.transaction('rw', [db.conversations, db.messages, db.chatSettings, db.conversationStates, db.memories, db.conversationStateHistory, db.musicStates], async () => {
    await db.conversations.add(branchConversation)
    if (copiedMessages.length) await db.messages.bulkAdd(copiedMessages)
    if (chatSettings.value) {
      await db.chatSettings.put({
        ...chatSettings.value,
        id: newConversationId,
        conversationId: newConversationId,
        updatedAt: now
      })
    }
    await db.conversationStates.put(branchState)
    if (copiedMemories.length) await db.memories.bulkAdd(copiedMemories)
    if (copiedHistory.length) await db.conversationStateHistory.bulkAdd(copiedHistory)
    if (sourceMusic && sourceMusic.updatedAt <= selectedCreatedAt) await db.musicStates.put({ ...sourceMusic, id: newConversationId, isPlaying: false, updatedAt: now })
  })

  activePanel.value = null
  noticeMessage.value = '聊天分支已创建，正在进入新的独立剧情。'
  await router.push(`/chat/${newConversationId}`)
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
  if (!message) return

  const ids = message.replyGroupId
    ? messages.value
      .filter(item => item.replyGroupId === message.replyGroupId)
      .map(item => item.id)
    : [message.id]

  await db.messages.bulkDelete(ids)
  messages.value = messages.value.filter(item => !ids.includes(item.id))
  if (replyTarget.value && ids.includes(replyTarget.value.id)) {
    replyTarget.value = undefined
  }
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

async function regenerateSelectedMessage() {
  const message = selectedMessage.value
  if (!message || message.senderId === 'user' || isSending.value) return

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
          :memories="memories"
          :new-memory-text="newMemoryText"
          :memory-category-names="memoryCategoryNames"
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
          @update:new-memory-text="newMemoryText = $event"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @close="activePanel = null"
          @persist="persistChatSettings"
          @preview-voice="previewCurrentVoice"
          @add-memory="addManualMemory"
          @delete-memory="deleteMemory"
          @clear-memories="clearAllMemories"
          @clear-conversation="clearConversationMessages"
          @open-model-settings="router.push('/settings/models')"
          @open-personas="router.push('/settings/personas')"
          @open-lorebook="router.push({ path: '/world', query: { character: character?.id || '', tab: 'lorebooks' } })"
          @open-character-card="character && router.push(`/characters/${character.id}/card`)"
          @open-prompt-debug="conversation && router.push(`/chat/${conversation.id}/debug`)"
          @open-memory-manager="conversation && router.push(`/chat/${conversation.id}/memory`)"
          @use-greeting="switchCharacterGreeting"
          @use-free-greeting="useFreeOpening"
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
          @edit="editSelectedMessage"
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

<style scoped>
.chat-page {
  position: relative;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at 20% 5%, rgba(255,255,255,.75), transparent 35%),
    #eef6fd;
}

:deep(.app-header--custom) {
  grid-template-columns: 42px minmax(0, 1fr) 92px;
  padding: 0 8px;
  background: rgba(255,255,255,.88);
}

.chat-header-back,
.chat-header-button {
  border: 0;
  background: transparent;
  color: #40566c;
  cursor: pointer;
}

.chat-header-back {
  font-size: 34px;
  line-height: 1;
}

.chat-identity {
  min-width: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font-weight: 700;
  cursor: pointer;
}

.chat-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.chat-header-button {
  width: 42px;
  height: 42px;
  font-size: 24px;
}

.chat-header-more {
  font-size: 18px;
  letter-spacing: 1px;
}

.now-playing-pill {
  align-self: center;
  max-width: calc(100% - 32px);
  margin: 10px 16px 0;
  padding: 7px 13px;
  overflow: hidden;
  border: 1px solid rgba(111,159,202,.18);
  border-radius: 999px;
  background: rgba(255,255,255,.82);
  color: #607d99;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 5px 16px rgba(63,92,122,.06);
}

.chat-error {
  flex: 0 0 auto;
  margin: 10px 14px 0;
  padding: 9px 12px;
  border-radius: 13px;
  text-align: center;
  font-size: 13px;
}

.chat-error {
  border: 0;
  background: rgba(255, 236, 240, .95);
  color: #a94f68;
}

.chat-error small {
  display: block;
  margin-top: 2px;
  opacity: .65;
}

.chat-notice {
  position: absolute;
  z-index: 18;
  top: 10px;
  left: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 10px 8px 14px;
  border: 1px solid rgba(111,151,190,.14);
  border-radius: 14px;
  background: rgba(255,255,255,.94);
  color: #71869a;
  text-align: center;
  font-size: 12px;
  box-shadow: 0 10px 28px rgba(57,86,116,.12);
  backdrop-filter: blur(16px);
}
.chat-notice span{min-width:0;flex:1}
.chat-notice button{width:27px;height:27px;flex:0 0 auto;padding:0;border:0;border-radius:50%;background:#eaf3fb;color:#67839f;font-size:18px}
.chat-notice-enter-active,.chat-notice-leave-active{transition:opacity .2s ease,transform .2s ease}
.chat-notice-enter-from,.chat-notice-leave-to{opacity:0;transform:translateY(-8px)}

.message-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 12px 13px 24px;
  overscroll-behavior: contain;

  /* 隐藏滚动条 */
  scrollbar-width: none;          /* Firefox */
  -ms-overflow-style: none;       /* IE / Edge */
  -webkit-overflow-scrolling: touch;
}

.message-list::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.message-time {
  margin: 15px 0 9px;
  text-align: center;
  color: rgba(91,63,74,.46);
  font-size: 11px;
}

.message-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 9px 0;
}

.message-row--theirs { justify-content: flex-start; }
.message-row--mine { justify-content: flex-end; }

.bubble {
  position: relative;
  max-width: 74%;
  padding: 11px 14px;
  border: 0;
  border-radius: 17px;
  line-height: 1.6;
  font-size: 15px;
  text-align: left;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 2px 10px rgba(58,83,107,.06);
  user-select: text;
  cursor: default;
}

.bubble--theirs {
  border-top-left-radius: 6px;
  background: #fff;
  color: #40566a;
}

.bubble--mine {
  border-top-right-radius: 6px;
  background: #8dbfe5;
  color: #fff;
}

.bubble--music {
  background: linear-gradient(145deg, #fff, #f0f7fd);
}

.music-message-mark {
  margin-right: 5px;
  color: #6fa3cc;
}

.typing-bubble {
  display: flex;
  gap: 4px;
  padding: 14px 17px;
  border-radius: 17px;
  border-top-left-radius: 6px;
  background: #fff;
}

.typing-bubble i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b89ca8;
  animation: typing 1.1s infinite ease-in-out;
}
.typing-bubble i:nth-child(2) { animation-delay: .15s; }
.typing-bubble i:nth-child(3) { animation-delay: .3s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: .45; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.empty-chat {
  margin-top: 70px;
  text-align: center;
  color: rgba(91,63,74,.42);
  font-size: 14px;
}

.composer {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 11px max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(0,0,0,.05);
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(18px);
}

.composer textarea {
  min-width: 0;
  min-height: 42px;
  max-height: 112px;
  flex: 1;
  padding: 10px 13px;
  resize: none;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 17px;
  outline: none;
  background: #fff;
  line-height: 1.45;
}

.composer-side-button,
.send-button,
.stop-button {
  flex: 0 0 auto;
  height: 42px;
  border: 0;
  border-radius: 15px;
  cursor: pointer;
}

.composer-side-button {
  width: 42px;
  background: rgba(232,138,176,.16);
  color: #6e9fc8;
  font-size: 25px;
}

.send-button,
.stop-button {
  min-width: 61px;
  padding: 0 13px;
  background: #78add8;
  color: #fff;
  font-weight: 700;
}

.stop-button { background: #6c7f91; }
.send-button:disabled { opacity: .45; }

.panel-backdrop {
  position: absolute;
  z-index: 30;
  inset: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(44,30,37,.28);
  backdrop-filter: blur(2px);
}

.bottom-panel,
.action-panel {
  width: 100%;
  max-height: 88%;
  overflow-y: auto;
  padding: 8px 18px 24px;
  border-radius: 26px 26px 0 0;
  background: #f9fcff;
  box-shadow: 0 -18px 50px rgba(70,42,55,.18);
}

.panel-handle {
  width: 42px;
  height: 5px;
  margin: 2px auto 15px;
  border-radius: 999px;
  background: #d9e7f2;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title-row h2 { margin: 2px 0 16px; }
.panel-title-row small { color: #7f95aa; }
.panel-title-row > button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #edf5fb;
  color: #5c748b;
  font-size: 22px;
}

.thought-person {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fff, #eaf5fd);
}

.thought-person p { margin: 5px 0 0; color: #6f879c; }
.thought-panel blockquote {
  margin: 18px 0;
  padding: 18px;
  border: 0;
  border-radius: 19px;
  background: #eef6fc;
  color: #654b57;
  line-height: 1.85;
}

.panel-primary {
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 15px;
  background: #78add8;
  color: #fff;
  font-weight: 700;
}

.panel-footnote,
.panel-empty {
  color: #748b9e;
  font-size: 12px;
  line-height: 1.65;
}
.panel-empty { padding: 28px 8px; text-align: center; }

.music-cover {
  width: 104px;
  height: 104px;
  display: grid;
  place-items: center;
  margin: 0 auto 18px;
  border-radius: 27px;
  background: linear-gradient(145deg, #ddecf9, #a9cfea);
  color: #fff;
  font-size: 48px;
  box-shadow: 0 16px 28px rgba(203,98,143,.22);
}

.music-panel label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin: 11px 0;
  font-size: 12px;
  font-weight: 700;
}

.music-panel input {
  padding: 11px 12px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 13px;
  background: #fff;
}

.local-file-button {
  align-items: center;
  padding: 11px;
  border-radius: 13px;
  background: #eaf3fa;
  color: #5f7c95;
  text-align: center;
  cursor: pointer;
}
.local-file-button input { display: none; }

.music-progress-row {
  display: grid;
  grid-template-columns: 38px 1fr 38px;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  font-size: 11px;
  color: #6e8497;
}
.music-progress-row input { width: 100%; }

.music-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 16px 0;
}

.music-play {
  width: 54px;
  height: 54px;
  border: 0;
  border-radius: 50%;
  background: #78add8;
  color: #fff;
  font-size: 21px;
}

.music-react {
  padding: 12px 17px;
  border: 0;
  border-radius: 15px;
  background: #e7f2fa;
  color: #506a80;
  font-weight: 700;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  border-radius: 15px;
  background: #edf5fb;
}
.settings-tabs button {
  padding: 9px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #74899d;
}
.settings-tabs button.active {
  background: #fff;
  color: #40566a;
  box-shadow: 0 3px 10px rgba(75,45,58,.07);
}

.settings-content { padding: 12px 0 4px; }
.setting-control,
.setting-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 3px;
  border-bottom: 1px solid rgba(80,50,62,.07);
}
.setting-control > span,
.setting-switch > span {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.setting-control small,
.setting-switch small { color: #7d91a5; font-size: 11px; }
.setting-control select,
.setting-control input {
  width: 112px;
  padding: 8px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 10px;
  background: #fff;
}
.setting-switch > input { width: 20px; height: 20px; accent-color: #78add8; }

.memory-add {
  display: grid;
  grid-template-columns: 1fr 58px;
  gap: 7px;
  margin: 14px 0;
}
.memory-add input,
.memory-add button {
  padding: 10px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 12px;
}
.memory-add button { background: #78add8; color: #fff; border: 0; }

.memory-list article {
  position: relative;
  margin: 9px 0;
  padding: 12px 48px 12px 13px;
  border-radius: 14px;
  background: #eef6fc;
}
.memory-list article small { color: #7f98ae; }
.memory-list article p { margin: 5px 0 0; line-height: 1.55; }
.memory-list article button {
  position: absolute;
  top: 12px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #6b91b4;
}

.danger-row {
  width: 100%;
  margin-top: 13px;
  padding: 12px;
  border: 0;
  border-radius: 13px;
  background: #f3f9fe;
  color: #a45a69;
}

.advanced-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 15px;
  border-radius: 16px;
  background: #eef6fc;
}
.advanced-card small,
.advanced-card span { color: #788ca0; }
.technical-note,
.technical-error,
.technical-ok {
  margin: 12px 0;
  padding: 12px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
}
.technical-note { background: #fff5e7; color: #8c6a37; }
.technical-error { background: #f3f9fe; color: #9f4d63; }
.technical-error p { margin: 5px 0 0; }
.technical-ok { background: #edf8f1; color: #547663; }

.action-panel { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
.selected-preview {
  max-height: 80px;
  overflow: hidden;
  padding: 12px;
  border-radius: 13px;
  background: #eef6fc;
  color: #617f99;
}
.action-panel > button {
  width: 100%;
  padding: 13px;
  border: 0;
  border-bottom: 1px solid rgba(80,50,62,.07);
  background: transparent;
  color: #40566c;
  font-weight: 700;
}
.action-panel .danger-text { color: #b44f68; }



/* V0.3.1：沉浸式聊天交互 */
.message-list {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.message-list::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.message-row {
  animation: bubble-in .22s cubic-bezier(.2, .82, .24, 1) both;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translate3d(0, 7px, 0) scale(.985);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.bubble {
  overflow: hidden;
  touch-action: pan-y;
  -webkit-touch-callout: none;
}

.bubble--image {
  width: min(248px, 68vw);
  max-width: 74%;
  padding: 4px;
  line-height: 0;
}

.message-image {
  display: block;
  width: 100%;
  max-height: 330px;
  object-fit: cover;
  border-radius: 13px;
  cursor: zoom-in;
}

.message-reply-quote {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: -3px -4px 8px;
  padding: 6px 8px;
  overflow: hidden;
  border-left: 3px solid rgba(210, 102, 148, .58);
  border-radius: 7px;
  background: rgba(221, 195, 206, .25);
  line-height: 1.35;
  font-size: 11px;
  color: #667f96;
}

.message-reply-quote b,
.message-reply-quote span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-reply-quote--mine {
  border-left-color: rgba(255, 255, 255, .72);
  background: rgba(255, 255, 255, .18);
  color: rgba(255, 255, 255, .92);
}

.reply-preview-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 7px;
  border-top: 1px solid rgba(0, 0, 0, .045);
  background: rgba(255, 255, 255, .91);
}

.reply-preview-bar > div {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 9px;
  border-left: 3px solid #79add8;
}

.reply-preview-bar b {
  color: #6f9dc4;
  font-size: 12px;
}

.reply-preview-bar span {
  overflow: hidden;
  color: #73889c;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-preview-bar > button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: #eaf3fb;
  color: #617b93;
  font-size: 19px;
}

.image-input {
  display: none;
}

.composer textarea {
  height: 42px;
  overflow-y: auto;
  transition: height .12s ease;
}

.scroll-bottom-button {
  position: absolute;
  z-index: 8;
  right: 17px;
  bottom: calc(78px + env(safe-area-inset-bottom));
  width: 38px;
  height: 38px;
  border: 1px solid rgba(113, 75, 91, .1);
  border-radius: 50%;
  background: rgba(255, 255, 255, .94);
  color: #9c6079;
  font-size: 20px;
  box-shadow: 0 7px 22px rgba(80, 49, 62, .15);
  backdrop-filter: blur(14px);
  animation: scroll-button-in .18s ease both;
}

@keyframes scroll-button-in {
  from { opacity: 0; transform: translateY(8px) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.panel-backdrop {
  animation: backdrop-in .18s ease both;
}

@keyframes backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.bottom-panel,
.action-panel {
  transition: transform .24s cubic-bezier(.22, .8, .24, 1);
  will-change: transform;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.panel-handle {
  position: relative;
  width: 84px;
  height: 17px;
  margin-top: -3px;
  background: transparent;
  touch-action: none;
  cursor: grab;
}

.panel-handle::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  width: 42px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #d9e7f2;
}

.panel-handle:active {
  cursor: grabbing;
}

.selected-preview {
  max-height: 140px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.selected-preview img {
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 11px;
}

.selected-preview p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  line-height: 1.55;
}

.image-preview-backdrop {
  position: absolute;
  z-index: 60;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(25, 18, 22, .91);
  backdrop-filter: blur(14px);
  animation: backdrop-in .18s ease both;
}

.image-preview-backdrop img {
  max-width: 100%;
  max-height: 88%;
  object-fit: contain;
  border-radius: 18px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, .34);
}

.image-preview-backdrop button {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  right: 14px;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  font-size: 25px;
}


/* V0.3.2：图片理解、发送预览与消息可靠性 */
.typing-bubble {
  align-items: center;
  flex-wrap: wrap;
  max-width: min(260px, 72vw);
}

.typing-bubble span {
  width: 100%;
  color: #8a6d79;
  font-size: 12px;
  line-height: 1.35;
}

.bubble--image {
  display: flex;
  flex-direction: column;
  gap: 0;
  line-height: 1.5;
}

.image-caption {
  display: block;
  padding: 8px 9px 7px;
  color: #644a55;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  overflow-wrap: anywhere;
}

.image-caption--mine {
  color: #fff;
}

.pending-image-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-top: 1px solid rgba(0, 0, 0, .045);
  background: rgba(255, 255, 255, .94);
}

.pending-image-bar img {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 12px;
}

.pending-image-bar > div {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 3px;
}

.pending-image-bar b {
  color: #6f4d5b;
  font-size: 13px;
}

.pending-image-bar span {
  overflow: hidden;
  color: #987785;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-image-bar > button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: #eaf3fb;
  color: #617b93;
  font-size: 19px;
}

.message-delivery-state {
  align-self: flex-end;
  margin: 0 -2px 2px 0;
  padding: 3px 4px;
  border: 0;
  background: transparent;
  color: #73889c;
  font-size: 10px;
  white-space: nowrap;
}

.message-delivery-state--failed,
.message-delivery-state--cancelled {
  color: #c84f63;
  font-weight: 700;
}

.composer-side-button:disabled {
  opacity: .45;
}

.vision-capability {
  margin-top: 4px;
  color: #a45c7b;
  font-size: 12px;
}


.missing-image {
  min-width: 180px;
  display: grid;
  gap: 5px;
  padding: 18px 14px;
  color: #8c6c79;
  line-height: 1.45;
  text-align: center;
}

.missing-image small {
  color: inherit;
  opacity: .8;
}

.missing-image--mine {
  color: #fff;
}

@media (max-width: 460px) {
  .composer {
    padding-bottom: max(14px, calc(env(safe-area-inset-bottom) + 7px));
  }

  .scroll-bottom-button {
    bottom: calc(72px + env(safe-area-inset-bottom));
  }
}

</style>
