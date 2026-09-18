import { db } from '../db/database'
import type { AppCustomization } from '../types/domain'

export type HomeAppKey =
  | 'banxin'
  | 'chat'
  | 'contacts'
  | 'moments'
  | 'diary'
  | 'music'
  | 'wallet'
  | 'turtle-soup'
  | 'profile'
  | 'memory'
  | 'world'
  | 'backup'
  | 'settings'
  | 'new-character'

export type HomeWidgetKey = 'greeting' | 'companion' | 'world' | 'music'
export type HomeWidgetStyle = 'clear' | 'frosted' | 'solid'

export interface HomeAppDefinition {
  key: HomeAppKey
  label: string
  route: string
  icon: HomeAppKey
  tone: [string, string]
}

export interface HomeWidgetDefinition {
  key: HomeWidgetKey
  label: string
  description: string
  size: 'small' | 'medium'
}

export interface HomeAppearancePreferences {
  wallpaperDataUrl?: string
  iconScale: number
  showAppLabels: boolean
  /** 扁平列表只负责“桌面是否显示”，用于兼容旧版本和设置页。 */
  homeAppKeys: HomeAppKey[]
  /** Launcher V3 的真实分页顺序。每个子数组就是一页，空白页也会被保留。 */
  homePageKeys: HomeAppKey[][]
  dockAppKeys: HomeAppKey[]
  homeWidgetKeys: HomeWidgetKey[]
  widgetStyle: HomeWidgetStyle
}

export type HomePlacement = 'home' | 'dock'
const MIN_HOME_PAGES = 2
const MAX_HOME_PAGES = 8

/**
 * 旧版只有一维 homeAppKeys。升级时把有 Widget 的第一页控制为一行 App，
 * 其余页按四列三行分页，并至少保留两页，让桌面从一开始就具备真实横向分页。
 */
export function paginateHomeAppKeys(
  keys: readonly HomeAppKey[],
  hasWidgets = false,
  firstPageCapacity = hasWidgets ? 4 : 12,
  pageCapacity = 12,
  minimumPages = MIN_HOME_PAGES
): HomeAppKey[][] {
  const firstCap = Math.max(1, Math.floor(firstPageCapacity))
  const nextCap = Math.max(1, Math.floor(pageCapacity))
  const pages: HomeAppKey[][] = [[...keys.slice(0, firstCap)]]
  for (let offset = firstCap; offset < keys.length; offset += nextCap) {
    pages.push([...keys.slice(offset, offset + nextCap)])
  }
  while (pages.length < Math.max(1, minimumPages)) pages.push([])
  return pages.slice(0, MAX_HOME_PAGES)
}

export function addHomePage(value: HomeAppearancePreferences): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  if (normalized.homePageKeys.length >= MAX_HOME_PAGES) return normalized
  return normalizeHomeAppearance({
    ...normalized,
    homePageKeys: [...normalized.homePageKeys.map(page => [...page]), []]
  })
}

export function removeHomePage(value: HomeAppearancePreferences, pageIndex: number): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  if (normalized.homePageKeys.length <= MIN_HOME_PAGES) return normalized
  const pages = normalized.homePageKeys.map(page => [...page])
  const index = Math.max(0, Math.min(pages.length - 1, Math.floor(pageIndex)))
  const [removed] = pages.splice(index, 1)
  const receiver = Math.max(0, Math.min(pages.length - 1, index - 1))
  pages[receiver].push(...removed)
  return normalizeHomeAppearance({ ...normalized, homePageKeys: pages })
}

/**
 * 在桌面分页与 Dock 之间移动 / 排序 App。目标页是显式状态，不再靠“扁平数组容量”
 * 猜测，所以把 App 拖到第二页后会真正留在第二页。
 */
