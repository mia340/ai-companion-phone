<script setup lang="ts">
import { liveQuery } from 'dexie'
import {
  computed,
  onMounted,
  onUnmounted,
  ref
} from 'vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
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

const chatItems = ref<ChatListItem[]>([])
const searchText = ref('')

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
        <button
          v-for="item in filteredChatItems"
          :key="item.conversation.id"
          class="chat-row"
          :class="{ 'chat-row--pinned': item.conversation.pinned }"
          type="button"
          @click="$router.push(`/chat/${item.conversation.id}`)"
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
  background: #fff;
  border-top: 1px solid rgba(48, 78, 103, .07);
  border-bottom: 1px solid rgba(48, 78, 103, .07);
}

.chat-row {
  position: relative;
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
}

.chat-row::after {
  content: '';
  position: absolute;
  left: 80px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(48, 78, 103, .08);
}

.chat-row:last-child::after {
  display: none;
}

.chat-row:active {
  background: #eef4f8;
}

.chat-row--pinned {
  background: #f8fbfd;
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
