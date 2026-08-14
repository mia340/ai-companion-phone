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

const baseApps = [
  ['💬', '聊天', '/chat'],
  ['👥', '通讯录', '/contacts'],
  ['🌷', '朋友圈', '/app/朋友圈'],
  ['📔', '日记', '/app/日记'],
  ['🎵', '音乐', '/app/音乐'],
  ['🪙', '钱包', '/app/钱包'],
  ['🎲', '游戏', '/app/游戏大厅'],
  ['🙋', '我的资料', '/profile'],
  ['🧠', '记忆', '/app/记忆管理'],
  ['✨', '世界', '/world'],
  ['📦', '数据备份', '/backup'],
  ['⚙️', '设置', '/settings']
] as const

const apps = computed(() =>
  baseApps.map(app => [
    app[0],
    app[1],
    app[2],
    app[1] === '聊天' ? chatUnread.value : 0
  ] as const)
)

const dockApps = computed(() => [
  ['💬', '聊天', '/chat', chatUnread.value],
  ['👥', '通讯录', '/contacts', 0],
  ['➕', '新建角色', '/characters/new', 0],
  ['⚙️', '设置', '/settings', 0]
] as const)

const homeSummary = computed(() => {
  if (!latestCharacterName.value) {
    return '还没有联系人 · 可以先创建或导入一个角色'
  }

  return `${latestCharacterName.value} · 今日世界状态：${worldStateLabel.value}`
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

  if (!latest?.memberIds[0]) return

  const character = await db.characters.get(latest.memberIds[0])
  if (!character) return

  latestCharacterName.value = character.name
  latestCharacterAvatar.value = character.avatar || '🙂'
}

onMounted(loadHomeState)
</script>

<template>
  <PhoneFrame>
    <section class="home-screen">
      <div class="profile-widget">
        <CharacterAvatar
          :avatar="latestCharacterAvatar"
          :name="latestCharacterName || worldName"
          :size="66"
        />

        <div>
          <small>{{ worldName }}</small>
          <h2>欢迎来到我的陪伴世界</h2>
          <p>{{ homeSummary }}</p>
        </div>
      </div>

      <div class="app-grid">
        <button
          v-for="app in apps"
          :key="app[1]"
          class="app-icon"
          type="button"
          @click="$router.push(app[2])"
        >
          <span
            v-if="app[3]"
            class="app-badge"
          >
            {{ app[3] }}
          </span>

          <span class="app-symbol">
            {{ app[0] }}
          </span>

          <span>
            {{ app[1] }}
          </span>
        </button>
      </div>

      <DockBar :apps="dockApps" />
    </section>
  </PhoneFrame>
</template>
