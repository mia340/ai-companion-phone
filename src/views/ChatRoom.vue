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
import { useBottomPanel } from '../composables/useBottomPanel'
import { useChatScroll, type ChatMessageListHandle } from '../composables/useChatScroll'
import { useChatSpeech } from '../composables/useChatSpeech'

import { db } from '../db/database'
import {
  MockProvider,
  isVisionUnsupportedError,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamChunk,
  type ChatTurn,
  type ModelProvider
} from '../services/ai/provider'
import { createProvider } from '../services/ai/providerFactory'
import { getModelSettings, getVisionCapability, saveVisionCapability } from '../services/modelSettings'
import { MAX_CHAT_IMAGES, prepareChatImageBatch, type PreparedChatImage } from '../services/imageService'
import { getMessageImages, getMessageImageUrls } from '../services/messageImageService'
import {
  getChatSettings,
  getConversationState,
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
  rememberFromMessage,
  removeMemory
} from '../services/memoryService'
import { generateVisibleCharacterState } from '../services/characterStateService'
import {
  getRelationship,
  maybeCreateProactiveMessage,
  recordInteraction,
  recordMusicMoment,
  relationshipPrompt
} from '../services/relationshipService'
import { getOrCreateUserProfile } from '../services/userProfile'
import type {
  Character,
  CharacterMemory,
  CharacterRelationship,
  ChatSettings,
  Conversation,
  ConversationState,
  Message,
  MessageReplyReference,
  MusicState,
  UserProfile
} from '../types/domain'
import type { ModelSettings } from '../types/modelSettings'

const route = useRoute()
const router = useRouter()
const conversation = ref<Conversation>()
const character = ref<Character>()
const userProfile = ref<UserProfile>()
const messages = ref<Message[]>([])
const memories = ref<CharacterMemory[]>([])
const chatSettings = ref<ChatSettings>()
const conversationState = ref<ConversationState>()
const musicState = ref<MusicState>()
const modelSettings = ref<ModelSettings>()
const relationship = ref<CharacterRelationship>()
const draft = ref('')
const isSending = ref(false)
const streamingMessageId = ref('')
const isLoadingThought = ref(false)
const errorMessage = ref('')
const noticeMessage = ref('')
const newMemoryText = ref('')
const settingsTab = ref<'chat' | 'memory' | 'advanced'>('chat')
const activePanel = ref<'thought' | 'music' | 'settings' | 'message' | null>(null)
const selectedMessage = ref<Message>()
const replyTarget = ref<Message>()
const previewImages = ref<string[]>([])
const previewImageIndex = ref(0)
const pendingImages = ref<PreparedChatImage[]>([])
const isPreparingImage = ref(false)

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
let noticeTimer: number | undefined
let streamPersistTimer: number | undefined
let streamScrollFrame: number | undefined
let localAudioObjectUrl = ''
let lastMusicSaveSecond = -1

