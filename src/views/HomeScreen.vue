<script setup lang="ts">
import { liveQuery } from 'dexie'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
  addHomeAppToFolder,
  addHomeWidgetToGrid,
  createHomeFolder,
  collapseHomeLayoutPageIntoPrevious,
  applyHomeThemePreset,
  getHomeAppDefinition,
  getWidgetGridSizes,
  inspectHomeLayout,
  listAppCustomizations,
  loadHomeAppearance,
  moveHomeAppPlacement,
  moveHomeFolderAppToDock,
  moveHomeFolderAppToGrid,
  moveHomeLayoutItemToGrid,
  resizeHomeWidgetInGrid,
  removeHomeAppFromFolder,
  renameHomeFolder,
  repairHomeLayoutIntegrity,
  reorderHomeFolderApps,
  removeHomeLayoutPages,
  resolveDockApps,
  saveHomeAppearance,
  updateHomeWidgetSettings,
  type HomeAppDefinition,
  type HomeAppKey,
  type HomeAppearancePreferences,
  type HomeLayoutFolderItem,
  type HomeLayoutItem,
  type HomeLayoutPage,
  type HomePlacement,
  type HomeThemePreset,
  type HomeWidgetKey
} from '../services/appCustomizationService'
import { parseHomeLayoutBackup, serializeHomeLayoutBackup } from '../services/homeLayoutBackup'
import type { MusicState } from '../types/domain'

const router = useRouter()

const chatUnread = ref(0)
const momentsUnread = ref(0)
const worldName = ref('草莓云世界')
const worldId = ref('world-default')
const worldStateLabel = ref('日常')
const latestCharacterName = ref('')
const latestCharacterAvatar = ref('🌍')
const latestConversationId = ref('')
const musicState = ref<MusicState>()
const musicAudio = ref<HTMLAudioElement | null>(null)
const musicPlaybackActive = ref(false)
const musicPlaybackError = ref('')
const customIcons = ref<Record<string, string>>({})
const appearance = ref<HomeAppearancePreferences>(structuredClone(DEFAULT_HOME_APPEARANCE))
const dragPreviewAppearance = ref<HomeAppearancePreferences>()
const now = ref(new Date())
const musicTones: [string, string] = ['#8f9cde', '#b9c4ef']

const editMode = ref(false)
const editMenuOpen = ref(false)
const activeSheet = ref<'widgets' | 'pages' | 'apps' | 'widget' | 'theme' | 'layout-backup' | 'diagnostics' | null>(null)
const editingWidgetKey = ref<HomeWidgetKey | ''>('')
const photoInput = ref<HTMLInputElement | null>(null)
const layoutImportInput = ref<HTMLInputElement | null>(null)
const layoutBackupMessage = ref('')
const layoutDiagnosticMessage = ref('')
const layoutDiagnosticSnapshot = ref<{
  capturedAt: string
  revision: number
  currentPage: number
  pageCount: number
  dockAppKeys: string[]
  issues: string[]
  pages: Array<{
    pageIndex: number
    itemCount: number
    occupiedCells: number
    issues: string[]
    items: Array<{
      id: string
      type: string
      key: string
      label: string
      x: number
      y: number
      w: number
      h: number
      issues: string[]
      domPresent: boolean
      painted: boolean | null
      proofClass?: string
      rect?: { left: number; top: number; width: number; height: number }
    }>
  }>
} | null>(null)
const openFolderId = ref('')
const pageViewport = ref<HTMLElement | null>(null)
const pageSwipeOffset = ref(0)
const pageSwiping = ref(false)
const currentPage = ref(0)
const transientBlankPage = ref(false)

const draggingId = ref('')
const dropTargetKey = ref<HomeAppKey | ''>('')
const dropTargetItemId = ref('')
const dropTargetFolderId = ref('')
const dropTargetKind = ref<HomePlacement | 'folder' | 'folder-order' | ''>('')
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
  itemType: 'app' | 'widget' | 'folder'
  key: string
  kind: HomePlacement
  originFolderId?: string
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
let dragPreviewSignature = ''
let dragPreviewAnimationToken = 0
let socialBadgeSubscription: { unsubscribe: () => void } | undefined
let musicStateSubscription: { unsubscribe: () => void } | undefined
let minuteTimer: number | undefined
let repairingRenderedPages = false
let longPressStartX = 0
let longPressStartY = 0
const blankPageRepairStrikes = new Map<string, number>()
const GHOST_PAGE_RECOVERY_PREFIX = 'companion-home-ghost-page:'

const renderedAppearance = computed(() => draggingId.value && dragPreviewAppearance.value ? dragPreviewAppearance.value : appearance.value)
const actualPages = computed<HomeLayoutPage[]>(() => {
  const nonEmpty = renderedAppearance.value.homeLayoutPages.filter(page => page.items.length > 0)
  return nonEmpty.length ? nonEmpty : [{ items: [] }]
})
const launcherPages = computed<HomeLayoutPage[]>(() => {
  // 临时空白页只服务于“正在编辑并拖拽到最后一页右边缘”的那一瞬间。
  // 稳定页在 UI 层也再次过滤空页，避免历史脏数据继续显示分页圆点。
  const canExposeTransientPage = transientBlankPage.value
    && editMode.value
    && Boolean(draggingId.value)
    && !dragPreviewAppearance.value
    && actualPages.value.length < MAX_HOME_PAGES

  return canExposeTransientPage
    ? [...actualPages.value, { items: [] }]
    : actualPages.value
})
const clampCurrentPageToPersistedLayout = () => {
  const pageCount = Math.max(1, actualPages.value.length)
  if (currentPage.value >= pageCount) currentPage.value = pageCount - 1
  if (currentPage.value < 0) currentPage.value = 0
}

watch(() => actualPages.value.length, () => {
  // 拖拽预览允许页面数量暂时变化；真正松手后再收敛页索引，
  // 避免在手指还按着时突然把当前页抢回前一页。
  if (draggingId.value) return
  transientBlankPage.value = false
  clampCurrentPageToPersistedLayout()
})

watch(
  () => appearance.value.homeLayoutPages.map(page => page.items.map(item => item.id).join(',')).join('|'),
  () => {
    if (!draggingId.value && !editMode.value) void repairRenderedEmptyPages()
  },
  { flush: 'post' }
)

watch([editMode, draggingId], ([editing, dragging]) => {
  if (editing && dragging) return
  transientBlankPage.value = false
  clampCurrentPageToPersistedLayout()
})

const dockApps = computed(() => resolveDockApps(appearance.value).map(enrichApp))
const draggingAppKey = computed(() => launcherPointer?.itemType === 'app' ? String(launcherPointer.key) : '')
const availableWidgets = computed(() => WIDGET_CATALOG.filter(widget => !appearance.value.homeWidgetKeys.includes(widget.key)))
const desktopAppSet = computed(() => new Set(appearance.value.homeAppKeys))
const dockAppSet = computed(() => new Set(appearance.value.dockAppKeys))
const HOME_THEME_PRESETS: HomeThemePreset[] = ['default', 'dark', 'clear', 'tinted']
const editingWidgetDefinition = computed(() => editingWidgetKey.value ? widgetForKey(editingWidgetKey.value) : undefined)
const editingWidgetSizes = computed(() => editingWidgetKey.value ? getWidgetGridSizes(editingWidgetKey.value) : [])
const editingWidgetLayout = computed(() => editingWidgetKey.value ? appearance.value.homeLayoutPages
  .flatMap(page => page.items)
  .find(item => item.type === 'widget' && item.key === editingWidgetKey.value) : undefined)

const openFolder = computed<HomeLayoutFolderItem | undefined>(() => {
  if (!openFolderId.value) return undefined
  return appearance.value.homeLayoutPages
    .flatMap(page => page.items)
    .find((item): item is HomeLayoutFolderItem => item.type === 'folder' && item.id === openFolderId.value)
})

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

const calendarDay = computed(() => String(now.value.getDate()).padStart(2, '0'))
const calendarMonth = computed(() => `${now.value.getMonth() + 1}月`)
const calendarWeekday = computed(() => now.value.toLocaleDateString('zh-CN', { weekday: 'short' }))

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

  const [conversations, savedIcons, savedAppearance, unreadMomentNotifications, musicStates] = await Promise.all([
    db.conversations.toArray(),
    listAppCustomizations(worldId.value),
    loadHomeAppearance(worldId.value),
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count(),
    db.musicStates.toArray()
  ])
  momentsUnread.value = unreadMomentNotifications
  musicState.value = [...musicStates].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]
  chatUnread.value = conversations.reduce((sum, conversation) => sum + Number(conversation.unread || 0), 0)
  customIcons.value = Object.fromEntries(
    savedIcons.filter(item => item.iconDataUrl).map(item => [item.appKey, item.iconDataUrl as string])
  )
  appearance.value = savedAppearance
  void repairRenderedEmptyPages()
  window.setTimeout(() => { void repairCurrentBlankPage() }, 380)

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
  if (performance.now() < suppressAppClickUntil) return
  if (editMode.value) {
    editingWidgetKey.value = key
    editMenuOpen.value = false
    activeSheet.value = 'widget'
    return
  }
  if (key === 'companion') {
    void router.push(latestConversationId.value ? `/chat/${latestConversationId.value}` : '/chat')
    return
  }
  if (key === 'world') {
    void router.push('/world')
    return
  }
  if (key === 'music') {
    void router.push('/app/音乐')
    return
  }
}

async function persistLatestMusicState(patch: Partial<Pick<MusicState, 'isPlaying' | 'currentTime'>>) {
  const current = musicState.value
  if (!current) return
  const next: MusicState = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  }
  musicState.value = next
  await db.musicStates.put(next)
}

