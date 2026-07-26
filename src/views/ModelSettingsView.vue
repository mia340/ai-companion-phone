<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch
} from 'vue'

import PhoneFrame from '../components/PhoneFrame.vue'

import {
  getModelSettings,
  getProviderDefaults,
  normalizeApiBaseUrl,
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
  availableModels: ['mock'],
  updatedAt: new Date().toISOString()
})

const modelOptions = ref<string[]>(['mock'])
const manualModelMode = ref(false)

const isLoading = ref(true)
const isSaving = ref(false)
const isTesting = ref(false)
const isFetchingModels = ref(false)

const successMessage = ref('')
const errorMessage = ref('')
const modelFetchMessage = ref('')

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
    description: '支持第三方中转、本地模型和其他 OpenAI 格式服务。'
  }
]

const isRemoteProvider = computed(() => {
  return form.value.provider !== 'mock'
})

const visibleModelOptions = computed(() => {
  return [...new Set([
    ...modelOptions.value,
    ...(form.value.availableModels ?? []),
    ...(form.value.model
      ? [form.value.model]
      : [])
  ].map(item => item.trim()).filter(Boolean))]
})

onMounted(async () => {
  try {
    form.value = await getModelSettings()

    const defaults = getProviderDefaults(
      form.value.provider
    )

    modelOptions.value = [
      ...(form.value.availableModels ?? []),
      ...defaults.models,
      ...(form.value.model
        ? [form.value.model]
        : [])
    ]

    manualModelMode.value =
      form.value.provider === 'openai-compatible' &&
      modelOptions.value.length === 0
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
    if (
      isLoading.value ||
      provider === oldProvider
    ) {
      return
    }

    const defaults = getProviderDefaults(provider)

    form.value.baseUrl = defaults.baseUrl
    form.value.model = defaults.model
    form.value.availableModels = [
      ...defaults.models
    ]
    form.value.modelsUpdatedAt = undefined

    modelOptions.value = [
      ...defaults.models
    ]

    manualModelMode.value =
      provider === 'openai-compatible'

    clearMessages()
  }
)

watch(
  [
    () => form.value.baseUrl,
    () => form.value.apiKey
  ],
  () => {
    modelFetchMessage.value = ''
  }
)

function clearMessages() {
  successMessage.value = ''
  errorMessage.value = ''
  modelFetchMessage.value = ''
}

function validateEndpoint() {
  if (!form.value.baseUrl.trim()) {
    throw new Error('请填写 API 地址。')
  }

  if (!/^https?:\/\//i.test(
    form.value.baseUrl.trim()
  )) {
    throw new Error(
      'API 地址需要以 http:// 或 https:// 开头。'
    )
  }

  if (!form.value.apiKey.trim()) {
    throw new Error('请填写 API Key。')
  }
}

function validate() {
  if (form.value.provider === 'mock') {
    return
  }

  validateEndpoint()

  if (!form.value.model.trim()) {
    throw new Error(
      '请选择模型，或切换为手动填写模型名称。'
    )
  }
}

function useManualModelInput() {
  manualModelMode.value = true
  clearMessages()
}

function useModelDropdown() {
  if (visibleModelOptions.value.length === 0) {
    errorMessage.value =
      '当前没有可选择的模型，请先拉取模型。'
    return
  }

  manualModelMode.value = false
  clearMessages()
}

async function fetchModels() {
  if (isFetchingModels.value) return

  isFetchingModels.value = true
  clearMessages()

  try {
    validateEndpoint()

    form.value.baseUrl = normalizeApiBaseUrl(
      form.value.baseUrl
    )

    const provider = createProvider(form.value)
    const models = await provider.listModels()
    const ids = [...new Set(
      models
        .map(item => item.id.trim())
        .filter(Boolean)
    )]

    if (ids.length === 0) {
      throw new Error(
        '接口没有返回可用模型，请改用手动填写。'
      )
    }

    modelOptions.value = ids
    form.value.availableModels = ids
    form.value.modelsUpdatedAt =
      new Date().toISOString()

    if (
      !form.value.model ||
      !ids.includes(form.value.model)
    ) {
      form.value.model = ids[0]
    }

    manualModelMode.value = false
    modelFetchMessage.value =
      `已拉取 ${ids.length} 个模型，当前选择：${form.value.model}`
  } catch (error) {
    manualModelMode.value = true
    errorMessage.value =
      error instanceof Error
        ? `拉取模型失败：${error.message}`
        : '拉取模型失败，请检查接口配置。'
  } finally {
    isFetchingModels.value = false
  }
}