const title = computed(() => character.value?.name || conversation.value?.title || '聊天')
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
  return '本地模拟'
})
const canSend = computed(() => Boolean(draft.value.trim() || pendingImages.value.length) && !isSending.value && !isPreparingImage.value)
const sendingHint = computed(() => {
  const latest = [...messages.value].reverse().find(item => item.senderId === 'user')
  return latest?.type === 'image' ? '正在认真看你发来的图片…' : '正在想该怎么回应你…'
})
const visionCapabilityLabel = computed(() => {
  const settings = modelSettings.value
  if (!settings) return '尚未检测'
  const capability = getVisionCapability(settings)
  if (capability === 'supported') return '可理解图片'
  if (capability === 'unsupported') return '图片将使用自然兜底回应'
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
  relationship,
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
  if (message.type === 'image') {
    const caption = message.content.trim()
    return caption ? `[图片] ${caption}` : '[图片]'
  }
  const text = message.content.replace(/\s+/g, ' ').trim()
  return text.length > maxLength
    ? `${text.slice(0, maxLength)}…`
    : text
}

function messageSenderName(message: Message) {
  return message.senderId === 'user'
    ? (userProfile.value?.name || '我')
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

function formatMessageForPrompt(message: Message) {
  const caption = message.content.trim()
  const imageCount = getMessageImages(message).length
  const imageLabel = imageCount > 1 ? `${imageCount} 张图片` : '一张图片'
  const base = message.type === 'image'
    ? caption
      ? `用户分享了${imageLabel}，并说：“${caption}”。当前无法确认图片细节，请围绕附言和分享行为自然回应，不要猜测图中具体内容，也不要解释技术限制。`
      : `用户分享了${imageLabel}。当前无法确认图片细节，请自然回应这次分享，不要猜测图中具体内容，也不要解释技术限制。`
    : message.content
  if (!message.replyTo) return base
  return `这条消息是在回复${message.replyTo.senderName}的“${message.replyTo.preview}”。\n${base}`
}

function imageMessageContent(message: Message): ChatTurn['content'] {
  const images = getMessageImages(message).filter(image => Boolean(image.dataUrl))
  const countLabel = images.length > 1 ? `这 ${images.length} 张图片` : '这张图片'
  const text = message.content.trim()
    ? `请认真查看${countLabel}，并结合用户的话自然回应：“${message.content.trim()}”`
    : `请认真查看${countLabel}，根据你实际看到的内容自然回应。不要编造看不清或无法确认的细节。`
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
  const link = document.createElement('a')
  link.href = url
  link.download = `chat-image-${Date.now()}-${index + 1}.jpg`
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

function clearPendingImages() {
  pendingImages.value = []
}

async function recoverInterruptedMessages(
  rows: Message[]
) {
  const emptyAssistantIds: string[] = []
  const recovered: Message[] = []
  const updates: Message[] = []

  for (const message of rows) {
    if (message.status !== 'pending') {
      recovered.push(message)
      continue
    }

    if (
      message.senderId !== 'user' &&
      !message.content.trim()
    ) {
      emptyAssistantIds.push(message.id)
      continue
    }

    const next: Message = {
      ...message,
      status: 'cancelled',
      errorText: undefined
    }

    recovered.push(next)
    updates.push(next)
  }

  if (emptyAssistantIds.length || updates.length) {
    await db.transaction(
      'rw',
      db.messages,
      async () => {
        if (emptyAssistantIds.length) {
          await db.messages.bulkDelete(
            emptyAssistantIds
          )
        }

        if (updates.length) {
          await db.messages.bulkPut(updates)
        }
      }
    )
  }

  return recovered
}


async function loadConversation(conversationId: string) {
  errorMessage.value = ''
  pendingImages.value = []
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
      modelRow
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
      getModelSettings()
    ])

    const recoveredMessageRows =
      await recoverInterruptedMessages(messageRows)

    conversation.value = conversationRow
    messages.value = recoveredMessageRows
    character.value = characterRow
    userProfile.value = profileRow
    chatSettings.value = settingsRow
    conversationState.value = stateRow
    musicState.value = musicRow
    memories.value = memoryRows
    modelSettings.value = modelRow
    relationship.value = characterRow
      ? await getRelationship(characterRow.id)
      : undefined
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

    if (characterRow) {
      const proactive = await maybeCreateProactiveMessage({
        character: characterRow,
        conversationId,
        worldId: conversationRow.worldId,
        messages: recoveredMessageRows,
        enabled: settingsRow.proactiveEnabled ?? true,
        intervalHours: settingsRow.proactiveIntervalHours ?? 12
      })
      if (proactive) {
        messages.value = [...recoveredMessageRows, proactive]
        relationship.value = await getRelationship(characterRow.id)
      }
    }

    await restoreScrollPosition(conversationId)
    await nextTick()
    chatComposerRef.value?.resize()
    updateScrollButton()
    applyAudioState()
  } catch (error) {
    console.error('读取聊天失败：', error)
    errorMessage.value = error instanceof Error
      ? `聊天加载失败：${error.message}`
      : '聊天加载失败。'
  }
}