async function toggleMusicPlayback(event?: Event) {
  event?.stopPropagation()
  if (editMode.value) return
  const state = musicState.value
  const audio = musicAudio.value
  musicPlaybackError.value = ''

  // 还没有可直接播放的音频时，播放键就是“去音乐里选一首”的明确入口。
  if (!state?.audioUrl || !audio) {
    openWidget('music')
    return
  }

  try {
    if (audio.getAttribute('src') !== state.audioUrl) {
      audio.src = state.audioUrl
      audio.volume = Math.max(0, Math.min(1, Number(state.volume ?? 1)))
      if (Number.isFinite(state.currentTime) && state.currentTime > 0) audio.currentTime = state.currentTime
    }

    if (musicPlaybackActive.value && !audio.paused) {
      audio.pause()
      musicPlaybackActive.value = false
      await persistLatestMusicState({ isPlaying: false, currentTime: audio.currentTime || 0 })
      return
    }

    await audio.play()
    musicPlaybackActive.value = true
    await persistLatestMusicState({ isPlaying: true, currentTime: audio.currentTime || state.currentTime || 0 })
  } catch {
    musicPlaybackActive.value = false
    musicPlaybackError.value = '这首歌暂时不能直接播放，点组件进入音乐页。'
    await persistLatestMusicState({ isPlaying: false })
  }
}

function handleMusicAudioEnded() {
  musicPlaybackActive.value = false
  void persistLatestMusicState({ isPlaying: false, currentTime: 0 })
}


function openFolderItem(folder: HomeLayoutFolderItem) {
  if (performance.now() < suppressAppClickUntil) return
  openFolderId.value = folder.id
  editMenuOpen.value = false
  activeSheet.value = null
}

async function moveAppOutOfFolder(appKey: HomeAppKey) {
  const folder = openFolder.value
  if (!folder) return
  await persistAppearance(removeHomeAppFromFolder(appearance.value, folder.id, appKey, currentPage.value))
  if (!appearance.value.homeLayoutPages.some(page => page.items.some(item => item.type === 'folder' && item.id === folder.id))) {
    openFolderId.value = ''
  }
}

async function updateFolderName(name: string) {
  const folder = openFolder.value
  if (!folder) return
  await persistAppearance(renameHomeFolder(appearance.value, folder.id, name))
}

function handleFolderNameChange(event: Event) {
  const input = event.target as HTMLInputElement | null
  if (input) void updateFolderName(input.value)
}

function openFolderApp(key: HomeAppKey) {
  if (editMode.value) return
  openFolderId.value = ''
  openAppKey(key)
}

async function persistAppearance(next: HomeAppearancePreferences) {
  appearance.value = await saveHomeAppearance(worldId.value, next)
}

async function repairRenderedEmptyPages() {
  if (repairingRenderedPages || editMode.value || draggingId.value || dragPreviewAppearance.value) return
  // 稳定 HomeLayout 理论上不会含 items=[] 的页；这里仅清理历史脏数据。
  // 不再根据“离屏页面的 DOM 盒子”判断可见性，否则横向分页时会把正常离屏页误判。
  const emptyIndexes = appearance.value.homeLayoutPages
    .map((page, index) => page.items.length === 0 ? index : -1)
    .filter(index => index >= 0)
  if (!emptyIndexes.length) return
  repairingRenderedPages = true
  try {
    appearance.value = await saveHomeAppearance(
      worldId.value,
      removeHomeLayoutPages(appearance.value, emptyIndexes)
    )
    transientBlankPage.value = false
    clampCurrentPageToPersistedLayout()
  } finally {
    repairingRenderedPages = false
  }
}


function launcherItemVisualProofTarget(element: HTMLElement) {
  if (element.classList.contains('hm-app-shell')) {
    return element.querySelector<HTMLElement>('.app-icon') || element.querySelector<HTMLElement>('.hm-tile-wrap') || element
  }
  if (element.classList.contains('hm-folder-shell')) {
    return element.querySelector<HTMLElement>('.hm-folder-tile') || element
  }
  return element
}

function elementChainIsVisible(element: HTMLElement, stopAt: HTMLElement) {
  let current: HTMLElement | null = element
  let opacity = 1
  while (current) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    opacity *= Number(style.opacity || 1)
    if (opacity <= 0.05) return false
    if (current === stopAt) break
    current = current.parentElement
  }
  return true
}

function launcherItemIsActuallyPainted(element: HTMLElement, pageElement: HTMLElement) {
  const proof = launcherItemVisualProofTarget(element)
  const style = window.getComputedStyle(proof)
  const rect = proof.getBoundingClientRect()
  const pageRect = pageElement.getBoundingClientRect()
  const intersectsPage = rect.right > pageRect.left + 1 && rect.left < pageRect.right - 1 && rect.bottom > pageRect.top + 1 && rect.top < pageRect.bottom - 1
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) <= 0.05 || rect.width <= 1 || rect.height <= 1 || !intersectsPage) return false
  if (!elementChainIsVisible(proof, pageElement)) return false

  // 透明 shell 本身能被 elementFromPoint 命中，但不代表图标真的画出来。
  // App / Folder 改为采样实际 icon/tile；Widget 自己有可见背景，因此直接采样 Widget。
  const insetX = Math.min(10, rect.width * 0.2)
  const insetY = Math.min(10, rect.height * 0.2)
  const samples = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
    [rect.left + insetX, rect.top + insetY],
    [rect.right - insetX, rect.top + insetY],
    [rect.left + insetX, rect.bottom - insetY],
    [rect.right - insetX, rect.bottom - insetY]
  ]
  return samples.some(([x, y]) => {
    if (x < pageRect.left || x > pageRect.right || y < pageRect.top || y > pageRect.bottom) return false
    const top = document.elementFromPoint(x, y)
    return Boolean(top && (top === proof || proof.contains(top)))
  })
}

function ghostPageSignature(page: HomeLayoutPage, index: number) {
  return `${index}:${page.items.map(item => `${item.id}@${item.x},${item.y},${item.w},${item.h}`).join('|')}`
}

function backupGhostPageForRecovery(page: HomeLayoutPage, index: number) {
  try {
    localStorage.setItem(`${GHOST_PAGE_RECOVERY_PREFIX}${worldId.value}`, JSON.stringify({
      version: 1,
      appVersion: '0.5.0-alpha.5.1.24',
      capturedAt: new Date().toISOString(),
      pageIndex: index,
      page
    }))
  } catch {
    // Recovery 是额外保险；浏览器禁用 localStorage 时不阻断 Launcher 自愈。
  }
}

async function forceQuarantineBlankPage(index: number) {
  const page = appearance.value.homeLayoutPages[index]
  if (!page || index <= 0) return false
  backupGhostPageForRecovery(page, index)
  const next = removeHomeLayoutPages(appearance.value, [index])
  if (JSON.stringify(next.homeLayoutPages) === JSON.stringify(appearance.value.homeLayoutPages)) return false
  appearance.value = await saveHomeAppearance(worldId.value, next)
  transientBlankPage.value = false
  clampCurrentPageToPersistedLayout()
  return true
}

async function repairCurrentBlankPage(force = false) {
  if (repairingRenderedPages || editMode.value || draggingId.value) return
  await nextTick()
  const index = currentPage.value
  if (appearance.value.homeLayoutPages.length <= 1 || index <= 0 || index >= appearance.value.homeLayoutPages.length) return
  const viewport = pageViewport.value
  const pageElement = viewport?.querySelector<HTMLElement>(`.hm-page[data-launcher-page="${index}"]:not(.is-transient)`)
  if (!pageElement) return
  const renderedItems = Array.from(pageElement.querySelectorAll<HTMLElement>('[data-launcher-item]'))
  const hasVisibleItem = renderedItems.some(element => launcherItemIsActuallyPainted(element, pageElement))
  const page = appearance.value.homeLayoutPages[index]
  const signature = ghostPageSignature(page, index)
  if (hasVisibleItem && !force) {
    blankPageRepairStrikes.delete(signature)
    return
  }

  repairingRenderedPages = true
  try {
    const repaired = page?.items.length
      ? collapseHomeLayoutPageIntoPrevious(appearance.value, index)
      : removeHomeLayoutPages(appearance.value, [index])

    if (JSON.stringify(repaired.homeLayoutPages) !== JSON.stringify(appearance.value.homeLayoutPages)) {
      appearance.value = await saveHomeAppearance(worldId.value, repaired)
      blankPageRepairStrikes.delete(signature)
      transientBlankPage.value = false
      clampCurrentPageToPersistedLayout()
      return
    }

    // 到这里说明：页面视觉上是空白，但“安全搬回前页”仍无法完成。
    // 连续两次确认后，把这页从 Launcher 隐藏/回收；原始 page JSON 会先写入本地恢复槽，
    // 所以不会因为 UI 自愈而不可逆丢失 underlying App/Widget 配置。
    const strikes = force ? 2 : (blankPageRepairStrikes.get(signature) || 0) + 1
    blankPageRepairStrikes.set(signature, strikes)
    if (strikes >= 2) {
      await forceQuarantineBlankPage(index)
      blankPageRepairStrikes.delete(signature)
      return
    }
    window.setTimeout(() => { void repairCurrentBlankPage() }, 420)
  } finally {
    repairingRenderedPages = false
  }
}


async function refreshLayoutDiagnostics() {
  await nextTick()
  const structural = inspectHomeLayout(appearance.value)
  const viewport = pageViewport.value
  const pages = structural.pages.map(page => {
    const pageElement = viewport?.querySelector<HTMLElement>(`.hm-page[data-launcher-page="${page.pageIndex}"]:not(.is-transient)`) || null
    const domItems = pageElement
      ? Array.from(pageElement.querySelectorAll<HTMLElement>('[data-launcher-item]'))
      : []
    const domById = new Map(domItems.map(element => [element.dataset.launcherItem || '', element]))
    return {
      ...page,
      items: page.items.map(item => {
        const element = domById.get(item.id)
        const proof = element && pageElement ? launcherItemVisualProofTarget(element) : undefined
        const rect = proof?.getBoundingClientRect()
        return {
          ...item,
          domPresent: Boolean(element),
          painted: page.pageIndex === currentPage.value && element && pageElement
            ? launcherItemIsActuallyPainted(element, pageElement)
            : null,
          proofClass: proof?.className || undefined,
          rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : undefined
        }
      })
    }
  })
  layoutDiagnosticSnapshot.value = {
    capturedAt: new Date().toISOString(),
    revision: structural.revision,
    currentPage: currentPage.value,
    pageCount: structural.pageCount,
    dockAppKeys: structural.dockAppKeys,
    issues: structural.issues,
    pages
  }
}

