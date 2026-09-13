<script setup lang="ts">
import { liveQuery } from 'dexie'
import {
  computed,
  onMounted,
  onUnmounted,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { deleteConversationConsistently } from '../runtime/conversation/conversationMutationService'
import type {
  Character,
  Conversation,
  Message
} from '../types/domain'

interface ChatListItem {
  conversation: Conversation
  character?: Character
  lastMessage?: Message
}

interface SwipeGesture {
  id: string
  pointerId: number
  startX: number
  startY: number
  startOffset: number
  startedAt: number
  axis: 'pending' | 'horizontal' | 'vertical'
  moved: boolean
}

const DELETE_REVEAL = 86
const router = useRouter()
const chatItems = ref<ChatListItem[]>([])
const searchText = ref('')
const openSwipeId = ref('')
const swipeOffsets = ref<Record<string, number>>({})
const deletingId = ref('')
let gesture: SwipeGesture | undefined
let suppressClickUntil = 0

let subscription:
  | { unsubscribe: () => void }
  | undefined

const filteredChatItems = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return chatItems.value

  return chatItems.value.filter(item => {
    const title = item.character?.name ?? item.conversation.title
    const message = item.lastMessage?.content ?? ''
    return title.toLowerCase().includes(keyword) || message.toLowerCase().includes(keyword)
  })
})

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const today = new Date()
  const sameDay =
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()

  if (sameDay) {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric'
  })
}

function currentOffset(id: string) {
  return swipeOffsets.value[id] ?? (openSwipeId.value === id ? -DELETE_REVEAL : 0)
}

function setOffset(id: string, offset: number) {
  swipeOffsets.value = {
    ...swipeOffsets.value,
    [id]: offset
  }
}

function closeSwipe(id = openSwipeId.value) {
  if (!id) return
  setOffset(id, 0)
  if (openSwipeId.value === id) openSwipeId.value = ''
}

function settleSwipe(id: string, open: boolean) {
  setOffset(id, open ? -DELETE_REVEAL : 0)
  openSwipeId.value = open ? id : ''
}

function swipeStyle(id: string) {
  return {
    transform: `translate3d(${currentOffset(id)}px, 0, 0)`
  }
}

function onPointerDown(event: PointerEvent, id: string) {
  if (deletingId.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (openSwipeId.value && openSwipeId.value !== id) closeSwipe(openSwipeId.value)

  gesture = {
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    startOffset: currentOffset(id),
    startedAt: performance.now(),
    axis: 'pending',
    moved: false
  }

  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // 部分旧 WebView 不支持 pointer capture；不影响基础点击与 CSS 回弹。
  }
}

function onPointerMove(event: PointerEvent, id: string) {
  if (!gesture || gesture.id !== id || gesture.pointerId !== event.pointerId) return
  const dx = event.clientX - gesture.startX
  const dy = event.clientY - gesture.startY
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (gesture.axis === 'pending') {
    if (Math.max(absX, absY) < 5) return
    gesture.axis = absX > absY + 2 ? 'horizontal' : 'vertical'
  }
  if (gesture.axis !== 'horizontal') return

  gesture.moved = gesture.moved || absX > 7
  event.preventDefault()
  let next = gesture.startOffset + dx
  next = Math.max(-DELETE_REVEAL - 16, Math.min(14, next))
  if (next > 0) next *= 0.25
  setOffset(id, next)
}

function finishPointerGesture(event: PointerEvent, id: string, cancelled = false) {
  if (!gesture || gesture.id !== id || gesture.pointerId !== event.pointerId) return
  const active = gesture
  gesture = undefined

  if (active.axis !== 'horizontal' || cancelled) {
    settleSwipe(id, openSwipeId.value === id)
    return
  }

  if (active.moved) suppressClickUntil = performance.now() + 360
  const elapsed = Math.max(1, performance.now() - active.startedAt)
  const velocityX = (event.clientX - active.startX) / elapsed
  const offset = currentOffset(id)
  const shouldOpen = velocityX < -0.45
    ? true
    : velocityX > 0.45
      ? false
      : offset < -DELETE_REVEAL * 0.5
  settleSwipe(id, shouldOpen)
}

