<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    avatar?: string
    name?: string
    size?: number
  }>(),
  {
    avatar: '🙂',
    name: '角色',
    size: 52
  }
)

const isImageAvatar = computed(() => {
  const avatar = props.avatar?.trim() ?? ''

  return (
    avatar.startsWith('data:image/') ||
    avatar.startsWith('blob:') ||
    avatar.startsWith('http://') ||
    avatar.startsWith('https://')
  )
})

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.round(props.size * 0.52)}px`
}))
</script>

<template>
  <span
    class="character-avatar"
    :style="avatarStyle"
  >
    <img
      v-if="isImageAvatar"
      :src="avatar"
      :alt="`${name}的头像`"
    />

    <span v-else class="emoji-avatar">
      {{ avatar || '🙂' }}
    </span>
  </span>
</template>

<style scoped>
.character-avatar {
  flex: 0 0 auto;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 30%;
  background: rgba(255, 225, 238, 0.9);
}

.character-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.emoji-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>