async function openLayoutDiagnostics() {
  activeSheet.value = 'diagnostics'
  editMenuOpen.value = false
  layoutDiagnosticMessage.value = ''
  await refreshLayoutDiagnostics()
}

async function copyLayoutDiagnostics() {
  await refreshLayoutDiagnostics()
  if (!layoutDiagnosticSnapshot.value) return
  await navigator.clipboard.writeText(JSON.stringify(layoutDiagnosticSnapshot.value, null, 2))
  layoutDiagnosticMessage.value = '布局诊断 JSON 已复制。'
}

async function repairLayoutStructure() {
  appearance.value = await saveHomeAppearance(worldId.value, repairHomeLayoutIntegrity(appearance.value))
  transientBlankPage.value = false
  clampCurrentPageToPersistedLayout()
  layoutDiagnosticMessage.value = '已清理 Dock/桌面重复项、重复 App/Widget 与空页。'
  await refreshLayoutDiagnostics()
}

async function quarantineCurrentVisualBlankPage() {
  if (currentPage.value <= 0) {
    layoutDiagnosticMessage.value = '第一页不会被诊断器直接回收。'
    return
  }
  await nextTick()
  const pageElement = pageViewport.value?.querySelector<HTMLElement>(`.hm-page[data-launcher-page="${currentPage.value}"]:not(.is-transient)`)
  if (!pageElement) {
    layoutDiagnosticMessage.value = '找不到当前页 DOM。'
    return
  }
  const renderedItems = Array.from(pageElement.querySelectorAll<HTMLElement>('[data-launcher-item]'))
  const visible = renderedItems.filter(element => launcherItemIsActuallyPainted(element, pageElement))
  if (visible.length) {
    layoutDiagnosticMessage.value = `当前页检测到 ${visible.length} 个真实可见项目，不会强制回收。`
    await refreshLayoutDiagnostics()
    return
  }
  const removed = await forceQuarantineBlankPage(currentPage.value)
  layoutDiagnosticMessage.value = removed ? '当前视觉空白页已备份后回收。' : '未能回收当前页；请复制诊断 JSON。'
  await refreshLayoutDiagnostics()
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



async function chooseWidgetSize(key: HomeWidgetKey, w: number, h: number) {
  await persistAppearance(resizeHomeWidgetInGrid(appearance.value, key, w, h))
}

async function applyThemePreset(preset: HomeThemePreset) {
  await persistAppearance(applyHomeThemePreset(appearance.value, preset))
}

function requestPhoto() {
  photoInput.value?.click()
}

async function handlePhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取照片失败'))
    reader.readAsDataURL(file)
  })
  await persistAppearance(updateHomeWidgetSettings(appearance.value, 'photo', { imageDataUrl: dataUrl }))
}

function exportLayoutBackup() {
  const text = serializeHomeLayoutBackup(appearance.value)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `zhijian-home-layout-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
  layoutBackupMessage.value = '桌面布局已导出。'
}

function requestLayoutImport() {
  layoutImportInput.value?.click()
}

async function handleLayoutImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const next = parseHomeLayoutBackup(await file.text())
    await persistAppearance(next)
    currentPage.value = 0
    layoutBackupMessage.value = '桌面布局已通过 Schema 校验并恢复。'
  } catch (error) {
    layoutBackupMessage.value = error instanceof Error ? error.message : '桌面布局导入失败。'
  }
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

function captureLauncherRects() {
  const root = pageViewport.value
  const rects = new Map<string, DOMRect>()
  root?.querySelectorAll<HTMLElement>('[data-launcher-item]').forEach(node => {
    const id = node.dataset.launcherItem
    if (id) rects.set(id, node.getBoundingClientRect())
  })
  return rects
}

function animateLauncherReflow(before: Map<string, DOMRect>, token: number) {
  if (token !== dragPreviewAnimationToken) return
  pageViewport.value?.querySelectorAll<HTMLElement>('[data-launcher-item]').forEach(node => {
    const id = node.dataset.launcherItem
    if (!id) return
    const previous = before.get(id)
    if (!previous) return
    const next = node.getBoundingClientRect()
    const dx = previous.left - next.left
    const dy = previous.top - next.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    node.getAnimations().filter(animation => animation.id === 'launcher-reflow').forEach(animation => animation.cancel())
    const animation = node.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.985)` },
        { transform: 'translate(0, 0) scale(1)' }
      ],
      { duration: 280, easing: 'cubic-bezier(.2,.9,.28,1.16)' }
    )
    animation.id = 'launcher-reflow'
  })
}

function setDragPreview(next: HomeAppearancePreferences | undefined, signature = '') {
  if (signature && signature === dragPreviewSignature) return
  if (!signature && !dragPreviewAppearance.value) return
  const before = captureLauncherRects()
  dragPreviewSignature = signature
  dragPreviewAppearance.value = next
  const token = ++dragPreviewAnimationToken
  void nextTick(() => animateLauncherReflow(before, token))
}

function clearDropTarget() {
  dropTargetKind.value = ''
  dropTargetKey.value = ''
  dropTargetItemId.value = ''
  dropTargetFolderId.value = ''
  dropTargetPage.value = -1
  dropTargetX.value = -1
  dropTargetY.value = -1
  setDragPreview(undefined)
}

function resetLauncherPointer() {
  cancelHomeLongPress()
  clearPageTurn()
  removeLauncherGhost()
  launcherPointer = undefined
  draggingId.value = ''
  clearDropTarget()
  transientBlankPage.value = false
  clampCurrentPageToPersistedLayout()
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
  ghost.querySelectorAll('.hm-remove,.hm-dock-remove,.hm-folder-app-remove').forEach(node => node.remove())
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
    editMenuOpen.value = false
    activeSheet.value = null
  }, 520)
}

function beginLauncherItemPointer(event: PointerEvent, item: HTMLElement) {
  const rawKey = item.dataset.launcherKey || item.dataset.launcherItem
  const itemType = (item.dataset.launcherType || 'app') as 'app' | 'widget' | 'folder'
  const kind = item.dataset.launcherKind as HomePlacement | undefined
  if (!rawKey || (itemType !== 'app' && itemType !== 'widget' && itemType !== 'folder') || (kind !== 'home' && kind !== 'dock')) return
  if ((itemType === 'widget' || itemType === 'folder') && kind !== 'home') return
  const key = rawKey
  cancelHomeLongPress()
  launcherPointer = {
    pointerId: event.pointerId,
    itemType,
    key,
    kind,
    startX: event.clientX,
    startY: event.clientY,
    active: editMode.value,
    sourceElement: item
  }
  if (editMode.value) {
    draggingId.value = `${itemType}:${key}`
    activateLauncherDrag(event)
    event.preventDefault()
    return
  }
  longPressTimer = window.setTimeout(() => {
    if (!launcherPointer || launcherPointer.pointerId !== event.pointerId) return
    launcherPointer.active = true
    draggingId.value = `${itemType}:${key}`
    editMode.value = true
    editMenuOpen.value = false
    activateLauncherDrag(event)
    activeSheet.value = null
  }, 520)
}

