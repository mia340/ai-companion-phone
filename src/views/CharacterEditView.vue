<script setup lang="ts">
import {
  computed,
  onMounted,
  reactive,
  ref
} from 'vue'

import {
  useRoute,
  useRouter
} from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'

import { db } from '../db/database'

import {
  updateCharacterAndConversation
} from '../services/characterService'

import type {
  Character
} from '../types/domain'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const isSaving = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const characterId = computed(() =>
  String(route.params.id ?? '')
)

const form = reactive({
  name: '',
  nickname: '',
  avatar: '🙂',

  gender: '',
  age: '',
  identity: '',

  relationship: '朋友',

  persona: '',
  speakingStyle: '',
  background: '',

  likesText: '',
  dislikesText: '',

  mood: '',
  activity: '',

  replySpeed: 'natural'
})

function isImageAvatar(
  avatar?: string
) {
  if (!avatar) return false

  return /^(data:image\/|blob:|https?:\/\/)/i
    .test(avatar)
}

function parseList(
  value: string
) {
  return Array.from(
    new Set(
      value
        .split(/[,，、\n]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  )
}

function loadImage(
  url: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image = new Image()

      image.onload = () => resolve(image)

      image.onerror = () =>
        reject(
          new Error('图片读取失败。')
        )

      image.src = url
    }
  )
}

