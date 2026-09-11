<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import type { HomeAppDefinition } from '../services/appCustomizationService'
import { prepareAppIcon, resetAppIcon, saveAppIcon } from '../services/appCustomizationService'

const props = defineProps<{
  open: boolean
  worldId: string
  app: HomeAppDefinition | null
  currentImage?: string
}>()

const emit = defineEmits<{
  close: []
  saved: [iconDataUrl?: string]
}>()

const fileInput = ref<HTMLInputElement>()
const preview = ref('')
const saving = ref(false)
const error = ref('')

watch(() => props.open, open => {
  if (!open) return
  preview.value = props.currentImage || ''
  error.value = ''
  saving.value = false
})

function chooseFile() {
  fileInput.value?.click()
}

async function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  try {
    preview.value = await prepareAppIcon(file)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '图片处理失败。'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function save() {
  if (!props.app || !preview.value) return
  saving.value = true
  error.value = ''
  try {
    await saveAppIcon(props.worldId, props.app.key, preview.value)
    emit('saved', preview.value)
    emit('close')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存图标失败。'
  } finally {
    saving.value = false
  }
}

async function reset() {
  if (!props.app || !props.currentImage) return
  saving.value = true
  error.value = ''
  try {
    await resetAppIcon(props.worldId, props.app.key)
    preview.value = ''
    emit('saved')
    emit('close')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '恢复默认图标失败。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open && app" class="icon-editor-backdrop" @click.self="emit('close')">
      <section class="icon-editor" role="dialog" aria-modal="true" aria-label="修改 App 图标">
        <div class="editor-grabber"></div>
        <header>
          <div>
            <small>主屏幕个性化</small>
            <h2>{{ app.label }}</h2>
          </div>
          <button type="button" class="close" @click="emit('close')">×</button>
        </header>

        <div class="preview-stage">
          <AppIcon :icon="app.icon" :custom-image="preview" :tones="app.tone" :size="112" />
          <p>建议使用清晰、主体居中的方形图片。系统会自动裁切成适合 App 图标的比例。</p>
        </div>

        <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFile">
        <button type="button" class="primary" @click="chooseFile">
          {{ preview ? '更换图片' : '上传图片' }}
        </button>
        <button v-if="currentImage" type="button" class="secondary" :disabled="saving" @click="reset">恢复默认图标</button>
        <p v-if="error" class="error">{{ error }}</p>
        <p class="hint">图片会保存在本机，不会自动上传到服务器。</p>
        <button type="button" class="save" :disabled="!preview || saving" @click="save">{{ saving ? '保存中…' : '保存图标' }}</button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.icon-editor-backdrop{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:18px;background:rgba(34,58,77,.22);backdrop-filter:blur(8px)}
.icon-editor{width:min(430px,100%);padding:12px 18px 20px;border:1px solid rgba(255,255,255,.85);border-radius:30px;background:rgba(249,253,255,.96);box-shadow:0 24px 70px rgba(43,72,96,.28)}
.editor-grabber{width:44px;height:5px;margin:0 auto 14px;border-radius:8px;background:#c9dbe8}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}header small{color:#7e9bb0;font-size:11px}h2{margin:3px 0 0;color:#263f53;font-size:21px;letter-spacing:-.02em}.close{width:36px;height:36px;border:0;border-radius:50%;background:#edf5fa;color:#67839a;font-size:25px;line-height:1}.preview-stage{display:grid;justify-items:center;gap:12px;padding:22px 8px 16px}.preview-stage p{max-width:300px;margin:0;color:#8296a5;text-align:center;font-size:11px;line-height:1.6}.primary,.save,.secondary{width:100%;border:0;border-radius:15px;padding:12px;font-weight:750}.primary{background:#e5f1fa;color:#5d91b7}.save{margin-top:8px;background:#6daedc;color:white}.secondary{margin-top:8px;background:#f1f5f8;color:#71899c}.secondary:disabled,.save:disabled{opacity:.45}.error{margin:10px 0 0;color:#bd5368;text-align:center;font-size:12px}.hint{margin:10px 0 0;color:#9aaab7;text-align:center;font-size:10px}
</style>
