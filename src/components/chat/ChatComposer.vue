<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  ref,
  watch
} from 'vue'

import {
  formatImageSize,
  type PreparedChatImage
} from '../../services/imageService'

const props = defineProps<{
  modelValue: string
  pendingImage?: PreparedChatImage
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
  requestImage: []
  imageSelected: [file: File]
  removeImage: []
  cancelReply: []
  stop: []
  focus: []
  startRecording: []
  stopRecording: []
  cancelRecording: []
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const imageInputRef = ref<HTMLInputElement>()
let micPressTimer: number | undefined
let longPressRecording = false

function resize() {
  void nextTick(() => {
    const element = textareaRef.value
    if (!element) return

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 112)}px`
  })
}

function focus() {
  textareaRef.value?.focus()
}

function openImagePicker() {
  imageInputRef.value?.click()
}

function handleInput(event: Event) {
  emit(
    'update:modelValue',
    (event.target as HTMLTextAreaElement).value
  )
  resize()
}

function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (file) emit('imageSelected', file)
}

function handleKeydown(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    !event.shiftKey &&
    !event.isComposing &&
    props.canSend &&
    !props.isSending
  ) {
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

watch(
  () => props.modelValue,
  resize
)

watch(
  () => props.pendingImage,
  resize
)

onBeforeUnmount(clearMicPressTimer)

defineExpose({
  focus,
  resize,
  openImagePicker
})
</script>

<template>
  <div
    v-if="pendingImage"
    class="pending-image-bar"
  >
    <img
      :src="pendingImage.dataUrl"
      :alt="pendingImage.name"
    />
    <div>
      <b>准备发送图片</b>
      <span>
        {{ pendingImage.name }} · {{ formatImageSize(pendingImage.bytes) }}
      </span>
    </div>
    <button
      type="button"
      aria-label="移除图片"
      @click="emit('removeImage')"
    >×</button>
  </div>

  <div
    v-if="replySender && replyPreview"
    class="reply-preview-bar"
  >
    <div>
      <b>回复 {{ replySender }}</b>
      <span>{{ replyPreview }}</span>
    </div>
    <button
      type="button"
      aria-label="取消回复"
      @click="emit('cancelReply')"
    >×</button>
  </div>

  <div
    v-if="isRecording || isRecognizing"
    class="recording-bar"
  >
    <span class="recording-dot" aria-hidden="true"></span>
    <div>
      <b>{{ isRecognizing ? '正在整理语音…' : '正在聆听' }}</b>
      <small>{{ isRecognizing ? '稍后会填入输入框' : formatRecordingTime(recordingSeconds) }}</small>
    </div>
    <button
      v-if="isRecording"
      type="button"
      @click="emit('cancelRecording')"
    >取消</button>
  </div>

  <div
    v-if="isSending && modelValue.trim()"
    class="next-message-hint"
  >
    已保留为下一条消息，当前回复结束后即可发送
  </div>

  <form
    class="composer"
    @submit.prevent="emit('submit')"
  >
    <input
      ref="imageInputRef"
      class="image-input"
      type="file"
      accept="image/*"
      @change="handleImageChange"
    />

    <button
      type="button"
      class="composer-side-button"
      :disabled="isSending || isPreparingImage"
      aria-label="选择图片"
      @click="emit('requestImage')"
    >
      ＋
    </button>

    <button
      v-if="voiceInputAvailable"
      type="button"
      :class="['mic-button', { 'mic-button--active': isRecording }]"
      :disabled="isPreparingImage || isRecognizing"
      :aria-label="isRecording ? '结束录音' : '语音输入'"
      @click.prevent
      @pointerdown.prevent="handleMicPointerDown"
      @pointerup.prevent="handleMicPointerUp"
      @pointerleave="handleMicPointerCancel"
      @pointercancel="handleMicPointerCancel"
    >
      {{ isRecording ? '■' : '🎙' }}
    </button>

    <textarea
      ref="textareaRef"
      :value="modelValue"
      rows="1"
      inputmode="text"
      enterkeyhint="send"
      autocomplete="off"
      autocapitalize="sentences"
      aria-label="消息输入框"
      :placeholder="pendingImage ? '为图片添加一句话…' : isSending ? '可以先输入下一条消息…' : '输入消息…'"
      @input="handleInput"
      @focus="emit('focus')"
      @keydown="handleKeydown"
    ></textarea>

    <button
      v-if="isSending"
      class="stop-button"
      type="button"
      @click="emit('stop')"
    >
      停止
    </button>

    <button
      v-else
      class="send-button"
      type="submit"
      :disabled="!canSend"
    >
      发送
    </button>
  </form>
</template>

<style scoped>
.pending-image-bar,
.reply-preview-bar,
.recording-bar,
.next-message-hint {
  flex: 0 0 auto;
  border-top: 1px solid rgba(0, 0, 0, .045);
  background: rgba(255, 255, 255, .94);
}

.pending-image-bar,
.reply-preview-bar,
.recording-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px 7px;
}

.pending-image-bar img {
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 12px;
}

.pending-image-bar > div,
.reply-preview-bar > div,
.recording-bar > div {
  min-width: 0;
  flex: 1;
}

.pending-image-bar > div,
.recording-bar > div {
  display: grid;
  gap: 3px;
}

.pending-image-bar b,
.reply-preview-bar b,
.recording-bar b {
  color: #ba5e86;
  font-size: 12px;
}

.pending-image-bar span,
.reply-preview-bar span,
.recording-bar small {
  overflow: hidden;
  color: #8c717c;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-image-bar > button,
.reply-preview-bar > button {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: #f4e9ed;
  color: #785d69;
  font-size: 19px;
}

.reply-preview-bar > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 9px;
  border-left: 3px solid #da729f;
}

.recording-bar > button {
  padding: 7px 11px;
  border: 0;
  border-radius: 12px;
  background: #f3e7ec;
  color: #8b5f70;
}

.recording-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #df5e79;
  animation: recording-pulse 1s ease-in-out infinite;
}

.next-message-hint {
  padding: 6px 14px;
  color: #9a7383;
  font-size: 11px;
  text-align: center;
}

.composer {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 11px max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid rgba(0,0,0,.05);
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(18px);
}

.composer textarea {
  min-width: 0;
  min-height: 42px;
  height: 42px;
  max-height: 112px;
  flex: 1;
  padding: 10px 13px;
  overflow-y: auto;
  resize: none;
  border: 1px solid rgba(0,0,0,.08);
  border-radius: 17px;
  outline: none;
  background: #fff;
  line-height: 1.45;
  transition: height .12s ease;
  user-select: text;
  -webkit-user-select: text;
  touch-action: auto;
  pointer-events: auto;
}

.image-input { display: none; }

.composer-side-button,
.mic-button,
.send-button,
.stop-button {
  flex: 0 0 auto;
  height: 42px;
  border: 0;
  border-radius: 15px;
  cursor: pointer;
}

.composer-side-button,
.mic-button {
  width: 42px;
  background: rgba(232,138,176,.16);
  color: #cf6793;
}

.composer-side-button { font-size: 25px; }
.mic-button { font-size: 18px; }
.mic-button--active {
  background: #df6f88;
  color: #fff;
}

.send-button,
.stop-button {
  min-width: 61px;
  padding: 0 13px;
  background: #d96b99;
  color: #fff;
  font-weight: 700;
}

.stop-button { background: #826a75; }
.send-button:disabled,
.composer-side-button:disabled,
.mic-button:disabled { opacity: .45; }

@keyframes recording-pulse {
  0%, 100% { transform: scale(.8); opacity: .55; }
  50% { transform: scale(1.15); opacity: 1; }
}

@media (max-width: 460px) {
  .composer {
    gap: 6px;
    padding-bottom: max(14px, calc(env(safe-area-inset-bottom) + 7px));
  }

  .composer-side-button,
  .mic-button {
    width: 38px;
  }
}
</style>
