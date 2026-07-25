<script setup lang="ts">
import {
  onMounted,
  ref,
  watch
} from 'vue'

import PhoneFrame from '../components/PhoneFrame.vue'

import {
  getModelSettings,
  getProviderDefaults,
  saveModelSettings
} from '../services/modelSettings'

import {
  createProvider
} from '../services/ai/providerFactory'

import type {
  ModelSettings,
  ProviderType
} from '../types/modelSettings'

const form = ref<ModelSettings>({
  id: 'default',
  provider: 'mock',
  baseUrl: '',
  apiKey: '',
  model: 'mock',
  temperature: 0.8,
  maxTokens: 600,
  fallbackToMock: true,
  updatedAt: new Date().toISOString()
})

const isLoading = ref(true)
const isSaving = ref(false)
const isTesting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const providerOptions: Array<{
  value: ProviderType
  label: string
  description: string
}> = [
  {
    value: 'mock',
    label: '本地模拟模型',
    description: '不联网，不需要 API Key，用于演示和离线测试。'
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    description: '使用 DeepSeek 官方 OpenAI 兼容接口。'
  },
  {
    value: 'openai-compatible',
    label: 'OpenAI 兼容接口',
    description: '适用于支持 /v1/chat/completions 的服务。'
  }
]

onMounted(async () => {
  try {
    form.value = await getModelSettings()
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? `读取设置失败：${error.message}`
        : '读取设置失败。'
  } finally {
    isLoading.value = false
  }
})

watch(
  () => form.value.provider,
  (provider, oldProvider) => {
    if (isLoading.value || provider === oldProvider) {
      return
    }

    const defaults = getProviderDefaults(provider)
    form.value.baseUrl = defaults.baseUrl
    form.value.model = defaults.model
    successMessage.value = ''
    errorMessage.value = ''
  }
)

function validate() {
  if (form.value.provider === 'mock') {
    return
  }

  if (!form.value.baseUrl.trim()) {
    throw new Error('请填写 API 地址。')
  }

  if (!/^https?:\/\//i.test(form.value.baseUrl.trim())) {
    throw new Error('API 地址需要以 http:// 或 https:// 开头。')
  }

  if (!form.value.apiKey.trim()) {
    throw new Error('请填写 API Key。')
  }

  if (!form.value.model.trim()) {
    throw new Error('请填写模型名称。')
  }
}

async function save() {
  if (isSaving.value) return

  isSaving.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    validate()
    await saveModelSettings(form.value)
    form.value = await getModelSettings()
    successMessage.value = '模型设置已保存。'
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : '保存失败，请重试。'
  } finally {
    isSaving.value = false
  }
}

