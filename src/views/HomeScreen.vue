<script setup lang="ts">
import { liveQuery } from 'dexie'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import DockBar from '../components/DockBar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  CUSTOMIZABLE_APPS,
  DEFAULT_HOME_APPEARANCE,
  HOME_GRID_COLUMNS,
  HOME_GRID_ROWS,
  MAX_HOME_PAGES,
  WIDGET_CATALOG,
  addHomeWidgetToGrid,
  getHomeAppDefinition,
  listAppCustomizations,
  loadHomeAppearance,
  moveHomeAppPlacement,
  moveHomeAppToGrid,
  resolveDockApps,
  saveHomeAppearance,
  type HomeAppDefinition,
  type HomeAppKey,
  type HomeAppearancePreferences,
  type HomeLayoutItem,
  type HomeLayoutPage,
  type HomePlacement,
  type HomeWidgetKey
} from '../services/appCustomizationService'

const router = useRouter()

const chatUnread = ref(0)
const momentsUnread = ref(0)
const worldName = ref('草莓云世界')
const worldId = ref('world-default')
const worldStateLabel = ref('日常')
const latestCharacterName = ref('')
const latestCharacterAvatar = ref('🌍')
const latestConversationId = ref('')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>(structuredClone(DEFAULT_HOME_APPEARANCE))
const now = ref(new Date())
const musicTones: [string, string] = ['#8f9cde', '#b9c4ef']

const editMode = ref(false)
const activeSheet = ref<'widgets' | 'page' | null>(null)
const pageViewport = ref<HTMLElement | null>(null)
const pageSwipeOffset = ref(0)
const pageSwiping = ref(false)
const currentPage = ref(0)
const transientBlankPage = ref(false)

const draggingKey = ref<HomeAppKey | ''>('')
const dropTargetKey = ref<HomeAppKey | ''>('')
const dropTargetKind = ref<HomePlacement | ''>('')
const dropTargetPage = ref(-1)
const dropTargetX = ref(-1)
const dropTargetY = ref(-1)

let pageSwipe: {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  startedAt: number
} | undefined
let suppressAppClickUntil = 0

type LauncherPointerState = {
  pointerId: number
  key: HomeAppKey
  kind: HomePlacement
  startX: number
  startY: number
  active: boolean
  sourceElement: HTMLElement
  ghost?: HTMLElement
  grabOffsetX?: number
  grabOffsetY?: number
}

let launcherPointer: LauncherPointerState | undefined
let longPressTimer: number | undefined
let pageTurnTimer: number | undefined
let socialBadgeSubscription: { unsubscribe: () => void } | undefined
let minuteTimer: number | undefined
let longPressStartX = 0
let longPressStartY = 0

const actualPages = computed(() => appearance.value.homeLayoutPages)
const launcherPages = computed<HomeLayoutPage[]>(() => {
  if (transientBlankPage.value && appearance.value.homeLayoutPages.length < MAX_HOME_PAGES) {
    return [...appearance.value.homeLayoutPages, { items: [] }]
  }
  return appearance.value.homeLayoutPages
})
const dockApps = computed(() => resolveDockApps(appearance.value).map(enrichApp))
const availableWidgets = computed(() => WIDGET_CATALOG.filter(widget => !appearance.value.homeWidgetKeys.includes(widget.key)))
const desktopAppSet = computed(() => new Set(appearance.value.homeAppKeys))
const dockAppSet = computed(() => new Set(appearance.value.dockAppKeys))

