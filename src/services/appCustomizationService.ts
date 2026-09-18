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

export const HOME_GRID_COLUMNS = 4
export const HOME_GRID_ROWS = 6
export const MAX_HOME_PAGES = 8

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

export interface HomeLayoutAppItem {
  id: string
  type: 'app'
  key: HomeAppKey
  x: number
  y: number
  w: 1
  h: 1
}

export interface HomeLayoutWidgetItem {
  id: string
  type: 'widget'
  key: HomeWidgetKey
  x: number
  y: number
  w: number
  h: number
}

export type HomeLayoutItem = HomeLayoutAppItem | HomeLayoutWidgetItem

export interface HomeLayoutPage {
  items: HomeLayoutItem[]
}

export interface HomeAppearancePreferences {
  wallpaperDataUrl?: string
  iconScale: number
  showAppLabels: boolean
  /** 扁平列表只负责“桌面是否显示”，用于兼容旧版本和设置页。 */
  homeAppKeys: HomeAppKey[]
  /** 兼容旧版分页顺序；Launcher Grid 的真实状态以 homeLayoutPages 为准。 */
  homePageKeys: HomeAppKey[][]
  /** Launcher Grid：4×6 槽位。App=1×1，小组件可合并多个槽位。 */
  homeLayoutPages: HomeLayoutPage[]
  dockAppKeys: HomeAppKey[]
  homeWidgetKeys: HomeWidgetKey[]
  widgetStyle: HomeWidgetStyle
}

export type HomePlacement = 'home' | 'dock'

/**
 * 旧版只有一维 homeAppKeys。保留这个函数给历史兼容与测试；新 Launcher 不再靠容量
 * 自动挤页，而是把每页的网格位置持久化到 homeLayoutPages。
 */