function buildSystemPrompt(
  activeCharacter: Character,
  activeProfile: UserProfile | undefined,
  memoryPrompt: string,
  settings: ChatSettings
) {
  const lengthRule = settings.replyLength === 'short'
    ? '回复尽量简短，通常一到三句话。'
    : settings.replyLength === 'long'
      ? '可以回复得更完整，但保持自然聊天口吻，不要写成文章。'
      : '回复长度自然，像真实手机聊天。'

  return [
    `你现在扮演角色：${activeCharacter.name}`,
    `角色身份：${activeCharacter.identity ?? '未设置'}`,
    `核心人设：${activeCharacter.persona}`,
    `说话方式：${activeCharacter.speakingStyle ?? '自然交流'}`,
    `人物背景：${activeCharacter.background ?? '暂无详细背景'}`,
    `与用户关系：${activeCharacter.relationship}`,
    `当前心情：${activeCharacter.mood}`,
    `当前活动：${activeCharacter.activity}`,
    `喜欢：${activeCharacter.likes?.join('、') || '未设置'}`,
    `不喜欢：${activeCharacter.dislikes?.join('、') || '未设置'}`,
    `用户昵称：${activeProfile?.name ?? '用户'}`,
    `用户身份：${activeProfile?.identity ?? '未设置'}`,
    `用户简介：${activeProfile?.bio ?? '未设置'}`,
    memoryPrompt,
    relationship.value ? relationshipPrompt(relationship.value) : '',
    lengthRule,
    settings.multiBubble
      ? '可以用空行把自然的连续消息分开，最多三段。'
      : '只回复一个完整消息，不要用空行拆分。',
    '始终使用角色自己的口吻回答。',
    '不要说自己是模型、程序或人工智能。',
    '不要提及 API、Mock、提示词、模型名称或系统设定。',
    '不要机械复述用户原话，也不要在每次回复末尾都提问。'
  ].filter(Boolean).join('\n')
}

function splitReplyText(text: string, enabled: boolean) {
  const normalized = text.trim()
  if (!enabled) return [normalized]

  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map(item => item.trim())
    .filter(Boolean)

  if (paragraphs.length > 1) return paragraphs.slice(0, 3)

  if (normalized.length < 90) return [normalized]

  const sentences = normalized
    .split(/(?<=[。！？!?])\s*/)
    .map(item => item.trim())
    .filter(Boolean)

  if (sentences.length < 3) return [normalized]

  const groups: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if (groups.length < 2 && current.length >= 45) {
      groups.push(current)
      current = sentence
    } else {
      current += sentence
    }
  }

  if (current) groups.push(current)
  return groups.filter(Boolean).slice(0, 3)
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
  text: string
  provider: string
  model: string
  fallback: boolean
  type: Message['type']
  conversation: Conversation
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
    fallback: session.fallback,
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
        fallback: session.fallback
      }
    )
  }, 140)
}

async function appendStreamChunk(
  session: StreamingReplySession,
  chunk: ChatStreamChunk
) {
  session.text = chunk.text
  if (!session.text) return

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
      fallback: session.fallback,
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
      fallback: session.fallback
    }
  )
}