async function compressAvatar(
  file: File
): Promise<string> {
  const objectUrl =
    URL.createObjectURL(file)

  try {
    const image =
      await loadImage(objectUrl)

    const size = 512

    const canvas =
      document.createElement('canvas')

    canvas.width = size
    canvas.height = size

    const context =
      canvas.getContext('2d')

    if (!context) {
      throw new Error(
        '浏览器无法处理这张图片。'
      )
    }

    const sourceSize =
      Math.min(
        image.naturalWidth,
        image.naturalHeight
      )

    const sourceX =
      (
        image.naturalWidth -
        sourceSize
      ) / 2

    const sourceY =
      (
        image.naturalHeight -
        sourceSize
      ) / 2

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    )

    return canvas.toDataURL(
      'image/jpeg',
      0.84
    )
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function selectAvatar(
  event: Event
) {
  const input =
    event.target as HTMLInputElement

  const file = input.files?.[0]

  if (!file) return

  errorMessage.value = ''

  if (!file.type.startsWith('image/')) {
    errorMessage.value =
      '请选择图片文件。'

    input.value = ''
    return
  }

  if (file.size > 12 * 1024 * 1024) {
    errorMessage.value =
      '原始图片不能超过 12MB。'

    input.value = ''
    return
  }

  try {
    form.avatar =
      await compressAvatar(file)
  } catch (error) {
    console.error(
      '处理头像失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '头像处理失败。'
  } finally {
    input.value = ''
  }
}

async function loadCharacter() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const character =
      await db.characters.get(
        characterId.value
      )

    if (!character) {
      throw new Error(
        '没有找到需要编辑的角色。'
      )
    }

    form.name = character.name
    form.nickname =
      character.nickname ?? ''

    form.avatar =
      character.avatar || '🙂'

    form.gender =
      character.gender ?? ''

    form.age =
      character.age !== undefined
        ? String(character.age)
        : ''

    form.identity =
      character.identity ?? ''

    form.relationship =
      character.relationship || '朋友'

    form.persona =
      character.persona ?? ''

    form.speakingStyle =
      character.speakingStyle ?? ''

    form.background =
      character.background ?? ''

    form.likesText =
      character.likes?.join('、') ?? ''

    form.dislikesText =
      character.dislikes?.join('、') ?? ''

    form.mood =
      character.mood ?? ''

    form.activity =
      character.activity ?? ''

    form.replySpeed =
      character.replySpeed ?? 'natural'
  } catch (error) {
    console.error(
      '读取角色失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '读取角色失败。'
  } finally {
    isLoading.value = false
  }
}

async function saveCharacter() {
  if (isSaving.value) return

  errorMessage.value = ''
  successMessage.value = ''

  const name = form.name.trim()

  if (!name) {
    errorMessage.value =
      '角色姓名不能为空。'
    return
  }

  let age: number | undefined

  if (form.age.trim()) {
    age = Number(form.age)

    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 999
    ) {
      errorMessage.value =
        '年龄请输入 1 至 999 的整数。'
      return
    }
  }

  // 提前完成类型转换，避免对象内部的 as 语法被错误解析
  const gender:
    Character['gender'] | undefined =
      form.gender
        ? (
            form.gender as
              Character['gender']
          )
        : undefined

  const replySpeed:
    Character['replySpeed'] =
      form.replySpeed as
        Character['replySpeed']

  isSaving.value = true

  try {
    await updateCharacterAndConversation(
      characterId.value,
      {
        name,

        nickname:
          form.nickname.trim() ||
          undefined,

        avatar:
          form.avatar.trim() ||
          '🙂',

        gender,

        age,

        identity:
          form.identity.trim() ||
          undefined,

        relationship:
          form.relationship.trim() ||
          '朋友',

        persona:
          form.persona.trim() ||
          '等待你逐渐了解的原创角色。',

        speakingStyle:
          form.speakingStyle.trim() ||
          undefined,

        background:
          form.background.trim() ||
          undefined,

        likes:
          parseList(form.likesText),

        dislikes:
          parseList(
            form.dislikesText
          ),

        mood:
          form.mood.trim() ||
          '平静',

        activity:
          form.activity.trim() ||
          '正在等待你的消息',

        replySpeed
      }
    )

    successMessage.value =
      '角色资料已经保存。'

    window.setTimeout(() => {
      router.replace(
        `/characters/${characterId.value}`
      )
    }, 500)
  } catch (error) {
    console.error(
      '保存角色失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '保存角色失败。'
  } finally {
    isSaving.value = false
  }
}

onMounted(loadCharacter)
</script>

<template>
  <PhoneFrame
    :title="
      form.name
        ? `编辑 ${form.name}`
        : '编辑角色'
    "
    show-back
  >
    <form
      class="edit-page"
      @submit.prevent="saveCharacter"
    >
      <p
        v-if="isLoading"
        class="state-message"
      >
        正在读取角色资料……
      </p>

      <template v-else>
        <section class="form-card avatar-card">
          <h2>角色头像</h2>

          <div class="avatar-preview">
            <img
              v-if="isImageAvatar(
                form.avatar
              )"
              :src="form.avatar"
              alt="角色头像"
            />

            <span v-else>
              {{ form.avatar || '🙂' }}
            </span>
          </div>

          <label>
            表情头像

            <input
              v-model="form.avatar"
              maxlength="4"
              placeholder="例如：🌙"
            />
          </label>

          <label class="photo-button">
            选择本地照片

            <input
              type="file"
              accept="image/*"
              @change="selectAvatar"
            />
          </label>

          <button
            v-if="isImageAvatar(form.avatar)"
            type="button"
            class="remove-photo"
            @click="form.avatar = '🙂'"
          >
            移除照片并使用表情
          </button>
        </section>

        <section class="form-card">
          <h2>基本资料</h2>

          <label>
            角色姓名

            <input
              v-model="form.name"
              required
              maxlength="30"
            />
          </label>

          <label>
            昵称

            <input
              v-model="form.nickname"
              maxlength="30"
              placeholder="例如：晚晚"
            />
          </label>

          <div class="two-fields">
            <label>
              性别

              <select v-model="form.gender">
                <option value="">
                  未设置
                </option>
                <option value="female">
                  女
                </option>
                <option value="male">
                  男
                </option>
                <option value="other">
                  其他
                </option>
              </select>
            </label>

            <label>
              年龄

              <input
                v-model="form.age"
                inputmode="numeric"
                placeholder="例如：23"
              />
            </label>
          </div>

          <label>
            身份或职业

            <input
              v-model="form.identity"
              maxlength="60"
              placeholder="例如：甜品店店主"
            />
          </label>

          <label>
            与我的关系

            <select
              v-model="form.relationship"
            >
              <option>朋友</option>
              <option>挚友</option>
              <option>恋人</option>
              <option>家人</option>
              <option>同学</option>
              <option>同事</option>
              <option>陌生人</option>
            </select>
          </label>
        </section>

        <section class="form-card">
          <h2>人物设定</h2>

          <label>
            核心性格

            <textarea
              v-model="form.persona"
              rows="5"
              placeholder="描述性格、价值观和相处方式"
            />
          </label>

          <label>
            说话方式

            <textarea
              v-model="form.speakingStyle"
              rows="4"
              placeholder="例如：语气温柔，回复自然，不会说教"
            />
          </label>

          <label>
            背景故事

            <textarea
              v-model="form.background"
              rows="6"
              placeholder="描述成长经历、生活环境和重要经历"
            />
          </label>
        </section>

        <section class="form-card">
          <h2>喜好与状态</h2>

          <label>
            喜欢

            <textarea
              v-model="form.likesText"
              rows="3"
              placeholder="用逗号或顿号分隔，例如：甜品、月亮、猫"
            />
          </label>

          <label>
            不喜欢

            <textarea
              v-model="form.dislikesText"
              rows="3"
              placeholder="用逗号或顿号分隔"
            />
          </label>

          <label>
            当前心情

            <input
              v-model="form.mood"
              maxlength="60"
              placeholder="例如：有点想你"
            />
          </label>

          <label>
            当前活动

            <input
              v-model="form.activity"
              maxlength="100"
              placeholder="例如：刚结束下午茶"
            />
          </label>

          <label>
            回复速度

            <select
              v-model="form.replySpeed"
            >
              <option value="instant">
                立即回复
              </option>

              <option value="natural">
                自然速度
              </option>

              <option value="slow">
                慢速回复
              </option>

              <option value="custom">
                自定义
              </option>
            </select>
          </label>
        </section>

        <p
          v-if="successMessage"
          class="success-message"
        >
          {{ successMessage }}
        </p>

        <p
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </p>

        <button
          class="save-button"
          type="submit"
          :disabled="isSaving"
        >
          {{
            isSaving
              ? '正在保存……'
              : '保存角色资料'
          }}
        </button>
      </template>
    </form>
  </PhoneFrame>
