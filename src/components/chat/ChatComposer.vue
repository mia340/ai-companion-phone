<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formatImageSize, totalPreparedImageBytes, type PreparedChatImage } from '../../services/imageService'

const props = defineProps<{
  modelValue: string
  pendingImages?: PreparedChatImage[]
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
let micPressTimer: number | undefined
let longPressRecording = false
const imageCount = computed(() => props.pendingImages?.length ?? 0)
const imageBytes = computed(() => totalPreparedImageBytes(props.pendingImages ?? []))

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
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && props.canSend && !props.isSending) {
    event.preventDefault(); emit('submit')
  }
}
function clearMicPressTimer() {
  if (micPressTimer !== undefined) { window.clearTimeout(micPressTimer); micPressTimer = undefined }
}
function handleMicPointerDown() {
  if (props.isRecording || props.isRecognizing) return
  longPressRecording = false
  clearMicPressTimer()
  micPressTimer = window.setTimeout(() => {
    micPressTimer = undefined; longPressRecording = true; emit('startRecording')
  }, 260)
}
function handleMicPointerUp() {
  clearMicPressTimer()
  if (longPressRecording) { longPressRecording = false; emit('stopRecording'); return }
  if (props.isRecognizing) return
  if (props.isRecording) emit('stopRecording'); else emit('startRecording')
}
function handleMicPointerCancel() {
  clearMicPressTimer()
  if (longPressRecording) { longPressRecording = false; emit('cancelRecording') }
}
function formatRecordingTime(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds)); const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}
watch(() => props.modelValue, resize)
watch(() => props.pendingImages, resize, { deep: true })
onBeforeUnmount(clearMicPressTimer)
defineExpose({ focus, resize })
</script>

<template>
  <div v-if="imageCount" class="pending-images-bar">
    <div class="pending-images-summary">
      <div><b>准备发送 {{ imageCount }} 张图片</b><span>{{ formatImageSize(imageBytes) }} · 单张原图≤15 MB · 最多 {{ maxImages ?? 6 }} 张</span></div>
      <button type="button" @click="emit('clearImages')">清空</button>
    </div>
    <div class="pending-images-grid">
      <figure v-for="(image,index) in pendingImages" :key="`${image.name}-${index}`">
        <button class="pending-image-preview-button" type="button" :aria-label="`预览第 ${index + 1} 张图片`" @click="emit('previewImages',index)">
          <img :src="image.dataUrl" :alt="image.name" loading="lazy" decoding="async" />
        </button>
        <small>{{ index + 1 }}</small>
        <button class="pending-image-remove-button" type="button" :aria-label="`移除第 ${index + 1} 张图片`" @click="emit('removeImage',index)">×</button>
      </figure>
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
    <input id="chat-album-input" class="image-input" type="file" accept="image/*" multiple :disabled="isSending || isPreparingImage || imageCount >= (maxImages ?? 6)" @change="handleImageChange" />
    <input id="chat-camera-input" class="image-input" type="file" accept="image/*" capture="environment" :disabled="isSending || isPreparingImage || imageCount >= (maxImages ?? 6)" @change="handleImageChange" />
    <label class="composer-side-button file-picker-label" :class="{ 'file-picker-label--disabled': isSending || isPreparingImage || imageCount >= (maxImages ?? 6) }" for="chat-album-input" aria-label="从相册选择图片" title="从相册选择，可多选">＋</label>
    <label class="camera-button file-picker-label" :class="{ 'file-picker-label--disabled': isSending || isPreparingImage || imageCount >= (maxImages ?? 6) }" for="chat-camera-input" aria-label="拍照" title="打开相机拍照">📷</label>
    <button v-if="voiceInputAvailable" type="button" :class="['mic-button',{'mic-button--active':isRecording}]" :disabled="isPreparingImage || isRecognizing" :aria-label="isRecording ? '结束录音' : '语音输入'" @click.prevent @pointerdown.prevent="handleMicPointerDown" @pointerup.prevent="handleMicPointerUp" @pointerleave="handleMicPointerCancel" @pointercancel="handleMicPointerCancel">{{ isRecording ? '■' : '🎙' }}</button>
    <textarea ref="textareaRef" :value="modelValue" rows="1" inputmode="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" aria-label="消息输入框" :placeholder="imageCount ? '为这些图片添加一句话…' : isSending ? '可以先输入下一条消息…' : '输入消息…'" @input="handleInput" @focus="emit('focus')" @keydown="handleKeydown"></textarea>
    <button v-if="isSending" class="stop-button" type="button" @click="emit('stop')">停止</button>
    <button v-else class="send-button" type="submit" :disabled="!canSend">发送</button>
  </form>