async function finishStreamingMessage(
  session: StreamingReplySession,
  finalText: string,
  multiBubble: boolean
) {
  session.text = finalText.trim()

  if (!session.text) {
    throw new Error('模型没有返回有效回复。')
  }

  if (!session.messageId) {
    await saveAssistantBubbles({
      texts: splitReplyText(session.text, multiBubble),
      provider: session.provider,
      model: session.model,
      fallback: session.fallback,
      type: session.type
    })
    return
  }

  await flushStreamingMessage(session)

  const bubbles = splitReplyText(
    session.text,
    multiBubble
  )

  if (bubbles.length <= 1) {
    await db.messages.update(
      session.messageId,
      {
        content: session.text,
        status: 'delivered',
        provider: session.provider,
        model: session.model,
        fallback: session.fallback,
        errorText: undefined
      }
    )
  } else {
    const source = messages.value.find(
      item => item.id === session.messageId
    )
    const groupId =
      source?.replyGroupId ?? crypto.randomUUID()
    const baseTime = source?.createdAt
      ? new Date(source.createdAt).getTime()
      : Date.now()

    await db.transaction(
      'rw',
      db.messages,
      db.conversations,
      async () => {
        await db.messages.delete(session.messageId!)

        await db.messages.bulkAdd(
          bubbles.map((content, index): Message => ({
            id: crypto.randomUUID(),
            worldId: session.conversation.worldId,
            conversationId: session.conversation.id,
            senderId: session.conversation.memberIds[0],
            type: session.type,
            content,
            status: 'delivered',
            createdAt: new Date(baseTime + index).toISOString(),
            provider: session.provider,
            model: session.model,
            fallback: session.fallback,
            replyGroupId: groupId
          }))
        )

        await db.conversations.update(
          session.conversation.id,
          { updatedAt: new Date().toISOString() }
        )
      }
    )
  }

  messages.value = await db.messages
    .where('conversationId')
    .equals(session.conversation.id)
    .sortBy('createdAt')

  streamingMessageId.value = ''
  session.messageId = undefined
  clearStreamTimers()
  await scrollToBottom('auto')
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
      fallback: session.fallback
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
      fallback: session.fallback
    }
  }

  streamingMessageId.value = ''
  session.messageId = undefined
  clearStreamTimers()
  return true
}

async function saveAssistantBubbles(options: {
  texts: string[]
  provider: string
  model: string
  fallback: boolean
  type?: Message['type']
  signal?: AbortSignal
}) {
  if (!conversation.value) return

  const activeConversation = conversation.value
  const groupId = crypto.randomUUID()

  for (let index = 0; index < options.texts.length; index += 1) {
    if (options.signal?.aborted) {
      throw new DOMException('请求已取消', 'AbortError')
    }

    if (index > 0 && chatSettings.value?.naturalDelay) {
      await wait(420 + Math.min(900, options.texts[index].length * 12), options.signal)
    }

    const now = new Date().toISOString()

    await db.transaction(
      'rw',
      db.messages,
      db.conversations,
      async () => {
        await db.messages.add({
          id: crypto.randomUUID(),
          worldId: activeConversation.worldId,
          conversationId: activeConversation.id,
          senderId: activeConversation.memberIds[0],
          type: options.type ?? 'text',
          content: options.texts[index],
          status: 'delivered',
          createdAt: now,
          provider: options.provider,
          model: options.model,
          fallback: options.fallback,
          replyGroupId: groupId
        })

        await db.conversations.update(activeConversation.id, {
          updatedAt: now
        })
      }
    )

    messages.value = await db.messages
      .where('conversationId')
      .equals(activeConversation.id)
      .sortBy('createdAt')

    await scrollToBottom()
  }
}

