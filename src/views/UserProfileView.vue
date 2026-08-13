<script setup lang="ts">
import {
  computed,
  onMounted,
  ref
} from 'vue'
import { useRouter } from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import {
  getOrCreateUserProfile,
  USER_PROFILE_ID
} from '../services/userProfile'
import { listPersonas } from '../services/personaService'
import type { UserPersona } from '../types/domain'

const router = useRouter()
const characterCardUserTemplateFallback = '来自角色卡 {{user}} 模板'
const personas = ref<UserPersona[]>([])

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

const defaultPersona = computed(() => personas.value.find(item => item.isDefault))
const globalPersonas = computed(() => personas.value.filter(item => item.personaScope !== 'character'))
const characterPersonas = computed(() => personas.value.filter(item => item.personaScope === 'character'))

function openPersonaManager() {
  router.push('/settings/personas')
}


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
    const [profile, personaRows] = await Promise.all([
      getOrCreateUserProfile(),
      listPersonas()
    ])
    personas.value = personaRows

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
      '基础资料已保存。角色扮演身份请在 Persona 中单独管理。'
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
        <section class="profile-hero">
          <CharacterAvatar
            :avatar="avatarImage || avatarEmoji || '🧑'"
            :name="name || '我'"
            :size="84"
          />

          <div class="profile-hero-copy">
            <span class="profile-kicker">手机基础身份</span>
            <h2>{{ name || '我' }}</h2>
            <p>{{ identity || '还没有填写身份' }}</p>
            <small>{{ bio || '这里保存全局昵称和头像；进入角色世界时由 Persona 决定角色认识的“你”。' }}</small>
          </div>
        </section>

        <section class="profile-card persona-overview">
          <div class="persona-overview-head">
            <div>
              <h3>我的 Persona</h3>
              <p>“我的资料”是手机里的基础身份；Persona 是进入不同角色和世界时，角色实际认识的“你”。</p>
            </div>
            <button class="persona-manage-button" type="button" @click="openPersonaManager">管理全部</button>
          </div>

          <article v-if="defaultPersona" class="persona-summary default">
            <CharacterAvatar class="persona-symbol" :avatar="defaultPersona.avatar || '🧑'" :name="defaultPersona.name" :size="42" />
            <div>
              <b>{{ defaultPersona.name }}</b>
              <small>默认 Persona · {{ defaultPersona.identity || defaultPersona.occupation || '未填写身份' }}</small>
            </div>
          </article>

          <div v-if="characterPersonas.length" class="character-persona-group">
            <div class="group-title">
              <b>角色卡自带 Persona</b>
              <small>{{ characterPersonas.length }} 套</small>
            </div>
            <article v-for="persona in characterPersonas" :key="persona.id" class="persona-summary">
              <CharacterAvatar class="persona-symbol" :avatar="persona.avatar || '🧑'" :name="persona.name" :size="42" />
              <div>
                <b>{{ persona.name }}</b>
                <small>{{ persona.boundCharacterName ? `仅用于 ${persona.boundCharacterName}` : '角色专属' }}</small>
                <p>{{ persona.occupation || persona.identity || persona.personality || characterCardUserTemplateFallback }}</p>
              </div>
            </article>
          </div>

          <div class="persona-counts">
            <span>全局 {{ globalPersonas.length }}</span>
            <span>角色专属 {{ characterPersonas.length }}</span>
          </div>

          <p class="persona-note">角色卡里的 <span v-pre>{{user}}</span> 可以在导入角色时自动创建成专属 Persona；不会自动改写你的全局资料。</p>
        </section>

        <section class="profile-card profile-editor">
          <div class="section-heading">
            <div>
              <h3>基础资料</h3>
              <p>只影响这台小手机的全局展示，不会覆盖任何角色专属 Persona。</p>
            </div>
          </div>

          <div class="avatar-edit-row">
            <CharacterAvatar :avatar="avatarImage || avatarEmoji || '🧑'" :name="name || '我'" :size="68" />
            <div class="avatar-edit-actions">
              <label class="emoji-field">
                <span>表情头像</span>
                <input v-model="avatarEmoji" maxlength="8" placeholder="例如：🧑" @input="useEmojiAvatar" />
              </label>
              <label class="upload-button">
                选择本地照片
                <input class="hidden-file-input" type="file" accept="image/*" @change="handleAvatarUpload" />
              </label>
              <button v-if="avatarImage" class="text-button" type="button" @click="useEmojiAvatar">改回表情头像</button>
            </div>
          </div>

          <div class="profile-fields">
            <label>
              我的昵称
              <input v-model="name" maxlength="20" placeholder="例如：小满" />
            </label>

            <label>
              我的身份
              <input v-model="identity" maxlength="50" placeholder="例如：大学生、设计师、旅行者" />
            </label>

            <label>
              个人简介
              <textarea v-model="bio" rows="4" maxlength="300" placeholder="写你希望整个小手机知道的基础信息；具体世界身份请放 Persona。"></textarea>
            </label>
          </div>
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
          头像和昵称用于整个虚拟手机；角色扮演中的身份、经历与边界由 Persona 独立控制。
        </p>
      </template>
    </form>
  </PhoneFrame>
