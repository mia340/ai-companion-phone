<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import type { HomeAppDefinition } from '../services/appCustomizationService'

const props = withDefaults(defineProps<{
  apps: readonly (HomeAppDefinition & { badge?: number; customImage?: string })[]
  iconSize?: number
  showLabels?: boolean
}>(), {
  iconSize: 50,
  showLabels: true
})

const router = useRouter()
</script>

<template>
  <nav class="hm-dock">
    <button
      v-for="app in props.apps"
      :key="app.key"
      class="hm-dock-item"
      type="button"
      @click="router.push(app.route)"
    >
      <span class="hm-dock-tile">
        <AppIcon :icon="app.icon" :custom-image="app.customImage" :tones="app.tone" :size="props.iconSize" />
        <b v-if="app.badge" class="hm-dock-badge">{{ app.badge }}</b>
      </span>
      <span v-if="props.showLabels" class="hm-dock-label">{{ app.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.hm-dock{flex:0 0 auto;display:flex;justify-content:space-around;align-items:flex-end;gap:10px;margin:4px 18px 0;padding:12px 14px 10px;border-radius:28px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.88);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 16px 38px rgba(57,89,115,.13)}
.hm-dock-item{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;border:0;background:transparent;cursor:pointer}.hm-dock-tile{position:relative;display:grid;place-items:center}.hm-dock-badge{position:absolute;right:-5px;top:-5px;min-width:19px;height:19px;padding:0 5px;border-radius:11px;background:#ff5b6a;color:white;font-size:11px;line-height:19px;text-align:center;font-weight:700;border:1px solid rgba(255,255,255,.85)}.hm-dock-label{font-size:11px;color:#3a5265;text-shadow:none}
</style>