async function requestAssistantReply(options?: {
  musicPrompt?: string
  type?: Message['type']
  sourceMessageId?: string
  visualMessageId?: string
}) {
  if (!conversation.value || !character.value || !chatSettings.value) return

  abortController = new AbortController()
  const signal = abortController.signal
  isSending.value = true
  errorMessage.value = ''
  noticeMessage.value = ''

  const activeConversation = conversation.value
  const activeCharacter = character.value
  const settings = chatSettings.value
  const streamSession: StreamingReplySession = {
    text: '',
    provider: '',
    model: '',
    fallback: false,
    type: options?.type ?? 'text',
    conversation: activeConversation
  }

  let visualMessage: Message | undefined
  let visionUsed = false
  let visionFallback = false

  try {
    let currentModelSettings = await getModelSettings()
    modelSettings.value = currentModelSettings
    const provider = createProvider(currentModelSettings)

    const memoryPrompt = settings.memoryEnabled
      ? buildMemoryPrompt(memories.value, conversationState.value?.summary ?? '')
      : ''

    visualMessage = options?.visualMessageId
      ? messages.value.find(item => item.id === options.visualMessageId)
      : undefined

    const visionCapability = getVisionCapability(currentModelSettings)
    const mayUseVision = Boolean(
      visualMessage?.type === 'image' &&
      getMessageImageUrls(visualMessage).length > 0 &&
      visionCapability !== 'unsupported'
    )

    visionUsed = mayUseVision
    visionFallback = Boolean(visualMessage) && !mayUseVision

    const buildRecentTurns = (includeVision: boolean): ChatTurn[] => {
      const turns: ChatTurn[] = messages.value
        .filter(message => message.type !== 'system')
        .slice(-settings.recentMessageLimit)
        .map(message => ({
          role: message.senderId === 'user'
            ? ('user' as const)
            : ('assistant' as const),
          content: includeVision && message.id === visualMessage?.id
            ? imageMessageContent(message)
            : formatMessageForPrompt(message)
        }))

      if (options?.musicPrompt) {
        turns.push({
          role: 'user',
          content: options.musicPrompt
        })
      }

      return turns
    }

    const createRequest = (includeVision: boolean): ChatRequest => ({
      model: currentModelSettings.model,
      temperature: currentModelSettings.temperature,
      signal,
      character: {
        characterName: activeCharacter.name,
        userName: userProfile.value?.name,
        identity: activeCharacter.identity,
        persona: activeCharacter.persona,
        speakingStyle: activeCharacter.speakingStyle,
        background: activeCharacter.background,
        relationship: activeCharacter.relationship,
        mood: activeCharacter.mood,
        activity: activeCharacter.activity,
        likes: activeCharacter.likes,
        dislikes: activeCharacter.dislikes
      },
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(
            activeCharacter,
            userProfile.value,
            memoryPrompt,
            settings
          )
        },
        ...buildRecentTurns(includeVision)
      ]
    })

    let response: ChatResponse
    let providerId = provider.id
    let usedModel = currentModelSettings.model
    let fallback = false
    let providerNotice = ''

    const runProvider = async (
      activeProvider: ModelProvider,
      request: ChatRequest
    ) => {
      streamSession.provider = activeProvider.id
      streamSession.model = request.model
      streamSession.fallback = fallback

      if (!settings.streamResponse) {
        return activeProvider.chat(request)
      }

      return activeProvider.chatStream(
        request,
        {
          onDelta: chunk =>
            appendStreamChunk(streamSession, chunk)
        }
      )
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
        providerNotice = '当前模型不支持图片理解，本次已自动使用自然兜底回应。'
      }
    } catch (providerError) {
      if (isAbortError(providerError)) throw providerError

      const mayFallback =
        !streamSession.text &&
        provider.id !== 'mock' &&
        settings.autoFallback &&
        currentModelSettings.fallbackToMock

      if (!mayFallback) throw providerError

      const fallbackProvider = new MockProvider()
      providerId = fallbackProvider.id
      usedModel = 'mock'
      fallback = true
      visionUsed = false
      visionFallback = Boolean(visualMessage)

      response = await runProvider(
        fallbackProvider,
        {
          ...createRequest(false),
          model: 'mock',
          signal
        }
      )

      providerNotice = providerError instanceof Error
        ? `真实接口未响应，已使用本地回复。原因：${providerError.message}`
        : '真实接口未响应，已使用本地回复。'
    }

    if (settings.streamResponse) {
      streamSession.provider = providerId
      streamSession.model = usedModel
      streamSession.fallback = fallback

      await finishStreamingMessage(
        streamSession,
        response.text,
        settings.multiBubble
      )
    } else {
      if (settings.naturalDelay) {
        await wait(
          240 + Math.min(900, response.text.length * 9),
          signal
        )
      }

      const bubbles = splitReplyText(
        response.text,
        settings.multiBubble
      )

      await saveAssistantBubbles({
        texts: bubbles,
        provider: providerId,
        model: usedModel,
        fallback,
        type: options?.type,
        signal
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
        .find(message => message.senderId !== 'user' && message.status === 'delivered')
      speakText(response.text, latestAssistant?.id ?? '')
    }
  } catch (error) {
    if (isAbortError(error)) {
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
        ? '已停止生成，已经出现的内容已保留。'
        : '已停止等待回复，可长按消息重新发送。'
      return
    }

    console.error('获取角色回复失败：', error)
    const technical = error instanceof Error
      ? error.message
      : '未知错误'

    const preserved = await preserveInterruptedStream(
      streamSession,
      'failed',
      technical
    )

    await updateUserMessageState(
      options?.sourceMessageId,
      preserved ? 'read' : 'failed',
      {
        errorText: preserved ? undefined : technical,
        visionUsed: visualMessage ? visionUsed : undefined,
        visionFallback: visualMessage ? visionFallback : undefined
      }
    )

    errorMessage.value = preserved
      ? '回复在生成途中中断，已保留现有内容。'
      : '对方暂时没有回应。'

    conversationState.value = await patchConversationState(
      activeConversation.id,
      {
        lastTechnicalError: technical,
        lastProviderNotice: ''
      }
    )
  } finally {
    isSending.value = false
    streamingMessageId.value = ''
    clearStreamTimers()
    abortController = undefined
  }
}

