<script setup lang="ts">
import CompanionPixelAvatar from '../avatar/CompanionPixelAvatar.vue'
import type { AvatarAppearanceProfile } from '../../services/avatarWardrobeService'

const props = withDefaults(defineProps<{
  name: string
  appearance?: AvatarAppearanceProfile
  variant?: 'user' | 'partner'
  moving?: boolean
  active?: boolean
}>(), {
  variant: 'partner',
  moving: false,
  active: false
})
</script>

<template>
  <div class="sprite-wrap" :class="[`sprite-${props.variant}`, { moving: props.moving, active: props.active }]" :title="props.name">
    <CompanionPixelAvatar
      :profile="props.appearance"
      :size="46"
      :animation="props.moving ? 'walk' : 'idle'"
      :active="props.active"
      :label="props.name"
    />
  </div>
</template>

<style scoped>
.sprite-wrap{position:relative;width:48px;height:64px;display:grid;place-items:end center;filter:drop-shadow(0 6px 5px rgba(44,31,40,.16));transform:translate(-50%,-76%);transform-origin:center bottom;transition:filter .2s ease}.sprite-wrap.active{filter:drop-shadow(0 0 8px rgba(255,242,183,.92)) drop-shadow(0 6px 5px rgba(44,31,40,.16))}.sprite-wrap.moving{z-index:16}@media(prefers-reduced-motion:reduce){.sprite-wrap{transition:none}}
</style>