const homeIconSize = computed(() => Math.round(60 * appearance.value.iconScale))
const dockIconSize = computed(() => Math.round(54 * appearance.value.iconScale))
const wallpaperStyle = computed(() => appearance.value.wallpaperDataUrl
  ? {
      backgroundImage: `linear-gradient(180deg,rgba(22,39,54,.04),rgba(13,32,48,.08)),url("${appearance.value.wallpaperDataUrl}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  : undefined)

const dateLine = computed(() => now.value.toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
}).replace(/(\d日)(星期.+)/, '$1 $2'))

const timeLine = computed(() => now.value.toLocaleTimeString('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}))

const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 5) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

function enrichApp(app: HomeAppDefinition) {
  return {
    ...app,
    badge: app.key === 'banxin'
      ? chatUnread.value + momentsUnread.value
      : app.key === 'chat'
        ? chatUnread.value
        : app.key === 'moments'
          ? momentsUnread.value
          : 0,
    customImage: customIcons.value[app.key]
  }
}

function appForKey(key: HomeAppKey) {
  const app = getHomeAppDefinition(key)
  return app ? enrichApp(app) : undefined
}

function appLabel(key: HomeAppKey) {
  return appForKey(key)?.label || key
}

function appIconFor(key: HomeAppKey) {
  return appForKey(key)?.icon || key
}

function appToneFor(key: HomeAppKey): [string, string] {
  return appForKey(key)?.tone || ['#9caebb', '#c8d3dc']
}

function appCustomImageFor(key: HomeAppKey) {
  return appForKey(key)?.customImage
}

function appBadgeFor(key: HomeAppKey) {
  return appForKey(key)?.badge || 0
}

function openAppKey(key: HomeAppKey) {
  const app = getHomeAppDefinition(key)
  if (app) openApp(app)
}

function widgetForKey(key: HomeWidgetKey) {
  return WIDGET_CATALOG.find(widget => widget.key === key)
}

function layoutStyle(item: HomeLayoutItem) {
  return {
    gridColumn: `${item.x + 1} / span ${item.w}`,
    gridRow: `${item.y + 1} / span ${item.h}`
  }
}

function gridCellStyle(index: number) {
  const x = index % HOME_GRID_COLUMNS
  const y = Math.floor(index / HOME_GRID_COLUMNS)
  return {
    gridColumn: `${x + 1}`,
    gridRow: `${y + 1}`
  }
}

function isDropCell(pageIndex: number, index: number) {
  return dropTargetKind.value === 'home' &&
    dropTargetPage.value === pageIndex &&
    dropTargetX.value === index % HOME_GRID_COLUMNS &&
    dropTargetY.value === Math.floor(index / HOME_GRID_COLUMNS)
}

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

  const [conversations, savedIcons, savedAppearance, unreadMomentNotifications] = await Promise.all([
    db.conversations.toArray(),
    listAppCustomizations(worldId.value),
    loadHomeAppearance(worldId.value),
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count()
  ])
  momentsUnread.value = unreadMomentNotifications
  chatUnread.value = conversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0)
  customIcons.value = Object.fromEntries(
    savedIcons.filter(item => item.iconDataUrl).map(item => [item.appKey, item.iconDataUrl as string])
  )
  appearance.value = savedAppearance

  const latest = [...conversations]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .find(conversation => conversation.type === 'single' && conversation.memberIds[0])
  latestConversationId.value = latest?.id || ''

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
  if (editMode.value || performance.now() < suppressAppClickUntil) return
  void router.push(app.route)
}

function openWidget(key: HomeWidgetKey) {
  if (editMode.value) return
  if (key === 'companion') {
    void router.push(latestConversationId.value ? `/chat/${latestConversationId.value}` : '/chat')
    return
  }
  if (key === 'world') {
    void router.push('/world')
    return
  }
  if (key === 'music') void router.push('/app/音乐')
}

async function persistAppearance(next: HomeAppearancePreferences) {
  appearance.value = await saveHomeAppearance(worldId.value, next)
}

async function removeHomeApp(key: HomeAppKey) {
  await persistAppearance({
    ...appearance.value,
    homeAppKeys: appearance.value.homeAppKeys.filter(item => item !== key)
  })
}

async function removeDockApp(key: HomeAppKey) {
  await persistAppearance({
    ...appearance.value,
    dockAppKeys: appearance.value.dockAppKeys.filter(item => item !== key)
  })
}

async function addWidget(key: HomeWidgetKey) {
  if (appearance.value.homeWidgetKeys.includes(key)) return
  await persistAppearance(addHomeWidgetToGrid(appearance.value, key, currentPage.value))
  activeSheet.value = null
}

async function removeWidget(key: HomeWidgetKey) {
  await persistAppearance({
    ...appearance.value,
    homeWidgetKeys: appearance.value.homeWidgetKeys.filter(item => item !== key)
  })
}

async function toggleDesktopApp(key: HomeAppKey) {
  const exists = appearance.value.homeAppKeys.includes(key)
  if (exists) {
    await removeHomeApp(key)
    return
  }
  const dock = appearance.value.dockAppKeys.filter(item => item !== key)
  await persistAppearance({
    ...appearance.value,
    homeAppKeys: [...appearance.value.homeAppKeys, key],
    dockAppKeys: dock
  })
}

async function toggleDockApp(key: HomeAppKey) {
  const exists = appearance.value.dockAppKeys.includes(key)
  if (exists) {
    await removeDockApp(key)
    return
  }
  if (appearance.value.dockAppKeys.length >= 4) return
  if (appearance.value.homeAppKeys.includes(key)) {
    await persistAppearance(moveHomeAppPlacement(appearance.value, key, 'dock'))
    return
  }
  await persistAppearance({
    ...appearance.value,
    dockAppKeys: [...appearance.value.dockAppKeys, key]
  })
}

function cancelHomeLongPress() {
  if (longPressTimer !== undefined) window.clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function clearPageTurn() {
  if (pageTurnTimer !== undefined) window.clearTimeout(pageTurnTimer)
  pageTurnTimer = undefined
}

function removeLauncherGhost() {
  launcherPointer?.ghost?.remove()
  launcherPointer?.sourceElement.classList.remove('launcher-source-dragging')
}

function clearDropTarget() {
  dropTargetKind.value = ''
  dropTargetKey.value = ''
  dropTargetPage.value = -1
  dropTargetX.value = -1
  dropTargetY.value = -1
}

function resetLauncherPointer() {
  cancelHomeLongPress()
  clearPageTurn()
  removeLauncherGhost()
  launcherPointer = undefined
  draggingKey.value = ''
  clearDropTarget()
  transientBlankPage.value = false
  if (currentPage.value >= actualPages.value.length) currentPage.value = Math.max(0, actualPages.value.length - 1)
}

function activateLauncherDrag(event: PointerEvent) {
  if (!launcherPointer || launcherPointer.ghost) return
  const rect = launcherPointer.sourceElement.getBoundingClientRect()
  const ghost = launcherPointer.sourceElement.cloneNode(true) as HTMLElement
  ghost.removeAttribute('data-launcher-item')
  ghost.removeAttribute('data-launcher-kind')
  ghost.querySelectorAll('[data-launcher-item],[data-launcher-kind]').forEach(node => {
    node.removeAttribute('data-launcher-item')
    node.removeAttribute('data-launcher-kind')
  })
  ghost.classList.add('hm-drag-ghost')
  ghost.querySelectorAll('.hm-remove,.hm-dock-remove').forEach(node => node.remove())
  Object.assign(ghost.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`
  })
  document.body.appendChild(ghost)
  launcherPointer.ghost = ghost
  launcherPointer.grabOffsetX = event.clientX - rect.left
  launcherPointer.grabOffsetY = event.clientY - rect.top
  launcherPointer.sourceElement.classList.add('launcher-source-dragging')
}

