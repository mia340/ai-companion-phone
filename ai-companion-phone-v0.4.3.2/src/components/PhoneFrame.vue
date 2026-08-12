<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  useSlots
} from 'vue'
import StatusBar from './StatusBar.vue'

const slots = useSlots()

defineProps<{
  title?: string
  showBack?: boolean
}>()

function syncViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${Math.round(height)}px`
  )
}

onMounted(() => {
  syncViewportHeight()
  window.addEventListener('resize', syncViewportHeight)
  window.visualViewport?.addEventListener('resize', syncViewportHeight)
  window.visualViewport?.addEventListener('scroll', syncViewportHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncViewportHeight)
  window.visualViewport?.removeEventListener('resize', syncViewportHeight)
  window.visualViewport?.removeEventListener('scroll', syncViewportHeight)
})
</script>

<template>
  <main class="page-shell">
    <section class="phone-frame">
      <div class="speaker"></div>

      <StatusBar />

      <div
        v-if="slots.header"
        class="app-header app-header--custom"
      >
        <slot name="header" />
      </div>

      <div
        v-else-if="title"
        class="app-header"
      >
        <button
          v-if="showBack"
          class="icon-button"
          type="button"
          aria-label="返回"
          @click="$router.back()"
        >
          ‹
        </button>

        <strong>{{ title }}</strong>

        <span class="header-spacer"></span>
      </div>

      <div class="phone-content">
        <slot />
      </div>

      <button
        class="home-indicator"
        type="button"
        aria-label="返回主屏幕"
        @click="$router.push('/home')"
      ></button>
    </section>
  </main>
</template>

<style scoped>
.phone-content {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.phone-content::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
</style>