async function send() {
  const text = draft.value.trim()
  const images = pendingImages.value.slice()
  if ((!text && !images.length) || !conversation.value || !character.value || isSending.value || isPreparingImage.value) return
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
      bytes: image.bytes
    })),
    imageDataUrl: firstImage?.dataUrl,
    imageName: firstImage?.name,
    imageWidth: firstImage?.width,
    imageHeight: firstImage?.height,
    imageBytes: firstImage?.bytes
  }
  draft.value = ''
  pendingImages.value = []
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
    relationship.value = await recordInteraction({ character: character.value, conversationId: activeConversation.id, message })
    if (chatSettings.value?.memoryEnabled && text) {
      await rememberFromMessage({
        conversationId: activeConversation.id,
        characterId: character.value.id,
        sourceMessageId: messageId,
        text,
        strength: chatSettings.value.memoryStrength
      })
      await refreshMemoryList()
    }
    await requestAssistantReply({ sourceMessageId: messageId, visualMessageId: images.length ? messageId : undefined })
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

  const remaining = MAX_CHAT_IMAGES - pendingImages.value.length
  if (remaining <= 0) {
    noticeMessage.value = `已经达到 ${MAX_CHAT_IMAGES} 张上限。`
    return
  }

  const selected = files.slice(0, remaining)
  isPreparingImage.value = true
  noticeMessage.value = `正在整理 0 / ${selected.length} 张图片…`

  try {
    const result = await prepareChatImageBatch(selected, {
      maxCount: remaining,
      onProgress: (completed, total) => {
        noticeMessage.value = `正在整理 ${completed} / ${total} 张图片…`
      }
    })

    const existingKeys = new Set(
      pendingImages.value.map(image => `${image.name}:${image.originalBytes}:${image.width}x${image.height}`)
    )
    const uniquePrepared = result.prepared.filter(image => {
      const key = `${image.name}:${image.originalBytes}:${image.width}x${image.height}`
      if (existingKeys.has(key)) return false
      existingKeys.add(key)
      return true
    })
    pendingImages.value.push(...uniquePrepared)

    const skippedByLimit = Math.max(0, files.length - remaining)
    const duplicateCount = result.prepared.length - uniquePrepared.length
    const notes: string[] = []
    if (uniquePrepared.length) notes.push(`已添加 ${uniquePrepared.length} 张`)
    if (result.rejected.length) notes.push(`${result.rejected.length} 张无法处理`)
    if (duplicateCount) notes.push(`${duplicateCount} 张重复图片已跳过`)
    if (skippedByLimit) notes.push(`超过上限的 ${skippedByLimit} 张已跳过`)
    noticeMessage.value = notes.join('，') || '没有添加新图片。'

    await nextTick()
    chatComposerRef.value?.focus()
    chatComposerRef.value?.resize()
  } catch (error) {
    noticeMessage.value = error instanceof Error ? error.message : '图片读取失败。'
  } finally {
    isPreparingImage.value = false
  }
}