function moveLauncherGhost(event: PointerEvent) {
  if (!launcherPointer?.ghost) return
  launcherPointer.ghost.style.left = `${event.clientX - (launcherPointer.grabOffsetX || 0)}px`
  launcherPointer.ghost.style.top = `${event.clientY - (launcherPointer.grabOffsetY || 0)}px`
}

function beginBlankLongPress(event: PointerEvent) {
  if (editMode.value) return
  cancelHomeLongPress()
  longPressStartX = event.clientX
  longPressStartY = event.clientY
  longPressTimer = window.setTimeout(() => {
    longPressTimer = undefined
    editMode.value = true
    activeSheet.value = null
  }, 520)
}

function beginLauncherItemPointer(event: PointerEvent, item: HTMLElement) {
  const key = item.dataset.launcherItem as HomeAppKey | undefined
  const kind = item.dataset.launcherKind as HomePlacement | undefined
  if (!key || (kind !== 'home' && kind !== 'dock')) return
  cancelHomeLongPress()
  launcherPointer = {
    pointerId: event.pointerId,
    key,
    kind,
    startX: event.clientX,
    startY: event.clientY,
    active: editMode.value,
    sourceElement: item
  }
  if (editMode.value) {
    draggingKey.value = key
    activateLauncherDrag(event)
    event.preventDefault()
    return
  }
  longPressTimer = window.setTimeout(() => {
    if (!launcherPointer || launcherPointer.pointerId !== event.pointerId) return
    launcherPointer.active = true
    draggingKey.value = key
    editMode.value = true
    activateLauncherDrag(event)
    activeSheet.value = null
  }, 520)
}

function startPagePointer(event: PointerEvent) {
  if (activeSheet.value) return
  const target = event.target as HTMLElement | null
  if (target?.closest('.hm-remove')) return
  const item = target?.closest<HTMLElement>('[data-launcher-item]')
  if (item) {
    beginLauncherItemPointer(event, item)
    return
  }
  if (target?.closest('.hm-widget button,.hm-widget')) {
    beginBlankLongPress(event)
    return
  }
  beginBlankLongPress(event)
  startPageSwipe(event)
}

function startDockPointer(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.hm-dock-remove')) return
  const item = target?.closest<HTMLElement>('[data-launcher-item]')
  if (item) beginLauncherItemPointer(event, item)
}

function canTurnPage(direction: -1 | 1) {
  if (direction < 0) return currentPage.value > 0
  if (currentPage.value < actualPages.value.length - 1) return true
  return currentPage.value === actualPages.value.length - 1 && actualPages.value.length < MAX_HOME_PAGES
}

function queuePageTurn(direction: -1 | 1) {
  if (!launcherPointer?.active || !canTurnPage(direction)) return
  if (pageTurnTimer !== undefined) return
  pageTurnTimer = window.setTimeout(() => {
    pageTurnTimer = undefined
    if (!launcherPointer?.active) return

    if (direction > 0 && currentPage.value === actualPages.value.length - 1) {
      transientBlankPage.value = true
      currentPage.value = actualPages.value.length
    } else {
      currentPage.value = Math.max(0, Math.min(launcherPages.value.length - 1, currentPage.value + direction))
      if (currentPage.value < actualPages.value.length) transientBlankPage.value = false
    }
    pageSwipeOffset.value = 0
    clearDropTarget()
  }, 380)
}

function pageAt(index: number) {
  return launcherPages.value[index] ?? { items: [] }
}

function itemAtCell(page: HomeLayoutPage, x: number, y: number) {
  return page.items.find(item => x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h)
}

function updateDropTarget(event: PointerEvent) {
  const viewport = pageViewport.value
  if (!viewport || !launcherPointer?.active) return
  const viewportRect = viewport.getBoundingClientRect()
  const edge = Math.max(38, Math.min(52, viewportRect.width * 0.11))

  // 真机式边缘翻页：进入手机内容区域左右热区就开始计时，不需要把指针拖出手机。
  if (event.clientX <= viewportRect.left + edge && canTurnPage(-1)) queuePageTurn(-1)
  else if (event.clientX >= viewportRect.right - edge && canTurnPage(1)) queuePageTurn(1)
  else clearPageTurn()

  const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  const dockItem = hit?.closest<HTMLElement>('[data-launcher-kind="dock"]')
  const dockZone = hit?.closest<HTMLElement>('[data-launcher-zone="dock"]')
  if (dockItem || dockZone) {
    dropTargetKind.value = 'dock'
    const key = dockItem?.dataset.launcherItem as HomeAppKey | undefined
    dropTargetKey.value = key && key !== launcherPointer.key ? key : ''
    dropTargetPage.value = -1
    dropTargetX.value = -1
    dropTargetY.value = -1
    return
  }

  const grid = hit?.closest<HTMLElement>('[data-launcher-grid]')
  if (!grid) {
    clearDropTarget()
    return
  }

  const pageIndex = Number(grid.dataset.launcherPage ?? -1)
  if (!Number.isFinite(pageIndex) || pageIndex < 0) {
    clearDropTarget()
    return
  }

  const rect = grid.getBoundingClientRect()
  const relativeX = Math.max(0, Math.min(rect.width - 0.01, event.clientX - rect.left))
  const relativeY = Math.max(0, Math.min(rect.height - 0.01, event.clientY - rect.top))
  const x = Math.max(0, Math.min(HOME_GRID_COLUMNS - 1, Math.floor(relativeX / (rect.width / HOME_GRID_COLUMNS))))
  const y = Math.max(0, Math.min(HOME_GRID_ROWS - 1, Math.floor(relativeY / (rect.height / HOME_GRID_ROWS))))
  const occupant = itemAtCell(pageAt(pageIndex), x, y)

  if (occupant?.type === 'widget') {
    clearDropTarget()
    return
  }
  if (occupant?.type === 'app' && occupant.key === launcherPointer.key && launcherPointer.kind === 'home') {
    clearDropTarget()
    return
  }

  dropTargetKind.value = 'home'
  dropTargetKey.value = occupant?.type === 'app' ? occupant.key : ''
  dropTargetPage.value = pageIndex
  dropTargetX.value = x
  dropTargetY.value = y
}