function beginFolderAppPointer(event: PointerEvent, appKey: HomeAppKey) {
  const folder = openFolder.value
  const target = event.currentTarget as HTMLElement | null
  if (!folder || !target || !folder.appKeys.includes(appKey)) return
  cancelHomeLongPress()
  launcherPointer = {
    pointerId: event.pointerId,
    itemType: 'app',
    key: appKey,
    kind: 'home',
    originFolderId: folder.id,
    startX: event.clientX,
    startY: event.clientY,
    active: editMode.value,
    sourceElement: target
  }

  const activate = () => {
    if (!launcherPointer || launcherPointer.pointerId !== event.pointerId) return
    launcherPointer.active = true
    draggingId.value = `folder-app:${folder.id}:${appKey}`
    editMode.value = true
    editMenuOpen.value = false
    activateLauncherDrag(event)
    activeSheet.value = null
    event.preventDefault()
  }

  if (editMode.value) {
    activate()
    return
  }
  longPressTimer = window.setTimeout(() => {
    longPressTimer = undefined
    activate()
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
  if (!launcherPointer?.active) return
  const hit = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null

  if (launcherPointer.originFolderId && openFolderId.value === launcherPointer.originFolderId) {
    const member = hit?.closest<HTMLElement>('[data-folder-app-key]')
    const panel = hit?.closest<HTMLElement>('.hm-folder-panel')
    if (member) {
      const targetKey = member.dataset.folderAppKey as HomeAppKey | undefined
      if (targetKey && targetKey !== launcherPointer.key) {
        dropTargetKind.value = 'folder-order'
        dropTargetKey.value = targetKey
        dropTargetFolderId.value = launcherPointer.originFolderId
        dropTargetItemId.value = `folder-member:${targetKey}`
        dropTargetPage.value = -1
        dropTargetX.value = -1
        dropTargetY.value = -1
        setDragPreview(undefined)
        clearPageTurn()
        return
      }
    }
    if (panel) {
      clearDropTarget()
      clearPageTurn()
      return
    }

    // 指针离开文件夹面板后，收起面板，让下面的真实主屏参与命中。
    openFolderId.value = ''
    clearDropTarget()
    clearPageTurn()
    const clientX = event.clientX
    const clientY = event.clientY
    void nextTick(() => updateDesktopDropTarget(clientX, clientY))
    return
  }

  updateDesktopDropTarget(event.clientX, event.clientY)
}

function updateDesktopDropTarget(clientX: number, clientY: number) {
  const viewport = pageViewport.value
  if (!viewport || !launcherPointer?.active) return
  const viewportRect = viewport.getBoundingClientRect()
  const edge = Math.max(38, Math.min(52, viewportRect.width * 0.11))

  // iPhone 式边缘翻页：热区就在手机桌面内部，不要求指针越过手机边框。
  if (clientX <= viewportRect.left + edge && canTurnPage(-1)) queuePageTurn(-1)
  else if (clientX >= viewportRect.right - edge && canTurnPage(1)) queuePageTurn(1)
  else clearPageTurn()

  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  const dockItem = hit?.closest<HTMLElement>('[data-launcher-kind="dock"]')
  const dockZone = hit?.closest<HTMLElement>('[data-launcher-zone="dock"]')
  if ((dockItem || dockZone) && launcherPointer.itemType === 'app') {
    dropTargetKind.value = 'dock'
    const key = (dockItem?.dataset.launcherKey || dockItem?.dataset.launcherItem) as HomeAppKey | undefined
    dropTargetKey.value = key && key !== launcherPointer.key ? key : ''
    dropTargetItemId.value = key ? `app:${key}` : ''
    dropTargetPage.value = -1
    dropTargetX.value = -1
    dropTargetY.value = -1
    setDragPreview(undefined)
    return
  }

  const homeTarget = hit?.closest<HTMLElement>('[data-launcher-kind="home"][data-launcher-item]')
  if (launcherPointer.itemType === 'app' && homeTarget) {
    const targetId = homeTarget.dataset.launcherItem || ''
    const targetType = homeTarget.dataset.launcherType
    const selfId = `app:${launcherPointer.key}`
    if (targetId && targetId !== selfId && (targetType === 'app' || targetType === 'folder')) {
      dropTargetKind.value = 'folder'
      dropTargetKey.value = targetType === 'app' ? (homeTarget.dataset.launcherKey as HomeAppKey || '') : ''
      dropTargetFolderId.value = targetType === 'folder' ? targetId : ''
      dropTargetItemId.value = targetId
      dropTargetPage.value = Number(homeTarget.closest<HTMLElement>('[data-launcher-page]')?.dataset.launcherPage ?? -1)
      dropTargetX.value = -1
      dropTargetY.value = -1
      setDragPreview(undefined)
      return
    }
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
  const relativeX = Math.max(0, Math.min(rect.width - 0.01, clientX - rect.left))
  const relativeY = Math.max(0, Math.min(rect.height - 0.01, clientY - rect.top))
  const x = Math.max(0, Math.min(HOME_GRID_COLUMNS - 1, Math.floor(relativeX / (rect.width / HOME_GRID_COLUMNS))))
  const y = Math.max(0, Math.min(HOME_GRID_ROWS - 1, Math.floor(relativeY / (rect.height / HOME_GRID_ROWS))))
  const occupant = itemAtCell(pageAt(pageIndex), x, y)
  const selfId = launcherPointer.itemType === 'folder' ? launcherPointer.key : `${launcherPointer.itemType}:${launcherPointer.key}`

  if (occupant?.id === selfId && launcherPointer.kind === 'home') {
    // 预览已经把占位符流动到当前格时，不要下一帧又撤销预览造成来回闪动。
    if (dragPreviewAppearance.value && dropTargetKind.value === 'home' && dropTargetPage.value === pageIndex && dropTargetX.value === x && dropTargetY.value === y) return
    clearDropTarget()
    return
  }

  dropTargetKind.value = 'home'
  dropTargetKey.value = occupant?.type === 'app' ? occupant.key : ''
  dropTargetItemId.value = occupant?.id || ''
  dropTargetPage.value = pageIndex
  dropTargetX.value = x
  dropTargetY.value = y

  const previewSignature = `${launcherPointer.itemType}:${launcherPointer.key}:${pageIndex}:${x}:${y}`
  const preview = launcherPointer.originFolderId && launcherPointer.itemType === 'app'
    ? moveHomeFolderAppToGrid(
      appearance.value,
      launcherPointer.originFolderId,
      launcherPointer.key as HomeAppKey,
      pageIndex,
      x,
      y
    )
    : moveHomeLayoutItemToGrid(
      appearance.value,
      launcherPointer.itemType === 'app'
        ? { type: 'app', key: launcherPointer.key as HomeAppKey }
        : launcherPointer.itemType === 'widget'
          ? { type: 'widget', key: launcherPointer.key as HomeWidgetKey }
          : { type: 'folder', id: launcherPointer.key },
      pageIndex,
      x,
      y
    )
  setDragPreview(preview, previewSignature)
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
  const tapDistance = event ? Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) : Number.POSITIVE_INFINITY
  const shouldActivateTap = Boolean(commit && event && !pointer.active && tapDistance < 8)
  const shouldOpenFolder = Boolean(
    commit && event && pointer.itemType === 'folder' && pointer.active && !dropTargetKind.value && tapDistance < 8
  )

  try {
    if (shouldActivateTap) {
      // Launcher 自己捕获 pointerup 后，不再依赖浏览器是否继续派发 click。
      // 这样 App / Widget 的普通短按在鼠标、触屏和 PWA 下都走同一条确定路径。
      if (pointer.itemType === 'app') openAppKey(pointer.key as HomeAppKey)
      else if (pointer.itemType === 'widget') openWidget(pointer.key as HomeWidgetKey)
      else if (pointer.itemType === 'folder') openFolderId.value = pointer.key
      suppressAppClickUntil = performance.now() + 320
    } else if (pointer.active && commit) {
      if (dropTargetKind.value === 'folder-order' && pointer.itemType === 'app' && pointer.originFolderId && dropTargetKey.value) {
        await persistAppearance(reorderHomeFolderApps(
          appearance.value,
          pointer.originFolderId,
          pointer.key as HomeAppKey,
          dropTargetKey.value
        ))
        suppressAppClickUntil = performance.now() + 320
      } else if (dropTargetKind.value === 'folder' && pointer.itemType === 'app') {
        if (pointer.originFolderId && dropTargetFolderId.value === pointer.originFolderId) {
          // 从文件夹里拖出后又放回原文件夹，视为取消，不制造解散/重建抖动。
          suppressAppClickUntil = performance.now() + 320
        } else {
          const source = pointer.originFolderId
            ? removeHomeAppFromFolder(appearance.value, pointer.originFolderId, pointer.key as HomeAppKey, currentPage.value)
            : appearance.value
          const next = dropTargetFolderId.value
            ? addHomeAppToFolder(source, pointer.key as HomeAppKey, dropTargetFolderId.value)
            : dropTargetKey.value
              ? createHomeFolder(source, pointer.key as HomeAppKey, dropTargetKey.value)
              : source
          await persistAppearance(next)
          suppressAppClickUntil = performance.now() + 320
        }
      } else if (dropTargetKind.value === 'home' && dropTargetPage.value >= 0 && dropTargetX.value >= 0 && dropTargetY.value >= 0) {
        const next = dragPreviewAppearance.value ?? (pointer.originFolderId && pointer.itemType === 'app'
          ? moveHomeFolderAppToGrid(
            appearance.value,
            pointer.originFolderId,
            pointer.key as HomeAppKey,
            dropTargetPage.value,
            dropTargetX.value,
            dropTargetY.value
          )
          : moveHomeLayoutItemToGrid(
            appearance.value,
            pointer.itemType === 'app'
              ? { type: 'app', key: pointer.key as HomeAppKey }
              : pointer.itemType === 'widget'
                ? { type: 'widget', key: pointer.key as HomeWidgetKey }
                : { type: 'folder', id: pointer.key },
            dropTargetPage.value,
            dropTargetX.value,
            dropTargetY.value
          ))
        await persistAppearance(next)
        suppressAppClickUntil = performance.now() + 320
      } else if (dropTargetKind.value === 'dock' && pointer.itemType === 'app') {
        await persistAppearance(pointer.originFolderId
          ? moveHomeFolderAppToDock(
            appearance.value,
            pointer.originFolderId,
            pointer.key as HomeAppKey,
            dropTargetKey.value || undefined
          )
          : moveHomeAppPlacement(
            appearance.value,
            pointer.key as HomeAppKey,
            'dock',
            dropTargetKey.value || undefined
          ))
        suppressAppClickUntil = performance.now() + 320
      }
    }
  } finally {
    // 即便 IndexedDB 写入或布局校验异常，也必须销毁拖拽预览和临时页。
    // 否则 dragPreviewAppearance 会继续盖住真实 appearance，表现成“第二页永远删不掉”。
    resetLauncherPointer()
    if (shouldOpenFolder) openFolderId.value = pointer.key
    if (event) event.preventDefault()
  }
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
  const wasSwiping = pageSwiping.value
  const tapDistance = Math.hypot(pageSwipe.lastX - pageSwipe.startX, (event?.clientY ?? pageSwipe.startY) - pageSwipe.startY)
  if (wasSwiping) {
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

  // Face ID iPhone 的编辑态可以轻点主屏幕背景结束；这里也不再保留右上角大块“完成”。
  if (!wasSwiping && editMode.value && tapDistance < 8 && !activeSheet.value) finishEditing()
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

function pageSlideStyle(pageIndex: number) {
  const relative = pageIndex - currentPage.value
  return {
    transform: `translate3d(${relative * 100}%,0,0) translate3d(${pageSwipeOffset.value}px,0,0)`
  }
}

function pageRenderKey(page: HomeLayoutPage, pageIndex: number) {
  const signature = page.items.map(item => `${item.id}@${item.x},${item.y},${item.w},${item.h}`).join('|')
  return `${pageIndex}:${signature || 'empty'}`
}

function finishEditing() {
  void finishHomePointer(undefined, false)
  cancelPageSwipe()
  editMode.value = false
  editMenuOpen.value = false
  activeSheet.value = null
  editingWidgetKey.value = ''
  openFolderId.value = ''
}

function openAppearance(section: 'customize' | 'wallpaper') {
  void router.push({ path: '/settings/appearance', query: { section } })
}

watch(() => actualPages.value.length, length => {
  if (currentPage.value >= length) currentPage.value = Math.max(0, length - 1)
})

watch(currentPage, () => {
  if (activeSheet.value === 'diagnostics') void refreshLayoutDiagnostics()
  if (editMode.value || draggingId.value) return
  window.setTimeout(() => { void repairCurrentBlankPage() }, 380)
})

watch(activeSheet, sheet => {
  if (sheet === 'diagnostics') void refreshLayoutDiagnostics()
})

onMounted(async () => {
  await loadHomeState()
  socialBadgeSubscription = liveQuery(() =>
    db.socialNotifications.where('worldId').equals(worldId.value).filter(item => !item.read).count()
  ).subscribe(count => { momentsUnread.value = count })
  musicStateSubscription = liveQuery(() => db.musicStates.toArray()).subscribe(rows => {
    musicState.value = [...rows].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0]
  })
  minuteTimer = window.setInterval(() => { now.value = new Date() }, 30_000)
  window.setTimeout(() => { void repairCurrentBlankPage() }, 520)

  window.addEventListener('pointermove', handlePointerMove, { capture: true, passive: false })
  window.addEventListener('pointerup', handlePointerUp, true)
  window.addEventListener('pointercancel', handlePointerCancel, true)
  window.addEventListener('blur', handleWindowBlur)
})

onUnmounted(() => {
  resetLauncherPointer()
  cancelPageSwipe()
  socialBadgeSubscription?.unsubscribe()
  musicStateSubscription?.unsubscribe()
  musicAudio.value?.pause()
  if (minuteTimer !== undefined) window.clearInterval(minuteTimer)
  window.removeEventListener('pointermove', handlePointerMove, true)
  window.removeEventListener('pointerup', handlePointerUp, true)
  window.removeEventListener('pointercancel', handlePointerCancel, true)
  window.removeEventListener('blur', handleWindowBlur)
})
</script>

<template>
  <PhoneFrame status-tone="dark" lock-scroll>
    <section class="hm-root" :class="[{ 'is-editing': editMode }, `theme-${appearance.themePreset}`]">
      <div class="hm-wall" :style="wallpaperStyle"></div>
      <audio ref="musicAudio" class="hm-music-audio" preload="metadata" @ended="handleMusicAudioEnded"></audio>

      <div class="hm-main">
        <div v-if="editMode" class="hm-edit-toolbar">
          <button class="hm-edit-trigger" type="button" @click.stop="editMenuOpen = !editMenuOpen">编辑</button>
          <div v-if="editMenuOpen" class="hm-edit-menu">
            <button type="button" @click="activeSheet = 'widgets'; editMenuOpen = false">
              <span>▣＋</span><b>添加小组件</b>
            </button>
            <button type="button" @click="activeSheet = 'theme'; editMenuOpen = false">
              <span>✣</span><b>自定义</b>
            </button>
            <button type="button" @click="openAppearance('wallpaper')">
              <span>❉</span><b>编辑墙纸</b>
            </button>
            <button type="button" @click="activeSheet = 'pages'; editMenuOpen = false">
              <span>▦</span><b>编辑页面</b>
            </button>
            <button type="button" @click="activeSheet = 'apps'; editMenuOpen = false">
              <span>▦</span><b>管理 App</b>
            </button>
            <button type="button" @click="activeSheet = 'layout-backup'; editMenuOpen = false; layoutBackupMessage = ''">
              <span>⇩</span><b>布局备份</b>
            </button>
            <button type="button" @click="openLayoutDiagnostics">
              <span>⌁</span><b>布局诊断</b>
            </button>
          </div>
        </div>

        <div ref="pageViewport" class="hm-pages" :class="{ 'is-swiping': pageSwiping }" @pointerdown.stop="startPagePointer">
            <section
              v-for="(page, pageIndex) in launcherPages"
              :key="pageRenderKey(page, pageIndex)"
              class="hm-page"
              :class="{ 'is-transient': pageIndex >= actualPages.length }"
              :style="pageSlideStyle(pageIndex)"
              :data-launcher-page="pageIndex"
            >
              <div class="hm-launcher-grid" data-launcher-zone="home" data-launcher-grid :data-launcher-page="pageIndex">
                <template v-if="editMode || draggingId">
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
                    :class="[
                      `widget-${item.key}`,
                      `style-${appearance.widgetStyle}`,
                      `size-${item.w}x${item.h}`,
                      {
                        'is-dragging': draggingId === `widget:${item.key}`,
                        'is-drop-target': dropTargetKind === 'home' && dropTargetItemId === item.id
                      }
                    ]"
                    :style="layoutStyle(item)"
                    :data-launcher-item="item.id"
                    :data-launcher-key="item.key"
                    data-launcher-type="widget"
                    data-launcher-kind="home"
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
                        <AppIcon icon="music" :size="58" :tones="musicTones" />
                      </div>
                      <div class="music-copy">
                        <small>{{ musicPlaybackActive ? '正在播放' : '一起听' }}</small>
                        <b>{{ musicState?.title || '把声音留在这个世界里' }}</b>
                        <span>{{ musicPlaybackError || musicState?.artist || '点组件进入音乐，播放键可直接控制' }}</span>
                      </div>
                      <button
                        v-if="!editMode"
                        class="music-widget-play"
                        type="button"
                        :aria-label="musicPlaybackActive ? '暂停音乐' : '播放音乐'"
                        @pointerdown.stop
                        @click.stop="toggleMusicPlayback"
                      >{{ musicPlaybackActive ? 'Ⅱ' : '▶' }}</button>
                    </template>

                    <template v-else-if="item.key === 'calendar'">
                      <div class="calendar-badge">
                        <small>{{ calendarMonth }}</small>
                        <strong>{{ calendarDay }}</strong>
                      </div>
                      <div class="widget-copy calendar-copy">
                        <small>日历</small>
                        <b>{{ calendarWeekday }}</b>
                        <span>{{ dateLine }}</span>
                      </div>
                    </template>

                    <template v-else-if="item.key === 'photo'">
                      <img v-if="appearance.homeWidgetSettings.photo?.imageDataUrl" class="photo-widget-image" :src="appearance.homeWidgetSettings.photo.imageDataUrl" alt="桌面照片" />
                      <div v-else class="photo-widget-empty">
                        <span>▧</span><b>添加照片</b><small>编辑小组件后选择图片</small>
                      </div>
                    </template>
                  </article>

                  <div
                    v-else-if="item.type === 'folder'"
                    class="hm-folder-shell"
                    :class="{
                      'is-dragging': draggingId === `folder:${item.id}`,
                      'is-drop-target': dropTargetKind === 'folder' && dropTargetItemId === item.id
                    }"
                    :style="layoutStyle(item)"
                    :data-launcher-item="item.id"
                    :data-launcher-key="item.id"
                    data-launcher-type="folder"
                    data-launcher-kind="home"
                  >
                    <button class="hm-folder" type="button" @click="openFolderItem(item)">
                      <span class="hm-folder-tile">
                        <span v-for="key in item.appKeys.slice(0, 4)" :key="key" class="hm-folder-mini">
                          <AppIcon
                            :icon="appIconFor(key)"
                            :custom-image="appCustomImageFor(key)"
                            :tones="appToneFor(key)"
                            :size="20"
                          />
                        </span>
                      </span>
                      <span v-if="appearance.showAppLabels" class="hm-name">{{ item.name }}</span>
                    </button>
                  </div>

                  <div
                    v-else
                    class="hm-app-shell"
                    :class="{
                      'is-dragging': draggingId === `app:${item.key}`,
                      'is-drop-target': (dropTargetKind === 'home' || dropTargetKind === 'folder') && dropTargetItemId === item.id
                    }"
                    :style="layoutStyle(item)"
                    :data-launcher-item="item.id"
                    :data-launcher-key="item.key"
                    data-launcher-type="app"
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

        <div v-if="launcherPages.length > 1" class="hm-page-dots" aria-label="桌面分页">
          <button
            v-for="(_, index) in launcherPages"
            :key="index"
            type="button"
            :class="{ active: currentPage === index }"
            :aria-label="`第 ${index + 1} 页`"
            @click="editMode ? (activeSheet = 'pages') : (index < actualPages.length && goToPage(index))"
          ></button>
        </div>

        <div class="hm-dock-holder" data-launcher-zone="dock" @pointerdown.stop="startDockPointer">
          <DockBar
            :apps="dockApps"
            :icon-size="dockIconSize"
            :show-labels="false"
            :editing="editMode"
            :dragging-key="draggingAppKey"
            :drop-target-key="dropTargetKind === 'dock' ? dropTargetKey : ''"
            @remove="removeDockApp"
          />
        </div>
      </div>

      <div v-if="openFolder" class="hm-folder-backdrop" @click.self="openFolderId = ''">
        <section class="hm-folder-panel">
          <header class="hm-folder-header">
            <input
              v-if="editMode"
              :value="openFolder.name"
              maxlength="24"
              aria-label="文件夹名称"
              @change="handleFolderNameChange"
            />
            <h2 v-else>{{ openFolder.name }}</h2>
            <button type="button" aria-label="关闭文件夹" @click="openFolderId = ''">×</button>
          </header>
          <div class="hm-folder-grid">
            <div
              v-for="key in openFolder.appKeys"
              :key="key"
              class="hm-folder-app"
              :class="{ 'is-folder-drop-target': dropTargetKind === 'folder-order' && dropTargetKey === key }"
              :data-folder-app-key="key"
              @pointerdown.stop="beginFolderAppPointer($event, key)"
            >
              <button type="button" class="hm-folder-app-main" @click="openFolderApp(key)">
                <AppIcon
                  :icon="appIconFor(key)"
                  :custom-image="appCustomImageFor(key)"
                  :tones="appToneFor(key)"
                  :size="58"
                />
                <span>{{ appLabel(key) }}</span>
              </button>
              <button
                v-if="editMode"
                type="button"
                class="hm-folder-app-remove"
                :aria-label="`移出${appLabel(key)}`"
                @click.stop="moveAppOutOfFolder(key)"
              >−</button>
            </div>
          </div>
          <p v-if="editMode" class="hm-folder-hint">长按文件夹里的 App 可排序或直接拖回桌面；只剩 1 个 App 时会自动解散。</p>
        </section>
      </div>

      <div v-if="activeSheet" class="hm-sheet-backdrop" @click.self="activeSheet = null">
        <section class="hm-sheet">
          <header>
            <div>
              <small>{{ activeSheet === 'widgets' ? '小组件库' : activeSheet === 'widget' ? '编辑小组件' : activeSheet === 'theme' ? '自定义' : activeSheet === 'layout-backup' ? '布局备份' : activeSheet === 'diagnostics' ? 'HomeLayout Inspector' : activeSheet === 'pages' ? '主屏幕页面' : '桌面 App' }}</small>
              <h2>{{ activeSheet === 'widgets' ? '添加到当前主屏幕' : activeSheet === 'widget' ? (editingWidgetDefinition?.label || '小组件') : activeSheet === 'theme' ? '桌面外观' : activeSheet === 'layout-backup' ? '保存或恢复桌面' : activeSheet === 'diagnostics' ? '布局诊断' : activeSheet === 'pages' ? '选择页面' : '选择显示位置' }}</h2>
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
                <b v-else-if="widget.key === 'calendar'">{{ calendarDay }}</b>
                <b v-else-if="widget.key === 'photo'">▧</b>
                <b v-else>♪</b>
              </span>
              <span><b>{{ widget.label }}</b><small>{{ widget.description }}</small></span>
              <em>{{ appearance.homeWidgetKeys.includes(widget.key) ? '已添加' : '＋' }}</em>
            </button>
            <p v-if="availableWidgets.length === 0" class="sheet-note">所有小组件都已经在主屏幕上了。</p>
          </div>

          <div v-else-if="activeSheet === 'widget' && editingWidgetKey" class="widget-editor">
            <div class="widget-editor-block">
              <h3>尺寸</h3>
              <div class="widget-size-options">
                <button
                  v-for="size in editingWidgetSizes"
                  :key="size.key"
                  type="button"
                  :class="{ active: editingWidgetLayout?.w === size.w && editingWidgetLayout?.h === size.h }"
                  @click="editingWidgetKey && chooseWidgetSize(editingWidgetKey, size.w, size.h)"
                >
                  <span :style="{ aspectRatio: `${size.w}/${size.h}` }"></span>
                  <b>{{ size.label }}</b>
                </button>
              </div>
            </div>
            <div v-if="editingWidgetKey === 'photo'" class="widget-editor-block">
              <h3>照片</h3>
              <button class="sheet-action" type="button" @click="requestPhoto">选择照片</button>
              <button
                v-if="appearance.homeWidgetSettings.photo?.imageDataUrl"
                class="sheet-action secondary"
                type="button"
                @click="persistAppearance(updateHomeWidgetSettings(appearance, 'photo', { imageDataUrl: '' }))"
              >移除照片</button>
            </div>
            <p class="sheet-note">小组件和 App 使用同一套 4×6 网格；长按后可以互相交换位置。</p>
          </div>

          <div v-else-if="activeSheet === 'theme'" class="theme-editor">
            <button v-for="preset in HOME_THEME_PRESETS" :key="preset" type="button" :class="['theme-choice', `preset-${preset}`, { active: appearance.themePreset === preset }]" @click="applyThemePreset(preset)">
              <span class="theme-preview"></span>
              <b>{{ preset === 'default' ? '默认' : preset === 'dark' ? '深色' : preset === 'clear' ? '透明' : '色调' }}</b>
            </button>
            <p class="sheet-note">预设只改变桌面图标/小组件的显示氛围，不修改角色、聊天或世界数据。</p>
          </div>

          <div v-else-if="activeSheet === 'layout-backup'" class="layout-backup-editor">
            <button class="sheet-action" type="button" @click="exportLayoutBackup">导出桌面布局 JSON</button>
            <button class="sheet-action secondary" type="button" @click="requestLayoutImport">导入桌面布局 JSON</button>
            <p class="sheet-note">导入前会先通过 HomeLayout Zod Schema 校验；失败不会写入 IndexedDB。</p>
            <p v-if="layoutBackupMessage" class="backup-message">{{ layoutBackupMessage }}</p>
          </div>

          <div v-else-if="activeSheet === 'diagnostics'" class="layout-diagnostics">
            <p class="sheet-note">Inspector 同时检查持久化 HomeLayout 与当前页真实 DOM。painted 只有当前页会执行命中检测；离屏页显示“未采样”。</p>
            <div class="diagnostic-actions">
              <button type="button" class="sheet-action" @click="refreshLayoutDiagnostics">重新扫描</button>
              <button type="button" class="sheet-action secondary" @click="copyLayoutDiagnostics">复制诊断 JSON</button>
              <button type="button" class="sheet-action secondary" @click="repairLayoutStructure">修复结构异常</button>
              <button v-if="currentPage > 0" type="button" class="sheet-action danger" @click="quarantineCurrentVisualBlankPage">备份并回收当前视觉空白页</button>
            </div>
            <p v-if="layoutDiagnosticMessage" class="backup-message">{{ layoutDiagnosticMessage }}</p>
            <template v-if="layoutDiagnosticSnapshot">
              <p class="sheet-note">当前页：{{ currentPage + 1 }} / {{ layoutDiagnosticSnapshot.pageCount }} · revision {{ layoutDiagnosticSnapshot.revision }} · Dock {{ layoutDiagnosticSnapshot.dockAppKeys.join('、') }}</p>
              <div v-if="layoutDiagnosticSnapshot.issues.length" class="diagnostic-global-issues">
                <b>结构问题</b><span v-for="issue in layoutDiagnosticSnapshot.issues" :key="issue">{{ issue }}</span>
              </div>
              <div v-for="page in layoutDiagnosticSnapshot.pages" :key="`diag-${page.pageIndex}`" class="diagnostic-page">
                <b>第 {{ page.pageIndex + 1 }} 页 · {{ page.itemCount }} 项 · {{ page.occupiedCells }}/{{ HOME_GRID_COLUMNS * HOME_GRID_ROWS }} 格</b>
                <span v-if="page.issues.length" class="diagnostic-page-issue">{{ page.issues.join('；') }}</span>
                <article v-for="item in page.items" :key="item.id" class="diagnostic-item">
                  <div><strong>{{ item.label }}</strong><small>{{ item.type }} · {{ item.key }}</small></div>
                  <code>{{ item.x }},{{ item.y }} · {{ item.w }}×{{ item.h }}</code>
                  <small>DOM {{ item.domPresent ? '✓' : '×' }} · painted {{ item.painted === null ? '未采样' : item.painted ? '✓' : '×' }}<template v-if="item.rect"> · {{ item.rect.width }}×{{ item.rect.height }} @ {{ item.rect.left }},{{ item.rect.top }}</template></small>
                  <small v-if="item.issues.length" class="diagnostic-item-issue">{{ item.issues.join('；') }}</small>
                </article>
              </div>
            </template>
          </div>

          <div v-else-if="activeSheet === 'pages'" class="page-overview">
            <button
              v-for="(page, pageIndex) in actualPages"
              :key="`overview-${pageIndex}`"
              type="button"
              class="page-thumbnail"
              :class="{ active: currentPage === pageIndex }"
              @click="goToPage(pageIndex); activeSheet = null"
            >
              <span class="page-mini-grid">
                <i
                  v-for="item in page.items"
                  :key="item.id"
                  :class="['page-mini-item', `type-${item.type}`]"
                  :style="{
                    gridColumn: `${item.x + 1} / span ${item.w}`,
                    gridRow: `${item.y + 1} / span ${item.h}`
                  }"
                ></i>
              </span>
              <span class="page-thumbnail-meta"><b>第 {{ pageIndex + 1 }} 页</b><small>{{ page.items.length }} 个项目</small></span>
              <em>{{ currentPage === pageIndex ? '✓' : '' }}</em>
            </button>
            <p class="sheet-note">页面由内容自然产生：把 App 或小组件拖到最后一页右侧边缘可创建新页；一页清空后会自动回收。</p>
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

      <input ref="photoInput" class="hm-hidden-input" type="file" accept="image/*" @change="handlePhotoSelected" />
      <input ref="layoutImportInput" class="hm-hidden-input" type="file" accept="application/json,.json" @change="handleLayoutImport" />
    </section>
  </PhoneFrame>