</template>

<style scoped>
.pending-images-bar,.reply-preview-bar,.recording-bar,.next-message-hint{flex:0 0 auto;border-top:1px solid rgba(0,0,0,.045);background:rgba(255,255,255,.94)}.pending-images-bar{padding:8px 12px}.pending-images-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.pending-images-summary>div{display:grid;gap:2px}.pending-images-summary b{color:#ba5e86;font-size:12px}.pending-images-summary span{color:#8c717c;font-size:11px}.pending-images-summary button{border:0;background:transparent;color:#b25d80;font-size:12px}.pending-images-grid{display:flex;gap:7px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}.pending-images-grid::-webkit-scrollbar{display:none}.pending-images-grid figure{position:relative;width:58px;height:58px;flex:0 0 auto;margin:0}.pending-image-preview-button{width:100%;height:100%;padding:0;border:0;background:transparent}.pending-images-grid img{width:100%;height:100%;object-fit:cover;border-radius:12px}.pending-images-grid .pending-image-remove-button{position:absolute;top:-5px;right:-5px;width:21px;height:21px;padding:0;border:2px solid #fff;border-radius:50%;background:#705762;color:#fff;line-height:17px}.pending-images-grid figure small{position:absolute;left:4px;bottom:4px;min-width:18px;padding:1px 4px;border-radius:999px;background:rgba(45,28,36,.62);color:#fff;font-size:9px;text-align:center}.reply-preview-bar,.recording-bar{display:flex;align-items:center;gap:10px;padding:8px 12px 7px}.reply-preview-bar>div,.recording-bar>div{min-width:0;flex:1}.recording-bar>div{display:grid;gap:3px}.reply-preview-bar b,.recording-bar b{color:#ba5e86;font-size:12px}.reply-preview-bar span,.recording-bar small{overflow:hidden;color:#8c717c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.reply-preview-bar>button{width:30px;height:30px;flex:0 0 auto;border:0;border-radius:50%;background:#f4e9ed;color:#785d69;font-size:19px}.reply-preview-bar>div{display:flex;flex-direction:column;gap:2px;padding-left:9px;border-left:3px solid #da729f}.recording-bar>button{padding:7px 11px;border:0;border-radius:12px;background:#f3e7ec;color:#8b5f70}.recording-dot{width:10px;height:10px;flex:0 0 auto;border-radius:50%;background:#df5e79;animation:recording-pulse 1s ease-in-out infinite}.next-message-hint{padding:6px 14px;color:#9a7383;font-size:11px;text-align:center}.composer{flex:0 0 auto;display:flex;align-items:flex-end;gap:6px;padding:10px 11px max(16px,env(safe-area-inset-bottom));border-top:1px solid rgba(0,0,0,.05);background:rgba(255,255,255,.88);backdrop-filter:blur(18px)}.composer textarea{min-width:0;min-height:42px;height:42px;max-height:112px;flex:1;padding:10px 13px;overflow-y:auto;resize:none;border:1px solid rgba(0,0,0,.08);border-radius:17px;outline:none;background:#fff;line-height:1.45;transition:height .12s ease;user-select:text;-webkit-user-select:text}.image-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.file-picker-label{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}.file-picker-label--disabled{pointer-events:none;opacity:.45}.composer-side-button,.camera-button,.mic-button,.send-button,.stop-button{flex:0 0 auto;height:42px;border:0;border-radius:15px;cursor:pointer}.composer-side-button,.camera-button,.mic-button{width:38px;background:rgba(232,138,176,.16);color:#cf6793}.composer-side-button{font-size:24px}.camera-button{font-size:16px}.mic-button{font-size:17px}.mic-button--active{background:#df6f88;color:#fff}.send-button,.stop-button{min-width:58px;padding:0 11px;background:#d96b99;color:#fff;font-weight:700}.stop-button{background:#826a75}.send-button:disabled,.composer-side-button:disabled,.camera-button:disabled,.mic-button:disabled{opacity:.45}@keyframes recording-pulse{0%,100%{transform:scale(.8);opacity:.55}50%{transform:scale(1.15);opacity:1}}@media(max-width:390px){.composer{gap:4px;padding-left:8px;padding-right:8px}.composer-side-button,.camera-button,.mic-button{width:34px}.send-button,.stop-button{min-width:52px;padding:0 8px}}
</style>