export function paginateHomeAppKeys(
  keys: readonly HomeAppKey[],
  hasWidgets = false,
  firstPageCapacity = hasWidgets ? 4 : 12,
  pageCapacity = 12,
  minimumPages = 1
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
const APPEARANCE_APP_KEY = '__home-appearance__'
const VALID_APP_KEYS = new Set(APP_CATALOG.map(app => app.key))
const VALID_WIDGET_KEYS = new Set(WIDGET_CATALOG.map(widget => widget.key))

/** 所有能出现在主屏幕或 Dock 中、也允许玩家替换图标的 App。 */
export const CUSTOMIZABLE_APPS: HomeAppDefinition[] = [...APP_CATALOG]

function layoutId(type: 'app' | 'widget', key: string) {
  return `${type}:${key}`
}

export function getWidgetGridSize(key: HomeWidgetKey) {
  const size = WIDGET_CATALOG.find(item => item.key === key)?.size ?? 'small'
  return size === 'medium' ? { w: 4, h: 2 } : { w: 2, h: 2 }
}

function cellsOverlap(a: Pick<HomeLayoutItem, 'x' | 'y' | 'w' | 'h'>, b: Pick<HomeLayoutItem, 'x' | 'y' | 'w' | 'h'>) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function canPlace(items: readonly HomeLayoutItem[], x: number, y: number, w: number, h: number, ignoreId?: string) {
  if (x < 0 || y < 0 || w < 1 || h < 1) return false
  if (x + w > HOME_GRID_COLUMNS || y + h > HOME_GRID_ROWS) return false
  const probe = { x, y, w, h }
  return !items.some(item => item.id !== ignoreId && cellsOverlap(item, probe))
}

function findFirstFit(items: readonly HomeLayoutItem[], w: number, h: number) {
  for (let y = 0; y <= HOME_GRID_ROWS - h; y += 1) {
    for (let x = 0; x <= HOME_GRID_COLUMNS - w; x += 1) {
      if (canPlace(items, x, y, w, h)) return { x, y }
    }
  }
  return undefined
}

function createAppItem(key: HomeAppKey, x: number, y: number): HomeLayoutAppItem {
  return { id: layoutId('app', key), type: 'app', key, x, y, w: 1, h: 1 }
}

function createWidgetItem(key: HomeWidgetKey, x: number, y: number): HomeLayoutWidgetItem {
  const { w, h } = getWidgetGridSize(key)
  return { id: layoutId('widget', key), type: 'widget', key, x, y, w, h }
}

function ensurePage(pages: HomeLayoutPage[], index: number) {
  const capped = Math.max(0, Math.min(MAX_HOME_PAGES - 1, index))
  while (pages.length <= capped && pages.length < MAX_HOME_PAGES) pages.push({ items: [] })
  return Math.min(capped, pages.length - 1)
}

function placeOnAnyPage(
  pages: HomeLayoutPage[],
  item: Omit<HomeLayoutItem, 'x' | 'y'> & { x?: number; y?: number },
  preferredPage = Math.max(0, pages.length - 1)
) {
  if (!pages.length) pages.push({ items: [] })
  const order = [preferredPage, ...pages.map((_, index) => index).filter(index => index !== preferredPage)]
  for (const index of order) {
    if (!pages[index]) continue
    const fit = findFirstFit(pages[index].items, item.w, item.h)
    if (!fit) continue
    pages[index].items.push({ ...item, ...fit } as HomeLayoutItem)
    return index
  }
  if (pages.length < MAX_HOME_PAGES) {
    const page = { items: [] as HomeLayoutItem[] }
    pages.push(page)
    const fit = findFirstFit(page.items, item.w, item.h)
    if (fit) page.items.push({ ...item, ...fit } as HomeLayoutItem)
    return pages.length - 1
  }
  return -1
}

function createLegacyLayout(homePages: readonly HomeAppKey[][], widgets: readonly HomeWidgetKey[]) {
  const pages: HomeLayoutPage[] = homePages.length
    ? homePages.slice(0, MAX_HOME_PAGES).map(() => ({ items: [] }))
    : [{ items: [] }]

  // 旧版 Widget 都在第一页。先放 Widget，再按旧页归属放 App，可保持用户看到的布局最接近升级前。
  for (const key of widgets) {
    const { w, h } = getWidgetGridSize(key)
    const fit = findFirstFit(pages[0].items, w, h)
    if (fit) pages[0].items.push(createWidgetItem(key, fit.x, fit.y))
    else placeOnAnyPage(pages, { ...createWidgetItem(key, 0, 0), x: undefined, y: undefined }, 0)
  }

  homePages.forEach((keys, pageIndex) => {
    if (pageIndex >= MAX_HOME_PAGES) return
    ensurePage(pages, pageIndex)
    for (const key of keys) {
      const fit = findFirstFit(pages[pageIndex].items, 1, 1)
      if (fit) pages[pageIndex].items.push(createAppItem(key, fit.x, fit.y))
      else placeOnAnyPage(pages, { ...createAppItem(key, 0, 0), x: undefined, y: undefined }, pageIndex)
    }
  })

  return compactLayoutPages(pages)
}

function compactLayoutPages(pages: HomeLayoutPage[]) {
  const nonEmpty = pages.filter(page => page.items.length > 0).slice(0, MAX_HOME_PAGES)
  return nonEmpty.length ? nonEmpty : [{ items: [] }]
}

function normalizeLayoutPages(
  value: unknown,
  homeAppKeys: HomeAppKey[],
  homeWidgetKeys: HomeWidgetKey[],
  legacyPages: HomeAppKey[][]
) {
  const allowedApps = new Set(homeAppKeys)
  const allowedWidgets = new Set(homeWidgetKeys)
  const seenApps = new Set<HomeAppKey>()
  const seenWidgets = new Set<HomeWidgetKey>()
  const pages: HomeLayoutPage[] = []

  if (Array.isArray(value)) {
    for (const rawPage of value.slice(0, MAX_HOME_PAGES)) {
      if (!rawPage || typeof rawPage !== 'object') continue
      const rawItems = Array.isArray((rawPage as { items?: unknown }).items)
        ? (rawPage as { items: unknown[] }).items
        : []
      const page: HomeLayoutPage = { items: [] }

      for (const rawItem of rawItems) {
        if (!rawItem || typeof rawItem !== 'object') continue
        const row = rawItem as Record<string, unknown>
        const type = row.type
        const rawKey = row.key
        if (type !== 'app' && type !== 'widget') continue
        if (typeof rawKey !== 'string') continue

        if (type === 'app') {
          const key = rawKey as HomeAppKey
          if (!VALID_APP_KEYS.has(key) || !allowedApps.has(key) || seenApps.has(key)) continue
          const x = normalizeGridCoordinate(row.x, HOME_GRID_COLUMNS - 1)
          const y = normalizeGridCoordinate(row.y, HOME_GRID_ROWS - 1)
          const item = createAppItem(key, x, y)
          if (!canPlace(page.items, item.x, item.y, item.w, item.h)) {
            const fit = findFirstFit(page.items, 1, 1)
            if (!fit) continue
            item.x = fit.x
            item.y = fit.y
          }
          page.items.push(item)
          seenApps.add(key)
          continue
        }

        const key = rawKey as HomeWidgetKey
        if (!VALID_WIDGET_KEYS.has(key) || !allowedWidgets.has(key) || seenWidgets.has(key)) continue
        const { w, h } = getWidgetGridSize(key)
        let x = normalizeGridCoordinate(row.x, HOME_GRID_COLUMNS - w)
        let y = normalizeGridCoordinate(row.y, HOME_GRID_ROWS - h)
        if (!canPlace(page.items, x, y, w, h)) {
          const fit = findFirstFit(page.items, w, h)
          if (!fit) continue
          x = fit.x
          y = fit.y
        }
        page.items.push(createWidgetItem(key, x, y))
        seenWidgets.add(key)
      }
      if (page.items.length) pages.push(page)
    }
  }

  if (!pages.length) {
    return createLegacyLayout(legacyPages, homeWidgetKeys)
  }

  // 存储中缺失的已启用 Widget/App 只补空位，不挪动玩家已有页面和坐标。
  for (const key of homeWidgetKeys) {
    if (seenWidgets.has(key)) continue
    const item = createWidgetItem(key, 0, 0)
    placeOnAnyPage(pages, { ...item, x: undefined, y: undefined }, 0)
  }
  for (const key of homeAppKeys) {
    if (seenApps.has(key)) continue
    const item = createAppItem(key, 0, 0)
    placeOnAnyPage(pages, { ...item, x: undefined, y: undefined })
  }

  return compactLayoutPages(pages)
}

function normalizeGridCoordinate(value: unknown, max: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.floor(Number(value))))
}