async function testConnection() {
  if (isTesting.value) return

  isTesting.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    validate()

    const provider = createProvider(form.value)
    await provider.testConnection()

    successMessage.value =
      form.value.provider === 'mock'
        ? '本地模拟模型可正常使用。'
        : '连接成功，模型接口已返回有效响应。'
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? `连接失败：${error.message}`
        : '连接失败，请检查配置。'
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <PhoneFrame
    title="API 与模型"
    show-back
  >
    <form
      class="model-page"
      @submit.prevent="save"
    >
      <section class="setting-card">
        <h2>模型供应商</h2>

        <label
          v-for="option in providerOptions"
          :key="option.value"
          class="provider-option"
        >
          <input
            v-model="form.provider"
            type="radio"
            :value="option.value"
          />

          <span>
            <b>{{ option.label }}</b>
            <small>{{ option.description }}</small>
          </span>
        </label>
      </section>

      <section
        v-if="form.provider !== 'mock'"
        class="setting-card field-card"
      >
        <h2>接口配置</h2>

        <label>
          API 地址
          <input
            v-model="form.baseUrl"
            autocomplete="off"
            placeholder="例如：https://api.deepseek.com"
          />
        </label>

        <label>
          API Key
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="new-password"
            placeholder="仅保存在当前浏览器"
          />
        </label>

        <label>
          模型名称
          <input
            v-model="form.model"
            autocomplete="off"
            placeholder="例如：deepseek-chat"
          />
        </label>
      </section>

      <section class="setting-card field-card">
        <h2>生成参数</h2>

        <label>
          温度：{{ form.temperature.toFixed(1) }}
          <input
            v-model.number="form.temperature"
            type="range"
            min="0"
            max="2"
            step="0.1"
          />
          <small>
            数值越高越活泼，越低越稳定。
          </small>
        </label>

        <label>
          最大输出长度
          <input
            v-model.number="form.maxTokens"
            type="number"
            min="64"
            max="8192"
            step="64"
          />
        </label>

        <label class="switch-row">
          <span>
            <b>失败时降级到本地模拟</b>
            <small>
              网络或接口失败时仍返回本地角色化回复。
            </small>
          </span>

          <input
            v-model="form.fallbackToMock"
            type="checkbox"
          />
        </label>
      </section>

      <p class="security-notice">
        API Key 会保存在当前浏览器的 IndexedDB 中，不会写入 GitHub。
        纯前端应用无法彻底隐藏密钥，正式公开发布时应改用服务端代理。
      </p>

      <p
        v-if="successMessage"
        class="success-box"
      >
        {{ successMessage }}
      </p>

      <p
        v-if="errorMessage"
        class="error-box"
      >
        {{ errorMessage }}
      </p>

      <div class="action-grid">
        <button
          type="button"
          class="secondary-action"
          :disabled="isTesting || isSaving"
          @click="testConnection"
        >
          {{ isTesting ? '正在测试……' : '测试连接' }}
        </button>

        <button
          type="submit"
          class="primary-action"
          :disabled="isSaving || isTesting"
        >
          {{ isSaving ? '正在保存……' : '保存设置' }}
        </button>
      </div>
    </form>
  </PhoneFrame>
</template>

<style scoped>
.model-page {
  height: 100%;
  overflow-y: auto;
  padding: 16px 16px 42px;
  display: grid;
  align-content: start;
  gap: 14px;
  background: #fff7fb;
}

.setting-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 24px rgba(116, 72, 92, 0.07);
}

.setting-card h2 {
  margin: 0 0 12px;
  font-size: 17px;
}

.provider-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(112, 65, 85, 0.1);
}

.provider-option:last-child {
  border-bottom: 0;
}

.provider-option input {
  width: 18px;
  margin-top: 3px;
}

.provider-option span,
.switch-row span {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 4px;
}

small {
  color: #92717f;
  line-height: 1.5;
}

.field-card {
  display: grid;
  gap: 14px;
}

.field-card label {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
}

.field-card input:not([type='checkbox']):not([type='range']) {
  width: 100%;
  padding: 12px 13px;
  border: 1px solid rgba(112, 65, 85, 0.14);
  border-radius: 14px;
  outline: none;
}

.field-card input[type='range'] {
  width: 100%;
}

.switch-row {
  display: flex !important;
  align-items: center;
  gap: 12px;
}

.switch-row input {
  width: 22px;
  height: 22px;
}

.security-notice,
.success-box,
.error-box {
  margin: 0;
  padding: 12px 14px;
  border-radius: 15px;
  font-size: 12px;
  line-height: 1.65;
}

.security-notice {
  background: #fff0cf;
  color: #765b22;
}

.success-box {
  background: #e8f8ed;
  color: #28743e;
}

.error-box {
  background: #ffe4e4;
  color: #9b3838;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.secondary-action,
.primary-action {
  min-height: 48px;
  border: 0;
  border-radius: 16px;
  font-weight: 700;
  cursor: pointer;
}

.secondary-action {
  background: #ffe3ef;
  color: #b95580;
}

.primary-action {
  background: linear-gradient(135deg, #ef8fb5, #d86f9b);
  color: #ffffff;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
