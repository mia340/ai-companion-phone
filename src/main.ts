import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import { seedDatabase } from './db/seed'
import { getModelSettings, MAX_OUTPUT_TOKENS, saveModelSettings } from './services/modelSettings'
import { startAutoActivityLoop } from './services/momentAutoActivityService'
import { startSocialRuntimeLoop } from './services/socialRuntimeService'
import './assets/main.css'

let requestServiceWorkerUpdate: (reloadPage?: boolean) => Promise<void> = async () => {}
requestServiceWorkerUpdate = registerSW({
  immediate: true,
  onRegisteredSW: (_swUrl, registration) => {
    // Check the release worker on every launch so a normal refresh does not stay on an obsolete app shell.
    void registration?.update()
  },
  onNeedRefresh: () => {
    // autoUpdate normally activates immediately; this also handles browsers that still surface a waiting worker.
    void requestServiceWorkerUpdate(true)
  }
})

/**
 * 一次性开发引导：仅当开发模式下从地址栏带 `?applyKey=` 等参数打开时，
 * 把 API 配置写入本地 IndexedDB 的模型设置（等价于在「API 与模型」粘贴后保存）。
 *
 * - `applyKey`：API Key。
 * - `applyBase`（可选）：OpenAI 兼容 API 地址，缺省不改（保留设置页当前值）。
 * - `applyModel`（可选）：模型名，缺省不改。
 * - `applyMaxTokens`（可选）：最大输出 token 数，缺省不改。
 *
 * - key 不会出现在任何源码 / 打包产物里；生产构建（import.meta.env.DEV=false）整段不编译。
 * - 写入成功后立即把参数从地址栏移除，避免留在浏览器历史或分享链接里。
 * 其余情况（无这些参数）走普通启动，什么都不做。
 */
async function applyOnboardingKeyFromUrl() {
  if (!import.meta.env.DEV) return
  const params = new URLSearchParams(window.location.search)
  const key = params.get('applyKey')
  const maxTokensParam = params.get('applyMaxTokens')
  if (!key?.trim() && !maxTokensParam) return

  const settings = await getModelSettings()
  const next = { ...settings }
  if (key?.trim()) next.apiKey = key.trim()
  const base = params.get('applyBase')
  if (base?.trim()) next.baseUrl = base.trim()
  const model = params.get('applyModel')
  if (model?.trim()) next.model = model.trim()
  const maxTokens = Number(maxTokensParam)
  if (Number.isFinite(maxTokens) && maxTokens >= 64) {
    next.maxTokens = Math.min(MAX_OUTPUT_TOKENS, Math.round(maxTokens))
  }

  await saveModelSettings(next)

  window.history.replaceState(
    null,
    '',
    window.location.pathname + window.location.hash
  )
}

await seedDatabase()
await applyOnboardingKeyFromUrl()
const app = createApp(App).use(createPinia()).use(router)
app.mount('#app')
startAutoActivityLoop()
void startSocialRuntimeLoop()
