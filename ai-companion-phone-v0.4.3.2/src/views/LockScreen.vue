<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'

const router = useRouter()

// 当前时间
const now = ref(new Date())
let timer: number | undefined

const time = computed(() =>
  now.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
)

const date = computed(() =>
  now.value.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
)

// 每分钟更新时间
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

// 滑动解锁
const startY = ref(0)

function startSwipe(event: PointerEvent) {
  startY.value = event.clientY
}

function endSwipe(event: PointerEvent) {
  const distance = startY.value - event.clientY

  // 向上滑动超过 80 像素，进入桌面
  if (distance > 80) {
    router.push('/home')
  }
}
</script>

<template>
  <PhoneFrame>
    <section
      class="lock-screen"
      @pointerdown="startSwipe"
      @pointerup="endSwipe"
    >
      <div class="lock-time">{{ time }}</div>

      <div class="lock-date">{{ date }}</div>

      <div class="notice-card">
        <span class="notice-icon">🌸</span>

        <div>
          <b>林夏</b>
          <p>刚刚给你发来了 2 条消息</p>
        </div>
      </div>

      <div class="unlock-tip">
        <span class="unlock-arrow">⌃</span>
        <span>向上滑动解锁</span>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.lock-screen {
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.lock-screen:active {
  cursor: grabbing;
}

.unlock-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.unlock-arrow {
  font-size: 28px;
  line-height: 20px;
  animation: float-up 1.4s ease-in-out infinite;
}

@keyframes float-up {
  0%,
  100% {
    transform: translateY(4px);
    opacity: 0.45;
  }

  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}
</style>