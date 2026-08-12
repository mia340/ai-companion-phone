<script setup lang="ts">
import {
  computed,
  ref
} from 'vue'

import PhoneFrame from '../components/PhoneFrame.vue'

import {
  createBackup,
  downloadBackup,
  getBackupSummary,
  parseBackupFile,
  restoreBackup
} from '../services/dataBackup'

import type {
  CompanionBackup
} from '../services/dataBackup'

const selectedBackup =
  ref<CompanionBackup>()

const selectedFileName = ref('')
const includeImages = ref(true)

const isWorking = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const summary = computed(() => {
  if (!selectedBackup.value) {
    return undefined
  }

  return getBackupSummary(
    selectedBackup.value
  )
})

async function exportData() {
  if (isWorking.value) return

  isWorking.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const backup = await createBackup({
      includeImages: includeImages.value
    })

    downloadBackup(backup)

    successMessage.value =
      '备份文件已经生成，请保存好下载的 JSON 文件。'
  } catch (error) {
    console.error(
      '导出数据失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '数据导出失败，请重试。'
  } finally {
    isWorking.value = false
  }
}

async function selectBackupFile(
  event: Event
) {
  const input =
    event.target as HTMLInputElement

  const file = input.files?.[0]

  successMessage.value = ''
  errorMessage.value = ''
  selectedBackup.value = undefined
  selectedFileName.value = ''

  if (!file) return

  try {
    selectedBackup.value =
      await parseBackupFile(file)

    selectedFileName.value =
      file.name
  } catch (error) {
    console.error(
      '读取备份失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '备份文件读取失败。'
  } finally {
    input.value = ''
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function importData() {
  if (
    !selectedBackup.value ||
    isWorking.value
  ) {
    return
  }

  const confirmed = window.confirm(
    [
      '导入备份将覆盖当前浏览器中的角色、聊天和用户资料。',
      '',
      '建议先导出当前数据作为备份。',
      '',
      '确定继续导入吗？'
    ].join('\n')
  )

  if (!confirmed) return

  isWorking.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    await restoreBackup(
      selectedBackup.value
    )

    window.alert(
      '数据导入成功，页面将重新加载。'
    )

    window.location.reload()
  } catch (error) {
    console.error(
      '导入数据失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? error.message
        : '数据导入失败，请重试。'
  } finally {
    isWorking.value = false
  }
}
</script>

<template>
  <PhoneFrame
    title="数据备份"
    show-back
  >
    <section class="backup-page">
      <section class="backup-card">
        <div class="card-icon">📤</div>

        <div class="card-content">
          <h2>导出全部数据</h2>

          <p>
            导出角色、头像、聊天记录、
            世界设置、“我的资料”、聊天偏好、角色记忆与关系成长记录。
          </p>

          <label class="image-export-option">
            <input v-model="includeImages" type="checkbox" />
            <span>
              <b>备份中包含聊天图片</b>
              <small>关闭后备份更小，但恢复时只保留图片消息与附言。</small>
            </span>
          </label>

          <button
            class="primary-action"
            type="button"
            :disabled="isWorking"
            @click="exportData"
          >
            {{
              isWorking
                ? '正在处理……'
                : '导出 JSON 备份'
            }}
          </button>
        </div>
      </section>

      <section class="backup-card">
        <div class="card-icon">📥</div>

        <div class="card-content">
          <h2>导入备份</h2>

          <p>
            可以把本地浏览器中的数据迁移到
            GitHub Pages 在线版或其他设备。
          </p>

          <label class="file-button">
            选择备份文件

            <input
              type="file"
              accept=".json,application/json"
              @change="selectBackupFile"
            />
          </label>
        </div>
      </section>

      <section
        v-if="selectedBackup && summary"
        class="backup-preview"
      >
        <h3>备份文件预览</h3>

        <p class="file-name">
          {{ selectedFileName }}
        </p>

        <div class="summary-grid">
          <span>
            <b>{{ summary.characters }}</b>
            个角色
          </span>

          <span>
            <b>{{ summary.conversations }}</b>
            个会话
          </span>

          <span>
            <b>{{ summary.messages }}</b>
            条消息
          </span>

          <span>
            <b>{{ summary.images }}</b>
            张图片
          </span>

          <span>
            <b>{{ formatBytes(summary.imageBytes) }}</b>
            图片体积
          </span>

          <span>
            <b>{{ summary.userProfiles }}</b>
            份用户资料
          </span>

          <span>
            <b>{{ summary.memories }}</b>
            条角色记忆
          </span>


          <span>
            <b>{{ summary.relationships }}</b>
            份关系记录
          </span>

          <span>
            <b>{{ summary.relationshipEvents }}</b>
            个关系事件
          </span>

          <span>
            <b>{{ summary.personas }}</b>
            套用户人设
          </span>

          <span>
            <b>{{ summary.lorebookEntries }}</b>
            条世界书设定
          </span>

          <span>
            <b>{{ summary.stateHistory }}</b>
            条状态变化
          </span>

          <span>
            <b>{{ summary.communityResourceArchives }}</b>
            份社区资源归档
          </span>
        </div>

        <p class="export-time">
          导出时间：
          {{
            new Date(
              selectedBackup.exportedAt
            ).toLocaleString('zh-CN')
          }}
        </p>

        <button
          class="danger-action"
          type="button"
          :disabled="isWorking"
          @click="importData"
        >
          {{
            isWorking
              ? '正在导入……'
              : '覆盖当前数据并导入'
          }}
        </button>
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

      <section class="notice-card">
        <h3>为什么需要备份？</h3>

        <p>
          localhost、GitHub Pages、外部
          Edge 和 VS Code 内置浏览器分别拥有
          独立的 IndexedDB，数据不会自动同步。
        </p>

        <p>
          备份文件可能包含头像、聊天记录和个人
          信息，请不要随意发送给其他人。
        </p>
      </section>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.backup-page {
  height: 100%;
  overflow-y: auto;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 16px;
  background: #fff7fb;
}

.backup-card,
.backup-preview,
.notice-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    0 8px 24px rgba(116, 72, 92, 0.07);
}

.backup-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.card-icon {
  flex: 0 0 auto;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #ffe1ed;
  font-size: 28px;
}

.card-content {
  min-width: 0;
  flex: 1;
}

h2,
h3 {
  margin: 0 0 8px;
  color: #5b3f4a;
}

p {
  margin: 0;
  line-height: 1.65;
  color: rgba(91, 63, 74, 0.72);
}

.primary-action,
.danger-action,
.file-button {
  width: 100%;
  min-height: 48px;
  margin-top: 14px;
  border: none;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.primary-action {
  background: #df77a4;
  color: #ffffff;
}

.file-button {
  box-sizing: border-box;
  background: #ffe5ef;
  color: #b6537d;
}

.file-button input {
  display: none;
}

.danger-action {
  background: #bd5b72;
  color: #ffffff;
}

.primary-action:disabled,
.danger-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-grid {
  margin: 14px 0;
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-grid span {
  padding: 12px 8px;
  border-radius: 14px;
  text-align: center;
  background: #fff0f6;
  color: #75505f;
}

.summary-grid b {
  display: block;
  margin-bottom: 2px;
  font-size: 20px;
}

.export-time {
  font-size: 12px;
}

.success-message,
.error-message {
  padding: 12px 14px;
  border-radius: 14px;
  text-align: center;
}

.success-message {
  background: #e7faed;
  color: #317b4d;
}

.error-message {
  background: #ffe5e7;
  color: #a44352;
}

.notice-card {
  display: grid;
  gap: 10px;
}

.notice-card p {
  font-size: 13px;
}

.image-export-option {
  margin: 14px 0 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 14px;
  background: #fff1f6;
}

.image-export-option input {
  width: 19px;
  height: 19px;
  margin-top: 2px;
}

.image-export-option span {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.image-export-option small {
  color: #92717f;
  line-height: 1.5;
}

</style>