<script setup lang="ts">
import { useSlots } from 'vue'
import StatusBar from './StatusBar.vue'

const slots = useSlots()

defineProps<{
  title?: string
  showBack?: boolean
}>()
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

      <div
        class="home-indicator"
        @click="$router.push('/home')"
      ></div>
    </section>
  </main>
</template>

<style scoped>
.phone-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.phone-content::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
</style>