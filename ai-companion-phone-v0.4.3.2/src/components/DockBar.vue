<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{
  apps: readonly (readonly [string, string, string, number])[]
}>()

const router = useRouter()
</script>

<template>
  <div class="dock">
    <button
      v-for="app in apps"
      :key="app[1]"
      class="dock-item"
      type="button"
      @click="router.push(app[2])"
    >
      <span class="icon">{{ app[0] }}</span>
    </button>
  </div>
</template>

<style scoped>
.dock {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 14px;
  margin: 12px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(16px);
}

.dock-item {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 28px;
  background: rgba(255, 255, 255, 0.2);
}
</style>