function deriveLegacyPageKeys(pages: readonly HomeLayoutPage[]) {
  return pages.map(page => page.items
    .filter((item): item is HomeLayoutAppItem => item.type === 'app')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(item => item.key))
}

/**
 * 把 App 放到明确的 4×6 网格槽位。空白页只有在实际放入 App 后才持久化，
 * 所以一个 App 可以独占一页，而清空后的页面会自动消失。
 */
export function moveHomeAppToGrid(
  value: HomeAppearancePreferences,
  key: HomeAppKey,
  destinationPageIndex: number,
  x: number,
  y: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item })) }))
  const dock = [...normalized.dockAppKeys]
  const sourceDockIndex = dock.indexOf(key)
  if (sourceDockIndex >= 0) dock.splice(sourceDockIndex, 1)

  let sourcePage = -1
  let sourceItem: HomeLayoutAppItem | undefined
  pages.forEach((page, pageIndex) => {
    const index = page.items.findIndex(item => item.type === 'app' && item.key === key)
    if (index < 0) return
    const [removed] = page.items.splice(index, 1)
    if (removed?.type === 'app') {
      sourcePage = pageIndex
      sourceItem = removed
    }
  })

  const targetPageIndex = ensurePage(pages, destinationPageIndex)
  const targetPage = pages[targetPageIndex]
  const targetX = normalizeGridCoordinate(x, HOME_GRID_COLUMNS - 1)
  const targetY = normalizeGridCoordinate(y, HOME_GRID_ROWS - 1)
  const occupantIndex = targetPage.items.findIndex(item =>
    item.type === 'app' && cellsOverlap(item, { x: targetX, y: targetY, w: 1, h: 1 })
  )
  const blockedByWidget = targetPage.items.some(item =>
    item.type === 'widget' && cellsOverlap(item, { x: targetX, y: targetY, w: 1, h: 1 })
  )

  if (blockedByWidget) return normalized

  if (occupantIndex >= 0) {
    const [occupant] = targetPage.items.splice(occupantIndex, 1)
    if (occupant?.type === 'app') {
      if (sourceItem && sourcePage >= 0) {
        pages[sourcePage].items.push(createAppItem(occupant.key, sourceItem.x, sourceItem.y))
      } else if (sourceDockIndex >= 0) {
        dock.splice(Math.min(sourceDockIndex, dock.length), 0, occupant.key)
      } else {
        const fit = findFirstFit(targetPage.items, 1, 1)
        if (fit) targetPage.items.push(createAppItem(occupant.key, fit.x, fit.y))
      }
    }
  }

  targetPage.items.push(createAppItem(key, targetX, targetY))

  const compacted = compactLayoutPages(pages)
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys: compacted.flatMap(page => page.items.filter((item): item is HomeLayoutAppItem => item.type === 'app').map(item => item.key)),
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted,
    dockAppKeys: dock
  })
}

