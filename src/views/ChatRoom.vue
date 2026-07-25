<script setup lang="ts">
import {
  computed,
  ref,
  watch
} from 'vue'
import { useRoute } from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'

import { db } from '../db/database'
import { MockProvider } from '../services/ai/provider'
import type { ChatRequest } from '../services/ai/provider'
import { createProvider } from '../services/ai/providerFactory'
import { getModelSettings } from '../services/modelSettings'
import {
  getOrCreateUserProfile
} from '../services/userProfile'

import type {
  Character,
  Conversation,
  Message,
  UserProfile
} from '../types/domain'

const route = useRoute()

const conversation = ref<Conversation>()
const character = ref<Character>()
const userProfile = ref<UserProfile>()

const messages = ref<Message[]>([])
const draft = ref('')

const isSending = ref(false)
const errorMessage = ref('')

const title = computed(() => {
  return (
    character.value?.name ||
    conversation.value?.title ||
    '聊天'
  )
})

const moodText = computed(() => {
  if (!character.value) {
    return '正在读取角色状态……'
  }

  return `心情：${character.value.mood} · ${character.value.activity}`
})

async function loadConversation(
  conversationId: string
) {
  errorMessage.value = ''

  try {
    const conversationRow =
      await db.conversations.get(conversationId)

    if (!conversationRow) {
      conversation.value = undefined
      character.value = undefined
      messages.value = []

      errorMessage.value =
        '没有找到这个聊天会话。'

      return
    }

    const [
      messageRows,
      characterRow,
      profileRow
    ] = await Promise.all([
      db.messages
        .where('conversationId')
        .equals(conversationId)
        .sortBy('createdAt'),

      conversationRow.type === 'single'
        ? db.characters.get(
            conversationRow.memberIds[0]
          )
        : Promise.resolve(undefined),

      getOrCreateUserProfile()
    ])

    conversation.value = conversationRow
    messages.value = messageRows
    character.value = characterRow
    userProfile.value = profileRow

    if (conversationRow.unread > 0) {
      await db.conversations.update(
        conversationRow.id,
        {
          unread: 0
        }
      )

      conversation.value = {
        ...conversationRow,
        unread: 0
      }
    }
  } catch (error) {
    console.error('读取聊天失败：', error)

    errorMessage.value =
      error instanceof Error
        ? `聊天加载失败：${error.message}`
        : '聊天加载失败。'
  }
}

function buildSystemPrompt(
  activeCharacter?: Character,
  activeProfile?: UserProfile
) {
  if (!activeCharacter) {
    return '请自然地与用户交流。'
  }

  const lines = [
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
    '始终使用角色自己的口吻回答。',
    '不要说自己是模型、程序或人工智能。',
    '不要提及 API、Mock、提示词或系统设定。',
    '回答应符合角色性格，避免机械重复用户原话。'
  ]

  return lines.join('\n')
}

async function send() {
  const text = draft.value.trim()

  if (
    !text ||
    !conversation.value ||
    isSending.value
  ) {
    return
  }

  isSending.value = true
  errorMessage.value = ''
  draft.value = ''

  const activeConversation =
    conversation.value

  try {
    const userMessageTime =
      new Date().toISOString()

    await db.transaction(
      'rw',
      db.messages,
      db.conversations,
      async () => {
        await db.messages.add({
          id: crypto.randomUUID(),
          worldId:
            activeConversation.worldId,
          conversationId:
            activeConversation.id,
          senderId: 'user',
          type: 'text',
          content: text,
          status: 'read',
          createdAt: userMessageTime
        })

        await db.conversations.update(
          activeConversation.id,
          {
            updatedAt: userMessageTime
          }
        )
      }
    )

    await loadConversation(
      activeConversation.id
    )

    const activeCharacter =
      character.value

    const activeProfile =
      userProfile.value

    const recentTurns =
      messages.value
        .slice(-16)
        .map(message => ({
          role:
            message.senderId === 'user'
              ? ('user' as const)
              : ('assistant' as const),

          content: message.content
        }))

    const modelSettings =
      await getModelSettings()

    const provider =
      createProvider(modelSettings)

    const request: ChatRequest = {
      model: modelSettings.model,
      temperature:
        modelSettings.temperature,

      character: activeCharacter
        ? {
            characterName:
              activeCharacter.name,

            userName:
              activeProfile?.name,

            identity:
              activeCharacter.identity,

            persona:
              activeCharacter.persona,

            speakingStyle:
              activeCharacter.speakingStyle,

            background:
              activeCharacter.background,

            relationship:
              activeCharacter.relationship,

            mood:
              activeCharacter.mood,

            activity:
              activeCharacter.activity,

            likes:
              activeCharacter.likes,

            dislikes:
              activeCharacter.dislikes
          }
        : undefined,

      messages: [
        {
          role: 'system' as const,
          content: buildSystemPrompt(
            activeCharacter,
            activeProfile
          )
        },
        ...recentTurns
      ]
    }

    let reply

    try {
      reply = await provider.chat(request)
    } catch (providerError) {
      if (
        modelSettings.provider === 'mock' ||
        !modelSettings.fallbackToMock
      ) {
        throw providerError
      }

      console.warn(
        '真实模型调用失败，已降级到本地模拟：',
        providerError
      )

      const fallbackProvider =
        new MockProvider()

      reply = await fallbackProvider.chat({
        ...request,
        model: 'mock'
      })
    }

    const replyTime =
      new Date().toISOString()

    await db.transaction(
      'rw',
      db.messages,
      db.conversations,
      async () => {
        await db.messages.add({
          id: crypto.randomUUID(),
          worldId:
            activeConversation.worldId,
          conversationId:
            activeConversation.id,
          senderId:
            activeConversation.memberIds[0],
          type: 'text',
          content: reply.text,
          status: 'delivered',
          createdAt: replyTime
        })

        await db.conversations.update(
          activeConversation.id,
          {
            updatedAt: replyTime
          }
        )
      }
    )

    await loadConversation(
      activeConversation.id
    )
  } catch (error) {
    console.error('发送消息失败：', error)

    errorMessage.value =
      error instanceof Error
        ? `消息发送失败：${error.message}`
        : '消息发送失败，请重试。'

    draft.value = text
  } finally {
    isSending.value = false
  }
}