function stopGeneration() {
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
      profile: userProfile.value,
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
  } finally {
    isLoadingThought.value = false
  }
}

function openSettings(tab: 'chat' | 'memory' | 'advanced' = 'chat') {
  settingsTab.value = tab
  activePanel.value = 'settings'
}

async function persistChatSettings() {
  if (!chatSettings.value) return
  await saveChatSettings(chatSettings.value)
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
  activePanel.value = null
}


async function copySelectedMessage() {
  if (!selectedMessage.value) return
  await navigator.clipboard.writeText(selectedMessage.value.content)
  noticeMessage.value = '已复制。'
  activePanel.value = null
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
  await deleteSelectedMessage()
  await requestAssistantReply({
    sourceMessageId: source?.id,
    visualMessageId: source?.type === 'image' ? source.id : undefined
  })
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

  if (character.value && conversation.value) {
    await recordMusicMoment(character.value.id, conversation.value.id, music.title)
    relationship.value = await getRelationship(character.value.id)
  }

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
        :user-profile="userProfile"
        :is-sending="isSending"
        :show-typing="chatSettings?.showTyping"
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
        @click.self="activePanel = null"
      >
        <ChatThoughtPanel
          v-if="activePanel === 'thought'"
          :title="title"
          :character="character"
          :conversation-state="conversationState"
          :relationship="relationship"
          :chat-settings="chatSettings"
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
          :conversation-state="conversationState"
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
        />

        <ChatActionSheet
          v-else-if="activePanel === 'message'"
          :message="selectedMessage"
          :preview="selectedMessage ? messagePreview(selectedMessage, 90) : ''"
          :is-sending="isSending"
          :panel-style="panelStyle"
          @drag-start="beginPanelDrag"
          @drag-move="movePanelDrag"
          @drag-end="endPanelDrag"
          @reply="replyToSelectedMessage"
          @copy="copySelectedMessage"
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
    #f4edf1;
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
  color: #5f4651;
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
  border: 1px solid rgba(214, 107, 153, .18);
  border-radius: 999px;
  background: rgba(255,255,255,.82);
  color: #8d5a70;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 5px 16px rgba(100,60,78,.06);
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
  border: 1px solid rgba(196,112,147,.12);
  border-radius: 14px;
  background: rgba(255,255,255,.94);
  color: #8a6e79;
  text-align: center;
  font-size: 12px;
  box-shadow: 0 10px 28px rgba(89,56,70,.13);
  backdrop-filter: blur(16px);
}
.chat-notice span{min-width:0;flex:1}
.chat-notice button{width:27px;height:27px;flex:0 0 auto;padding:0;border:0;border-radius:50%;background:#f4e8ed;color:#8c6475;font-size:18px}
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
  box-shadow: 0 2px 10px rgba(89,56,70,.06);
  user-select: text;
  cursor: default;
}

.bubble--theirs {
  border-top-left-radius: 6px;
  background: #fff;
  color: #563f49;
}

.bubble--mine {
  border-top-right-radius: 6px;
  background: #e88ab0;
  color: #fff;
}

