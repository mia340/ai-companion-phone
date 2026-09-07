<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import DockBar from '../components/DockBar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'

const chatUnread = ref(0)
const worldName = ref('草莓云世界')
const latestCharacterName = ref('')
const latestCharacterAvatar = ref('🌍')
const worldStateLabel = ref('日常')

interface AppDef {
  g: string
  n: string
  to: string
  t1: string
  t2: string
}

// 每格图标一个专属的柔和双色渐变，模拟真实 App 图标色块。
const appDefs: AppDef[] = [
  { g: '💬', n: '聊天', to: '/chat', t1: '#5b8dff', t2: '#7fc1ff' },
  { g: '👥', n: '通讯录', to: '/contacts', t1: '#27c3a4', t2: '#6ee2c4' },
  { g: '🌷', n: '朋友圈', to: '/app/朋友圈', t1: '#fb7cb3', t2: '#ffa4d1' },
  { g: '📔', n: '日记', to: '/app/日记', t1: '#ffb059', t2: '#ffd27e' },
  { g: '🎵', n: '音乐', to: '/app/音乐', t1: '#ff6b7c', t2: '#ffa07f' },
  { g: '🪙', n: '钱包', to: '/app/钱包', t1: '#54bd68', t2: '#93dd7c' },
  { g: '🐢', n: '海龟汤', to: '/app/海龟汤', t1: '#46a8bb', t2: '#8ad3a8' },
  { g: '🙋', n: '我的资料', to: '/profile', t1: '#7a6bff', t2: '#a9a0ff' },
  { g: '🧠', n: '记忆', to: '/app/记忆管理', t1: '#9a5cff', t2: '#c29bff' },
  { g: '✨', n: '世界', to: '/world', t1: '#2f9be8', t2: '#74c6ff' },
  { g: '📦', n: '数据备份', to: '/backup', t1: '#7e93ab', t2: '#b3c4d6' },
  { g: '⚙️', n: '设置', to: '/settings', t1: '#8ca2bd', t2: '#c2d0e0' }
]

const apps = computed(() =>
  appDefs.map(app => ({ ...app, badge: app.n === '聊天' ? chatUnread.value : 0 }))
)

const dockApps = computed(
  () =>
    [
      ['💬', '聊天', '/chat', chatUnread.value],
      ['👥', '通讯录', '/contacts', 0],
      ['➕', '新建角色', '/characters/new', 0],
      ['⚙️', '设置', '/settings', 0]
    ] as const
)