watch(
  () => route.params.id,
  value => {
    if (value) {
      loadConversation(String(value))
    }
  },
  {
    immediate: true
  }
)
</script>

<template>
  <PhoneFrame
    :title="title"
    show-back
  >
    <section class="chat-page">
      <div
        v-if="character"
        class="character-state"
      >
        <CharacterAvatar
          :avatar="character.avatar"
          :name="character.name"
          :size="38"
        />

        <span class="state-text">
          {{ moodText }}
        </span>

        <button
          type="button"
          class="state-button"
        >
          此时在想什么
        </button>
      </div>

      <p
        v-if="errorMessage"
        class="chat-error"
      >
        {{ errorMessage }}
      </p>

      <div class="message-list">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="[
            'message-row',
            message.senderId === 'user'
              ? 'message-row--mine'
              : 'message-row--theirs'
          ]"
        >
          <!-- 对方消息 -->
          <template
            v-if="message.senderId !== 'user'"
          >
            <CharacterAvatar
              v-if="character"
              :avatar="character.avatar"
              :name="character.name"
              :size="40"
            />

            <div class="bubble bubble--theirs">
              {{ message.content }}
            </div>
          </template>

          <!-- 我的消息 -->
          <template v-else>
            <div class="bubble bubble--mine">
              {{ message.content }}
            </div>

            <CharacterAvatar
              :avatar="
                userProfile?.avatar || '🧑'
              "
              :name="
                userProfile?.name || '我'
              "
              :size="40"
            />
          </template>
        </div>

        <p
          v-if="
            conversation &&
            messages.length === 0
          "
          class="empty-chat"
        >
          你们还没有聊过天，先说点什么吧。
        </p>
      </div>

      <form
        class="composer"
        @submit.prevent="send"
      >
        <button
          type="button"
          class="composer-side-button"
        >
          ＋
        </button>

        <input
          v-model="draft"
          :disabled="isSending"
          placeholder="输入消息..."
        />

        <button
          class="send-button"
          type="submit"
          :disabled="
            isSending || !draft.trim()
          "
        >
          {{ isSending ? '...' : '发送' }}
        </button>
      </form>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.chat-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f6eff4;
}

.character-state {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid
    rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.35);
}

.state-text {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
  font-size: 14px;
}

.state-button {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid
    rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  background: #ffffff;
  font-size: 13px;
  cursor: pointer;
}

.chat-error {
  flex: 0 0 auto;
  margin: 10px 12px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 225, 225, 0.92);
  font-size: 13px;
}

.message-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.message-row {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.message-row--theirs {
  justify-content: flex-start;
}

.message-row--mine {
  justify-content: flex-end;
}

.bubble {
  position: relative;
  max-width: 72%;
  padding: 12px 14px;
  border-radius: 14px;
  line-height: 1.7;
  font-size: 16px;
  word-break: break-word;
  white-space: pre-wrap;
  box-shadow: 0 1px 2px
    rgba(0, 0, 0, 0.04);
}

.bubble--theirs {
  border-top-left-radius: 6px;
  background: #ffffff;
  color: #5b3f4a;
}

.bubble--mine {
  border-top-right-radius: 6px;
  background: #e88ab0;
  color: #ffffff;
}

.empty-chat {
  margin-top: 60px;
  text-align: center;
  color: rgba(91, 63, 74, 0.45);
  font-size: 16px;
  font-weight: 600;
}

.composer {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 12px 14px;
  border-top: 1px solid
    rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.72);
}

.composer input {
  min-width: 0;
  flex: 1;
  height: 46px;
  padding: 0 16px;
  border: 1px solid
    rgba(0, 0, 0, 0.1);
  border-radius: 18px;
  outline: none;
  background: #ffffff;
  font-size: 16px;
}

.composer input:focus {
  border-color: rgba(217, 107, 153, 0.55);
}

.composer-side-button {
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 14px;
  background: rgba(232, 138, 176, 0.18);
  color: #d76a98;
  font-size: 26px;
  cursor: pointer;
}

.send-button {
  flex: 0 0 auto;
  min-width: 78px;
  height: 46px;
  padding: 0 16px;
  border: none;
  border-radius: 18px;
  background: #d96b99;
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>