.bubble--music {
  background: linear-gradient(145deg, #fff, #fff1f7);
}

.music-message-mark {
  margin-right: 5px;
  color: #cf6f98;
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
  color: #cf6793;
  font-size: 25px;
}

.send-button,
.stop-button {
  min-width: 61px;
  padding: 0 13px;
  background: #d96b99;
  color: #fff;
  font-weight: 700;
}

.stop-button { background: #826a75; }
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
  background: #fffafb;
  box-shadow: 0 -18px 50px rgba(70,42,55,.18);
}

.panel-handle {
  width: 42px;
  height: 5px;
  margin: 2px auto 15px;
  border-radius: 999px;
  background: #dccbd2;
}

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title-row h2 { margin: 2px 0 16px; }
.panel-title-row small { color: #a17c8d; }
.panel-title-row > button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f3e9ed;
  color: #765864;
  font-size: 22px;
}

.thought-person {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fff, #ffeaf3);
}

.thought-person p { margin: 5px 0 0; color: #927483; }
.thought-panel blockquote {
  margin: 18px 0;
  padding: 18px;
  border: 0;
  border-radius: 19px;
  background: #f5edf1;
  color: #654b57;
  line-height: 1.85;
}

.panel-primary {
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 15px;
  background: #d96b99;
  color: #fff;
  font-weight: 700;
}

.panel-footnote,
.panel-empty {
  color: #9a7d8a;
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
  background: linear-gradient(145deg, #ffdbea, #e99abb);
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
  background: #f4e9ee;
  color: #8a6073;
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
  color: #8d6e7b;
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
  background: #d96b99;
  color: #fff;
  font-size: 21px;
}

.music-react {
  padding: 12px 17px;
  border: 0;
  border-radius: 15px;
  background: #f2e6eb;
  color: #76515f;
  font-weight: 700;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  border-radius: 15px;
  background: #f2e9ed;
}
.settings-tabs button {
  padding: 9px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #8d707c;
}
.settings-tabs button.active {
  background: #fff;
  color: #5e414d;
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
.setting-switch small { color: #9d7f8c; font-size: 11px; }
.setting-control select,
.setting-control input {
  width: 112px;
  padding: 8px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 10px;
  background: #fff;
}
.setting-switch > input { width: 20px; height: 20px; accent-color: #d96b99; }

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
.memory-add button { background: #d96b99; color: #fff; border: 0; }

.memory-list article {
  position: relative;
  margin: 9px 0;
  padding: 12px 48px 12px 13px;
  border-radius: 14px;
  background: #f5edf1;
}
.memory-list article small { color: #a57a8e; }
.memory-list article p { margin: 5px 0 0; line-height: 1.55; }
.memory-list article button {
  position: absolute;
  top: 12px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #b26178;
}

.danger-row {
  width: 100%;
  margin-top: 13px;
  padding: 12px;
  border: 0;
  border-radius: 13px;
  background: #fff0f2;
  color: #b34f69;
}

.advanced-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 15px;
  border-radius: 16px;
  background: #f5edf1;
}
.advanced-card small,
.advanced-card span { color: #927684; }
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
.technical-error { background: #fff0f2; color: #9f4d63; }
.technical-error p { margin: 5px 0 0; }
.technical-ok { background: #edf8f1; color: #547663; }

.action-panel { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
.selected-preview {
  max-height: 80px;
  overflow: hidden;
  padding: 12px;
  border-radius: 13px;
  background: #f4ecef;
  color: #7f6470;
}
.action-panel > button {
  width: 100%;
  padding: 13px;
  border: 0;
  border-bottom: 1px solid rgba(80,50,62,.07);
  background: transparent;
  color: #5f4651;
  font-weight: 700;
}
.action-panel .danger-text { color: #b44f68; }

.relationship-glance {
  margin: 14px 0;
  padding: 13px 15px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 12px;
  border-radius: 16px;
  background: rgba(255,255,255,.68);
}
.relationship-glance span,
.relationship-glance small { color: #8b6d79; }
.relationship-glance strong { color: #b65f86; }
.relationship-glance small { grid-column: 1 / -1; }


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
  color: #856673;
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
  border-left: 3px solid #da729f;
}

.reply-preview-bar b {
  color: #ba5e86;
  font-size: 12px;
}

.reply-preview-bar span {
  overflow: hidden;
  color: #8c717c;
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
  background: #f4e9ed;
  color: #785d69;
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
  background: #dccbd2;
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
  background: #f4e9ed;
  color: #785d69;
  font-size: 19px;
}

.message-delivery-state {
  align-self: flex-end;
  margin: 0 -2px 2px 0;
  padding: 3px 4px;
  border: 0;
  background: transparent;
  color: #9b7d89;
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
