<script setup lang="ts">
import StatusBar from './StatusBar.vue'

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

      <div v-if="title" class="app-header">
        <button
          v-if="showBack"
          class="icon-button"
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