</template>

<style scoped>
.hm-root{position:relative;height:100%;display:flex;flex-direction:column;overflow:hidden;color:#253b4e;background:linear-gradient(165deg,#f7fcff 0%,#e9f5fe 43%,#dbeaf7 100%)}
.hm-wall{position:absolute;inset:0;z-index:0;overflow:hidden;background:radial-gradient(120% 75% at 86% -12%,rgba(255,255,255,.96) 0%,rgba(226,244,255,.68) 38%,transparent 66%),radial-gradient(120% 82% at -20% 112%,rgba(192,225,248,.72) 0%,transparent 66%),linear-gradient(165deg,#f7fcff 0%,#e9f5fe 43%,#dbeaf7 100%);background-repeat:no-repeat}
.hm-main{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:0;touch-action:none}
.hm-pages{position:relative;flex:1;min-height:0;width:100%;overflow:hidden;touch-action:none;overscroll-behavior:none;isolation:isolate}
.hm-page{position:absolute;inset:0;width:100%;height:100%;min-height:0;overflow:hidden;will-change:transform;transition:transform .28s cubic-bezier(.22,.76,.24,1);backface-visibility:hidden;transform-style:flat}
.hm-pages.is-swiping .hm-page{transition:none}
.hm-page.is-transient{background:rgba(255,255,255,.035)}
.hm-launcher-grid{position:relative;z-index:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr));column-gap:8px;row-gap:8px;width:100%;height:100%;padding:16px 18px 8px;box-sizing:border-box;overflow:hidden}
.hm-grid-cell{position:relative;z-index:0;border-radius:19px;pointer-events:none;transition:background .14s ease,box-shadow .14s ease}
.is-editing .hm-grid-cell{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.11)}
.hm-grid-cell.is-drop-cell{background:rgba(255,255,255,.35);box-shadow:inset 0 0 0 1.5px rgba(80,120,150,.35)}
.hm-widget{position:relative;z-index:2;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(255,255,255,.52);border-radius:24px;box-shadow:0 12px 27px rgba(42,74,98,.12),inset 0 1px 0 rgba(255,255,255,.45);cursor:pointer;transition:transform .16s ease,opacity .16s ease,filter .16s ease}.hm-widget.is-dragging{opacity:.18;filter:saturate(.7)}.hm-widget.is-drop-target{transform:scale(.97);outline:1.5px dashed rgba(65,91,110,.34);outline-offset:2px}
.hm-widget.style-frosted{background:rgba(247,251,254,.6);backdrop-filter:blur(24px) saturate(1.12);-webkit-backdrop-filter:blur(24px) saturate(1.12)}
.hm-widget.style-clear{background:rgba(255,255,255,.22);backdrop-filter:blur(7px) saturate(1.08);-webkit-backdrop-filter:blur(7px) saturate(1.08)}
.hm-widget.style-solid{background:#f8fbfd}
.hm-music-audio{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none}
.music-widget-play{position:absolute;right:16px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.82);color:#7087ce;display:grid;place-items:center;font-size:16px;box-shadow:0 6px 16px rgba(60,82,110,.1);cursor:pointer}.music-widget-play:active{transform:translateY(-50%) scale(.94)}
.widget-music .music-copy{padding-right:54px}
.widget-greeting{position:absolute;left:18px;bottom:38px;font-size:27px;line-height:1;font-weight:760;letter-spacing:-.04em}.widget-date{position:absolute;left:18px;top:17px;color:#6d8292;font-size:11px}.widget-caption{position:absolute;left:18px;bottom:16px;color:#6f8494;font-size:10px}.widget-clock{position:absolute;right:17px;top:14px;font-size:27px;font-weight:620;letter-spacing:-.04em;color:#4c6679}
.widget-companion,.widget-world{padding:12px 13px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:10px}.widget-companion.size-2x2,.widget-world.size-2x2{grid-template-columns:1fr;align-content:space-between;justify-items:start}.widget-copy{display:grid;gap:2px;min-width:0}.widget-copy small,.music-copy small{color:#8396a5;font-size:9px}.widget-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.widget-copy span,.music-copy span{color:#7b8e9d;font-size:9px}.world-orb{display:grid;place-items:center;width:44px;height:44px;border-radius:15px;background:linear-gradient(145deg,#87b8dc,#c4def0);color:white;font-size:27px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}
.widget-music{display:flex;align-items:center;gap:11px;padding:11px 14px}.music-art{display:grid;place-items:center;width:58px;height:58px;flex:0 0 auto}.music-art :deep(.app-icon){transform:scale(.82)}.music-copy{display:grid;gap:3px;min-width:0;flex:1}.music-copy b{font-size:14px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-app-shell{position:relative;z-index:3;display:grid;place-items:center;min-width:0;min-height:0;transition:transform .16s ease,opacity .16s ease,filter .16s ease}.hm-app-shell.is-dragging{opacity:.18;filter:saturate(.7)}.hm-app-shell.is-drop-target{transform:scale(.92)}
.hm-app{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:0;border:0;background:transparent;cursor:pointer;color:inherit}.hm-tile-wrap{position:relative;display:grid;place-items:center}.hm-badge{position:absolute;z-index:3;right:-6px;top:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:11px;background:#ff4b57;color:#fff;font-size:10px;line-height:20px;text-align:center;font-weight:760;border:1.5px solid rgba(255,255,255,.92)}.hm-name{max-width:72px;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:#2e4659;white-space:nowrap;text-shadow:0 1px 8px rgba(255,255,255,.7)}
.hm-folder-shell{position:relative;z-index:3;display:grid;place-items:center;min-width:0;min-height:0;transition:transform .18s ease,opacity .16s ease,filter .16s ease}.hm-folder-shell.is-dragging{opacity:.18;filter:saturate(.7)}.hm-folder-shell.is-drop-target{transform:scale(.9)}
.hm-folder{display:flex;min-width:0;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:0;border:0;background:transparent;color:inherit;cursor:pointer}.hm-folder-tile{width:60px;height:60px;padding:7px;border-radius:18px;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:4px;place-items:center;background:rgba(236,244,250,.64);box-shadow:inset 0 0 0 1px rgba(255,255,255,.62),0 8px 18px rgba(42,74,98,.13);backdrop-filter:blur(18px) saturate(1.1);-webkit-backdrop-filter:blur(18px) saturate(1.1)}.hm-folder-mini{display:grid;place-items:center;width:22px;height:22px;overflow:hidden;border-radius:7px}.hm-folder-mini :deep(.app-icon){box-shadow:none!important}
.hm-folder-backdrop{position:absolute;z-index:120;inset:0;display:grid;place-items:center;padding:90px 30px 120px;background:rgba(31,47,60,.18);backdrop-filter:blur(18px) saturate(1.04);-webkit-backdrop-filter:blur(18px) saturate(1.04)}.hm-folder-panel{width:min(340px,92%);max-height:520px;padding:18px;border:1px solid rgba(255,255,255,.66);border-radius:32px;background:rgba(244,249,252,.76);box-shadow:0 28px 70px rgba(29,48,62,.24),inset 0 1px 0 rgba(255,255,255,.72);backdrop-filter:blur(28px) saturate(1.12);-webkit-backdrop-filter:blur(28px) saturate(1.12);overflow:auto}.hm-folder-header{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;margin-bottom:18px}.hm-folder-header h2{margin:0;text-align:center;font-size:18px;color:#2d4659}.hm-folder-header input{min-width:0;border:0;border-radius:14px;padding:9px 12px;background:rgba(255,255,255,.72);font:inherit;font-weight:700;color:#2d4659;text-align:center;outline:none}.hm-folder-header button{width:34px;height:34px;border:0;border-radius:50%;background:rgba(111,132,148,.14);font-size:20px;color:#536b7d}.hm-folder-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 10px}.hm-folder-app{position:relative;display:grid;place-items:center;touch-action:none;transition:transform .16s ease,filter .16s ease}.hm-folder-app.is-folder-drop-target{transform:scale(.9);filter:brightness(1.06)}.hm-folder-app-main{display:grid;justify-items:center;gap:7px;min-width:0;border:0;background:transparent;color:#30485b}.hm-folder-app-main span{max-width:88px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hm-folder-app-remove{position:absolute;left:4px;top:-4px;width:22px;height:22px;border:1px solid rgba(255,255,255,.7);border-radius:50%;background:rgba(113,122,130,.9);color:#fff;font-size:18px;line-height:18px}.hm-folder-hint{margin:18px 4px 2px;text-align:center;font-size:9px;line-height:1.6;color:#708698}
.hm-drag-ghost{position:fixed!important;z-index:9999!important;margin:0!important;pointer-events:none!important;opacity:.94!important;transform:scale(1.06)!important;transform-origin:center!important;filter:drop-shadow(0 16px 18px rgba(32,50,65,.22));transition:none!important}.hm-drag-ghost .hm-app,.hm-drag-ghost .dock-app{animation:none!important}.launcher-source-dragging{opacity:.18!important}
.hm-page-dots{display:flex;flex:0 0 auto;justify-content:center;gap:7px;padding:7px 0 9px}.hm-page-dots button{width:6px;height:6px;padding:0;border:0;border-radius:50%;background:rgba(63,81,95,.28)}.hm-page-dots button.active{background:rgba(42,62,78,.72)}
.hm-dock-holder{flex:0 0 auto;padding:0 21px 10px}
.hm-edit-toolbar{position:absolute;z-index:25;left:10px;top:8px;pointer-events:none}.hm-edit-trigger{pointer-events:auto;padding:7px 14px;border:1px solid rgba(255,255,255,.54);border-radius:999px;background:rgba(248,247,246,.5);backdrop-filter:blur(22px) saturate(1.12);-webkit-backdrop-filter:blur(22px) saturate(1.12);color:#263b4c;font-size:13px;font-weight:700;box-shadow:0 7px 20px rgba(28,47,62,.1)}.hm-edit-menu{pointer-events:auto;width:225px;margin-top:7px;overflow:hidden;border:1px solid rgba(255,255,255,.54);border-radius:24px;background:rgba(248,247,246,.72);backdrop-filter:blur(28px) saturate(1.15);-webkit-backdrop-filter:blur(28px) saturate(1.15);box-shadow:0 18px 42px rgba(28,45,58,.18)}.hm-edit-menu button{width:100%;height:51px;padding:0 16px;border:0;border-bottom:1px solid rgba(73,84,93,.08);background:transparent;display:flex;align-items:center;gap:13px;text-align:left;color:#202a31}.hm-edit-menu button:last-child{border-bottom:0}.hm-edit-menu button span{width:26px;text-align:center;font-size:20px}.hm-edit-menu button b{font-size:14px;font-weight:620}
.hm-remove{position:absolute;z-index:15;left:-7px;top:-7px;width:24px;height:24px;border:1px solid rgba(255,255,255,.72);border-radius:50%;background:rgba(119,127,135,.9);color:#fff;font-size:20px;line-height:20px;display:grid;place-items:center;box-shadow:0 3px 10px rgba(24,39,52,.2)}.hm-remove-app{left:2px;top:2px}.is-editing .hm-widget,.is-editing .hm-app{animation:home-jiggle .18s ease-in-out infinite alternate}.is-editing .hm-app-shell:nth-child(even) .hm-app,.is-editing .hm-widget:nth-child(even){animation-direction:alternate-reverse}
.hm-sheet-backdrop{position:absolute;z-index:40;inset:0;display:flex;align-items:flex-end;background:rgba(24,35,43,.16);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}.hm-sheet{width:100%;max-height:68%;overflow:hidden;border-radius:28px 28px 0 0;background:#f7f9fb;box-shadow:0 -18px 48px rgba(24,45,61,.2)}.hm-sheet header{display:flex;align-items:center;justify-content:space-between;padding:17px 18px 13px;border-bottom:1px solid #e8edf1}.hm-sheet header small{color:#8798a5;font-size:9px}.hm-sheet header h2{margin:2px 0 0;font-size:20px;letter-spacing:-.02em}.hm-sheet header button{width:32px;height:32px;border:0;border-radius:50%;background:#e8edf1;color:#536979;font-size:21px}
.widget-catalog,.page-editor,.page-overview{max-height:430px;overflow:auto;padding:12px 14px 24px}.widget-choice{width:100%;min-height:72px;display:grid;grid-template-columns:62px 1fr auto;align-items:center;gap:12px;padding:9px 10px;border:0;border-bottom:1px solid #e9eef1;background:transparent;text-align:left;color:#304759}.widget-choice:disabled{opacity:.46}.widget-choice>span:nth-child(2){display:grid;gap:3px}.widget-choice>span:nth-child(2) b{font-size:13px}.widget-choice>span:nth-child(2) small{color:#8495a2;font-size:9px;line-height:1.4}.widget-choice em{font-style:normal;font-size:18px;color:#5d91b6}.widget-sample{display:grid;place-items:center;width:58px;height:50px;border-radius:15px;background:linear-gradient(145deg,#e8f2f8,#fff);box-shadow:inset 0 0 0 1px rgba(80,109,131,.07);color:#5e7b91}.sample-music{background:linear-gradient(145deg,#dfe2f7,#f7f8ff);color:#7783c8}
.page-editor-head,.page-app-row{display:grid;grid-template-columns:1fr 58px 58px;align-items:center;gap:8px}.page-editor-head{padding:3px 5px 8px;color:#8c9aa5;font-size:9px;text-align:center}.page-editor-head span:first-child{text-align:left}.page-app-row{min-height:58px;border-top:1px solid #e9eef1}.page-app-name{display:flex;align-items:center;gap:9px;min-width:0}.page-app-name span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.place-toggle{justify-self:center;width:32px;height:32px;border:0;border-radius:50%;background:#e8edf1;color:#7a8b97;font-size:15px}.place-toggle.on{background:#dff3ea;color:#159a63;font-weight:800}.place-toggle:disabled{opacity:.32}.sheet-note{margin:12px 4px 0;color:#8d9ba6;font-size:9px;line-height:1.55}
.page-overview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.page-thumbnail{min-width:0;border:0;background:transparent;padding:0;color:#435c6e;display:grid;gap:8px;text-align:left}.page-mini-grid{aspect-ratio:4/6;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(6,1fr);gap:3px;padding:8px;border-radius:18px;background:linear-gradient(165deg,#edf7fd,#dcecf8);box-shadow:inset 0 0 0 1px rgba(76,106,128,.09),0 8px 18px rgba(35,56,70,.08)}.page-thumbnail.active .page-mini-grid{outline:3px solid rgba(62,158,120,.3);outline-offset:2px}.page-mini-item{display:block;border-radius:4px;background:linear-gradient(145deg,#9dbfe0,#d7e8f5)}.page-mini-item.type-widget{border-radius:6px;background:linear-gradient(145deg,#d9e9f4,#f7fbfd)}.page-thumbnail-meta{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 2px}.page-thumbnail-meta b{font-size:11px}.page-thumbnail-meta small{font-size:9px;color:#8a9aa6}.page-thumbnail em{position:absolute;opacity:0;pointer-events:none}

.widget-calendar{padding:10px 12px;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px}.calendar-badge{width:44px;height:48px;border-radius:14px;background:rgba(255,255,255,.76);display:grid;place-items:center;align-content:center;box-shadow:inset 0 0 0 1px rgba(72,92,108,.08)}.calendar-badge small{font-size:9px;color:#ef625f}.calendar-badge strong{font-size:22px;line-height:1;color:#263c4e}.calendar-copy{align-content:center}.widget-photo{padding:0}.photo-widget-image{width:100%;height:100%;object-fit:cover;display:block}.photo-widget-empty{width:100%;height:100%;display:grid;place-items:center;align-content:center;gap:4px;color:#708798;background:linear-gradient(145deg,rgba(255,255,255,.55),rgba(219,235,247,.46))}.photo-widget-empty span{font-size:26px}.photo-widget-empty b{font-size:12px}.photo-widget-empty small{font-size:9px}.widget-editor,.theme-editor,.layout-backup-editor,.layout-diagnostics{max-height:430px;overflow:auto;padding:16px 16px 26px}.widget-editor-block+ .widget-editor-block{margin-top:18px}.widget-editor-block h3{margin:0 0 10px;font-size:13px;color:#40596c}.widget-size-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.widget-size-options button{min-width:0;padding:10px 8px 9px;border:1px solid #e0e8ee;border-radius:17px;background:#fff;color:#52697a;display:grid;gap:7px;justify-items:center}.widget-size-options button.active{border-color:#3baa7d;box-shadow:0 0 0 2px rgba(59,170,125,.12)}.widget-size-options button span{display:block;width:48px;max-height:45px;border-radius:10px;background:linear-gradient(145deg,#d7e8f4,#f8fbfd);box-shadow:inset 0 0 0 1px rgba(75,105,125,.08)}.widget-size-options button b{font-size:10px}.sheet-action{width:100%;min-height:45px;border:0;border-radius:15px;background:#dff2e9;color:#16855c;font-weight:700}.sheet-action.secondary{margin-top:9px;background:#e9eef2;color:#546b7c}.theme-editor{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.theme-choice{min-width:0;border:0;background:transparent;display:grid;justify-items:center;gap:8px;color:#617788}.theme-choice b{font-size:10px}.theme-preview{width:58px;height:58px;border-radius:17px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.55),0 8px 18px rgba(34,55,69,.12);background:linear-gradient(145deg,#88bce5,#eef7fd)}.preset-dark .theme-preview{background:linear-gradient(145deg,#27333d,#70808c)}.preset-clear .theme-preview{background:linear-gradient(145deg,rgba(255,255,255,.25),rgba(182,221,244,.3));backdrop-filter:blur(10px)}.preset-tinted .theme-preview{background:linear-gradient(145deg,#ceb4c7,#907f9d)}.theme-choice.active .theme-preview{outline:3px solid rgba(49,157,115,.28);outline-offset:2px}.theme-editor .sheet-note{grid-column:1/-1}.backup-message{margin:12px 4px 0;padding:10px 12px;border-radius:12px;background:#eef7f2;color:#3e6f59;font-size:10px}.hm-hidden-input{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none}.theme-dark{color:#edf4f8}.theme-dark .hm-wall{filter:brightness(.58) saturate(.82)}.theme-dark .hm-name{color:#f4f7fa;text-shadow:0 1px 7px rgba(0,0,0,.38)}.theme-dark .hm-widget.style-solid{background:rgba(38,49,58,.86);color:#edf4f8}.theme-dark .hm-dock-holder :deep(.dock-bar){background:rgba(35,45,53,.58)}.theme-clear .hm-widget{background:rgba(255,255,255,.18)!important;backdrop-filter:blur(10px) saturate(1.08)!important;-webkit-backdrop-filter:blur(10px) saturate(1.08)!important}.theme-tinted .hm-widget{background:rgba(224,204,220,.58)!important}.theme-tinted .hm-app-shell :deep(.app-icon){filter:saturate(.72) sepia(.14) hue-rotate(285deg)}
.diagnostic-page{padding:11px 0;border-bottom:1px solid #e7edf1;color:#40596c}.diagnostic-page b{display:block;font-size:10px;line-height:1.55;word-break:break-all}
.diagnostic-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.diagnostic-actions .sheet-action{margin:0}.sheet-action.danger{background:#fff0ef;color:#b85f58}.diagnostic-global-issues{display:grid;gap:4px;margin:8px 0;padding:9px;border-radius:12px;background:#fff1e7;color:#925d2f;font-size:9px}.diagnostic-global-issues span:before{content:'· '}.diagnostic-page-issue,.diagnostic-item-issue{display:block;margin-top:4px;color:#b16b3f;font-size:9px}.diagnostic-item{display:grid;grid-template-columns:1fr auto;gap:3px 8px;margin-top:7px;padding:8px;border-radius:10px;background:#f3f8fb}.diagnostic-item>div{display:grid}.diagnostic-item strong{font-size:10px}.diagnostic-item small{grid-column:1/-1;color:#748a99;font-size:8px;line-height:1.4}.diagnostic-item code{font-size:8px;color:#5f7585}
@keyframes home-jiggle{from{transform:rotate(-.65deg) translateY(0)}to{transform:rotate(.65deg) translateY(.4px)}}
@media(max-width:360px){.hm-launcher-grid{padding-left:14px;padding-right:14px;column-gap:5px}.hm-dock-holder{padding-left:17px;padding-right:17px}.hm-name{font-size:10px}.hm-edit-menu{width:205px}}
</style>