function onPointerUp(event: PointerEvent, id: string) {
  finishPointerGesture(event, id)
}

function onPointerCancel(event: PointerEvent, id: string) {
  finishPointerGesture(event, id, true)
}

function openConversation(id: string) {
  if (performance.now() < suppressClickUntil) return
  if (openSwipeId.value === id) {
    closeSwipe(id)
    return
  }
  void router.push(`/chat/${id}`)
}

async function deleteChat(item: ChatListItem) {
  const id = item.conversation.id
  if (deletingId.value) return
  const name = item.character?.name || item.conversation.title || '这个聊天'
  const confirmed = window.confirm(
    `删除与“${name}”的这份聊天吗？\n\n聊天消息、当前剧情状态、聊天内记忆和调试记录会删除；角色的跨聊天共享记忆会保留。`
  )
  if (!confirmed) {
    closeSwipe(id)
    return
  }

  deletingId.value = id
  try {
    await deleteConversationConsistently(id)
    closeSwipe(id)
  } catch (error) {
    console.error('删除聊天失败：', error)
    window.alert(error instanceof Error ? `删除失败：${error.message}` : '删除聊天失败，请稍后重试。')
  } finally {
    deletingId.value = ''
  }
}

onMounted(() => {
  subscription = liveQuery(async () => {
    const conversations = await db.conversations.orderBy('updatedAt').reverse().toArray()

    return Promise.all(
      conversations.map(async conversation => {
        const character = conversation.type === 'single'
          ? await db.characters.get(conversation.memberIds[0])
          : undefined

        const messages = await db.messages
          .where('conversationId')
          .equals(conversation.id)
          .sortBy('createdAt')

        return {
          conversation,
          character,
          lastMessage: messages[messages.length - 1]
        }
      })
    )
  }).subscribe(rows => {
    chatItems.value = rows
    if (openSwipeId.value && !rows.some(item => item.conversation.id === openSwipeId.value)) {
      openSwipeId.value = ''
    }
  })
})

onUnmounted(() => {
  subscription?.unsubscribe()
})
</script>

<template>
  <PhoneFrame title="聊天" show-back>
    <section class="chat-list-page">
      <label class="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          v-model="searchText"
          type="search"
          placeholder="搜索"
          aria-label="搜索角色或聊天内容"
          @focus="closeSwipe()"
        />
        <button
          v-if="searchText"
          type="button"
          aria-label="清空搜索"
          @click="searchText = ''"
        >
          ×
        </button>
      </label>

      <section v-if="filteredChatItems.length" class="conversation-list">
        <div
          v-for="item in filteredChatItems"
          :key="item.conversation.id"
          class="swipe-row"
          :class="{
            'swipe-row--open': openSwipeId === item.conversation.id,
            'swipe-row--deleting': deletingId === item.conversation.id
          }"
        >
          <button
            class="delete-action"
            type="button"
            :disabled="Boolean(deletingId)"
            :aria-label="`删除与${item.character?.name || item.conversation.title}的聊天`"
            @click.stop="deleteChat(item)"
          >
            <span aria-hidden="true">⌫</span>
            <b>{{ deletingId === item.conversation.id ? '删除中' : '删除' }}</b>
          </button>

          <button
            class="chat-row"
            :class="{
              'chat-row--pinned': item.conversation.pinned,
              'chat-row--dragging': gesture?.id === item.conversation.id && gesture.axis === 'horizontal'
            }"
            :style="swipeStyle(item.conversation.id)"
            type="button"
            @pointerdown="onPointerDown($event, item.conversation.id)"
            @pointermove="onPointerMove($event, item.conversation.id)"
            @pointerup="onPointerUp($event, item.conversation.id)"
            @pointercancel="onPointerCancel($event, item.conversation.id)"
            @click="openConversation(item.conversation.id)"
          >
            <CharacterAvatar
              :avatar="item.character?.avatar || '💬'"
              :name="item.character?.name || item.conversation.title"
              :size="54"
            />

            <span class="chat-main">
              <span class="chat-title-line">
                <b>{{ item.character?.name || item.conversation.title }}</b>
                <small>{{ formatTime(item.conversation.updatedAt) }}</small>
              </span>

              <span class="chat-preview-line">
                <span class="message-preview">
                  {{ item.lastMessage?.content || '还没有消息，去和角色聊聊吧。' }}
                </span>
                <span v-if="item.conversation.unread" class="unread">
                  {{ item.conversation.unread > 99 ? '99+' : item.conversation.unread }}
                </span>
              </span>
            </span>
          </button>
        </div>
      </section>

      <div v-else class="empty-state">
        <div class="empty-icon">💬</div>
        <strong>{{ searchText ? '没有找到相关聊天' : '还没有聊天' }}</strong>
        <p>{{ searchText ? '换个关键词试试。' : '去通讯录选择一个角色开始聊天。' }}</p>
        <button v-if="!searchText" type="button" @click="$router.push('/contacts')">打开通讯录</button>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.chat-list-page {
  min-height: 100%;
  padding: 10px 0 34px;
  background: #f5f9fc;
}