export function addHomeWidgetToGrid(
  value: HomeAppearancePreferences,
  key: HomeWidgetKey,
  preferredPageIndex = 0
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  if (normalized.homeWidgetKeys.includes(key)) return normalized
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item })) }))
  const item = createWidgetItem(key, 0, 0)
  const pageIndex = ensurePage(pages, preferredPageIndex)
  const fit = findFirstFit(pages[pageIndex].items, item.w, item.h)
  if (fit) pages[pageIndex].items.push(createWidgetItem(key, fit.x, fit.y))
  else placeOnAnyPage(pages, { ...item, x: undefined, y: undefined }, pageIndex)

  return normalizeHomeAppearance({
    ...normalized,
    homeWidgetKeys: [...normalized.homeWidgetKeys, key],
    homeLayoutPages: pages
  })
}

/**
 * 兼容旧调用：排序 / Dock 交换仍可用；Home Screen 的精确位置移动使用 moveHomeAppToGrid。
 */
export function moveHomeAppPlacement(
  value: HomeAppearancePreferences,
  key: HomeAppKey,
  destination: HomePlacement,
  beforeKey?: HomeAppKey,
  destinationPageIndex?: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  if (destination === 'home') {
    const pageIndex = Math.max(0, destinationPageIndex ?? normalized.homeLayoutPages.findIndex(page =>
      page.items.some(item => item.type === 'app' && item.key === beforeKey)
    ))
    const page = normalized.homeLayoutPages[pageIndex]
    const marker = beforeKey
      ? page?.items.find(item => item.type === 'app' && item.key === beforeKey)
      : undefined
    const fit = marker && marker.type === 'app'
      ? { x: marker.x, y: marker.y }
      : findFirstFit(page?.items ?? [], 1, 1) ?? { x: 0, y: 0 }
    return moveHomeAppToGrid(normalized, key, pageIndex, fit.x, fit.y)
  }

  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item })) }))
  const dock = normalized.dockAppKeys.filter(item => item !== key)
  let sourcePage = -1
  let sourceItem: HomeLayoutAppItem | undefined
  pages.forEach((page, pageIndex) => {
    const index = page.items.findIndex(item => item.type === 'app' && item.key === key)
    if (index < 0) return
    const [removed] = page.items.splice(index, 1)
    if (removed?.type === 'app') {
      sourcePage = pageIndex
      sourceItem = removed
    }
  })

  if (dock.length >= 4) {
    const targetIndex = beforeKey ? dock.indexOf(beforeKey) : -1
    if (targetIndex < 0) return normalized
    const displaced = dock[targetIndex]
    dock[targetIndex] = key
    if (displaced) {
      const pageIndex = sourcePage >= 0 ? sourcePage : 0
      ensurePage(pages, pageIndex)
      const fit = sourceItem && canPlace(pages[pageIndex].items, sourceItem.x, sourceItem.y, 1, 1)
        ? { x: sourceItem.x, y: sourceItem.y }
        : findFirstFit(pages[pageIndex].items, 1, 1)
      if (fit) pages[pageIndex].items.push(createAppItem(displaced, fit.x, fit.y))
    }
  } else {
    const targetIndex = beforeKey ? dock.indexOf(beforeKey) : -1
    dock.splice(targetIndex >= 0 ? targetIndex : dock.length, 0, key)
  }

  const compacted = compactLayoutPages(pages)
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys: compacted.flatMap(page => page.items.filter((item): item is HomeLayoutAppItem => item.type === 'app').map(item => item.key)),
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted,
    dockAppKeys: dock
  })
}

