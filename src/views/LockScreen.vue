<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'

const router = useRouter()

const now = ref(new Date())
let timer: number | undefined

type LockNotice = {
  avatar: string
  name: string
  unread: number
}

const notice = ref<LockNotice | null>(null)

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

async function loadLatestUnreadNotice() {
  const conversations = (await db.conversations.toArray())
    .filter(conversation => Number(conversation.unread || 0) > 0)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))

  const latest = conversations[0]
  if (!latest) {
    notice.value = null
    return
  }

  let name = latest.title || '新消息'
  let avatar = '💬'

  if (latest.type === 'single' && latest.memberIds[0]) {
    const character = await db.characters.get(latest.memberIds[0])
    if (character) {
      name = character.name
      avatar = character.avatar || '🙂'
    }
  }

  notice.value = {
    avatar,
    name,
    unread: Number(latest.unread || 0)
  }
}

onMounted(async () => {
  await loadLatestUnreadNotice()

  timer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => {
  if (timer) {
    window.clearInterval(timer)
  }
})

const startY = ref(0)

function startSwipe(event: PointerEvent) {
  startY.value = event.clientY
}

function endSwipe(event: PointerEvent) {
  const distance = startY.value - event.clientY

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

      <div v-if="notice" class="notice-card">
        <CharacterAvatar
          class="notice-avatar"
          :avatar="notice.avatar"
          :name="notice.name"
          :size="40"
        />

        <div>
          <b>{{ notice.name }}</b>
          <p>刚刚给你发来了 {{ notice.unread }} 条消息</p>
        </div>
      </div>

      <div class="unlock-tip" :class="{ 'without-notice': !notice }">
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

.notice-avatar {
  flex: 0 0 auto;
}

.unlock-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.unlock-tip.without-notice {
  margin-top: 260px;
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