</template>

<style scoped>
.edit-page {
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 16px;
  background: #fff7fb;
}

.form-card {
  padding: 19px;
  display: grid;
  gap: 14px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 8px 24px rgba(111, 67, 87, 0.07);
}

.form-card h2 {
  margin: 0;
  color: #5c3f4b;
  font-size: 19px;
}

.form-card label {
  display: grid;
  gap: 7px;
  color: #674954;
  font-weight: 600;
  line-height: 1.5;
}

.form-card input,
.form-card select,
.form-card textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #eadde2;
  border-radius: 14px;
  padding: 12px 13px;
  background: white;
  color: #573d47;
  font: inherit;
  font-weight: 400;
  outline: none;
}

.form-card input,
.form-card select {
  min-height: 46px;
}

.form-card textarea {
  resize: vertical;
  line-height: 1.65;
}

.form-card input:focus,
.form-card select:focus,
.form-card textarea:focus {
  border-color: #df79a3;
  box-shadow:
    0 0 0 3px rgba(223, 121, 163, 0.12);
}

.avatar-card {
  justify-items: stretch;
}

.avatar-preview {
  width: 100px;
  height: 100px;
  justify-self: center;
  overflow: hidden;
  border-radius: 30px;
  display: grid;
  place-items: center;
  background: #ffe1ed;
  font-size: 48px;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-button {
  min-height: 46px;
  border-radius: 14px;
  display: flex !important;
  align-items: center;
  justify-content: center;
  background: #ffe4ef;
  color: #a95377 !important;
  cursor: pointer;
}

.photo-button input {
  display: none;
}

.remove-photo {
  min-height: 44px;
  border: none;
  border-radius: 14px;
  background: #fff1f4;
  color: #a44e67;
  font-weight: 700;
  cursor: pointer;
}

.two-fields {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.save-button {
  min-height: 54px;
  margin-bottom: 15px;
  border: none;
  border-radius: 18px;
  background: #dc73a0;
  color: white;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}

.save-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.state-message,
.success-message,
.error-message {
  padding: 14px;
  border-radius: 15px;
  text-align: center;
  line-height: 1.6;
}

.state-message {
  background: white;
  color: #80616d;
}

.success-message {
  background: #e6f9ec;
  color: #327a4d;
}

.error-message {
  background: #ffe5e8;
  color: #aa4052;
}

@media (max-width: 420px) {
  .two-fields {
    grid-template-columns: 1fr;
  }
}
</style>