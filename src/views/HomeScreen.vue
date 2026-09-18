<script setup lang="ts">
import { liveQuery } from 'dexie'
import {
  computed,
  onMounted,
  onUnmounted,
  ref
} from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  DEFAULT_HOME_APPEARANCE,
  HOME_APPS,
  listAppCustomizations,
  loadHomeAppearance,
  type HomeAppDefinition,
  type HomeAppearancePreferences
} from '../services/appCustomizationService'

const router = useRouter()

const chatUnread = ref(0)
const momentsUnread = ref(0)
const worldId = ref('world-default')
const worldStateLabel = ref('日常')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>({ ...DEFAULT_HOME_APPEARANCE })

let longPressTimer: number | undefined
let socialBadgeSubscription: { unsubscribe: () => void } | undefined
let longPressStartX = 0
let longPressStartY = 0

const apps = computed(() => HOME_APPS.map(app => ({
  ...app,
  badge: app.key === 'banxin' ? chatUnread.value + momentsUnread.value : 0,
  customImage: customIcons.value[app.key]
})))

const homeIconSize = computed(() => Math.round(64 * appearance.value.iconScale))
const wallpaperStyle = computed(() => appearance.value.wallpaperDataUrl
  ? {
      backgroundImage: `linear-gradient(180deg,rgba(244,250,255,.10),rgba(214,232,246,.18)),url("${appearance.value.wallpaperDataUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  : undefined)

const dateLine = computed(() => new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).replace(/(\d日)(星期.+)/, '$1 $2'))

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const dateStatus = computed(() => `${dateLine.value} · ${worldStateLabel.value === '暂停' ? '世界已暂停' : '美好正在发生'}`)

async function loadHomeState() {
  const worlds = await db.worlds.toArray()
  const world = worlds[0]
  worldId.value = world?.id || 'world-default'
  if (world) {
    worldStateLabel.value = world.paused
      ? '暂停'
      : world.eventLevel === 'daily'
        ? '日常'
        : world.eventLevel || '日常'
  }

  const [conversations, savedIcons, savedAppearance, unreadMomentNotifications] = await Promise.all([
    db.conversations.toArray(),
    listAppCustomizations(worldId.value),
    loadHomeAppearance(worldId.value),
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count()
  ])
  momentsUnread.value = unreadMomentNotifications
  chatUnread.value = conversations.reduce(
    (sum, conversation) => sum + Number(conversation.unread || 0),
    0
  )
  customIcons.value = Object.fromEntries(
    savedIcons.filter(item => item.iconDataUrl).map(item => [item.appKey, item.iconDataUrl as string])
  )
  appearance.value = savedAppearance
}

function openApp(app: HomeAppDefinition) {
  void router.push(app.route)
}

function cancelHomeLongPress() {
  if (longPressTimer !== undefined) window.clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function startHomeLongPress(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button,a,input,textarea,select')) return
  cancelHomeLongPress()
  longPressStartX = event.clientX
  longPressStartY = event.clientY
  longPressTimer = window.setTimeout(() => {
    longPressTimer = undefined
    void router.push('/settings/appearance')
  }, 520)
}

function moveHomeLongPress(event: PointerEvent) {
  if (longPressTimer === undefined) return
  if (Math.hypot(event.clientX - longPressStartX, event.clientY - longPressStartY) > 8) cancelHomeLongPress()
}

onMounted(async () => {
  await loadHomeState()
  socialBadgeSubscription = liveQuery(() =>
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count()
  ).subscribe(count => {
    momentsUnread.value = count
  })
})

onUnmounted(() => {
  cancelHomeLongPress()
  socialBadgeSubscription?.unsubscribe()
})
</script>

<template>
  <PhoneFrame status-tone="dark">
    <section class="hm-root">
      <div class="hm-wall" :style="wallpaperStyle">
        <template v-if="!appearance.wallpaperDataUrl">
          <i class="glow g1"></i>
          <i class="glow g2"></i>
          <i class="cloud c1"></i>
          <i class="cloud c2"></i>
        </template>
      </div>

      <div
        class="hm-main"
        @pointerdown="startHomeLongPress"
        @pointermove="moveHomeLongPress"
        @pointerup="cancelHomeLongPress"
        @pointercancel="cancelHomeLongPress"
        @pointerleave="cancelHomeLongPress"
      >
        <header class="hm-topbar">
          <div class="hm-date">{{ dateStatus }}</div>
          <h1>{{ greeting }}</h1>
          <p>连接真实的你 · 遇见有趣的世界</p>
        </header>

        <div class="hm-grid">
          <button
            v-for="app in apps"
            :key="app.key"
            class="hm-app"
            type="button"
            @click="openApp(app)"
          >
            <span class="hm-tile-wrap">
              <AppIcon :icon="app.icon" :custom-image="app.customImage" :tones="app.tone" :size="homeIconSize" />
              <b v-if="app.badge" class="hm-badge">{{ app.badge > 99 ? '99+' : app.badge }}</b>
            </span>
            <span v-if="appearance.showAppLabels" class="hm-name">{{ app.label }}</span>
          </button>
        </div>

        <p class="hm-tip">长按桌面空白处可调整壁纸与图标。</p>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.hm-root{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden}.hm-wall{position:absolute;inset:0;z-index:0;overflow:hidden;background:radial-gradient(100% 62% at 92% 0%,rgba(255,255,255,.97) 0%,rgba(227,244,255,.72) 36%,transparent 65%),linear-gradient(168deg,#f8fcff 0%,#edf8ff 46%,#dfeefa 100%)}.glow{position:absolute;display:block;border-radius:50%;filter:blur(12px);opacity:.48}.g1{width:230px;height:230px;top:-72px;right:-64px;background:radial-gradient(circle,rgba(165,212,244,.68),transparent 68%)}.g2{width:280px;height:280px;bottom:-110px;left:-100px;background:radial-gradient(circle,rgba(184,222,248,.76),transparent 68%)}.cloud{position:absolute;display:block;border-radius:999px;background:rgba(255,255,255,.56);filter:blur(.2px)}.cloud::before,.cloud::after{content:'';position:absolute;border-radius:50%;background:inherit}.c1{width:180px;height:58px;right:-35px;bottom:40px}.c1::before{width:88px;height:88px;left:18px;bottom:6px}.c1::after{width:112px;height:112px;right:8px;bottom:-2px}.c2{width:128px;height:42px;left:-38px;top:47%}.c2::before{width:72px;height:72px;left:26px;bottom:2px}.c2::after{width:62px;height:62px;right:-8px;bottom:-4px}.hm-root::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(214,232,246,.08))}.hm-main{position:relative;z-index:1;flex:1;min-height:0;overflow-y:auto;padding:26px 22px 28px;-webkit-overflow-scrolling:touch;touch-action:pan-y}.hm-topbar{color:#263d50}.hm-date{font-size:12px;color:#73899a;letter-spacing:.35px}.hm-topbar h1{margin:8px 0 7px;font-size:35px;line-height:1;font-weight:730;letter-spacing:-.035em}.hm-topbar p{margin:0;color:#5e7487;font-size:13px}.hm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:30px 14px;margin-top:46px;padding:0 4px}.hm-app{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0;border:0;background:transparent;cursor:pointer;color:inherit}.hm-tile-wrap{position:relative;display:grid;place-items:center}.hm-badge{position:absolute;z-index:3;right:-7px;top:-6px;min-width:19px;height:19px;padding:0 5px;border-radius:11px;background:#ff5b6a;color:#fff;font-size:10px;line-height:19px;text-align:center;font-weight:750;border:1.5px solid rgba(255,255,255,.9)}.hm-name{font-size:12px;color:#31495c;white-space:nowrap}.hm-tip{position:relative;margin:58px 0 0;text-align:center;color:#9aa9b4;font-size:10px}@media(max-width:360px){.hm-grid{gap:25px 8px}.hm-name{font-size:11px}.hm-topbar h1{font-size:32px}}
</style>
