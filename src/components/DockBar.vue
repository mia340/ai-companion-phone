<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = defineProps<{
  apps: readonly (readonly [string, string, string, number])[]
}>()

const router = useRouter()
</script>

<template>
  <nav class="hm-dock">
    <button
      v-for="app in props.apps"
      :key="app[1]"
      class="hm-dock-item"
      type="button"
      @click="router.push(app[2])"
    >
      <span class="hm-dock-tile">
        <span class="hm-dock-emoji">{{ app[0] }}</span>
        <b
          v-if="app[3]"
          class="hm-dock-badge"
        >
          {{ app[3] }}
        </b>
      </span>
      <span class="hm-dock-label">{{ app[1] }}</span>
    </button>
  </nav>
</template>

<style scoped>
.hm-dock {
  flex: 0 0 auto;
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  gap: 10px;
  margin: 4px 18px 0;
  padding: 12px 14px 10px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow: 0 14px 34px rgba(30, 50, 90, 0.16);
}

.hm-dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.hm-dock-tile {
  position: relative;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 5px 14px rgba(40, 60, 100, 0.14);
}

.hm-dock-emoji {
  font-size: 25px;
  line-height: 1;
}

.hm-dock-badge {
  position: absolute;
  right: -5px;
  top: -6px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 11px;
  background: #ff5b6a;
  color: white;
  font-size: 11px;
  line-height: 19px;
  text-align: center;
  font-weight: 700;
}

.hm-dock-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(20, 32, 70, 0.5);
}
</style>
