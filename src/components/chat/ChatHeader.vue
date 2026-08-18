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
.chat-header-back,
.chat-header-button {
  border: 0;
  background: transparent;
  color: #40566a;
  cursor: pointer;
}

.chat-header-back {
  font-size: 34px;
  line-height: 1;
}

.chat-identity {
  min-width: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  font-weight: 700;
  cursor: pointer;
}

.chat-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.chat-header-button {
  width: 42px;
  height: 42px;
  font-size: 24px;
}

.chat-header-more {
  font-size: 18px;
  letter-spacing: 1px;
}
</style>