/**
 * 宽松的存储输入。IndexedDB 中旧版本记录使用 string[]/string[][]；Launcher Grid
 * 新增非索引 JSON 字段，加载时统一白名单收窄，因此无需数据库迁移。
 */
type HomeAppearanceInput = {
  wallpaperDataUrl?: unknown
  iconScale?: unknown
  showAppLabels?: unknown
  homeAppKeys?: unknown
  homePageKeys?: unknown
  homeLayoutPages?: unknown
  dockAppKeys?: unknown
  homeWidgetKeys?: unknown
  widgetStyle?: unknown
}

function createDefaultAppearance(): HomeAppearancePreferences {
  const homeWidgetKeys: HomeWidgetKey[] = ['greeting']
  const legacyPages = [[...DEFAULT_HOME_APP_KEYS]]
  const homeLayoutPages = createLegacyLayout(legacyPages, homeWidgetKeys)
  return {
    iconScale: 1,
    showAppLabels: true,
    homeAppKeys: [...DEFAULT_HOME_APP_KEYS],
    homePageKeys: deriveLegacyPageKeys(homeLayoutPages),
    homeLayoutPages,
    dockAppKeys: DOCK_APPS.map(app => app.key),
    homeWidgetKeys,
    widgetStyle: 'frosted'
  }
}

export const DEFAULT_HOME_APPEARANCE: HomeAppearancePreferences = createDefaultAppearance()

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
    homeLayoutPages: row?.homeLayoutPages,
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
    homeLayoutPages: normalized.homeLayoutPages,
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
  const fallback = DEFAULT_HOME_APPEARANCE ?? createDefaultAppearance()
  const homeWidgetKeys = normalizeWidgetKeys(value.homeWidgetKeys, fallback.homeWidgetKeys)
  const requestedHomeAppKeys = normalizeAppKeys(value.homeAppKeys, fallback.homeAppKeys)
  const legacyPages = normalizeHomePageKeys(value.homePageKeys, requestedHomeAppKeys, homeWidgetKeys.length > 0)
  const homeLayoutPages = normalizeLayoutPages(value.homeLayoutPages, requestedHomeAppKeys, homeWidgetKeys, legacyPages)
  const homeAppKeys = homeLayoutPages.flatMap(page => page.items
    .filter((item): item is HomeLayoutAppItem => item.type === 'app')
    .map(item => item.key))
  const resolvedWidgetKeys = homeLayoutPages.flatMap(page => page.items
    .filter((item): item is HomeLayoutWidgetItem => item.type === 'widget')
    .map(item => item.key))

  return {
    wallpaperDataUrl: typeof value.wallpaperDataUrl === 'string' && value.wallpaperDataUrl ? value.wallpaperDataUrl : undefined,
    iconScale: clampIconScale(value.iconScale),
    showAppLabels: value.showAppLabels !== false,
    homeAppKeys,
    homePageKeys: deriveLegacyPageKeys(homeLayoutPages),
    homeLayoutPages,
    dockAppKeys: normalizeAppKeys(value.dockAppKeys, fallback.dockAppKeys).slice(0, 4),
    homeWidgetKeys: resolvedWidgetKeys,
    widgetStyle: value.widgetStyle === 'clear' || value.widgetStyle === 'solid' ? value.widgetStyle : 'frosted'
  }
}

function normalizeHomePageKeys(value: unknown, homeAppKeys: HomeAppKey[], hasWidgets: boolean) {
  const allowed = new Set(homeAppKeys)
  const seen = new Set<HomeAppKey>()
  const rawPages: HomeAppKey[][] = []

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
      if (page.length) rawPages.push(page)
    }
  }

  if (rawPages.length === 0) {
    return paginateHomeAppKeys(homeAppKeys, hasWidgets, hasWidgets ? 4 : 12, 12, 1)
  }

  const missing = homeAppKeys.filter(key => !seen.has(key))
  if (missing.length) {
    if (!rawPages.length) rawPages.push([])
    rawPages[rawPages.length - 1].push(...missing)
  }
  return rawPages.slice(0, MAX_HOME_PAGES)
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
  if (!Number.isFinite(value)) return 1
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