const dateLine = computed(() => {
  const value = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
  return value.replace(/(\d日)(星期.+)/, '$1 $2')
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const homeSummary = computed(() => {
  if (!latestCharacterName.value) {
    return '还没有联系人 · 先创建一个或导入一个角色吧'
  }
  return `${latestCharacterName.value} · 世界状态：${worldStateLabel.value}`
})

async function loadHomeState() {
  const worlds = await db.worlds.toArray()
  const world = worlds[0]
  if (world) {
    worldName.value = world.name || '草莓云世界'
    worldStateLabel.value = world.paused
      ? '暂停'
      : world.eventLevel === 'daily'
        ? '日常'
        : world.eventLevel || '日常'
  }

  const conversations = await db.conversations.toArray()
  chatUnread.value = conversations.reduce(
    (sum, conversation) => sum + Number(conversation.unread || 0),
    0
  )

  const latest = [...conversations]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .find(conversation => conversation.type === 'single' && conversation.memberIds[0])

  let character = latest?.memberIds[0]
    ? await db.characters.get(latest.memberIds[0])
    : undefined

  // 新库有示例角色但还没有会话时，也要在首页展示真实联系人，
  // 不要一边有 4 个角色、一边提示“还没有联系人”。
  if (!character) {
    const characters = await db.characters.toArray()
    character = [...characters].sort((a, b) =>
      String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
    )[0]
  }

  if (!character) return
  latestCharacterName.value = character.name
  latestCharacterAvatar.value = character.avatar || '🙂'
}

onMounted(loadHomeState)
</script>

<template>
  <PhoneFrame status-tone="light">
    <section class="hm-root">
      <!-- 与锁屏同款壁纸，加一层压暗让它更适合放图标 -->
      <div class="hm-wall">
        <i class="glow g1"></i>
        <i class="glow g2"></i>
        <i class="glow g3"></i>
      </div>

      <div class="hm-main">
        <!-- 问候卡 -->
        <div class="hm-hello">
          <div class="hm-date">{{ dateLine }} · {{ worldName }}</div>
          <h1>{{ greeting }}</h1>
          <div class="hm-char">
            <CharacterAvatar
              :avatar="latestCharacterAvatar"
              :name="latestCharacterName || worldName"
              :size="34"
            />
            <span>{{ homeSummary }}</span>
          </div>
        </div>

        <!-- App 网格 -->
        <div class="hm-grid">
          <button
            v-for="app in apps"
            :key="app.n"
            class="hm-app"
            type="button"
            @click="$router.push(app.to)"
          >
            <span
              class="hm-tile"
              :style="{
                backgroundImage: `linear-gradient(150deg, ${app.t1}, ${app.t2})`
              }"
            >
              <b
                v-if="app.badge"
                class="hm-badge"
              >
                {{ app.badge }}
              </b>
              <span class="hm-glyph">{{ app.g }}</span>
            </span>
            <span class="hm-name">{{ app.n }}</span>
          </button>
        </div>

        <div class="hm-dock-holder">
          <DockBar :apps="dockApps" />
        </div>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.hm-root {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---------- 壁纸 ---------- */
.hm-wall {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background:
    radial-gradient(120% 90% at 82% -12%, rgba(120, 168, 255, 0.5) 0%, transparent 46%),
    radial-gradient(130% 110% at 6% 108%, rgba(255, 158, 200, 0.46) 0%, transparent 52%),
    linear-gradient(165deg, #1d2b55 0%, #34407a 42%, #5a3d76 100%);
}

.glow {
  position: absolute;
  display: block;
  border-radius: 50%;
  filter: blur(6px);
  opacity: 0.5;
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
  top: 40%;
  left: 12%;
  background: radial-gradient(circle, rgba(255, 214, 170, 0.5), transparent 70%);
}

/* 让图标区域的壁纸略暗 + 微模糊，图标更清楚 */
.hm-root::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 70% at 50% 0%, transparent 30%, rgba(10, 16, 42, 0.34) 100%);
}

/* ---------- 内容 ---------- */
.hm-main {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 22px 18px 16px;
  -webkit-overflow-scrolling: touch;
}

.hm-hello {
  flex: 0 0 auto;
  color: white;
  text-shadow: 0 2px 12px rgba(12, 20, 50, 0.4);
  padding: 4px 6px 2px;
}

.hm-date {
  font-size: 12.5px;
  opacity: 0.82;
  letter-spacing: 0.5px;
}

.hm-hello h1 {
  margin: 8px 0 10px;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 1px;
}

.hm-char {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px 5px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(16px);
  font-size: 12.5px;
  text-shadow: none;
}

.hm-char span {
  color: rgba(255, 255, 255, 0.94);
}

/* ---------- App 网格 ---------- */
.hm-grid {
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px 8px;
  margin-top: 26px;
  padding: 0 6px;
}

.hm-app {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.hm-tile {
  position: relative;
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  box-shadow:
    0 8px 18px rgba(16, 24, 60, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.hm-tile::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 18px;
  background: linear-gradient(rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0));
}

.hm-glyph {
  position: relative;
  font-size: 29px;
  line-height: 1;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.18));
}

.hm-badge {
  position: absolute;
  z-index: 2;
  right: -5px;
  top: -6px;
  min-width: 19px;
  height: 19px;
  padding: 0 5px;
  border-radius: 11px;
  background: #ff4d5e;
  color: white;
  font-size: 11px;
  line-height: 19px;
  text-align: center;
  font-weight: 700;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
}

.hm-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.96);
  text-shadow: 0 1px 5px rgba(10, 16, 46, 0.65);
  white-space: nowrap;
}

/* ---------- Dock ---------- */
.hm-dock-holder {
  flex: 0 0 auto;
  margin-top: auto;
  padding: 18px 0 22px;
}
</style>
