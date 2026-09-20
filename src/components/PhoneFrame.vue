<script setup lang="ts">
import {
  onMounted,
  onUnmounted,
  useSlots,
  computed,
  ref
} from 'vue'
import StatusBar from './StatusBar.vue'
import { useRoute, useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '../db/database'

const props = defineProps<{
  title?: string
  showBack?: boolean
  /** 状态栏文字深浅：锁屏等深色壁纸页用 'light'。 */
  statusTone?: 'dark' | 'light'
  /** 主屏幕这类 OS Surface 自己管理分页，不允许外层再生成滚动层。 */
  lockScroll?: boolean
}>()

const slots = useSlots()
const route = useRoute()
const router = useRouter()
const companionTabs = [
  { label: '知间', path: '/chat', icon: 'chat' },
  { label: '通讯录', path: '/contacts', icon: 'contacts' },
  { label: '发现', path: '/companion/discover', icon: 'discover' },
  { label: '我', path: '/companion/me', icon: 'me' }
] as const
const inCompanion = computed(() => companionTabs.some(tab => tab.path === route.path))
const shouldShowBack = computed(() => Boolean(props.title))
const unreadChat = ref(0)
const unreadMoments = ref(0)
let chatSubscription: { unsubscribe: () => void } | undefined
let socialSubscription: { unsubscribe: () => void } | undefined

function goBack() {
  if (inCompanion.value) {
    void router.push('/home')
    return
  }
  const previous = window.history.state?.back
  if (previous) router.back()
  else void router.push('/home')
}

function syncViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty(
    '--app-viewport-height',
    `${Math.round(height)}px`
  )
}

onMounted(() => {
  if (inCompanion.value) {
    chatSubscription = liveQuery(() => db.conversations.toArray())
      .subscribe(rows => { unreadChat.value = rows.reduce((sum, row) => sum + Number(row.unread || 0), 0) })
    socialSubscription = liveQuery(async () => {
      const world = (await db.worlds.toArray())[0]
      return db.socialNotifications.where('worldId').equals(world?.id || 'world-default').filter(item => !item.read).count()
    }).subscribe(count => { unreadMoments.value = count })
  }
  syncViewportHeight()
  window.addEventListener('resize', syncViewportHeight)
  window.visualViewport?.addEventListener('resize', syncViewportHeight)
  window.visualViewport?.addEventListener('scroll', syncViewportHeight)
})

onUnmounted(() => {
  chatSubscription?.unsubscribe()
  socialSubscription?.unsubscribe()
  window.removeEventListener('resize', syncViewportHeight)
  window.visualViewport?.removeEventListener('resize', syncViewportHeight)
  window.visualViewport?.removeEventListener('scroll', syncViewportHeight)
})
</script>

<template>
  <main class="page-shell">
    <section class="phone-frame">
      <div class="speaker"></div>

      <StatusBar :tone="statusTone ?? 'dark'" />

      <div
        v-if="slots.header"
        class="app-header app-header--custom"
      >
        <slot name="header" />
      </div>

      <div
        v-else-if="title"
        class="app-header"
      >
        <button
          v-if="shouldShowBack"
          class="icon-button"
          type="button"
          aria-label="返回"
          @click="goBack"
        >
          ‹
        </button>
        <span v-else></span>

        <strong>{{ title }}</strong>

        <span class="header-right-slot"><slot name="header-right" /></span>
      </div>

      <div class="phone-content" :class="{ 'phone-content--locked': props.lockScroll }">
        <slot />
      </div>

      <nav v-if="inCompanion" class="companion-nav" aria-label="知间主导航">
        <button v-for="tab in companionTabs" :key="tab.path" type="button"
          class="companion-tab" :class="{ active: route.path === tab.path }"
          :aria-current="route.path === tab.path ? 'page' : undefined"
          @click="$router.push(tab.path)">
          <span class="companion-tab-icon">
            <svg v-if="tab.icon === 'chat'" viewBox="0 0 24 24"><path d="M4 5h16v12H9l-5 3V5Z"/><path d="M8 10h8M8 13h5"/></svg>
            <svg v-else-if="tab.icon === 'contacts'" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 6h4M17 11h4M17 16h4"/></svg>
            <svg v-else-if="tab.icon === 'discover'" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></svg>
            <svg v-else viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/></svg>
            <b v-if="tab.icon === 'chat' && unreadChat" class="companion-badge">{{ unreadChat > 99 ? '99+' : unreadChat }}</b>
            <b v-if="tab.icon === 'discover' && unreadMoments" class="companion-badge">{{ unreadMoments > 99 ? '99+' : unreadMoments }}</b>
          </span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <button
        class="home-indicator"
        type="button"
        aria-label="返回主屏幕"
        @click="$router.push('/home')"
      ></button>
    </section>
  </main>
</template>

<style scoped>
.phone-content {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.companion-nav{flex:0 0 79px;display:grid;grid-template-columns:repeat(4,1fr);min-height:79px;background:#fafbfc;border-top:1px solid #e5eaee;padding:7px 0 max(24px,env(safe-area-inset-bottom));z-index:5}
.companion-tab{border:0;background:transparent;color:#82909b;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;font-size:12px;line-height:1.2;cursor:pointer;min-width:0}
.companion-tab.active{color:#07ad67;font-weight:600}
.companion-tab-icon{position:relative;width:26px;height:26px;display:block}
.companion-tab-icon svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.companion-badge{position:absolute;top:-5px;right:-12px;border-radius:10px;background:#ee4d54;color:#fff;min-width:16px;height:16px;padding:0 3px;font:10px/16px sans-serif;border:1px solid #fff}
.phone-content--locked {
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-overflow-scrolling: auto;
}
.phone-content::-webkit-scrollbar,
.phone-content--locked::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
.header-right-slot{min-width:42px;height:42px;display:grid;place-items:center}
</style>
