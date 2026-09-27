<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch
} from 'vue'

import CharacterAvatar from '../CharacterAvatar.vue'
import ChatMessageItem from './ChatMessageItem.vue'

import type {
  Character,
  Conversation,
  Message,
  UserProfile
} from '../../types/domain'

const props = defineProps<{
  messages: Message[]
  conversation?: Conversation
  character?: Character
  userProfile?: UserProfile
  isSending: boolean
  showTyping?: boolean
  streamingMessageId: string
  sendingHint: string
  speechAvailable: boolean
  shouldShowTime: (index: number) => boolean
  formatMessageTime: (value: string) => string
  speechStateForMessage: (messageId: string) => 'idle' | 'playing' | 'paused'
}>()

const emit = defineEmits<{
  scroll: []
  openMenu: [message: Message]
  openImages: [urls: string[], index: number]
  toggleSpeech: [message: Message]
  stopSpeech: []
  retryMessage: [message: Message]
  selectAlternative: [message: Message, offset: number]
  selectGreeting: [index: number]
  feedback: [message: Message, value: 'up' | 'down']
}>()

const listRef = ref<HTMLElement>()

// ── Dynamic-height windowing ─────────────────────────────────
const ESTIMATED_HEIGHT = 88
const OVERSCAN = 6

const heightById = ref<Record<string, number>>({})
const scrollTop = ref(0)
const viewportHeight = ref(0)

const itemEls = new Map<string, HTMLElement>()
const resizeObservers = new Map<string, ResizeObserver>()

function observeItem(id: string, el: Element | unknown) {
  if (!(el instanceof HTMLElement)) {
    itemEls.delete(id)
    resizeObservers.get(id)?.disconnect()
    resizeObservers.delete(id)
    return
  }
  itemEls.set(id, el)

  if (resizeObservers.has(id)) return
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      const next = Math.round(entry.contentRect.height)
      if (next > 0 && heightById.value[id] !== next) {
        heightById.value = { ...heightById.value, [id]: next }
      }
    }
  })
  observer.observe(el)
  resizeObservers.set(id, observer)
}

function itemHeight(index: number) {
  const message = props.messages[index]
  return (message && heightById.value[message.id]) || ESTIMATED_HEIGHT
}

// Cumulative offsets, recomputed when heights or message count change.
const layout = computed(() => {
  let acc = 0
  const offsets: number[] = new Array(props.messages.length)
  for (let i = 0; i < props.messages.length; i += 1) {
    offsets[i] = acc
    acc += itemHeight(i)
  }
  return { offsets, total: acc }
})

const visibleRange = computed(() => {
  const count = props.messages.length
  if (!count) return { start: 0, end: 0 }

  const top = scrollTop.value
  const bottom = top + viewportHeight.value
  const { offsets } = layout.value

  let start = 0
  while (start < count && offsets[start] + itemHeight(start) < top) start += 1

  let end = start
  while (end < count && offsets[end] < bottom) end += 1

  // Always keep the streaming / latest message rendered.
  const streamIndex = props.messages.findIndex(m => m.id === props.streamingMessageId)
  const lastIndex = count - 1

  start = Math.max(0, start - OVERSCAN)
  end = Math.min(count, end + OVERSCAN)

  if (streamIndex >= 0) {
    start = Math.min(start, streamIndex)
    end = Math.max(end, streamIndex + 1)
  }
  end = Math.max(end, Math.min(count, lastIndex + 1))

  return { start, end }
})

const visibleMessages = computed(() =>
  props.messages.slice(visibleRange.value.start, visibleRange.value.end)
)

const topSpacerHeight = computed(() =>
  visibleRange.value.start ? layout.value.offsets[visibleRange.value.start] : 0
)

const bottomSpacerHeight = computed(() => {
  const { end } = visibleRange.value
  return Math.max(0, layout.value.total - layout.value.offsets[end])
})

function handleScroll() {
  const el = listRef.value
  if (!el) return
  scrollTop.value = el.scrollTop
  viewportHeight.value = el.clientHeight
  emit('scroll')
}

function getElement() {
  return listRef.value
}

async function scrollToMessageIndex(index: number, behavior: ScrollBehavior = 'auto') {
  const el = listRef.value
  if (!el || index < 0) return
  const top = layout.value.offsets[index]
  el.scrollTo({ top: Math.max(0, top - 8), behavior })
}

defineExpose({ getElement, scrollToMessageIndex })

function forwardImages(urls: string[], index: number) {
  emit('openImages', urls, index)
}

function forwardAlternative(message: Message, offset: number) {
  emit('selectAlternative', message, offset)
}

// Re-measure when the message list identity changes (new conversation loaded).
watch(
  () => props.messages.map(m => m.id).join('|'),
  async () => {
    await nextTick()
    const el = listRef.value
    if (el) {
      scrollTop.value = el.scrollTop
      viewportHeight.value = el.clientHeight
    }
  }
)

onBeforeUnmount(() => {
  resizeObservers.forEach(observer => observer.disconnect())
  resizeObservers.clear()
})
</script>

<template>
  <div
    ref="listRef"
    class="message-list"
    @scroll="handleScroll"
  >
    <div
      class="list-spacer"
      :style="{ height: `${topSpacerHeight}px` }"
      aria-hidden="true"
    ></div>

    <ChatMessageItem
      v-for="message in visibleMessages"
      :key="message.id"
      :ref="(el) => observeItem(message.id, el as Element)"
      :message="message"
      :data-message-id="message.id"
      :character="character"
      :user-profile="userProfile"
      :show-time="shouldShowTime(props.messages.findIndex(m => m.id === message.id))"
      :time-label="formatMessageTime(message.createdAt)"
      :streaming="message.id === streamingMessageId"
      :speech-available="speechAvailable"
      :speech-state="speechStateForMessage(message.id)"
      @open-menu="emit('openMenu', $event)"
      @open-images="forwardImages"
      @toggle-speech="emit('toggleSpeech', $event)"
      @stop-speech="emit('stopSpeech')"
      @retry-message="emit('retryMessage', $event)"
      @select-alternative="forwardAlternative"
      @select-greeting="emit('selectGreeting', $event)"
      @feedback="(message, value) => emit('feedback', message, value)"
    />

    <div
      v-if="isSending && showTyping && !streamingMessageId"
      class="message-row message-row--theirs"
    >
      <CharacterAvatar
        v-if="character"
        :avatar="character.avatar"
        :name="character.name"
        :size="38"
      />
      <div class="typing-bubble" aria-label="对方正在输入">
        <span>{{ sendingHint }}</span>
        <i></i><i></i><i></i>
      </div>
    </div>

    <div
      class="list-spacer"
      :style="{ height: `${bottomSpacerHeight}px` }"
      aria-hidden="true"
    ></div>

    <p
      v-if="conversation && messages.length === 0 && !isSending"
      class="empty-chat"
    >
      你们还没有聊过天，先说点什么吧。
    </p>
  </div>
</template>

<style scoped>
.message-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 12px 13px 24px;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
}

.message-list::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.list-spacer {
  flex: 0 0 auto;
  width: 100%;
  pointer-events: none;
}

.message-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 9px 0;
}

.message-row--theirs {
  justify-content: flex-start;
}

.typing-bubble {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  max-width: min(260px, 72vw);
  padding: 14px 17px;
  border-radius: 17px;
  border-top-left-radius: 6px;
  background: #fff;
}

.typing-bubble span {
  width: 100%;
  color: #8a6d79;
  font-size: 12px;
  line-height: 1.35;
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
  color: rgba(91,63,79,.42);
  font-size: 14px;
}
</style>
