<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  formatImageSize,
  imageProcessingModeLabel,
  totalPreparedImageBytes,
  type ImageBatchProgress,
  type ImagePreparationFailure,
  type PreparedChatImage
} from '../../services/imageService'

const props = defineProps<{
  modelValue: string
  pendingImages?: PreparedChatImage[]
  failedImages?: ImagePreparationFailure[]
  imageProgress?: ImageBatchProgress
  maxImages?: number
  replySender?: string
  replyPreview?: string
  isSending: boolean
  isPreparingImage: boolean
  canSend: boolean
  voiceInputAvailable?: boolean
  isRecording?: boolean
  isRecognizing?: boolean
  recordingSeconds?: number
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  imagesSelected: [files: File[]]
  removeImage: [index: number]
  moveImage: [index: number, offset: number]
  useOriginalImage: [index: number]
  retryFailedImage: [id: string]
  useOriginalFailedImage: [id: string]
  removeFailedImage: [id: string]
  clearImages: []
  previewImages: [index: number]
  cancelReply: []
  stop: []
  focus: []
  startRecording: []
  stopRecording: []
  cancelRecording: []
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const selectedReadyIndex = ref(0)
let micPressTimer: number | undefined
let longPressRecording = false

const imageCount = computed(() => props.pendingImages?.length ?? 0)
const failedCount = computed(() => props.failedImages?.length ?? 0)
const occupiedSlots = computed(() => imageCount.value + failedCount.value)
const imageBytes = computed(() => totalPreparedImageBytes(props.pendingImages ?? []))
const selectedImage = computed(() => props.pendingImages?.[selectedReadyIndex.value])
const pickerDisabled = computed(() => (
  props.isSending || props.isPreparingImage || occupiedSlots.value >= (props.maxImages ?? 6)
))

function resize() {
  void nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`
  })
}
function focus() { textareaRef.value?.focus() }
function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resize()
}
function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length) emit('imagesSelected', files)
}
function chooseReady(index: number) {
  selectedReadyIndex.value = index
  emit('previewImages', index)
}
function moveSelected(offset: number) {
  const target = selectedReadyIndex.value + offset
  if (target < 0 || target >= imageCount.value) return
  emit('moveImage', selectedReadyIndex.value, offset)
  selectedReadyIndex.value = target
}
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && props.canSend && !props.isSending) {
    event.preventDefault()
    emit('submit')
  }
}
function clearMicPressTimer() {
  if (micPressTimer !== undefined) {
    window.clearTimeout(micPressTimer)
    micPressTimer = undefined
  }
}
function handleMicPointerDown() {
  if (props.isRecording || props.isRecognizing) return
  longPressRecording = false
  clearMicPressTimer()
  micPressTimer = window.setTimeout(() => {
    micPressTimer = undefined
    longPressRecording = true
    emit('startRecording')
  }, 260)
}
function handleMicPointerUp() {
  clearMicPressTimer()
  if (longPressRecording) {
    longPressRecording = false
    emit('stopRecording')
    return
  }
  if (props.isRecognizing) return
  if (props.isRecording) emit('stopRecording')
  else emit('startRecording')
}
function handleMicPointerCancel() {
  clearMicPressTimer()
  if (longPressRecording) {
    longPressRecording = false
    emit('cancelRecording')
  }
}
function formatRecordingTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}
function formatDimensions(image?: PreparedChatImage) {
  if (!image?.width || !image.height) return '尺寸未知'
  return `${image.width} × ${image.height}`
}
function retryLabel(failure: ImagePreparationFailure) {
  if (failure.code === 'too-large') return '文件超过 15 MB，无法重试压缩'
  if (failure.code === 'not-image') return '不是受支持的图片文件'
  return failure.reason
}

watch(() => props.modelValue, resize)
watch(() => props.pendingImages, () => {
  selectedReadyIndex.value = Math.min(
    selectedReadyIndex.value,
    Math.max(0, imageCount.value - 1)
  )
  resize()
}, { deep: true })
onBeforeUnmount(clearMicPressTimer)
defineExpose({ focus, resize })
</script>

<template>
  <div v-if="isPreparingImage && imageProgress" class="image-processing-bar" role="status" aria-live="polite">
    <div>
      <b>正在处理 {{ imageProgress.completed }} / {{ imageProgress.total }}</b>
      <span>{{ imageProgress.currentName }}</span>
    </div>
    <progress :value="imageProgress.completed" :max="Math.max(1, imageProgress.total)"></progress>
  </div>

  <div v-if="occupiedSlots" class="pending-images-bar">
    <div class="pending-images-summary">
      <div>
        <b>已准备 {{ imageCount }} 张<span v-if="failedCount"> · {{ failedCount }} 张待处理</span></b>
        <span>{{ formatImageSize(imageBytes) }} · 单张原图≤15 MB · 最多 {{ maxImages ?? 6 }} 张</span>
      </div>
      <button type="button" @click="emit('clearImages')">清空</button>
    </div>

    <div v-if="imageCount" class="pending-images-grid">
      <figure
        v-for="(image,index) in pendingImages"
        :key="image.id || `${image.name}-${index}`"
        :class="{ selected: index === selectedReadyIndex }"
      >
        <button
          class="pending-image-preview-button"
          type="button"
          :aria-label="`预览第 ${index + 1} 张图片`"
          @click="chooseReady(index)"
        >
          <img :src="image.dataUrl" :alt="image.name" loading="lazy" decoding="async" />
        </button>
        <small>{{ index + 1 }}</small>
        <button class="pending-image-remove-button" type="button" :aria-label="`移除第 ${index + 1} 张图片`" @click="emit('removeImage',index)">×</button>
      </figure>
    </div>

    <div v-if="selectedImage" class="selected-image-detail">
      <div class="selected-image-detail__text">
        <b :title="selectedImage.name">{{ selectedImage.name }}</b>
        <span>{{ formatDimensions(selectedImage) }} · {{ imageProcessingModeLabel(selectedImage.processingMode) }}</span>
        <small>原始 {{ formatImageSize(selectedImage.originalBytes) }} → 当前 {{ formatImageSize(selectedImage.bytes) }}</small>
      </div>
      <div class="selected-image-detail__actions">
        <button type="button" :disabled="selectedReadyIndex === 0" @click="moveSelected(-1)">← 前移</button>
        <button type="button" :disabled="selectedReadyIndex >= imageCount - 1" @click="moveSelected(1)">后移 →</button>
        <button v-if="selectedImage.processingMode !== 'original' && selectedImage.sourceFile" type="button" @click="emit('useOriginalImage', selectedReadyIndex)">使用原图</button>
      </div>
    </div>

    <p v-if="failedCount" class="failed-image-hint">处理失败的图片需重试、使用原图或移除后才能发送。</p>
    <div v-if="failedCount" class="failed-image-list" aria-label="图片处理失败列表">
      <article v-for="failure in failedImages" :key="failure.id">
        <div>
          <b :title="failure.name">{{ failure.name }}</b>
          <span>{{ retryLabel(failure) }}</span>
          <small>{{ formatImageSize(failure.originalBytes) }} · {{ failure.originalType || '未知格式' }}</small>
        </div>
        <div class="failed-image-actions">
          <button type="button" :disabled="isPreparingImage || failure.code === 'too-large' || failure.code === 'not-image'" @click="emit('retryFailedImage',failure.id)">重试</button>
          <button type="button" :disabled="isPreparingImage || !failure.canUseOriginal || failure.code === 'too-large' || failure.code === 'not-image'" @click="emit('useOriginalFailedImage',failure.id)">使用原图</button>
          <button type="button" @click="emit('removeFailedImage',failure.id)">移除</button>
        </div>
        <details v-if="failure.attempts.length">
          <summary>查看已尝试的处理方式</summary>
          <p>{{ failure.attempts.join(' → ') }}</p>
        </details>
      </article>
    </div>
  </div>

  <div v-if="replySender && replyPreview" class="reply-preview-bar">
    <div><b>回复 {{ replySender }}</b><span>{{ replyPreview }}</span></div>
    <button type="button" aria-label="取消回复" @click="emit('cancelReply')">×</button>
  </div>
  <div v-if="isRecording || isRecognizing" class="recording-bar">
    <span class="recording-dot"></span>
    <div><b>{{ isRecognizing ? '正在整理语音…' : '正在聆听' }}</b><small>{{ isRecognizing ? '稍后会填入输入框' : formatRecordingTime(recordingSeconds) }}</small></div>
    <button v-if="isRecording" type="button" @click="emit('cancelRecording')">取消</button>
  </div>
  <div v-if="isSending && modelValue.trim()" class="next-message-hint">已保留为下一条消息，当前回复结束后即可发送</div>

  <form class="composer" @submit.prevent="emit('submit')">
    <input id="chat-album-input" class="image-input" type="file" accept="image/*" multiple :disabled="pickerDisabled" @change="handleImageChange" />
    <input id="chat-camera-input" class="image-input" type="file" accept="image/*" capture="environment" :disabled="pickerDisabled" @change="handleImageChange" />
    <label class="composer-side-button file-picker-label" :class="{ 'file-picker-label--disabled': pickerDisabled }" for="chat-album-input" aria-label="从相册选择图片" title="从相册选择，可多选">＋</label>
    <label class="camera-button file-picker-label" :class="{ 'file-picker-label--disabled': pickerDisabled }" for="chat-camera-input" aria-label="拍照" title="打开相机拍照">📷</label>
    <button v-if="voiceInputAvailable" type="button" :class="['mic-button',{'mic-button--active':isRecording}]" :disabled="isPreparingImage || isRecognizing" :aria-label="isRecording ? '结束录音' : '语音输入'" @click.prevent @pointerdown.prevent="handleMicPointerDown" @pointerup.prevent="handleMicPointerUp" @pointerleave="handleMicPointerCancel" @pointercancel="handleMicPointerCancel">{{ isRecording ? '■' : '🎙' }}</button>
    <textarea ref="textareaRef" :value="modelValue" rows="1" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" aria-label="消息输入框" :placeholder="imageCount ? '为这些图片添加一句话…' : isSending ? '可以先输入下一条消息…' : '输入消息…'" @input="handleInput" @focus="emit('focus')" @keydown="handleKeydown"></textarea>
    <button v-if="isSending" class="stop-button" type="button" @click="emit('stop')">停止</button>
    <button v-else class="send-button" type="submit" :disabled="!canSend">发送</button>
  </form>
</template>

<style scoped>
.image-processing-bar,.pending-images-bar,.reply-preview-bar,.recording-bar,.next-message-hint{flex:0 0 auto;border-top:1px solid rgba(0,0,0,.045);background:rgba(255,255,255,.95)}
.image-processing-bar{display:grid;gap:7px;padding:9px 12px}.image-processing-bar>div{display:flex;justify-content:space-between;gap:10px}.image-processing-bar b{color:#6f9dc4;font-size:12px}.image-processing-bar span{max-width:62%;overflow:hidden;color:#73889c;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.image-processing-bar progress{width:100%;height:5px;accent-color:#78add8}
.pending-images-bar{padding:8px 12px}.pending-images-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.pending-images-summary>div{display:grid;gap:2px}.pending-images-summary b{color:#6f9dc4;font-size:12px}.pending-images-summary span{color:#73889c;font-size:11px}.pending-images-summary button{border:0;background:transparent;color:#668fb2;font-size:12px}.pending-images-grid{display:flex;gap:7px;overflow-x:auto;padding:3px 2px 5px;scrollbar-width:none}.pending-images-grid::-webkit-scrollbar{display:none}.pending-images-grid figure{position:relative;width:58px;height:58px;flex:0 0 auto;margin:0;border-radius:13px;outline:2px solid transparent;outline-offset:1px}.pending-images-grid figure.selected{outline-color:#78add8}.pending-image-preview-button{width:100%;height:100%;padding:0;border:0;background:transparent}.pending-images-grid img{width:100%;height:100%;object-fit:cover;border-radius:12px}.pending-images-grid .pending-image-remove-button{position:absolute;top:-5px;right:-5px;width:21px;height:21px;padding:0;border:2px solid #fff;border-radius:50%;background:#536f89;color:#fff;line-height:17px}.pending-images-grid figure small{position:absolute;left:4px;bottom:4px;min-width:18px;padding:1px 4px;border-radius:999px;background:rgba(45,28,36,.62);color:#fff;font-size:9px;text-align:center}
.selected-image-detail{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-top:4px;padding:8px;border-radius:12px;background:#faf4f7}.selected-image-detail__text{min-width:0;display:grid;gap:2px}.selected-image-detail__text b{overflow:hidden;color:#4c647b;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.selected-image-detail__text span,.selected-image-detail__text small{color:#7d91a4;font-size:10px}.selected-image-detail__actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}.selected-image-detail__actions button,.failed-image-actions button{padding:5px 7px;border:0;border-radius:8px;background:#e6f0f8;color:#658caf;font-size:10px}.selected-image-detail__actions button:disabled,.failed-image-actions button:disabled{opacity:.4}
.failed-image-hint{margin:7px 0 0;color:#aa6573;font-size:10px}.failed-image-list{display:grid;gap:6px;margin-top:7px}.failed-image-list article{display:grid;gap:6px;padding:8px;border:1px solid rgba(197,78,99,.18);border-radius:12px;background:#fff7f8}.failed-image-list article>div:first-child{min-width:0;display:grid;gap:2px}.failed-image-list b{overflow:hidden;color:#a75b6a;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.failed-image-list span{color:#8d6c73;font-size:10px;line-height:1.35}.failed-image-list small{color:#9a8a91;font-size:9px}.failed-image-actions{display:flex;gap:5px}.failed-image-list details{color:#897b84;font-size:9px}.failed-image-list summary{cursor:pointer}.failed-image-list p{margin:4px 0 0;line-height:1.4}
.reply-preview-bar,.recording-bar{display:flex;align-items:center;gap:10px;padding:8px 12px 7px}.reply-preview-bar>div,.recording-bar>div{min-width:0;flex:1}.recording-bar>div{display:grid;gap:3px}.reply-preview-bar b,.recording-bar b{color:#6f9dc4;font-size:12px}.reply-preview-bar span,.recording-bar small{overflow:hidden;color:#73889c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.reply-preview-bar>button{width:30px;height:30px;flex:0 0 auto;border:0;border-radius:50%;background:#eaf3fb;color:#617b93;font-size:19px}.reply-preview-bar>div{display:flex;flex-direction:column;gap:2px;padding-left:9px;border-left:3px solid #79add8}.recording-bar>button{padding:7px 11px;border:0;border-radius:12px;background:#e8f2fa;color:#668099}.recording-dot{width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:#719fc5;animation:recording-pulse 1s ease-in-out infinite}.next-message-hint{padding:6px 14px;color:#71879c;font-size:11px;text-align:center}
.composer{flex:0 0 auto;display:flex;align-items:flex-end;gap:6px;padding:10px 11px max(16px,env(safe-area-inset-bottom));border-top:1px solid rgba(0,0,0,.05);background:rgba(255,255,255,.88);backdrop-filter:blur(18px)}.composer textarea{min-width:0;min-height:42px;height:42px;max-height:112px;flex:1;padding:10px 13px;overflow-y:auto;resize:none;border:1px solid rgba(0,0,0,.08);border-radius:17px;outline:none;background:#fff;line-height:1.45;transition:height .12s ease;user-select:text;-webkit-user-select:text}.image-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.file-picker-label{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.file-picker-label--disabled{pointer-events:none;opacity:.45}.composer-side-button,.camera-button,.mic-button,.send-button,.stop-button{flex:0 0 auto;height:42px;border:0;border-radius:15px;cursor:pointer}.composer-side-button,.camera-button,.mic-button{width:38px;background:rgba(232,138,176,.16);color:#6e9fc8}.composer-side-button{font-size:24px}.camera-button{font-size:16px}.mic-button{font-size:17px}.mic-button--active{background:#6d9ec7;color:#fff}.send-button,.stop-button{min-width:58px;padding:0 11px;background:#78add8;color:#fff;font-weight:700}.stop-button{background:#6c7f91}.send-button:disabled,.composer-side-button:disabled,.camera-button:disabled,.mic-button:disabled{opacity:.45}@keyframes recording-pulse{0%,100%{transform:scale(.8);opacity:.55}50%{transform:scale(1.15);opacity:1}}
@media(max-width:390px){.composer{gap:4px;padding-left:8px;padding-right:8px}.composer-side-button,.camera-button,.mic-button{width:34px}.send-button,.stop-button{min-width:52px;padding:0 8px}.selected-image-detail{align-items:flex-start;flex-direction:column}.selected-image-detail__actions{justify-content:flex-start}}
</style>