function handlePointerMove(event: PointerEvent) {
  if (launcherPointer && launcherPointer.pointerId === event.pointerId) {
    const distance = Math.hypot(event.clientX - launcherPointer.startX, event.clientY - launcherPointer.startY)
    if (!launcherPointer.active) {
      if (distance > 9) {
        cancelHomeLongPress()
        launcherPointer = undefined
      }
      return
    }
    event.preventDefault()
    moveLauncherGhost(event)
    updateDropTarget(event)
    return
  }

  if (pageSwipe && pageSwipe.pointerId === event.pointerId) {
    movePageSwipe(event)
    return
  }

  if (longPressTimer !== undefined && Math.hypot(event.clientX - longPressStartX, event.clientY - longPressStartY) > 8) {
    cancelHomeLongPress()
  }
}

async function finishHomePointer(event?: PointerEvent, commit = true) {
  const pointer = launcherPointer
  if (!pointer) return

  if (pointer.active && commit) {
    if (dropTargetKind.value === 'home' && dropTargetPage.value >= 0 && dropTargetX.value >= 0 && dropTargetY.value >= 0) {
      await persistAppearance(moveHomeAppToGrid(
        appearance.value,
        pointer.key,
        dropTargetPage.value,
        dropTargetX.value,
        dropTargetY.value
      ))
      suppressAppClickUntil = performance.now() + 320
    } else if (dropTargetKind.value === 'dock') {
      await persistAppearance(moveHomeAppPlacement(
        appearance.value,
        pointer.key,
        'dock',
        dropTargetKey.value || undefined
      ))
      suppressAppClickUntil = performance.now() + 320
    }
  }

  resetLauncherPointer()
  if (event) event.preventDefault()
}

function goToPage(index: number) {
  currentPage.value = Math.max(0, Math.min(actualPages.value.length - 1, index))
  pageSwipeOffset.value = 0
  transientBlankPage.value = false
}

function startPageSwipe(event: PointerEvent) {
  if (activeSheet.value || launcherPointer) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button,a,input,textarea,select,[data-launcher-item],.hm-widget')) return
  pageSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    startedAt: performance.now()
  }
}

function movePageSwipe(event: PointerEvent) {
  if (!pageSwipe || pageSwipe.pointerId !== event.pointerId || launcherPointer?.active) return
  const dx = event.clientX - pageSwipe.startX
  const dy = event.clientY - pageSwipe.startY
  pageSwipe.lastX = event.clientX

  if (!pageSwiping.value) {
    if (Math.abs(dx) < 10) return
    if (Math.abs(dx) <= Math.abs(dy) * 1.1) return
    pageSwiping.value = true
    cancelHomeLongPress()
  }

  event.preventDefault()
  const viewportWidth = pageViewport.value?.clientWidth || 1
  let offset = dx
  if ((currentPage.value === 0 && dx > 0) || (currentPage.value === actualPages.value.length - 1 && dx < 0)) {
    offset *= 0.22
  }
  pageSwipeOffset.value = Math.max(-viewportWidth, Math.min(viewportWidth, offset))
}

function finishPageSwipe(event?: PointerEvent) {
  if (!pageSwipe || (event && pageSwipe.pointerId !== event.pointerId)) return
  if (pageSwiping.value) {
    const dx = pageSwipe.lastX - pageSwipe.startX
    const elapsed = Math.max(1, performance.now() - pageSwipe.startedAt)
    const velocity = dx / elapsed
    const viewportWidth = pageViewport.value?.clientWidth || 320
    const threshold = Math.min(72, viewportWidth * 0.18)
    if ((dx < -threshold || velocity < -0.45) && currentPage.value < actualPages.value.length - 1) currentPage.value += 1
    else if ((dx > threshold || velocity > 0.45) && currentPage.value > 0) currentPage.value -= 1
    suppressAppClickUntil = performance.now() + 320
  }
  pageSwipeOffset.value = 0
  pageSwiping.value = false
  pageSwipe = undefined
}

function cancelPageSwipe() {
  pageSwipeOffset.value = 0
  pageSwiping.value = false
  pageSwipe = undefined
}