export function moveHomeAppPlacement(
  value: HomeAppearancePreferences,
  key: HomeAppKey,
  destination: HomePlacement,
  beforeKey?: HomeAppKey,
  destinationPageIndex?: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homePageKeys.map(page => page.filter(item => item !== key))
  const dock = normalized.dockAppKeys.filter(item => item !== key)
  const sourcePageIndex = normalized.homePageKeys.findIndex(page => page.includes(key))
  const sourceItemIndex = sourcePageIndex >= 0
    ? normalized.homePageKeys[sourcePageIndex].indexOf(key)
    : -1
  const source: HomePlacement | undefined = normalized.dockAppKeys.includes(key)
    ? 'dock'
    : sourcePageIndex >= 0
      ? 'home'
      : undefined

  const ensurePage = (index: number) => {
    while (pages.length <= index && pages.length < MAX_HOME_PAGES) pages.push([])
    return Math.max(0, Math.min(pages.length - 1, index))
  }

  const insertBefore = (target: HomeAppKey[], item: HomeAppKey, marker?: HomeAppKey) => {
    const index = marker ? target.indexOf(marker) : -1
    target.splice(index >= 0 ? index : target.length, 0, item)
  }

  if (destination === 'home') {
    let targetPageIndex = destinationPageIndex ?? sourcePageIndex
    if (beforeKey) {
      const markerPage = pages.findIndex(page => page.includes(beforeKey))
      if (markerPage >= 0) targetPageIndex = markerPage
    }
    targetPageIndex = ensurePage(targetPageIndex >= 0 ? targetPageIndex : 0)

    // 从 Dock 拖到另一个 Dock 图标上时，被顶出的图标回到来源页。
    if (beforeKey && dock.includes(beforeKey)) {
      dock.splice(dock.indexOf(beforeKey), 1)
      const returnPage = ensurePage(sourcePageIndex >= 0 ? sourcePageIndex : targetPageIndex)
      const returnAt = sourceItemIndex >= 0 ? Math.min(sourceItemIndex, pages[returnPage].length) : pages[returnPage].length
      pages[returnPage].splice(returnAt, 0, beforeKey)
    }
    insertBefore(pages[targetPageIndex], key, beforeKey)
  } else {
    if (dock.length >= 4) {
      const targetIndex = beforeKey ? dock.indexOf(beforeKey) : -1
      if (targetIndex < 0) return normalized
      const displaced = dock[targetIndex]
      dock[targetIndex] = key
      if (displaced && displaced !== key) {
        const returnPage = ensurePage(source === 'home' && sourcePageIndex >= 0 ? sourcePageIndex : 0)
        const returnAt = sourceItemIndex >= 0 ? Math.min(sourceItemIndex, pages[returnPage].length) : pages[returnPage].length
        pages[returnPage].splice(returnAt, 0, displaced)
      }
    } else {
      insertBefore(dock, key, beforeKey)
    }
  }

  const homeAppKeys = pages.flat()
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys,
    homePageKeys: pages,
    dockAppKeys: dock
  })
}

/**
 * 宽松的存储输入。IndexedDB 中旧版本记录使用 string[]；Launcher V3 又新增 string[][]。
 * 加载时全部先接收 unknown，再通过白名单和去重规则收窄，旧数据无需数据库迁移。
 */
type HomeAppearanceInput = {
  wallpaperDataUrl?: unknown
  iconScale?: unknown
  showAppLabels?: unknown
  homeAppKeys?: unknown
  homePageKeys?: unknown
  dockAppKeys?: unknown
  homeWidgetKeys?: unknown
  widgetStyle?: unknown
}

const APP_CATALOG: readonly HomeAppDefinition[] = [
  { key: 'banxin', label: '知间', route: '/companion', icon: 'banxin', tone: ['#16b874', '#62d6a4'] },
  { key: 'music', label: '音乐', route: '/app/音乐', icon: 'music', tone: ['#8f9cde', '#b9c4ef'] },
  { key: 'turtle-soup', label: '海龟汤', route: '/app/海龟汤', icon: 'turtle-soup', tone: ['#75bcc4', '#a8d8d3'] },
  { key: 'profile', label: '我的资料', route: '/profile', icon: 'profile', tone: ['#9aa6df', '#c5cdf0'] },
  { key: 'memory', label: '记忆', route: '/memory', icon: 'memory', tone: ['#a8a1dc', '#d0c9ee'] },
  { key: 'world', label: '世界', route: '/world', icon: 'world', tone: ['#7eafd6', '#b6d5ea'] },
  { key: 'backup', label: '数据备份', route: '/backup', icon: 'backup', tone: ['#9caebb', '#c8d3dc'] },
  { key: 'settings', label: '设置', route: '/settings', icon: 'settings', tone: ['#a7b4c3', '#d1d9e2'] },
  { key: 'new-character', label: '新建角色', route: '/characters/new', icon: 'new-character', tone: ['#8ebce8', '#bddcf4'] }
]

export const HOME_APPS: HomeAppDefinition[] = pickApps([
  'music',
  'turtle-soup',
  'profile',
  'memory',
  'backup'
])

export const DOCK_APPS: HomeAppDefinition[] = pickApps([
  'banxin',
  'new-character',
  'world',
  'settings'
])

export const WIDGET_CATALOG: readonly HomeWidgetDefinition[] = [
  { key: 'greeting', label: '今天', description: '时间、日期与一句轻量问候', size: 'medium' },
  { key: 'companion', label: '最近的人', description: '快速回到最近互动的角色', size: 'small' },
  { key: 'world', label: '世界状态', description: '查看当前世界与事件状态', size: 'small' },
  { key: 'music', label: '一起听', description: '快速进入音乐陪伴', size: 'medium' }
]

const DEFAULT_HOME_APP_KEYS = HOME_APPS.map(app => app.key)

