<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'

const router = useRouter()

const now = ref(new Date())
let clockTimer: number | undefined

const time = computed(() =>
  now.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
)

const dateLine = computed(() => {
  const value = now.value.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
  // zh-CN 常给成「9月5日星期五」，补一个空格更透气
  return value.replace(/(\d日)(星期.+)/, '$1 $2')
})

type LockNotice = {
  avatar: string
  name: string
  unread: number
}

const notices = ref<LockNotice[]>([])

async function loadNotices() {
  const conversations = (await db.conversations.toArray())
    .filter(conversation => Number(conversation.unread || 0) > 0)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 3)

  const loaded: LockNotice[] = []
  for (const latest of conversations) {
    if (latest.type === 'single' && latest.memberIds[0]) {
      const character = await db.characters.get(latest.memberIds[0])
      if (character) {
        loaded.push({
          avatar: character.avatar || '🙂',
          name: character.name,
          unread: Number(latest.unread || 0)
        })
        continue
      }
    }
    loaded.push({
      avatar: '💬',
      name: latest.title || '新消息',
      unread: Number(latest.unread || 0)
    })
  }
  notices.value = loaded
}

onMounted(async () => {
  await loadNotices()
  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) {
    window.clearInterval(clockTimer)
  }
})

// ---------- 拖拽上滑解锁 ----------
const MIN_SWIPE = 90

const dragY = ref(0)
const dragging = ref(false)
let startY = 0
let startDragY = 0

function onPointerDown(event: PointerEvent) {
  dragging.value = true
  startY = event.clientY
  startDragY = dragY.value
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const offset = startDragY + (startY - event.clientY)
  dragY.value = Math.max(0, Math.min(offset, 320))
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  if (dragY.value >= MIN_SWIPE) {
    void router.push('/home')
  } else {
    dragY.value = 0
  }
}

const bodyTransform = computed(() =>
  dragY.value > 0 ? `translateY(${dragY.value * 0.55}px)` : ''
)
</script>

<template>
  <PhoneFrame status-tone="light">
    <section
      class="ls-root"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- 全幅深色壁纸（延伸到状态栏背后） -->
      <div class="ls-wall">
        <i class="glow g1"></i>
        <i class="glow g2"></i>
        <i class="glow g3"></i>
      </div>

      <div
        class="ls-body"
        :class="{ dragging }"
        :style="bodyTransform"
      >
        <header class="ls-clock">
          <div class="ls-time">{{ time }}</div>
          <div class="ls-date">{{ dateLine }}</div>
        </header>

        <div class="ls-mid"></div>

        <!-- 未读通知：最多 3 条，毛玻璃小卡片 -->
        <div
          v-if="notices.length"
          class="ls-notices"
        >
          <article
            v-for="notice in notices"
            :key="notice.name + notice.unread"
            class="ls-notice"
          >
            <CharacterAvatar
              class="ls-notice-avatar"
              :avatar="notice.avatar"
              :name="notice.name"
              :size="42"
            />
            <div class="ls-notice-main">
              <b>{{ notice.name }}</b>
              <small>
                刚刚给你发来 {{ notice.unread }} 条新消息
              </small>
            </div>
            <span class="ls-notice-count">{{ notice.unread }}</span>
          </article>
        </div>

        <div
          v-else
          class="ls-notices ls-notices--empty"
        >
          <div class="ls-quiet">没有未读消息 · 世界很安静</div>
        </div>

        <!-- 解锁提示 -->
        <div class="ls-hint">
          <span class="ls-hint-arrow">⌃</span>
          <span>上滑进入</span>
        </div>
      </div>

      <div class="ls-vignette"></div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.ls-root {
  position: relative;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.ls-root:active {
  cursor: grabbing;
}

/* ---------- 壁纸 ---------- */
.ls-wall {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 82% -12%, rgba(120, 168, 255, 0.55) 0%, transparent 46%),
    radial-gradient(130% 110% at 6% 108%, rgba(255, 158, 200, 0.5) 0%, transparent 52%),
    linear-gradient(165deg, #1d2b55 0%, #34407a 42%, #5a3d76 100%);
}

.glow {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.55;
  mix-blend-mode: screen;
}

.g1 {
  width: 230px;
  height: 230px;
  top: -70px;
  right: -60px;
  background: radial-gradient(circle, rgba(168, 205, 255, 0.9), transparent 68%);
}

.g2 {
  width: 260px;
  height: 260px;
  bottom: -90px;
  left: -90px;
  background: radial-gradient(circle, rgba(255, 174, 205, 0.7), transparent 66%);
}

.g3 {
  width: 140px;
  height: 140px;
  top: 42%;
  left: 12%;
  background: radial-gradient(circle, rgba(255, 214, 170, 0.5), transparent 70%);
}

.ls-vignette {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(130% 90% at 50% 30%, transparent 55%, rgba(12, 16, 40, 0.42) 100%);
}

/* ---------- 主体 ---------- */
.ls-body {
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 26px;
  color: rgba(255, 255, 255, 0.96);
  text-shadow: 0 2px 14px rgba(12, 20, 50, 0.35);
  transition: transform 0.28s ease;
}

.ls-body.dragging {
  transition: none;
}

.ls-clock {
  text-align: center;
}

.ls-time {
  font-size: 84px;
  font-weight: 200;
  letter-spacing: 2px;
  line-height: 1.02;
  font-variant-numeric: tabular-nums;
}

.ls-date {
  margin-top: 6px;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: 1px;
  opacity: 0.92;
}

.ls-mid {
  flex: 1;
  min-height: 18px;
}

/* ---------- 通知 ---------- */
.ls-notices {
  width: 100%;
  max-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ls-notices--empty {
  align-items: center;
}

.ls-quiet {
  padding: 12px 18px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px;
  backdrop-filter: blur(14px);
}

.ls-notice {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 20px;
  backdrop-filter: blur(18px);
  text-align: left;
  text-shadow: none;
  box-shadow: 0 10px 30px rgba(10, 16, 44, 0.25);
}

.ls-notice-avatar {
  flex: 0 0 auto;
}

.ls-notice-main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 2px;
}

.ls-notice-main b {
  color: rgba(255, 255, 255, 0.98);
  font-size: 15px;
}

.ls-notice-main small {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.ls-notice-count {
  flex: 0 0 auto;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #ff5b6a;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

/* ---------- 解锁提示 ---------- */
.ls-hint {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 13px;
  opacity: 0.9;
}

.ls-hint-arrow {
  font-size: 24px;
  line-height: 18px;
  animation: hint-float 1.5s ease-in-out infinite;
}

@keyframes hint-float {
  0%,
  100% {
    transform: translateY(5px);
    opacity: 0.5;
  }

  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}
</style>
