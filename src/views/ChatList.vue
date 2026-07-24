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
  const keyword = searchText.value
    .trim()
    .toLowerCase()

  if (!keyword) {
    return chatItems.value
  }

  return chatItems.value.filter(item => {
    const title =
      item.character?.name ??
      item.conversation.title

    const message =
      item.lastMessage?.content ?? ''

    return (
      title.toLowerCase().includes(keyword) ||
      message.toLowerCase().includes(keyword)
    )
  })
})

function formatTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

onMounted(() => {
  subscription = liveQuery(async () => {
    const conversations =
      await db.conversations
        .orderBy('updatedAt')
        .reverse()
        .toArray()

    return Promise.all(
      conversations.map(async conversation => {
        const character =
          conversation.type === 'single'
            ? await db.characters.get(
                conversation.memberIds[0]
              )
            : undefined

        const messages =
          await db.messages
            .where('conversationId')
            .equals(conversation.id)
            .sortBy('createdAt')

        return {
          conversation,
          character,
          lastMessage:
            messages[messages.length - 1]
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
  <PhoneFrame title="消息" show-back>
    <section class="list-page">
      <input
        v-model="searchText"
        class="search"
        placeholder="搜索角色或聊天内容"
      />

      <button
        v-for="item in filteredChatItems"
        :key="item.conversation.id"
        class="chat-row"
        type="button"
        @click="
          $router.push(
            `/chat/${item.conversation.id}`
          )
        "
      >
        <CharacterAvatar
          :avatar="
            item.character?.avatar || '💬'
          "
          :name="
            item.character?.name ||
            item.conversation.title
          "
          :size="52"
        />

        <span class="chat-main">
          <b>
            {{
              item.character?.name ||
              item.conversation.title
            }}

            <small
              v-if="item.conversation.pinned"
              class="pinned-label"
            >
              置顶
            </small>
          </b>

          <span class="message-preview">
            {{
              item.lastMessage?.content ||
              '还没有消息，去和角色聊聊吧。'
            }}
          </span>
        </span>

        <span class="chat-side">
          <small>
            {{
              formatTime(
                item.conversation.updatedAt
              )
            }}
          </small>

          <span
            v-if="item.conversation.unread"
            class="unread"
          >
            {{ item.conversation.unread }}
          </span>
        </span>
      </button>

      <p
        v-if="filteredChatItems.length === 0"
        class="empty-tip"
      >
        没有找到聊天记录。
      </p>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.message-preview {
  display: block;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-side {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
}

.chat-side small {
  opacity: 0.55;
}

.pinned-label {
  margin-left: 4px;
}

.empty-tip {
  padding: 20px;
  text-align: center;
  opacity: 0.65;
}
</style>