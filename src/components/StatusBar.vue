<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 状态栏文字颜色：'dark' 深色（浅色壁纸上），'light' 白色（深色壁纸上）。 */
    tone?: 'dark' | 'light'
  }>(),
  {
    tone: 'dark'
  }
)

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
  <div
    class="status-bar"
    :class="`tone-${tone}`"
  >
    <span class="st-time">{{ time }}</span>

    <div class="st-icons">
      <!-- 蜂窝信号：四根高度递增的短竖条 -->
      <span class="st-sig" aria-hidden="true">
        <i class="sig-bar b1"></i>
        <i class="sig-bar b2"></i>
        <i class="sig-bar b3"></i>
        <i class="sig-bar b4"></i>
      </span>

      <!-- WiFi：两段圆弧 + 圆点 -->
      <span class="st-wifi" aria-hidden="true">
        <i class="wifi-a a1"></i>
        <i class="wifi-a a2"></i>
        <i class="wifi-dot"></i>
      </span>

      <!-- 电池：圆角胶囊，右侧小凸点 -->
      <span class="st-bat" aria-hidden="true">
        <span class="bat-body">
          <span class="bat-fill"></span>
        </span>
        <span class="bat-cap"></span>
      </span>
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
  padding: 0 24px;
  font-size: 13px;
  font-weight: 600;
  color: #33475c;
}

.status-bar.tone-light {
  color: rgba(255, 255, 255, 0.96);
  text-shadow: 0 1px 3px rgba(20, 30, 60, 0.35);
}

.st-icons {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
}

/* ---------- 蜂窝信号 ---------- */
.st-sig {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}

.sig-bar {
  width: 3px;
  border-radius: 2px;
  background: currentColor;
}

.b1 {
  height: 4px;
  opacity: 0.45;
}

.b2 {
  height: 6px;
  opacity: 0.7;
}

.b3 {
  height: 9px;
}

.b4 {
  height: 11px;
}

/* ---------- WiFi ---------- */
.st-wifi {
  position: relative;
  width: 16px;
  height: 12px;
  display: inline-block;
}

.wifi-a {
  position: absolute;
  left: 50%;
  top: 0;
  width: 11px;
  height: 8px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50% 50% 0 0;
  transform: translateX(-50%);
}

.wifi-a.a1 {
  width: 5px;
  height: 4px;
  top: 5px;
}

.wifi-dot {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  transform: translateX(-50%);
}

/* ---------- 电池 ---------- */
.st-bat {
  display: flex;
  align-items: center;
  gap: 1.5px;
}

.bat-body {
  position: relative;
  width: 22px;
  height: 11px;
  border: 1.4px solid currentColor;
  border-radius: 3px;
  padding: 1.5px;
}

.bat-fill {
  display: block;
  width: 74%;
  height: 100%;
  border-radius: 1px;
  background: currentColor;
}

.bat-cap {
  width: 1.6px;
  height: 5px;
  border-radius: 0 1px 1px 0;
  background: currentColor;
}
</style>