.search-field {
  height: 36px;
  margin: 0 14px 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 10px;
  background: #eaf1f6;
  color: #8294a3;
}

.search-field > span {
  font-size: 20px;
  line-height: 1;
  transform: translateY(-1px);
}

.search-field input {
  min-width: 0;
  height: 100%;
  flex: 1;
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  color: #23394c;
  font-size: 15px;
}

.search-field input::-webkit-search-cancel-button {
  display: none;
}

.search-field button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #a7b4bf;
  color: white;
  font-size: 16px;
  line-height: 20px;
}

.conversation-list {
  overflow: hidden;
  background: #fff;
  border-top: 1px solid rgba(48, 78, 103, .07);
  border-bottom: 1px solid rgba(48, 78, 103, .07);
}

.swipe-row {
  position: relative;
  overflow: hidden;
  background: #e9514c;
}

.delete-action {
  position: absolute;
  inset: 0 0 0 auto;
  width: 86px;
  display: grid;
  place-content: center;
  gap: 3px;
  border: 0;
  background: #e9514c;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.delete-action span {
  font-size: 21px;
  line-height: 1;
}

.delete-action b {
  font-size: 12px;
}

.delete-action:active {
  background: #d84440;
}

.delete-action:disabled {
  opacity: .72;
}

.chat-row {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 76px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 0;
  background: #fff;
  color: inherit;
  text-align: left;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  will-change: transform;
  transition: transform 180ms cubic-bezier(.22,.72,.24,1), background 120ms ease;
}

.chat-row--dragging {
  transition: none;
}

.swipe-row:not(:last-child) .chat-row::after {
  content: '';
  position: absolute;
  left: 80px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(48, 78, 103, .08);
}

.chat-row:active {
  background: #eef4f8;
}

.chat-row--pinned {
  background: #f8fbfd;
}

.swipe-row--open .chat-row {
  box-shadow: 8px 0 18px rgba(45, 55, 65, .08);
}

.swipe-row--deleting .chat-row {
  pointer-events: none;
  opacity: .78;
}

.chat-main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 7px;
}

.chat-title-line,
.chat-preview-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-title-line b {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #23394c;
  font-size: 16px;
  font-weight: 650;
}

.chat-title-line small {
  flex: 0 0 auto;
  color: #9aa8b4;
  font-size: 11px;
  font-weight: 400;
}

.message-preview {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #81919f;
  font-size: 13px;
}

.unread {
  flex: 0 0 auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #69a9d7;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.empty-state {
  min-height: 360px;
  padding: 90px 36px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: #7d91a1;
}

.empty-icon {
  width: 70px;
  height: 70px;
  margin-bottom: 18px;
  display: grid;
  place-items: center;
  border-radius: 22px;
  background: #e7f3fc;
  font-size: 34px;
}

.empty-state strong {
  color: #38546b;
  font-size: 17px;
}

.empty-state p {
  margin: 8px 0 20px;
  font-size: 13px;
}

.empty-state button {
  border: 0;
  border-radius: 11px;
  padding: 10px 16px;
  background: #dfeefa;
  color: #4e88b3;
  font-weight: 650;
}
</style>
