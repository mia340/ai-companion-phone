<script setup lang="ts">
import { ref } from 'vue'

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
}>()

const listRef = ref<HTMLElement>()

function getElement() {
  return listRef.value
}

function forwardImages(urls: string[], index: number) {
  emit('openImages', urls, index)
}

function forwardAlternative(message: Message, offset: number) {
  emit('selectAlternative', message, offset)
}

defineExpose({ getElement })
</script>

<template>
  <div
    ref="listRef"
    class="message-list"
    @scroll="emit('scroll')"
  >
    <ChatMessageItem
      v-for="(message, index) in props.messages"
      :key="message.id"
      :message="message"
      :character="character"
      :user-profile="userProfile"
      :show-time="shouldShowTime(index)"
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
  color: rgba(91,63,74,.42);
  font-size: 14px;
}
</style>
