<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import type { HomeAppDefinition } from '../services/appCustomizationService'

const props = withDefaults(defineProps<{
  apps: readonly (HomeAppDefinition & { badge?: number; customImage?: string })[]
  iconSize?: number
  showLabels?: boolean
  editing?: boolean
}>(), {
  iconSize: 54,
  showLabels: false,
  editing: false
})

const emit = defineEmits<{
  remove: [key: HomeAppDefinition['key']]
}>()

const router = useRouter()

function open(app: HomeAppDefinition) {
  if (props.editing) return
  void router.push(app.route)
}
</script>

<template>
  <nav class="hm-dock" :class="{ editing: props.editing }" aria-label="常用 App">
    <div v-for="app in props.apps" :key="app.key" class="hm-dock-slot">
      <button class="hm-dock-item" type="button" :aria-label="app.label" @click="open(app)">
        <span class="hm-dock-tile">
          <AppIcon :icon="app.icon" :custom-image="app.customImage" :tones="app.tone" :size="props.iconSize" />
          <b v-if="app.badge" class="hm-dock-badge">{{ app.badge > 99 ? '99+' : app.badge }}</b>
        </span>
        <span v-if="props.showLabels" class="hm-dock-label">{{ app.label }}</span>
      </button>
      <button
        v-if="props.editing"
        class="hm-dock-remove"
        type="button"
        :aria-label="`从 Dock 移除${app.label}`"
        @click.stop="emit('remove', app.key)"
      >−</button>
    </div>
  </nav>
</template>

<style scoped>
.hm-dock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:center;gap:8px;width:100%;padding:11px 13px 10px;border:1px solid rgba(255,255,255,.56);border-radius:30px;background:rgba(246,249,252,.55);box-shadow:0 15px 38px rgba(32,58,78,.16),inset 0 1px 0 rgba(255,255,255,.6);backdrop-filter:blur(28px) saturate(1.15);-webkit-backdrop-filter:blur(28px) saturate(1.15)}
.hm-dock-slot{position:relative;display:grid;place-items:center;min-width:0}.hm-dock-item{display:flex;min-width:0;flex-direction:column;align-items:center;gap:3px;padding:0;border:0;background:transparent;cursor:pointer}.hm-dock-tile{position:relative;display:grid;place-items:center}.hm-dock-badge{position:absolute;right:-6px;top:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:11px;background:#ff4b57;color:white;font-size:10px;line-height:20px;text-align:center;font-weight:760;border:1.5px solid rgba(255,255,255,.92)}.hm-dock-label{max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#32495c}.hm-dock-remove{position:absolute;left:-3px;top:-5px;z-index:5;width:22px;height:22px;border:1px solid rgba(255,255,255,.72);border-radius:50%;background:rgba(119,127,135,.88);color:#fff;font-size:19px;line-height:18px;display:grid;place-items:center;box-shadow:0 3px 10px rgba(24,39,52,.22)}
.hm-dock.editing .hm-dock-item{animation:dock-jiggle .18s ease-in-out infinite alternate}.hm-dock-slot:nth-child(even) .hm-dock-item{animation-direction:alternate-reverse}
@keyframes dock-jiggle{from{transform:rotate(-.8deg)}to{transform:rotate(.8deg)}}
</style>
