<script setup lang="ts">
import {
  computed,
  onMounted,
  ref
} from 'vue'

import {
  useRoute,
  useRouter
} from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'

import { db } from '../db/database'

import {
  deleteCharacterSafely,
  getOrCreateSingleConversation
} from '../services/characterService'

import type {
  Character
} from '../types/domain'

const route = useRoute()
const router = useRouter()

const character =
  ref<Character | null>(null)

const isLoading = ref(true)
const isDeleting = ref(false)

const errorMessage = ref('')

const showDeletePanel = ref(false)
const deleteConfirmName = ref('')

const characterId = computed(() =>
  String(route.params.id ?? '')
)

const canDelete = computed(() => {
  return (
    character.value !== null &&
    deleteConfirmName.value.trim() ===
      character.value.name
  )
})

function isImageAvatar(
  avatar?: string
) {
  if (!avatar) return false

  return /^(data:image\/|blob:|https?:\/\/)/i
    .test(avatar)
}

function showValue(
  value?: string | number
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return '未填写'
  }

  return String(value)
}

function showList(
  values?: string[]
) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return '未填写'
  }

  return values.join('、')
}

async function loadCharacter() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result =
      await db.characters.get(
        characterId.value
      )

    if (!result) {
      throw new Error(
        '这个角色不存在或已经被删除。'
      )
    }

    character.value = result
  } catch (error) {
    console.error(
      '读取角色详情失败：',
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

async function openChat() {
  if (!character.value) return

  try {
    const conversation =
      await getOrCreateSingleConversation(
        character.value
      )

    router.push(
      `/chat/${conversation.id}`
    )
  } catch (error) {
    console.error(
      '打开聊天失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '无法打开聊天。'
  }
}

function openEdit() {
  if (!character.value) return

  router.push(
    `/characters/${character.value.id}/edit`
  )
}

function cancelDelete() {
  showDeletePanel.value = false
  deleteConfirmName.value = ''
}

async function confirmDelete() {
  if (
    !character.value ||
    !canDelete.value ||
    isDeleting.value
  ) {
    return
  }

  isDeleting.value = true
  errorMessage.value = ''

  const deletedName =
    character.value.name

  try {
    const result =
      await deleteCharacterSafely(
        character.value.id
      )

    window.alert(
      [
        `“${deletedName}”已经删除。`,
        '',
        `删除单聊：${result.deletedSingleConversations} 个`,
        `删除消息：${result.deletedMessages} 条`,
        `调整群聊：${result.updatedGroupConversations} 个`
      ].join('\n')
    )

    router.replace('/contacts')
  } catch (error) {
    console.error(
      '删除角色失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '删除角色失败。'
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadCharacter)
</script>

<template>
  <PhoneFrame
    :title="character?.name ?? '角色详情'"
    show-back
  >
    <section class="detail-page">
      <p
        v-if="isLoading"
        class="state-message"
      >
        正在读取角色资料……
      </p>

      <p
        v-else-if="errorMessage && !character"
        class="error-message"
      >
        {{ errorMessage }}
      </p>

      <template v-else-if="character">
        <section class="profile-card">
          <div class="avatar-shell">
            <img
              v-if="isImageAvatar(
                character.avatar
              )"
              :src="character.avatar"
              :alt="character.name"
            />

            <span v-else>
              {{ character.avatar || '🙂' }}
            </span>
          </div>

          <div class="profile-main">
            <h1>{{ character.name }}</h1>

            <p v-if="character.nickname">
              昵称：{{ character.nickname }}
            </p>

            <div class="profile-tags">
              <span>
                {{ character.relationship }}
              </span>

              <span v-if="character.identity">
                {{ character.identity }}
              </span>

              <span v-if="character.age">
                {{ character.age }} 岁
              </span>
            </div>
          </div>
        </section>

        <section class="status-card">
          <div>
            <small>当前心情</small>
            <strong>
              {{ showValue(character.mood) }}
            </strong>
          </div>

          <div>
            <small>当前活动</small>
            <strong>
              {{ showValue(character.activity) }}
            </strong>
          </div>
        </section>

        <section class="action-grid">
          <button
            type="button"
            class="primary-action"
            @click="openChat"
          >
            💬 发消息
          </button>

          <button
            type="button"
            class="secondary-action"
            @click="openEdit"
          >
            ✏️ 编辑资料
          </button>
        </section>

        <section class="info-card">
          <h2>人物性格</h2>
          <p>
            {{ showValue(character.persona) }}
          </p>
        </section>

        <section class="info-card">
          <h2>说话方式</h2>
          <p>
            {{
              showValue(
                character.speakingStyle
              )
            }}
          </p>
        </section>

        <section class="info-card">
          <h2>背景故事</h2>
          <p>
            {{
              showValue(
                character.background
              )
            }}
          </p>
        </section>

        <section class="info-card two-column">
          <div>
            <h2>喜欢</h2>
            <p>
              {{ showList(character.likes) }}
            </p>
          </div>

          <div>
            <h2>不喜欢</h2>
            <p>
              {{
                showList(
                  character.dislikes
                )
              }}
            </p>
          </div>
        </section>

        <p
          v-if="errorMessage"
          class="error-message"
        >
          {{ errorMessage }}
        </p>

        <section class="danger-zone">
          <h2>危险操作</h2>

          <p>
            删除角色后，该角色的单聊和聊天记录
            也会被删除。该操作无法撤销。
          </p>

          <button
            v-if="!showDeletePanel"
            type="button"
            class="show-delete-button"
            @click="showDeletePanel = true"
          >
            删除这个角色
          </button>

          <div
            v-else
            class="delete-confirm-panel"
          >
            <strong>
              删除前建议先导出数据备份
            </strong>

            <button
              type="button"
              class="backup-link"
              @click="
                router.push('/backup')
              "
            >
              前往数据备份
            </button>

            <label>
              输入角色姓名
              “{{ character.name }}”
              确认删除

              <input
                v-model="deleteConfirmName"
                :placeholder="character.name"
                autocomplete="off"
              />
            </label>

            <div class="delete-actions">
              <button
                type="button"
                class="cancel-button"
                :disabled="isDeleting"
                @click="cancelDelete"
              >
                取消
              </button>

              <button
                type="button"
                class="delete-button"
                :disabled="
                  !canDelete ||
                  isDeleting
                "
                @click="confirmDelete"
              >
                {{
                  isDeleting
                    ? '正在删除……'
                    : '永久删除'
                }}
              </button>
            </div>
          </div>
        </section>
      </template>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 15px;
  background: #fff7fb;
}

.profile-card,
.status-card,
.info-card,
.danger-zone {
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8px 24px rgba(110, 67, 87, 0.07);
}

.profile-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-shell {
  flex: 0 0 auto;
  width: 86px;
  height: 86px;
  overflow: hidden;
  border-radius: 26px;
  display: grid;
  place-items: center;
  background: #ffe2ee;
  font-size: 42px;
}

.avatar-shell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-main {
  min-width: 0;
}

.profile-main h1 {
  margin: 0 0 5px;
  color: #573b47;
  font-size: 25px;
}

.profile-main p {
  margin: 0 0 10px;
  color: #997580;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.profile-tags span {
  padding: 5px 9px;
  border-radius: 999px;
  background: #fff0f6;
  color: #a95377;
  font-size: 12px;
}

.status-card {
  padding: 16px;
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-card div {
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  background: #fff0f6;
}

.status-card small {
  display: block;
  margin-bottom: 6px;
  color: #a6828e;
}

.status-card strong {
  color: #644651;
  line-height: 1.5;
}

.action-grid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.action-grid button {
  min-height: 50px;
  border: none;
  border-radius: 17px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

.primary-action {
  background: #dd75a2;
  color: white;
}

.secondary-action {
  background: #ffe2ee;
  color: #a85075;
}

.info-card {
  padding: 18px;
}

.info-card h2,
.danger-zone h2 {
  margin: 0 0 9px;
  color: #5d404c;
  font-size: 17px;
}

.info-card p,
.danger-zone p {
  margin: 0;
  color: #866672;
  line-height: 1.75;
  white-space: pre-wrap;
}

.two-column {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.danger-zone {
  margin-bottom: 12px;
  padding: 18px;
  border: 1px solid #ffd2d8;
}

.show-delete-button,
.delete-button,
.cancel-button,
.backup-link {
  min-height: 44px;
  border: none;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
}

.show-delete-button {
  width: 100%;
  margin-top: 14px;
  background: #fff0f1;
  color: #bc4d60;
}

.delete-confirm-panel {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  gap: 12px;
  border-radius: 17px;
  background: #fff0f2;
}

.delete-confirm-panel strong {
  color: #9d4557;
}

.backup-link {
  background: white;
  color: #a55374;
}

.delete-confirm-panel label {
  display: grid;
  gap: 8px;
  color: #744f5d;
  line-height: 1.6;
}

.delete-confirm-panel input {
  min-height: 45px;
  box-sizing: border-box;
  padding: 0 13px;
  border: 1px solid #ecced8;
  border-radius: 13px;
  outline: none;
  font-size: 15px;
}

.delete-actions {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.cancel-button {
  background: white;
  color: #72515d;
}

.delete-button {
  background: #bd5368;
  color: white;
}

.delete-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.state-message,
.error-message {
  padding: 14px;
  border-radius: 15px;
  text-align: center;
}

.state-message {
  background: white;
  color: #80616d;
}

.error-message {
  background: #ffe5e8;
  color: #ab4052;
}

@media (max-width: 420px) {
  .two-column,
  .status-card {
    grid-template-columns: 1fr;
  }
}
</style>