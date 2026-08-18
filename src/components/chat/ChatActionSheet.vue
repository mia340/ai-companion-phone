<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { getMessageImages } from '../../services/messageImageService'
import type { Message } from '../../types/domain'

const props = defineProps<{
  message?: Message
  preview: string
  isSending: boolean
  swipeRepliesEnabled?: boolean
  panelStyle?: CSSProperties
}>()

const images = computed(() => getMessageImages(props.message))

const emit = defineEmits<{
  dragStart: [event: PointerEvent]
  dragMove: [event: PointerEvent]
  dragEnd: []
  reply: []
  copy: []
  edit: []
  continueReply: []
  branch: []
  downloadImage: []
  retry: []
  regenerate: []
  delete: []
  close: []
}>()
</script>

<template>
  <section class="action-panel" :style="panelStyle">
    <div
      class="panel-handle"
      @pointerdown="emit('dragStart', $event)"
      @pointermove="emit('dragMove', $event)"
      @pointerup="emit('dragEnd')"
      @pointercancel="emit('dragEnd')"
    ></div>

    <div class="selected-preview">
      <img
        v-if="message?.type === 'image' && images[0]?.dataUrl"
        :src="images[0]?.dataUrl"
        alt="所选图片"
      />
      <p>{{ preview }}</p>
    </div>

    <button type="button" @click="emit('reply')">回复</button>
    <button v-if="message?.type !== 'image'" type="button" @click="emit('copy')">复制</button>
    <button type="button" @click="emit('edit')">编辑这条消息</button>
    <button
      v-if="message && message.senderId !== 'user'"
      type="button"
      :disabled="isSending"
      @click="emit('continueReply')"
    >
      继续生成
    </button>
    <button v-if="message" type="button" @click="emit('branch')">从这里创建聊天分支</button>
    <button
      v-if="message?.type === 'image' && images.length"
      type="button"
      @click="emit('downloadImage')"
    >
      {{ images.length > 1 ? `保存全部 ${images.length} 张图片` : '保存图片' }}
    </button>
    <button
      v-if="message?.senderId === 'user' && (message.status === 'failed' || message.status === 'cancelled')"
      type="button"
      :disabled="isSending"
      @click="emit('retry')"
    >
      重新发送
    </button>
    <button
      v-if="message && message.senderId !== 'user'"
      type="button"
      :disabled="isSending"
      @click="emit('regenerate')"
    >
      {{ swipeRepliesEnabled ? '换一个回复（保留旧版本）' : '重新生成' }}
    </button>
    <button type="button" class="danger-text" @click="emit('delete')">删除</button>
    <button type="button" @click="emit('close')">取消</button>
  </section>
</template>

<style scoped>
.action-panel {
  width: 100%;
  max-height: 88%;
  overflow-y: auto;
  padding: 8px 18px max(24px, env(safe-area-inset-bottom));
  border-radius: 26px 26px 0 0;
  background: #f8fcff;
  box-shadow: 0 -18px 50px rgba(70,42,55,.18);
  transition: transform .24s cubic-bezier(.22, .8, .24, 1);
  will-change: transform;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.panel-handle {
  position: relative;
  width: 84px;
  height: 17px;
  margin: -3px auto 15px;
  background: transparent;
  touch-action: none;
  cursor: grab;
}

.panel-handle::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  width: 42px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #c8dbe9;
}

.panel-handle:active { cursor: grabbing; }

.selected-preview {
  max-height: 140px;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 12px;
  border-radius: 13px;
  background: #eef6fc;
  color: #617f99;
}

.selected-preview img {
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 11px;
}

.selected-preview p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  line-height: 1.55;
}

.action-panel > button {
  width: 100%;
  padding: 13px;
  border: 0;
  border-bottom: 1px solid rgba(80,50,62,.07);
  background: transparent;
  color: #40566a;
  font-weight: 700;
}

.action-panel .danger-text { color: #b44f68; }
</style>
