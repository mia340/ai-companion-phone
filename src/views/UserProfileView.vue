<script setup lang="ts">
import {
  onMounted,
  ref
} from 'vue'

import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import {
  getOrCreateUserProfile,
  USER_PROFILE_ID
} from '../services/userProfile'

const name = ref('我')
const identity = ref('')
const bio = ref('')

const avatarEmoji = ref('🧑')
const avatarImage = ref('')

const isLoading = ref(true)
const isSaving = ref(false)
const message = ref('')
const errorMessage = ref('')
const originalCreatedAt = ref('')

function isImageAvatar(value: string) {
  return (
    value.startsWith('data:image/') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  )
}

async function loadProfile() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const profile =
      await getOrCreateUserProfile()

    name.value = profile.name
    identity.value = profile.identity ?? ''
    bio.value = profile.bio ?? ''
    originalCreatedAt.value =
      profile.createdAt

    if (isImageAvatar(profile.avatar)) {
      avatarImage.value = profile.avatar
      avatarEmoji.value = '🧑'
    } else {
      avatarEmoji.value =
        profile.avatar || '🧑'
      avatarImage.value = ''
    }
  } catch (error) {
    console.error('读取用户资料失败：', error)
    errorMessage.value =
      '用户资料加载失败，请刷新后重试。'
  } finally {
    isLoading.value = false
  }
}

function resizeAvatar(file: File):
Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl =
      URL.createObjectURL(file)

    image.onload = () => {
      try {
        const canvas =
          document.createElement('canvas')

        const size = 320

        canvas.width = size
        canvas.height = size

        const context =
          canvas.getContext('2d')

        if (!context) {
          throw new Error(
            '浏览器无法处理图片。'
          )
        }

        const cropSize = Math.min(
          image.naturalWidth,
          image.naturalHeight
        )

        const cropX =
          (image.naturalWidth - cropSize) / 2

        const cropY =
          (image.naturalHeight - cropSize) / 2

        context.drawImage(
          image,
          cropX,
          cropY,
          cropSize,
          cropSize,
          0,
          0,
          size,
          size
        )

        const result =
          canvas.toDataURL(
            'image/jpeg',
            0.85
          )

        URL.revokeObjectURL(objectUrl)
        resolve(result)
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        reject(error)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)

      reject(
        new Error('图片读取失败。')
      )
    }

    image.src = objectUrl
  })
}

async function handleAvatarUpload(
  event: Event
) {
  errorMessage.value = ''
  message.value = ''

  const input =
    event.target as HTMLInputElement

  const file = input.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value =
      '请选择有效的图片文件。'

    input.value = ''
    return
  }

  if (file.size > 8 * 1024 * 1024) {
    errorMessage.value =
      '图片不能超过 8MB。'

    input.value = ''
    return
  }

  try {
    avatarImage.value =
      await resizeAvatar(file)
  } catch (error) {
    console.error('处理头像失败：', error)

    errorMessage.value =
      '头像处理失败，请换一张图片。'
  } finally {
    input.value = ''
  }
}

function useEmojiAvatar() {
  avatarImage.value = ''
}

async function saveProfile() {
  if (isSaving.value) return

  message.value = ''
  errorMessage.value = ''

  const trimmedName = name.value.trim()

  if (!trimmedName) {
    errorMessage.value =
      '请填写你的昵称。'
    return
  }

  isSaving.value = true

  try {
    const now = new Date().toISOString()

    await db.userProfiles.put({
      id: USER_PROFILE_ID,
      name: trimmedName,

      avatar:
        avatarImage.value ||
        avatarEmoji.value.trim() ||
        '🧑',

      identity:
        identity.value.trim() || undefined,

      bio:
        bio.value.trim() || undefined,

      createdAt:
        originalCreatedAt.value || now,

      updatedAt: now
    })

    originalCreatedAt.value =
      originalCreatedAt.value || now

    message.value =
      '资料已保存，聊天中的头像也会同步更新。'
  } catch (error) {
    console.error('保存资料失败：', error)

    errorMessage.value =
      error instanceof Error
        ? `保存失败：${error.message}`
        : '保存资料失败，请重试。'
  } finally {
    isSaving.value = false
  }
}

onMounted(loadProfile)
</script>

<template>
  <PhoneFrame title="我的资料" show-back>
    <form
      class="form-page profile-page"
      @submit.prevent="saveProfile"
    >
      <p
        v-if="isLoading"
        class="status-message"
      >
        正在读取资料……
      </p>

      <template v-else>
        <section class="profile-preview">
          <CharacterAvatar
            :avatar="
              avatarImage ||
              avatarEmoji ||
              '🧑'
            "
            :name="name || '我'"
            :size="92"
          />

          <div>
            <h2>{{ name || '我' }}</h2>

            <p>
              {{
                identity ||
                '还没有填写身份'
              }}
            </p>
          </div>
        </section>

        <section class="profile-card">
          <h3>我的头像</h3>

          <label>
            表情头像

            <input
              v-model="avatarEmoji"
              maxlength="8"
              placeholder="例如：🧑"
              @input="useEmojiAvatar"
            />
          </label>

          <label class="upload-button">
            选择本地照片

            <input
              class="hidden-file-input"
              type="file"
              accept="image/*"
              @change="handleAvatarUpload"
            />
          </label>

          <button
            v-if="avatarImage"
            class="text-button"
            type="button"
            @click="useEmojiAvatar"
          >
            移除照片，使用表情头像
          </button>
        </section>

        <section class="profile-card">
          <h3>基本资料</h3>

          <label>
            我的昵称

            <input
              v-model="name"
              maxlength="20"
              placeholder="例如：小满"
            />
          </label>

          <label>
            我的身份

            <input
              v-model="identity"
              maxlength="50"
              placeholder="例如：大学生、设计师、旅行者"
            />
          </label>

          <label>
            个人简介

            <textarea
              v-model="bio"
              rows="4"
              maxlength="300"
              placeholder="可以写兴趣、性格，以及希望角色如何了解你。"
            ></textarea>
          </label>
        </section>

        <p
          v-if="message"
          class="success-message"
        >
          {{ message }}
        </p>

        <p
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </p>

        <button
          class="primary"
          type="submit"
          :disabled="isSaving"
        >
          {{
            isSaving
              ? '正在保存……'
              : '保存我的资料'
          }}
        </button>

        <p class="hint">
          头像和昵称将用于聊天、朋友圈、日记及其他虚拟应用。
        </p>
      </template>
    </form>
  </PhoneFrame>
</template>

<style scoped>
.profile-page {
  padding-bottom: 36px;
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.58);
}

.profile-preview h2 {
  margin: 0 0 6px;
}

.profile-preview p {
  margin: 0;
  opacity: 0.65;
}

.profile-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.42);
}

.profile-card h3 {
  margin: 0;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 11px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
}

.hidden-file-input {
  display: none;
}

.text-button {
  border: none;
  background: transparent;
  cursor: pointer;
  opacity: 0.7;
}

.status-message,
.success-message,
.error-message {
  padding: 11px 13px;
  border-radius: 13px;
  text-align: center;
}

.status-message {
  background: rgba(255, 255, 255, 0.52);
}

.success-message {
  background: rgba(225, 255, 235, 0.82);
}

.error-message {
  background: rgba(255, 225, 225, 0.88);
}
</style>