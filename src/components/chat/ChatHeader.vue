<script setup lang="ts">
import CharacterAvatar from '../CharacterAvatar.vue'
import type { Character } from '../../types/domain'

defineProps<{
  title: string
  character?: Character
}>()

const emit = defineEmits<{
  back: []
  openThought: []
  openMusic: []
  openSettings: []
}>()
</script>

<template>
  <button
    class="chat-header-back"
    type="button"
    aria-label="返回"
    @click="emit('back')"
  >
    ‹
  </button>

  <button
    class="chat-identity"
    type="button"
    @click="emit('openThought')"
  >
    <CharacterAvatar
      v-if="character"
      :avatar="character.avatar"
      :name="character.name"
      :size="34"
    />
    <span>{{ title }}</span>
  </button>

  <div class="chat-header-actions">
    <button
      class="chat-header-button"
      type="button"
      aria-label="一起听歌"
      @click="emit('openMusic')"
    >
      ♫
    </button>
    <button
      class="chat-header-button chat-header-more"
      type="button"
      aria-label="聊天设置"
      @click="emit('openSettings')"
    >
      •••
    </button>
  </div>
</template>

<style scoped>
.chat-header-back,.chat-header-button{border:0;background:transparent;color:#334b5f;cursor:pointer;-webkit-tap-highlight-color:transparent}
.chat-header-back{width:38px;height:44px;padding:0;font-size:32px;font-weight:300;line-height:1}
.chat-identity{min-width:0;height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;background:transparent;color:#213444;font-weight:700;cursor:pointer}.chat-identity span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;letter-spacing:-.01em}
.chat-header-actions{display:flex;justify-content:flex-end;align-items:center;gap:2px}.chat-header-button{width:40px;height:42px;border-radius:13px;font-size:22px}.chat-header-button:active{background:#f0f4f7}.chat-header-more{font-size:17px;letter-spacing:1px}
</style>