function handlePointerUp(event: PointerEvent) {
  if (launcherPointer?.pointerId === event.pointerId) {
    void finishHomePointer(event, true)
    return
  }
  if (pageSwipe?.pointerId === event.pointerId) finishPageSwipe(event)
  else cancelHomeLongPress()
}

function handlePointerCancel(event: PointerEvent) {
  if (launcherPointer?.pointerId === event.pointerId) void finishHomePointer(event, false)
  if (pageSwipe?.pointerId === event.pointerId) cancelPageSwipe()
  cancelHomeLongPress()
}

function handleWindowBlur() {
  void finishHomePointer(undefined, false)
  cancelPageSwipe()
  cancelHomeLongPress()
}

const pageTrackStyle = computed(() => ({
  transform: `translate3d(${-currentPage.value * 100}%,0,0) translate3d(${pageSwipeOffset.value}px,0,0)`
}))

function finishEditing() {
  void finishHomePointer(undefined, false)
  cancelPageSwipe()
  editMode.value = false
  activeSheet.value = null
}

function openAppearance(section: 'customize' | 'wallpaper') {
  void router.push({ path: '/settings/appearance', query: { section } })
}

watch(() => actualPages.value.length, length => {
  if (currentPage.value >= length) currentPage.value = Math.max(0, length - 1)
})

onMounted(async () => {
  await loadHomeState()
  socialBadgeSubscription = liveQuery(() =>
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count()
  ).subscribe(count => { momentsUnread.value = count })
  minuteTimer = window.setInterval(() => { now.value = new Date() }, 30_000)

  window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
  window.addEventListener('pointerup', handlePointerUp, true)
  window.addEventListener('pointercancel', handlePointerCancel, true)
  window.addEventListener('blur', handleWindowBlur)
})

onUnmounted(() => {
  resetLauncherPointer()
  cancelPageSwipe()
  socialBadgeSubscription?.unsubscribe()
  if (minuteTimer !== undefined) window.clearInterval(minuteTimer)
  window.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('pointerup', handlePointerUp, true)
  window.removeEventListener('pointercancel', handlePointerCancel, true)
  window.removeEventListener('blur', handleWindowBlur)
})
</script>