async function save() {
  if (isSaving.value) return

  isSaving.value = true
  clearMessages()

  try {
    validate()

    form.value.baseUrl = normalizeApiBaseUrl(
      form.value.baseUrl
    )
    form.value.availableModels =
      visibleModelOptions.value

    await saveModelSettings(form.value)
    form.value = await getModelSettings()
    modelOptions.value = [
      ...(form.value.availableModels ?? [])
    ]

    successMessage.value =
      form.value.provider === 'mock'
        ? '本地模拟模型设置已保存。'
        : `设置已保存，当前模型：${form.value.model}`
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
  clearMessages()

  try {
    validate()

    const startedAt = performance.now()
    const provider = createProvider(form.value)

    await provider.testConnection()

    const elapsed = Math.max(
      1,
      Math.round(performance.now() - startedAt)
    )

    successMessage.value =
      form.value.provider === 'mock'
        ? '本地模拟模型可正常使用。'
        : `连接成功，当前模型：${form.value.model}，耗时约 ${elapsed} ms。`
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
        v-if="isRemoteProvider"
        class="setting-card field-card"
      >
        <h2>接口配置</h2>

        <label>
          API 地址
          <input
            v-model="form.baseUrl"
            autocomplete="off"
            placeholder="例如：https://api.example.com/v1"
          />
          <small>
            可以填写服务商提供的基础地址，不要填写 /chat/completions。
          </small>
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

        <div class="model-field">
          <div class="field-heading">
            <b>模型名称</b>

            <button
              type="button"
              class="fetch-model-button"
              :disabled="isFetchingModels || isTesting || isSaving"
              @click="fetchModels"
            >
              {{
                isFetchingModels
                  ? '正在拉取……'
                  : '↻ 拉取模型'
              }}
            </button>
          </div>

          <select
            v-if="!manualModelMode"
            v-model="form.model"
            class="model-select"
          >
            <option
              value=""
              disabled
            >
              请选择模型
            </option>

            <option
              v-for="model in visibleModelOptions"
              :key="model"
              :value="model"
            >
              {{ model }}
            </option>
          </select>

          <input
            v-else
            v-model="form.model"
            autocomplete="off"
            placeholder="手动填写模型名称"
          />

          <div class="model-mode-row">
            <small v-if="modelFetchMessage">
              {{ modelFetchMessage }}
            </small>

            <small v-else>
              点击“拉取模型”可从接口获取可用模型列表。
            </small>

            <button
              v-if="manualModelMode && visibleModelOptions.length > 0"
              type="button"
              class="text-action"
              @click="useModelDropdown"
            >
              使用下拉框
            </button>

            <button
              v-else-if="!manualModelMode"
              type="button"
              class="text-action"
              @click="useManualModelInput"
            >
              手动填写
            </button>
          </div>
        </div>
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
        ✓ {{ successMessage }}
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
          :disabled="isTesting || isSaving || isFetchingModels"
          @click="testConnection"
        >
          {{ isTesting ? '正在测试……' : '测试连接' }}
        </button>

        <button
          type="submit"
          class="primary-action"
          :disabled="isSaving || isTesting || isFetchingModels"
        >
          {{ isSaving ? '正在保存……' : '保存设置' }}
        </button>
      </div>

      <details class="error-reference">
        <summary>错误代码参考</summary>

        <dl>
          <div>
            <dt>400</dt>
            <dd>请求格式或模型名称错误</dd>
          </div>
          <div>
            <dt>401</dt>
            <dd>API Key 无效或已失效</dd>
          </div>
          <div>
            <dt>403</dt>
            <dd>没有权限或账户余额不足</dd>
          </div>
          <div>
            <dt>404</dt>
            <dd>API 地址或接口路径错误</dd>
          </div>
          <div>
            <dt>429</dt>
            <dd>请求过于频繁或额度不足</dd>
          </div>
          <div>
            <dt>500/503</dt>
            <dd>服务商暂时异常</dd>
          </div>
        </dl>
      </details>
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

.field-card label,
.model-field {
  display: grid;
  gap: 7px;
  font-size: 13px;
  font-weight: 700;
}

.field-card input:not([type='checkbox']):not([type='range']),
.model-select {
  width: 100%;
  min-height: 46px;
  padding: 12px 13px;
  border: 1px solid rgba(112, 65, 85, 0.14);
  border-radius: 14px;
  outline: none;
  background: #ffffff;
  color: inherit;
  font: inherit;
  box-sizing: border-box;
}

.field-card input[type='range'] {
  width: 100%;
}

.field-heading,
.model-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.model-mode-row small {
  min-width: 0;
  flex: 1;
  font-weight: 400;
}

.fetch-model-button,
.text-action {
  border: 0;
  background: transparent;
  color: #c85f8a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.fetch-model-button {
  padding: 4px 0;
}

.text-action {
  padding: 2px 0;
  font-size: 12px;
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

.error-reference {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
}

.error-reference summary {
  cursor: pointer;
  font-weight: 700;
}

.error-reference dl {
  margin: 12px 0 0;
  display: grid;
  gap: 8px;
  font-size: 12px;
}

.error-reference dl div {
  display: grid;
  grid-template-columns: 68px 1fr;
  gap: 10px;
}

.error-reference dt {
  font-weight: 700;
}

.error-reference dd {
  margin: 0;
  color: #92717f;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
