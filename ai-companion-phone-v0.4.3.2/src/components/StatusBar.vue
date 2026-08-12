<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const now = ref(new Date())
let timer: number | undefined

const time = computed(() =>
  now.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
)

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer)
  }
})
</script>

<template>
  <div class="status-bar">
    <span class="status-time">{{ time }}</span>

    <div class="status-icons">
      <span>📶</span>
      <span>WiFi</span>
      <span>🔋</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 22px;
  font-size: 12px;
  font-weight: 600;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>