<template>
  <PhoneFrame status-tone="dark" lock-scroll>
    <section class="hm-root" :class="{ 'is-editing': editMode }">
      <div class="hm-wall" :style="wallpaperStyle"></div>

      <div class="hm-main">
        <div v-if="editMode" class="hm-edit-toolbar">
          <div class="hm-edit-menu">
            <button type="button" @click="activeSheet = 'widgets'">
              <span>▣＋</span><b>添加小组件</b>
            </button>
            <button type="button" @click="openAppearance('customize')">
              <span>✣</span><b>自定义</b>
            </button>
            <button type="button" @click="openAppearance('wallpaper')">
              <span>❉</span><b>编辑墙纸</b>
            </button>
            <button type="button" @click="activeSheet = 'page'">
              <span>▦</span><b>编辑桌面</b>
            </button>
          </div>
          <button class="hm-done" type="button" @click="finishEditing">完成</button>
        </div>

        <div ref="pageViewport" class="hm-pages" :class="{ 'is-swiping': pageSwiping }" @pointerdown.stop="startPagePointer">
          <div class="hm-pages-track" :style="pageTrackStyle">
            <section
              v-for="(page, pageIndex) in launcherPages"
              :key="pageIndex"
              class="hm-page"
              :class="{ 'is-transient': pageIndex >= actualPages.length }"
              :data-launcher-page="pageIndex"
            >
              <div class="hm-launcher-grid" data-launcher-zone="home" data-launcher-grid :data-launcher-page="pageIndex">
                <template v-if="editMode || draggingKey">
                  <span
                    v-for="cell in HOME_GRID_COLUMNS * HOME_GRID_ROWS"
                    :key="`cell-${cell}`"
                    class="hm-grid-cell"
                    :class="{ 'is-drop-cell': isDropCell(pageIndex, cell - 1) }"
                    :style="gridCellStyle(cell - 1)"
                  ></span>
                </template>

                <template v-for="item in page.items" :key="item.id">
                  <article
                    v-if="item.type === 'widget'"
                    class="hm-widget"
                    :class="[`widget-${item.key}`, `style-${appearance.widgetStyle}`]"
                    :style="layoutStyle(item)"
                    @click="openWidget(item.key)"
                  >
                    <button
                      v-if="editMode"
                      class="hm-remove"
                      type="button"
                      :aria-label="`移除${widgetForKey(item.key)?.label || ''}小组件`"
                      @click.stop="removeWidget(item.key)"
                    >−</button>

                    <template v-if="item.key === 'greeting'">
                      <div class="widget-date">{{ dateLine }}</div>
                      <div class="widget-greeting">{{ greeting }}</div>
                      <div class="widget-caption">{{ worldName }} · {{ worldStateLabel }}</div>
                      <div class="widget-clock">{{ timeLine }}</div>
                    </template>

                    <template v-else-if="item.key === 'companion'">
                      <CharacterAvatar :avatar="latestCharacterAvatar" :name="latestCharacterName || '知间'" :size="45" />
                      <div class="widget-copy">
                        <small>最近的人</small>
                        <b>{{ latestCharacterName || '还没有联系人' }}</b>
                        <span>{{ latestCharacterName ? '继续刚才的对话' : '去知间认识一个人' }}</span>
                      </div>
                    </template>

                    <template v-else-if="item.key === 'world'">
                      <div class="world-orb">◎</div>
                      <div class="widget-copy">
                        <small>世界</small>
                        <b>{{ worldName }}</b>
                        <span>状态：{{ worldStateLabel }}</span>
                      </div>
                    </template>

                    <template v-else-if="item.key === 'music'">
                      <div class="music-art">
                        <AppIcon icon="music" :size="72" :tones="musicTones" />
                      </div>
                      <div class="music-copy">
                        <small>一起听</small>
                        <b>把声音留在这个世界里</b>
                        <span>打开音乐陪伴</span>
                      </div>
                      <span class="music-play">▶</span>
                    </template>
                  </article>

                  <div
                    v-else
                    class="hm-app-shell"
                    :class="{
                      'is-dragging': draggingKey === item.key,
                      'is-drop-target': dropTargetKind === 'home' && dropTargetKey === item.key
                    }"
                    :style="layoutStyle(item)"
                    :data-launcher-item="item.key"
                    data-launcher-kind="home"
                  >
                    <button class="hm-app" type="button" @click="openAppKey(item.key)">
                      <span class="hm-tile-wrap">
                        <AppIcon
                          :icon="appIconFor(item.key)"
                          :custom-image="appCustomImageFor(item.key)"
                          :tones="appToneFor(item.key)"
                          :size="homeIconSize"
                        />
                        <b v-if="appBadgeFor(item.key)" class="hm-badge">{{ appBadgeFor(item.key) > 99 ? '99+' : appBadgeFor(item.key) }}</b>
                      </span>
                      <span v-if="appearance.showAppLabels" class="hm-name">{{ appLabel(item.key) }}</span>
                    </button>
                    <button
                      v-if="editMode"
                      class="hm-remove hm-remove-app"
                      type="button"
                      :aria-label="`从桌面移除${appLabel(item.key)}`"
                      @click.stop="removeHomeApp(item.key)"
                    >−</button>
                  </div>
                </template>
              </div>
            </section>
          </div>
        </div>

        <div v-if="launcherPages.length > 1" class="hm-page-dots" aria-label="桌面分页">
          <button
            v-for="(_, index) in launcherPages"
            :key="index"
            type="button"
            :class="{ active: currentPage === index }"
            :aria-label="`第 ${index + 1} 页`"
            @click="index < actualPages.length && goToPage(index)"
          ></button>
        </div>

        <div class="hm-dock-holder" data-launcher-zone="dock" @pointerdown.stop="startDockPointer">
          <DockBar
            :apps="dockApps"
            :icon-size="dockIconSize"
            :show-labels="false"
            :editing="editMode"
            :dragging-key="draggingKey"
            :drop-target-key="dropTargetKind === 'dock' ? dropTargetKey : ''"
            @remove="removeDockApp"
          />
        </div>
      </div>

      <div v-if="activeSheet" class="hm-sheet-backdrop" @click.self="activeSheet = null">
        <section class="hm-sheet">
          <header>
            <div>
              <small>{{ activeSheet === 'widgets' ? '小组件库' : '桌面布局' }}</small>
              <h2>{{ activeSheet === 'widgets' ? '添加到当前主屏幕' : '选择显示位置' }}</h2>
            </div>
            <button type="button" aria-label="关闭" @click="activeSheet = null">×</button>
          </header>

          <div v-if="activeSheet === 'widgets'" class="widget-catalog">
            <button
              v-for="widget in WIDGET_CATALOG"
              :key="widget.key"
              type="button"
              class="widget-choice"
              :disabled="appearance.homeWidgetKeys.includes(widget.key)"
              @click="addWidget(widget.key)"
            >
              <span class="widget-sample" :class="`sample-${widget.key}`">
                <b v-if="widget.key === 'greeting'">{{ timeLine }}</b>
                <b v-else-if="widget.key === 'companion'">☺</b>
                <b v-else-if="widget.key === 'world'">◎</b>
                <b v-else>♪</b>
              </span>
              <span><b>{{ widget.label }}</b><small>{{ widget.description }}</small></span>
              <em>{{ appearance.homeWidgetKeys.includes(widget.key) ? '已添加' : '＋' }}</em>
            </button>
            <p v-if="availableWidgets.length === 0" class="sheet-note">所有小组件都已经在主屏幕上了。</p>
          </div>

          <div v-else class="page-editor">
            <div class="page-editor-head">
              <span>App</span><span>桌面</span><span>Dock</span>
            </div>
            <div v-for="app in CUSTOMIZABLE_APPS" :key="app.key" class="page-app-row">
              <div class="page-app-name">
                <AppIcon :icon="app.icon" :custom-image="customIcons[app.key]" :tones="app.tone" :size="35" />
                <span>{{ app.label }}</span>
              </div>
              <button type="button" class="place-toggle" :class="{ on: desktopAppSet.has(app.key) }" @click="toggleDesktopApp(app.key)">
                {{ desktopAppSet.has(app.key) ? '✓' : '＋' }}
              </button>
              <button
                type="button"
                class="place-toggle"
                :class="{ on: dockAppSet.has(app.key) }"
                :disabled="!dockAppSet.has(app.key) && appearance.dockAppKeys.length >= 4"
                @click="toggleDockApp(app.key)"
              >
                {{ dockAppSet.has(app.key) ? '✓' : '＋' }}
              </button>
            </div>
            <p class="sheet-note">页面由 4×6 网格自动管理。把 App 拖到手机内部左右边缘可换页；在最后一页继续向右拖会临时出现新页，只有真正放入内容后才保存。</p>
          </div>
        </section>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.hm-root{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden;color:#253b4e;background:linear-gradient(165deg,#f7fcff 0%,#e9f5fe 43%,#dbeaf7 100%)}
.hm-wall{position:absolute;inset:0;z-index:0;overflow:hidden;background:radial-gradient(120% 75% at 86% -12%,rgba(255,255,255,.96) 0%,rgba(226,244,255,.68) 38%,transparent 66%),radial-gradient(120% 82% at -20% 112%,rgba(192,225,248,.72) 0%,transparent 66%),linear-gradient(165deg,#f7fcff 0%,#e9f5fe 43%,#dbeaf7 100%);background-repeat:no-repeat}
.hm-main{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:0;touch-action:none;contain:layout paint}
.hm-pages{position:relative;flex:1;min-height:0;width:100%;overflow:hidden;touch-action:none;overscroll-behavior:none;contain:layout paint}
.hm-pages-track{display:flex;width:100%;height:100%;will-change:transform;transition:transform .28s cubic-bezier(.22,.76,.24,1);backface-visibility:hidden}
.hm-pages.is-swiping .hm-pages-track{transition:none}
.hm-page{position:relative;flex:0 0 100%;width:100%;height:100%;min-height:0;overflow:hidden;contain:layout paint}
.hm-page.is-transient{background:rgba(255,255,255,.035)}
.hm-launcher-grid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr));column-gap:8px;row-gap:8px;width:100%;height:100%;padding:16px 18px 8px;box-sizing:border-box;overflow:hidden}
.hm-grid-cell{position:relative;z-index:0;border-radius:19px;pointer-events:none;transition:background .14s ease,box-shadow .14s ease}
.is-editing .hm-grid-cell{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.11)}
.hm-grid-cell.is-drop-cell{background:rgba(255,255,255,.35);box-shadow:inset 0 0 0 1.5px rgba(80,120,150,.35)}
.hm-widget{position:relative;z-index:2;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(255,255,255,.52);border-radius:24px;box-shadow:0 12px 27px rgba(42,74,98,.12),inset 0 1px 0 rgba(255,255,255,.45);cursor:pointer}
.hm-widget.style-frosted{background:rgba(247,251,254,.6);backdrop-filter:blur(24px) saturate(1.12);-webkit-backdrop-filter:blur(24px) saturate(1.12)}
.hm-widget.style-clear{background:rgba(255,255,255,.22);backdrop-filter:blur(7px) saturate(1.08);-webkit-backdrop-filter:blur(7px) saturate(1.08)}
.hm-widget.style-solid{background:#f8fbfd}
.widget-greeting{position:absolute;left:18px;bottom:38px;font-size:27px;line-height:1;font-weight:760;letter-spacing:-.04em}.widget-date{position:absolute;left:18px;top:17px;color:#6d8292;font-size:11px}.widget-caption{position:absolute;left:18px;bottom:16px;color:#6f8494;font-size:10px}.widget-clock{position:absolute;right:17px;top:14px;font-size:27px;font-weight:620;letter-spacing:-.04em;color:#4c6679}
.widget-companion,.widget-world{padding:14px;display:flex;flex-direction:column;justify-content:space-between}.widget-copy{display:grid;gap:2px;min-width:0}.widget-copy small,.music-copy small{color:#8396a5;font-size:9px}.widget-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.widget-copy span,.music-copy span{color:#7b8e9d;font-size:9px}.world-orb{display:grid;place-items:center;width:45px;height:45px;border-radius:15px;background:linear-gradient(145deg,#87b8dc,#c4def0);color:white;font-size:29px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.widget-music{display:flex;align-items:center;gap:12px;padding:15px 16px}.music-art{display:grid;place-items:center;width:72px;height:72px;flex:0 0 auto}.music-copy{display:grid;gap:3px;min-width:0;flex:1}.music-copy b{font-size:14px;line-height:1.35}.music-play{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:rgba(255,255,255,.8);color:#6f7fc4;font-size:12px}
.hm-app-shell{position:relative;z-index:3;display:grid;place-items:center;min-width:0;min-height:0;transition:transform .16s ease,opacity .16s ease,filter .16s ease}.hm-app-shell.is-dragging{opacity:.18;filter:saturate(.7)}.hm-app-shell.is-drop-target{transform:scale(.92)}
.hm-app{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:0;border:0;background:transparent;cursor:pointer;color:inherit}.hm-tile-wrap{position:relative;display:grid;place-items:center}.hm-badge{position:absolute;z-index:3;right:-6px;top:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:11px;background:#ff4b57;color:#fff;font-size:10px;line-height:20px;text-align:center;font-weight:760;border:1.5px solid rgba(255,255,255,.92)}.hm-name{max-width:72px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#2e4659;white-space:nowrap;text-shadow:0 1px 8px rgba(255,255,255,.7)}
.hm-drag-ghost{position:fixed!important;z-index:9999!important;margin:0!important;pointer-events:none!important;opacity:.94!important;transform:scale(1.06)!important;transform-origin:center!important;filter:drop-shadow(0 16px 18px rgba(32,50,65,.22));transition:none!important}.hm-drag-ghost .hm-app,.hm-drag-ghost .dock-app{animation:none!important}.launcher-source-dragging{opacity:.18!important}
.hm-page-dots{display:flex;flex:0 0 auto;justify-content:center;gap:7px;padding:7px 0 9px}.hm-page-dots button{width:6px;height:6px;padding:0;border:0;border-radius:50%;background:rgba(63,81,95,.28)}.hm-page-dots button.active{background:rgba(42,62,78,.72)}
.hm-dock-holder{flex:0 0 auto;padding:0 21px 10px}
.hm-edit-toolbar{position:absolute;z-index:25;inset:8px 0 auto;display:flex;align-items:flex-start;justify-content:space-between;pointer-events:none}.hm-done{pointer-events:auto;margin-right:2px;padding:7px 15px;border:1px solid rgba(255,255,255,.55);border-radius:999px;background:rgba(248,250,252,.6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:#2d4050;font-size:13px;font-weight:700;box-shadow:0 7px 20px rgba(28,47,62,.12)}.hm-edit-menu{pointer-events:auto;width:225px;overflow:hidden;border:1px solid rgba(255,255,255,.54);border-radius:24px;background:rgba(248,247,246,.72);backdrop-filter:blur(28px) saturate(1.15);-webkit-backdrop-filter:blur(28px) saturate(1.15);box-shadow:0 18px 42px rgba(28,45,58,.18)}.hm-edit-menu button{width:100%;height:51px;padding:0 16px;border:0;border-bottom:1px solid rgba(73,84,93,.08);background:transparent;display:flex;align-items:center;gap:13px;text-align:left;color:#202a31}.hm-edit-menu button:last-child{border-bottom:0}.hm-edit-menu button span{width:26px;text-align:center;font-size:20px}.hm-edit-menu button b{font-size:14px;font-weight:620}
.hm-remove{position:absolute;z-index:15;left:-7px;top:-7px;width:24px;height:24px;border:1px solid rgba(255,255,255,.72);border-radius:50%;background:rgba(119,127,135,.9);color:#fff;font-size:20px;line-height:20px;display:grid;place-items:center;box-shadow:0 3px 10px rgba(24,39,52,.2)}.hm-remove-app{left:2px;top:2px}.is-editing .hm-widget,.is-editing .hm-app{animation:home-jiggle .18s ease-in-out infinite alternate}.is-editing .hm-app-shell:nth-child(even) .hm-app,.is-editing .hm-widget:nth-child(even){animation-direction:alternate-reverse}
.hm-sheet-backdrop{position:absolute;z-index:40;inset:0;display:flex;align-items:flex-end;background:rgba(24,35,43,.16);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}.hm-sheet{width:100%;max-height:68%;overflow:hidden;border-radius:28px 28px 0 0;background:#f7f9fb;box-shadow:0 -18px 48px rgba(24,45,61,.2)}.hm-sheet header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 13px;border-bottom:1px solid #e8edf1}.hm-sheet header small{color:#8798a5;font-size:9px}.hm-sheet header h2{margin:2px 0 0;font-size:20px;letter-spacing:-.02em}.hm-sheet header button{width:32px;height:32px;border:0;border-radius:50%;background:#e8edf1;color:#536979;font-size:21px}
.widget-catalog,.page-editor{max-height:430px;overflow:auto;padding:12px 14px 24px}.widget-choice{width:100%;min-height:72px;display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:12px;padding:9px 10px;border:0;border-bottom:1px solid #e9eef1;background:transparent;text-align:left;color:#304759}.widget-choice:disabled{opacity:.46}.widget-choice>span:nth-child(2){display:grid;gap:3px}.widget-choice>span:nth-child(2) b{font-size:13px}.widget-choice>span:nth-child(2) small{color:#8495a2;font-size:9px;line-height:1.4}.widget-choice em{font-style:normal;font-size:18px;color:#5d91b6}.widget-sample{display:grid;place-items:center;width:58px;height:50px;border-radius:15px;background:linear-gradient(145deg,#e8f2f8,#fff);box-shadow:inset 0 0 0 1px rgba(80,109,131,.07);color:#5e7b91}.sample-music{background:linear-gradient(145deg,#dfe2f7,#f7f8ff);color:#7783c8}
.page-editor-head,.page-app-row{display:grid;grid-template-columns:1fr 58px 58px;align-items:center;gap:8px}.page-editor-head{padding:3px 5px 8px;color:#8c9aa5;font-size:9px;text-align:center}.page-editor-head span:first-child{text-align:left}.page-app-row{min-height:58px;border-top:1px solid #e9eef1}.page-app-name{display:flex;align-items:center;gap:9px;min-width:0}.page-app-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.place-toggle{justify-self:center;width:32px;height:32px;border:0;border-radius:50%;background:#e8edf1;color:#7a8b97;font-size:15px}.place-toggle.on{background:#dff3ea;color:#159a63;font-weight:800}.place-toggle:disabled{opacity:.32}.sheet-note{margin:12px 4px 0;color:#8d9ba6;font-size:9px;line-height:1.55}
@keyframes home-jiggle{from{transform:rotate(-.65deg) translateY(0)}to{transform:rotate(.65deg) translateY(.4px)}}
@media(max-width:360px){.hm-launcher-grid{padding-left:14px;padding-right:14px;column-gap:5px}.hm-dock-holder{padding-left:17px;padding-right:17px}.hm-name{font-size:10px}.hm-edit-menu{width:205px}}
</style>