export const DEFAULT_HOME_APPEARANCE: HomeAppearancePreferences = {
  iconScale: 1,
  showAppLabels: true,
  homeAppKeys: DEFAULT_HOME_APP_KEYS,
  homePageKeys: paginateHomeAppKeys(DEFAULT_HOME_APP_KEYS, true),
  dockAppKeys: DOCK_APPS.map(app => app.key),
  homeWidgetKeys: ['greeting'],
  widgetStyle: 'frosted'
}

const APPEARANCE_APP_KEY = '__home-appearance__'
const VALID_APP_KEYS = new Set(APP_CATALOG.map(app => app.key))
const VALID_WIDGET_KEYS = new Set(WIDGET_CATALOG.map(widget => widget.key))

/** 所有能出现在主屏幕或 Dock 中、也允许玩家替换图标的 App。 */
export const CUSTOMIZABLE_APPS: HomeAppDefinition[] = [...APP_CATALOG]

export function getHomeAppDefinition(key: HomeAppKey) {
  return APP_CATALOG.find(app => app.key === key)
}

export function resolveHomeApps(preferences: HomeAppearancePreferences) {
  return preferences.homeAppKeys
    .map(key => getHomeAppDefinition(key))
    .filter((item): item is HomeAppDefinition => Boolean(item))
}

export function resolveDockApps(preferences: HomeAppearancePreferences) {
  return preferences.dockAppKeys
    .map(key => getHomeAppDefinition(key))
    .filter((item): item is HomeAppDefinition => Boolean(item))
    .slice(0, 4)
}

function pickApps(keys: HomeAppKey[]) {
  return keys
    .map(key => APP_CATALOG.find(app => app.key === key))
    .filter((item): item is HomeAppDefinition => Boolean(item))
}

function customizationId(worldId: string, appKey: string) {
  return `${worldId}:${appKey}`
}

export async function listAppCustomizations(worldId: string) {
  return db.appCustomizations.where('worldId').equals(worldId).toArray()
}

export async function saveAppIcon(worldId: string, appKey: HomeAppKey, iconDataUrl: string) {
  const now = new Date().toISOString()
  const row: AppCustomization = {
    id: customizationId(worldId, appKey),
    worldId,
    appKey,
    iconDataUrl,
    updatedAt: now
  }
  await db.appCustomizations.put(row)
  return row
}

export async function resetAppIcon(worldId: string, appKey: HomeAppKey) {
  await db.appCustomizations.delete(customizationId(worldId, appKey))
}

export async function loadHomeAppearance(worldId: string): Promise<HomeAppearancePreferences> {
  const row = await db.appCustomizations.get(customizationId(worldId, APPEARANCE_APP_KEY))
  return normalizeHomeAppearance({
    wallpaperDataUrl: row?.wallpaperDataUrl,
    iconScale: row?.iconScale,
    showAppLabels: row?.showAppLabels,
    homeAppKeys: row?.homeAppKeys,
    homePageKeys: row?.homePageKeys,
    dockAppKeys: row?.dockAppKeys,
    homeWidgetKeys: row?.homeWidgetKeys,
    widgetStyle: row?.widgetStyle
  })
}

export async function saveHomeAppearance(worldId: string, value: HomeAppearancePreferences) {
  const normalized = normalizeHomeAppearance(value)
  const row: AppCustomization = {
    id: customizationId(worldId, APPEARANCE_APP_KEY),
    worldId,
    appKey: APPEARANCE_APP_KEY,
    wallpaperDataUrl: normalized.wallpaperDataUrl,
    iconScale: normalized.iconScale,
    showAppLabels: normalized.showAppLabels,
    homeAppKeys: normalized.homeAppKeys,
    homePageKeys: normalized.homePageKeys,
    dockAppKeys: normalized.dockAppKeys,
    homeWidgetKeys: normalized.homeWidgetKeys,
    widgetStyle: normalized.widgetStyle,
    updatedAt: new Date().toISOString()
  }
  await db.appCustomizations.put(row)
  return normalized
}

export async function resetHomeWallpaper(worldId: string) {
  const current = await loadHomeAppearance(worldId)
  await saveHomeAppearance(worldId, { ...current, wallpaperDataUrl: undefined })
}