</template>

<style scoped>
.profile-page {
  padding-bottom: 36px;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgba(217, 111, 155, 0.1);
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(255,255,255,.82), rgba(255,244,249,.64));
  box-shadow: 0 12px 30px rgba(116, 66, 87, 0.06);
}

.profile-hero-copy { min-width: 0; display: grid; gap: 3px; }
.profile-kicker { width: max-content; padding: 4px 8px; border-radius: 999px; background: rgba(217,111,155,.1); color: #b8567f; font-size: 11px; font-weight: 800; }
.profile-hero h2 { margin: 3px 0 0; font-size: 25px; }
.profile-hero p { margin: 0; color: #8d6677; }
.profile-hero small { margin-top: 4px; color: #a17d8d; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.profile-card {
  display: grid;
  gap: 12px;
  padding: 17px;
  border: 1px solid rgba(217, 111, 155, 0.08);
  border-radius: 21px;
  background: rgba(255, 255, 255, 0.58);
}

.profile-card h3 { margin: 0; }
.section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.section-heading p { margin: 4px 0 0; color: #9b7183; font-size: 12px; line-height: 1.5; }

.avatar-edit-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 13px;
  border-radius: 17px;
  background: rgba(255, 247, 251, .78);
}
.avatar-edit-actions { display: grid; gap: 8px; min-width: 0; }
.emoji-field { display: grid; gap: 5px; }
.emoji-field span { color: #7a5867; font-size: 12px; font-weight: 700; }
.profile-fields { display: grid; gap: 12px; }

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 13px;
  border-radius: 13px;
  background: rgba(217,111,155,.1);
  color: #b8567f;
  font-weight: 800;
  cursor: pointer;
}
.hidden-file-input { display: none; }
.text-button { border: none; background: transparent; color: #9b7183; cursor: pointer; text-align: left; padding: 2px 0; }

.status-message, .success-message, .error-message { padding: 11px 13px; border-radius: 13px; text-align: center; }
.status-message { background: rgba(255, 255, 255, 0.52); }
.success-message { background: rgba(225, 255, 235, 0.82); }
.error-message { background: rgba(255, 225, 225, 0.88); }

.persona-overview { gap: 10px; }
.persona-overview-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.persona-overview-head h3 { margin:0 0 4px; }
.persona-overview-head p { margin:0; color:#9b7183; font-size:12px; line-height:1.5; }
.persona-manage-button { border:0; border-radius:12px; padding:9px 11px; background:rgba(217,111,155,.12); color:#b8567f; font-weight:800; white-space:nowrap; }
.persona-summary { display:flex; gap:10px; align-items:flex-start; padding:11px; border-radius:14px; background:rgba(255,255,255,.76); overflow:hidden; }
.persona-summary.default { border:1px solid rgba(217,111,155,.16); }
.persona-symbol { flex: 0 0 auto; }
.persona-summary > div:last-child { display:grid; gap:3px; min-width:0; overflow:hidden; }
.persona-summary b, .persona-summary small, .persona-summary p { overflow-wrap:anywhere; }
.persona-summary small { color:#9b7183; }
.persona-summary p { margin:2px 0 0; color:#745b66; font-size:12px; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.character-persona-group { display:grid; gap:8px; }
.group-title { display:flex; justify-content:space-between; align-items:center; color:#745b66; }
.group-title small { color:#a78091; }
.persona-counts { display:flex; gap:8px; flex-wrap:wrap; }
.persona-counts span { padding:5px 9px; border-radius:999px; background:rgba(217,111,155,.08); color:#a35c78; font-size:11px; }
.persona-note { margin:0; color:#9b7183; font-size:12px; line-height:1.5; }

@media (max-width: 420px) {
  .profile-hero { align-items: flex-start; }
  .avatar-edit-row { grid-template-columns: 1fr; }
}
</style>