<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import DockBar from '../components/DockBar.vue'
import AppIcon from '../components/AppIcon.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  DEFAULT_HOME_APPEARANCE,
  DOCK_APPS,
  HOME_APPS,
  listAppCustomizations,
  loadHomeAppearance,
  type HomeAppDefinition,
  type HomeAppearancePreferences
} from '../services/appCustomizationService'

const router = useRouter()

const chatUnread = ref(0)
const worldName = ref('草莓云世界')
const worldId = ref('world-default')
const latestCharacterName = ref('')
const latestCharacterAvatar = ref('🌍')
const worldStateLabel = ref('日常')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>({ ...DEFAULT_HOME_APPEARANCE })

let longPressTimer: number | undefined
let longPressStartX = 0
let longPressStartY = 0

const apps = computed(() => HOME_APPS.map(app => ({
  ...app,
  badge: app.key === 'chat' ? chatUnread.value : 0,
  customImage: customIcons.value[app.key]
})))

const dockApps = computed(() => DOCK_APPS.map(app => ({
  ...app,
  badge: app.key === 'chat' ? chatUnread.value : 0,
  customImage: customIcons.value[app.key]
})))

const homeIconSize = computed(() => Math.round(62 * appearance.value.iconScale))
const dockIconSize = computed(() => Math.round(50 * appearance.value.iconScale))
const wallpaperStyle = computed(() => appearance.value.wallpaperDataUrl
  ? {
      backgroundImage: `linear-gradient(180deg,rgba(244,250,255,.10),rgba(214,232,246,.18)),url("${appearance.value.wallpaperDataUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  : undefined)

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
  if (!latestCharacterName.value) return '还没有联系人 · 先创建一个或导入一个角色吧'
  return `${latestCharacterName.value} · 世界状态：${worldStateLabel.value}`
})

async function loadHomeState() {
  const worlds = await db.worlds.toArray()
  const world = worlds[0]
  worldId.value = world?.id || 'world-default'
  if (world) {
    worldName.value = world.name || '草莓云世界'
    worldStateLabel.value = world.paused
      ? '暂停'
      : world.eventLevel === 'daily'
        ? '日常'
        : world.eventLevel || '日常'
  }

  const [conversations, savedIcons, savedAppearance] = await Promise.all([
    db.conversations.toArray(),
    listAppCustomizations(worldId.value),
    loadHomeAppearance(worldId.value)
  ])
  chatUnread.value = conversations.reduce(
    (sum, conversation) => sum + Number(conversation.unread || 0),
    0
  )
  customIcons.value = Object.fromEntries(
    savedIcons.filter(item => item.iconDataUrl).map(item => [item.appKey, item.iconDataUrl as string])
  )
  appearance.value = savedAppearance

  const latest = [...conversations]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .find(conversation => conversation.type === 'single' && conversation.memberIds[0])

  let character = latest?.memberIds[0]
    ? await db.characters.get(latest.memberIds[0])
    : undefined

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

onMounted(loadHomeState)
onUnmounted(cancelHomeLongPress)
</script>

<template>
  <PhoneFrame status-tone="dark">
    <section class="hm-root">
      <div class="hm-wall" :style="wallpaperStyle">
        <template v-if="!appearance.wallpaperDataUrl">
          <i class="glow g1"></i>
          <i class="glow g2"></i>
          <i class="glow g3"></i>
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
          <div class="hm-hello">
            <div class="hm-date">{{ dateLine }} · {{ worldName }}</div>
            <h1>{{ greeting }}</h1>
            <div class="hm-char">
              <CharacterAvatar :avatar="latestCharacterAvatar" :name="latestCharacterName || worldName" :size="34" />
              <span>{{ homeSummary }}</span>
            </div>
          </div>
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
              <b v-if="app.badge" class="hm-badge">{{ app.badge }}</b>
            </span>
            <span v-if="appearance.showAppLabels" class="hm-name">{{ app.label }}</span>
          </button>
        </div>

        <div class="hm-dock-holder">
          <DockBar :apps="dockApps" :icon-size="dockIconSize" :show-labels="appearance.showAppLabels" />
        </div>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.hm-root{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden}.hm-wall{position:absolute;inset:0;z-index:0;overflow:hidden;background:radial-gradient(120% 70% at 86% -8%,rgba(255,255,255,.96) 0%,rgba(226,244,255,.76) 34%,transparent 62%),radial-gradient(100% 75% at -8% 100%,rgba(199,228,249,.88) 0%,transparent 62%),linear-gradient(165deg,#f5fbff 0%,#eaf6ff 44%,#dfeef9 100%)}.glow{position:absolute;display:block;border-radius:50%;filter:blur(10px);opacity:.48}.g1{width:230px;height:230px;top:-70px;right:-60px;background:radial-gradient(circle,rgba(163,210,244,.72),transparent 68%)}.g2{width:260px;height:260px;bottom:-90px;left:-90px;background:radial-gradient(circle,rgba(185,224,249,.72),transparent 66%)}.g3{width:140px;height:140px;top:40%;left:12%;background:radial-gradient(circle,rgba(255,255,255,.88),transparent 70%)}
.hm-root::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(214,232,246,.1))}.hm-main{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;overflow-y:auto;padding:22px 18px 14px;-webkit-overflow-scrolling:touch;touch-action:pan-y}.hm-topbar{display:flex;align-items:flex-start;justify-content:flex-start}.hm-hello{min-width:0;color:#24394b;padding:4px 6px 2px}.hm-date{font-size:12px;color:#6e8495;letter-spacing:.45px}.hm-hello h1{margin:7px 0 10px;font-size:34px;line-height:1;font-weight:700;letter-spacing:-.035em}.hm-char{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:5px 12px 5px 6px;border-radius:999px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.86);box-shadow:0 7px 22px rgba(62,99,126,.08);backdrop-filter:blur(16px);font-size:12px}.hm-char span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#536b7e}
.hm-grid{flex:0 0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:22px 8px;margin-top:34px;padding:0 4px}.hm-app{display:flex;flex-direction:column;align-items:center;gap:7px;padding:0;border:0;background:transparent;cursor:pointer;color:inherit}.hm-tile-wrap{position:relative;display:grid;place-items:center}.hm-badge{position:absolute;z-index:3;right:-6px;top:-6px;min-width:19px;height:19px;padding:0 5px;border-radius:11px;background:#ff5b6a;color:#fff;font-size:10px;line-height:19px;text-align:center;font-weight:750;border:1.5px solid rgba(255,255,255,.9)}.hm-name{font-size:12px;color:#31495c;text-shadow:none;white-space:nowrap}.hm-dock-holder{flex:0 0 auto;margin-top:auto;padding:18px 0 20px}
@media(max-width:360px){.hm-grid{gap:18px 5px}.hm-name{font-size:11px}.hm-hello h1{font-size:31px}}
</style>