export function normalizeHomeAppearance(value: HomeAppearanceInput): HomeAppearancePreferences {
  const homeWidgetKeys = normalizeWidgetKeys(value.homeWidgetKeys, DEFAULT_HOME_APPEARANCE.homeWidgetKeys)
  const requestedHomeAppKeys = normalizeAppKeys(value.homeAppKeys, DEFAULT_HOME_APPEARANCE.homeAppKeys)
  const homePageKeys = normalizeHomePageKeys(
    value.homePageKeys,
    requestedHomeAppKeys,
    homeWidgetKeys.length > 0
  )
  const homeAppKeys = homePageKeys.flat()
  return {
    wallpaperDataUrl: typeof value.wallpaperDataUrl === 'string' && value.wallpaperDataUrl ? value.wallpaperDataUrl : undefined,
    iconScale: clampIconScale(value.iconScale),
    showAppLabels: value.showAppLabels !== false,
    homeAppKeys,
    homePageKeys,
    dockAppKeys: normalizeAppKeys(value.dockAppKeys, DEFAULT_HOME_APPEARANCE.dockAppKeys).slice(0, 4),
    homeWidgetKeys,
    widgetStyle: value.widgetStyle === 'clear' || value.widgetStyle === 'solid' ? value.widgetStyle : 'frosted'
  }
}

function normalizeHomePageKeys(value: unknown, homeAppKeys: HomeAppKey[], hasWidgets: boolean) {
  const allowed = new Set(homeAppKeys)
  const seen = new Set<HomeAppKey>()
  const pages: HomeAppKey[][] = []

  if (Array.isArray(value) && value.some(page => Array.isArray(page))) {
    for (const rawPage of value.slice(0, MAX_HOME_PAGES)) {
      if (!Array.isArray(rawPage)) continue
      const page: HomeAppKey[] = []
      for (const raw of rawPage) {
        if (typeof raw !== 'string' || !VALID_APP_KEYS.has(raw as HomeAppKey)) continue
        const key = raw as HomeAppKey
        if (!allowed.has(key) || seen.has(key)) continue
        seen.add(key)
        page.push(key)
      }
      pages.push(page)
    }
  }

  if (pages.length === 0) {
    return paginateHomeAppKeys(homeAppKeys, hasWidgets)
  }

  const missing = homeAppKeys.filter(key => !seen.has(key))
  if (missing.length) pages[pages.length - 1].push(...missing)
  while (pages.length < MIN_HOME_PAGES) pages.push([])
  return pages.slice(0, MAX_HOME_PAGES)
}

function normalizeAppKeys(value: unknown, fallback: HomeAppKey[]) {
  if (!Array.isArray(value)) return [...fallback]
  const seen = new Set<HomeAppKey>()
  const result: HomeAppKey[] = []
  for (const raw of value) {
    if (typeof raw !== 'string' || !VALID_APP_KEYS.has(raw as HomeAppKey)) continue
    const key = raw as HomeAppKey
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

function normalizeWidgetKeys(value: unknown, fallback: HomeWidgetKey[]) {
  if (!Array.isArray(value)) return [...fallback]
  const seen = new Set<HomeWidgetKey>()
  const result: HomeWidgetKey[] = []
  for (const raw of value) {
    if (typeof raw !== 'string' || !VALID_WIDGET_KEYS.has(raw as HomeWidgetKey)) continue
    const key = raw as HomeWidgetKey
    if (seen.has(key)) continue
    seen.add(key)
    result.push(key)
  }
  return result
}

function clampIconScale(value?: unknown) {
  if (!Number.isFinite(value)) return DEFAULT_HOME_APPEARANCE.iconScale
  return Math.max(0.88, Math.min(1.12, Number(value)))
}

function readAsDataUrl(file: File | Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败。'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('浏览器无法解析这张图片。'))
    image.src = dataUrl
  })
}

/** 将玩家上传的图标中心裁切并压缩后存进 IndexedDB。 */
export async function prepareAppIcon(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 8 * 1024 * 1024) throw new Error('图标图片不能超过 8 MB。')

  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效。')

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理图片。')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight)
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  const x = (size - width) / 2
  const y = (size - height) / 2
  context.drawImage(image, x, y, width, height)

  let quality = 0.9
  let blob: Blob | null = null
  while (quality >= 0.58) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.size <= 380 * 1024) break
    quality -= 0.08
  }

  if (!blob) throw new Error('图标编码失败。')
  if (blob.size > 420 * 1024) throw new Error('这张图片压缩后仍然过大，请换一张更简单的图片。')
  return readAsDataUrl(blob)
}

/** 壁纸进入 IndexedDB 前先缩放，避免备份膨胀和移动端卡顿。 */
export async function prepareHomeWallpaper(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。')
  if (file.size > 16 * 1024 * 1024) throw new Error('壁纸图片不能超过 16 MB。')

  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效。')

  const maxWidth = 1440
  const maxHeight = 2560
  const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理图片。')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  let quality = 0.88
  let blob: Blob | null = null
  while (quality >= 0.56) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
    if (blob && blob.size <= 1.35 * 1024 * 1024) break
    quality -= 0.08
  }
  if (!blob) throw new Error('壁纸编码失败。')
  if (blob.size > 1.6 * 1024 * 1024) throw new Error('壁纸压缩后仍然过大，请换一张尺寸较小的图片。')
  return readAsDataUrl(blob)
}
