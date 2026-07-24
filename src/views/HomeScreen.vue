<script setup lang="ts">
import PhoneFrame from '../components/PhoneFrame.vue'
import DockBar from '../components/DockBar.vue'


const apps = [
  ['💬', '聊天', '/chat', 2],
  ['👥', '通讯录', '/contacts', 0],
  ['🌷', '朋友圈', '/app/朋友圈', 1],
  ['📔', '日记', '/app/日记', 0],
  ['🎵', '音乐', '/app/音乐', 0],
  ['🪙', '钱包', '/app/钱包', 0],
  ['🎲', '游戏', '/app/游戏大厅', 0],
  ['🙋', '我的资料', '/profile', 0],
  ['🧠', '记忆', '/app/记忆管理', 0],
  ['✨', '世界', '/app/世界状态', 0],
  ['🖼️', '外观', '/settings', 0],
  ['⚙️', '设置', '/settings', 0]
] as const

const dockApps = [
  ['💬', '聊天', '/chat', 2],
  ['👥', '通讯录', '/contacts', 0],
  ['➕', '新建角色', '/characters/new', 0],
  ['⚙️', '设置', '/settings', 0]
] as const
</script>

<template>
  <PhoneFrame>
    <section class="home-screen">
      <div class="profile-widget">
        <div class="avatar-large">🌸</div>

        <div>
          <small>草莓云世界</small>
          <h2>欢迎来到我的陪伴世界</h2>
          <p>林夏正在等你的消息 · 今日世界状态：日常</p>
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