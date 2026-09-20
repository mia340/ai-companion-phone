import { z } from 'zod'
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

export type HomeWidgetKey = 'greeting' | 'companion' | 'world' | 'music' | 'photo' | 'calendar'
export type HomeWidgetStyle = 'clear' | 'frosted' | 'solid'
export type HomeThemePreset = 'default' | 'dark' | 'clear' | 'tinted'

export interface HomeWidgetSettings {
  photo?: {
    imageDataUrl?: string
    caption?: string
  }
  calendar?: {
    startWeekOnMonday?: boolean
  }
}

export const HOME_GRID_COLUMNS = 4
export const HOME_GRID_ROWS = 6
export const MAX_HOME_PAGES = 8
export const HOME_LAYOUT_REVISION = 10

export interface HomeAppDefinition {
  key: HomeAppKey
  label: string
  route: string
  icon: HomeAppKey
  tone: [string, string]
}

export interface HomeWidgetGridSize {
  key: 'compact' | 'regular' | 'large'
  label: string
  w: number
  h: number
}

export interface HomeWidgetDefinition {
  key: HomeWidgetKey
  label: string
  description: string
  size: 'small' | 'medium'
  /** Apple 式可选尺寸。网格尺寸直接持久化到 HomeLayoutItem，后续可继续扩展。 */
  gridSizes: readonly HomeWidgetGridSize[]
  defaultGridSize: HomeWidgetGridSize['key']
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

export interface HomeLayoutFolderItem {
  id: string
  type: 'folder'
  key: string
  name: string
  appKeys: HomeAppKey[]
  x: number
  y: number
  w: 1
  h: 1
}

export type HomeLayoutItem = HomeLayoutAppItem | HomeLayoutWidgetItem | HomeLayoutFolderItem

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
  /** Apple 风格的快速外观预设，只影响 Launcher 表现，不影响 App 数据。 */
  themePreset: HomeThemePreset
  /** 小组件自己的轻量配置，仍保存在 appCustomizations 非索引记录中。 */
  homeWidgetSettings: HomeWidgetSettings
  /** 用于无破坏地执行一次性 Launcher 布局迁移。 */
  homeLayoutRevision: number
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
  {
    key: 'greeting', label: '今天', description: '时间、日期与一句轻量问候', size: 'medium', defaultGridSize: 'regular',
    gridSizes: [
      { key: 'compact', label: '紧凑', w: 2, h: 1 },
      { key: 'regular', label: '横向', w: 4, h: 1 },
      { key: 'large', label: '大号', w: 4, h: 2 }
    ]
  },
  {
    key: 'companion', label: '最近的人', description: '快速回到最近互动的角色', size: 'small', defaultGridSize: 'compact',
    gridSizes: [
      { key: 'compact', label: '小号', w: 2, h: 1 },
      { key: 'regular', label: '横向', w: 4, h: 1 },
      { key: 'large', label: '方形', w: 2, h: 2 }
    ]
  },
  {
    key: 'world', label: '世界状态', description: '查看当前世界与事件状态', size: 'small', defaultGridSize: 'compact',
    gridSizes: [
      { key: 'compact', label: '小号', w: 2, h: 1 },
      { key: 'regular', label: '横向', w: 4, h: 1 },
      { key: 'large', label: '方形', w: 2, h: 2 }
    ]
  },
  {
    key: 'music', label: '一起听', description: '当前歌曲与音乐陪伴', size: 'medium', defaultGridSize: 'regular',
    gridSizes: [
      { key: 'compact', label: '小号', w: 2, h: 1 },
      { key: 'regular', label: '横向', w: 4, h: 1 },
      { key: 'large', label: '大号', w: 4, h: 2 }
    ]
  },
  {
    key: 'calendar', label: '日历', description: '日期、星期与当月概览', size: 'small', defaultGridSize: 'compact',
    gridSizes: [
      { key: 'compact', label: '小号', w: 2, h: 1 },
      { key: 'regular', label: '横向', w: 4, h: 1 },
      { key: 'large', label: '方形', w: 2, h: 2 }
    ]
  },
  {
    key: 'photo', label: '照片', description: '把喜欢的照片放在主屏幕', size: 'small', defaultGridSize: 'compact',
    gridSizes: [
      { key: 'compact', label: '横向', w: 2, h: 1 },
      { key: 'regular', label: '方形', w: 2, h: 2 },
      { key: 'large', label: '大号', w: 4, h: 2 }
    ]
  }
]

const DEFAULT_HOME_APP_KEYS = HOME_APPS.map(app => app.key)
const APPEARANCE_APP_KEY = '__home-appearance__'
const VALID_APP_KEYS = new Set(APP_CATALOG.map(app => app.key))
const VALID_WIDGET_KEYS = new Set(WIDGET_CATALOG.map(widget => widget.key))


const homeLayoutBaseItemSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0).max(HOME_GRID_COLUMNS - 1),
  y: z.number().int().min(0).max(HOME_GRID_ROWS - 1),
  w: z.number().int().min(1).max(HOME_GRID_COLUMNS),
  h: z.number().int().min(1).max(HOME_GRID_ROWS)
})

const homeLayoutItemSchema = z.discriminatedUnion('type', [
  homeLayoutBaseItemSchema.extend({
    type: z.literal('app'),
    key: z.string().refine(value => VALID_APP_KEYS.has(value as HomeAppKey), '未知 App key'),
    w: z.literal(1),
    h: z.literal(1)
  }),
  homeLayoutBaseItemSchema.extend({
    type: z.literal('widget'),
    key: z.string().refine(value => VALID_WIDGET_KEYS.has(value as HomeWidgetKey), '未知 Widget key')
  }),
  homeLayoutBaseItemSchema.extend({
    type: z.literal('folder'),
    key: z.string().min(1),
    name: z.string().min(1).max(24),
    appKeys: z.array(z.string().refine(value => VALID_APP_KEYS.has(value as HomeAppKey), '未知文件夹 App key')).min(2),
    w: z.literal(1),
    h: z.literal(1)
  })
])

const homeLayoutPageSchema = z.object({ items: z.array(homeLayoutItemSchema) }).superRefine((page, ctx) => {
  const ids = new Set<string>()
  for (let index = 0; index < page.items.length; index += 1) {
    const item = page.items[index]
    if (ids.has(item.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'id'], message: '页面内布局 id 重复' })
    ids.add(item.id)
    if (item.x + item.w > HOME_GRID_COLUMNS || item.y + item.h > HOME_GRID_ROWS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index], message: '布局项目超出桌面网格' })
    }
    const overlap = page.items.slice(0, index).some(other =>
      item.x < other.x + other.w && item.x + item.w > other.x && item.y < other.y + other.h && item.y + item.h > other.y
    )
    if (overlap) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index], message: '布局项目发生重叠' })
  }
})

/** Launcher Grid V9 的正式持久化 Schema（App / Widget / Folder）。 */
export const homeLayoutPagesSchema = z.array(homeLayoutPageSchema).min(1).max(MAX_HOME_PAGES)

export function assertHomeLayoutPages(value: unknown): asserts value is HomeLayoutPage[] {
  const result = homeLayoutPagesSchema.safeParse(value)
  if (!result.success) throw new Error(`桌面布局校验失败：${result.error.issues[0]?.message || '未知错误'}`)
}

/** 所有能出现在主屏幕或 Dock 中、也允许玩家替换图标的 App。 */
export const CUSTOMIZABLE_APPS: HomeAppDefinition[] = [...APP_CATALOG]

function layoutId(type: 'app' | 'widget' | 'folder', key: string) {
  return `${type}:${key}`
}

export function getWidgetGridSizes(key: HomeWidgetKey) {
  return WIDGET_CATALOG.find(item => item.key === key)?.gridSizes ?? [{ key: 'compact' as const, label: '小号', w: 2, h: 1 }]
}

export function getWidgetGridSize(key: HomeWidgetKey, storedW?: unknown, storedH?: unknown) {
  const definition = WIDGET_CATALOG.find(item => item.key === key)
  const sizes = definition?.gridSizes ?? getWidgetGridSizes(key)
  const wantedW = Number(storedW)
  const wantedH = Number(storedH)
  const stored = sizes.find(size => size.w === wantedW && size.h === wantedH)
  if (stored) return { w: stored.w, h: stored.h }
  const preferred = sizes.find(size => size.key === definition?.defaultGridSize) ?? sizes[0]
  return { w: preferred.w, h: preferred.h }
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

function createWidgetItem(key: HomeWidgetKey, x: number, y: number, size?: { w: number; h: number }): HomeLayoutWidgetItem {
  const { w, h } = size ?? getWidgetGridSize(key)
  return { id: layoutId('widget', key), type: 'widget', key, x, y, w, h }
}

function createFolderItem(appKeys: readonly HomeAppKey[], x: number, y: number, name = '文件夹'): HomeLayoutFolderItem {
  const unique = [...new Set(appKeys)].filter(key => VALID_APP_KEYS.has(key))
  const key = unique.slice().sort().join('-') || 'apps'
  return { id: layoutId('folder', key), type: 'folder', key, name, appKeys: unique, x, y, w: 1, h: 1 }
}


function collectPageAppKeys(pages: readonly HomeLayoutPage[]) {
  const keys: HomeAppKey[] = []
  const seen = new Set<HomeAppKey>()
  for (const page of pages) {
    for (const item of page.items) {
      const itemKeys = item.type === 'app' ? [item.key] : item.type === 'folder' ? item.appKeys : []
      for (const key of itemKeys) {
        if (seen.has(key)) continue
        seen.add(key)
        keys.push(key)
      }
    }
  }
  return keys
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
        if (type !== 'app' && type !== 'widget' && type !== 'folder') continue
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

        if (type === 'folder') {
          const memberKeys = Array.isArray(row.appKeys)
            ? [...new Set(row.appKeys.filter((value): value is string => typeof value === 'string'))]
              .map(value => value as HomeAppKey)
              .filter(key => VALID_APP_KEYS.has(key) && allowedApps.has(key) && !seenApps.has(key))
            : []
          if (!memberKeys.length) continue
          const x = normalizeGridCoordinate(row.x, HOME_GRID_COLUMNS - 1)
          const y = normalizeGridCoordinate(row.y, HOME_GRID_ROWS - 1)
          const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 24) : '文件夹'
          const item: HomeLayoutItem = memberKeys.length >= 2
            ? { ...createFolderItem(memberKeys, x, y, name), id: typeof row.id === 'string' && row.id ? row.id : createFolderItem(memberKeys, x, y, name).id }
            : createAppItem(memberKeys[0], x, y)
          if (!canPlace(page.items, item.x, item.y, item.w, item.h)) {
            const fit = findFirstFit(page.items, 1, 1)
            if (!fit) continue
            item.x = fit.x
            item.y = fit.y
          }
          page.items.push(item)
          memberKeys.forEach(key => seenApps.add(key))
          continue
        }

        const key = rawKey as HomeWidgetKey
        if (!VALID_WIDGET_KEYS.has(key) || !allowedWidgets.has(key) || seenWidgets.has(key)) continue
        const { w, h } = getWidgetGridSize(key, row.w, row.h)
        let x = normalizeGridCoordinate(row.x, HOME_GRID_COLUMNS - w)
        let y = normalizeGridCoordinate(row.y, HOME_GRID_ROWS - h)
        if (!canPlace(page.items, x, y, w, h)) {
          const fit = findFirstFit(page.items, w, h)
          if (!fit) continue
          x = fit.x
          y = fit.y
        }
        page.items.push(createWidgetItem(key, x, y, { w, h }))
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
  return pages.map(page => sortItemsByVisualOrder(page.items).flatMap(item =>
    item.type === 'app' ? [item.key] : item.type === 'folder' ? item.appKeys : []
  ))
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
  return moveHomeLayoutItemToGrid(value, { type: 'app', key }, destinationPageIndex, x, y)
}


export type HomeLayoutMovableRef =
  | { type: 'app'; key: HomeAppKey }
  | { type: 'widget'; key: HomeWidgetKey }
  | { type: 'folder'; id: string }

function itemMatchesRef(item: HomeLayoutItem, ref: HomeLayoutMovableRef) {
  if (ref.type === 'folder') return item.type === 'folder' && item.id === ref.id
  return item.type === ref.type && item.key === ref.key
}

function layoutItemsFromAppearance(pages: readonly HomeLayoutPage[], type: HomeLayoutItem['type']) {
  return pages.flatMap(page => page.items.filter(item => item.type === type))
}

/**
 * Launcher Grid 的统一“插入 + 流式重排”搬运器。
 *
 * 与旧版 swap 不同：落点代表“插入位置”。目标页从该位置开始重新排布，
 * 后面的 App / Widget 会按可用网格自动后移；目标页装不下时继续把尾部项目
 * 推到下一页。来源页则只在本页向前补位，不会擅自把下一页内容拉回来，
 * 因此玩家仍然可以保留“一个 App 单独一页”的布局。
 */
function visualOrderValue(item: Pick<HomeLayoutItem, 'x' | 'y'>) {
  return item.y * HOME_GRID_COLUMNS + item.x
}

function sortItemsByVisualOrder(items: readonly HomeLayoutItem[]) {
  return [...items].sort((left, right) => {
    const delta = visualOrderValue(left) - visualOrderValue(right)
    return delta || left.id.localeCompare(right.id)
  })
}

function packFlowItems(sequence: readonly HomeLayoutItem[]) {
  const placed: HomeLayoutItem[] = []
  for (let index = 0; index < sequence.length; index += 1) {
    const item = sequence[index]
    const fit = findFirstFit(placed, item.w, item.h)
    if (!fit) {
      return {
        items: placed,
        overflow: sequence.slice(index).map(row => ({ ...row }))
      }
    }
    placed.push({ ...item, x: fit.x, y: fit.y })
  }
  return { items: placed, overflow: [] as HomeLayoutItem[] }
}

function insertionIndexForCell(items: readonly HomeLayoutItem[], x: number, y: number) {
  const ordered = sortItemsByVisualOrder(items)
  const occupant = ordered.findIndex(item =>
    x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h
  )
  if (occupant >= 0) return occupant
  const targetOrder = y * HOME_GRID_COLUMNS + x
  const before = ordered.findIndex(item => visualOrderValue(item) >= targetOrder)
  return before >= 0 ? before : ordered.length
}

export function moveHomeLayoutItemToGrid(
  value: HomeAppearancePreferences,
  ref: HomeLayoutMovableRef,
  destinationPageIndex: number,
  x: number,
  y: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item })) }))
  const dock = [...normalized.dockAppKeys]

  let sourcePageIndex = -1
  let sourceItem: HomeLayoutItem | undefined
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const index = pages[pageIndex].items.findIndex(item => itemMatchesRef(item, ref))
    if (index < 0) continue
    const [removed] = pages[pageIndex].items.splice(index, 1)
    sourcePageIndex = pageIndex
    sourceItem = removed
    break
  }

  if (ref.type === 'app') {
    const sourceDockIndex = dock.indexOf(ref.key)
    if (sourceDockIndex >= 0) dock.splice(sourceDockIndex, 1)
  }

  const moving: HomeLayoutItem = sourceItem
    ? { ...sourceItem }
    : ref.type === 'app'
      ? createAppItem(ref.key, 0, 0)
      : ref.type === 'widget'
        ? createWidgetItem(ref.key, 0, 0)
        : (() => { throw new Error('找不到要移动的文件夹') })()

  const targetPageIndex = ensurePage(pages, destinationPageIndex)
  const targetX = normalizeGridCoordinate(x, HOME_GRID_COLUMNS - 1)
  const targetY = normalizeGridCoordinate(y, HOME_GRID_ROWS - 1)

  // 来源页先在自己的页面内向前补位，不从后续页面抽项目回来。
  // 同页拖动也先把原位置留下的空洞收拢，随后再按指针所在格执行插入，
  // 这样“拖到第二个图标前”会变成 [A, moving, B, C]，而不是交换 A/B。
  if (sourcePageIndex >= 0) {
    const packedSource = packFlowItems(sortItemsByVisualOrder(pages[sourcePageIndex].items))
    // 移走一个项目只会增加空间，因此来源页正常情况下不应出现 overflow。
    if (packedSource.overflow.length) return normalized
    pages[sourcePageIndex].items = packedSource.items
  }

  const targetItems = sortItemsByVisualOrder(pages[targetPageIndex].items)
  const insertionIndex = insertionIndexForCell(targetItems, targetX, targetY)
  targetItems.splice(insertionIndex, 0, moving)

  let carry = packFlowItems(targetItems)
  pages[targetPageIndex].items = carry.items
  let overflow = carry.overflow
  let pageIndex = targetPageIndex + 1

  // 目标页装不下时，像手机 Launcher 一样把尾部项目继续向后推。
  while (overflow.length) {
    if (pageIndex >= MAX_HOME_PAGES) return normalized
    ensurePage(pages, pageIndex)
    const existing = sortItemsByVisualOrder(pages[pageIndex].items)
    const packed = packFlowItems([...overflow, ...existing])
    pages[pageIndex].items = packed.items
    overflow = packed.overflow
    pageIndex += 1
  }

  const compacted = compactLayoutPages(pages)
  const homeAppKeys = collectPageAppKeys(compacted)
  const homeWidgetKeys = layoutItemsFromAppearance(compacted, 'widget')
    .filter((item): item is HomeLayoutWidgetItem => item.type === 'widget')
    .map(item => item.key)

  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys,
    homeWidgetKeys,
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted,
    dockAppKeys: dock
  })
}

export function moveHomeWidgetToGrid(
  value: HomeAppearancePreferences,
  key: HomeWidgetKey,
  destinationPageIndex: number,
  x: number,
  y: number
) {
  return moveHomeLayoutItemToGrid(value, { type: 'widget', key }, destinationPageIndex, x, y)
}


export function createHomeFolder(
  value: HomeAppearancePreferences,
  sourceKey: HomeAppKey,
  targetKey: HomeAppKey,
  name = '文件夹'
): HomeAppearancePreferences {
  if (sourceKey === targetKey) return normalizeHomeAppearance(value)
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) })) as HomeLayoutItem[] }))
  const dock = [...normalized.dockAppKeys]

  let sourcePageIndex = -1
  let targetPageIndex = -1
  let sourceItem: HomeLayoutAppItem | undefined
  let targetItem: HomeLayoutAppItem | undefined

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const sourceIndex = page.items.findIndex(item => item.type === 'app' && item.key === sourceKey)
    if (sourceIndex >= 0) {
      const [item] = page.items.splice(sourceIndex, 1)
      if (item?.type === 'app') {
        sourcePageIndex = pageIndex
        sourceItem = item
      }
    }
  }
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const targetIndex = page.items.findIndex(item => item.type === 'app' && item.key === targetKey)
    if (targetIndex >= 0) {
      const [item] = page.items.splice(targetIndex, 1)
      if (item?.type === 'app') {
        targetPageIndex = pageIndex
        targetItem = item
      }
      break
    }
  }
  const sourceDockIndex = dock.indexOf(sourceKey)
  if (!sourceItem && sourceDockIndex >= 0) sourceItem = createAppItem(sourceKey, 0, 0)
  if (!sourceItem || !targetItem || targetPageIndex < 0) return normalized

  if (sourceDockIndex >= 0) dock.splice(sourceDockIndex, 1)
  const targetDockIndex = dock.indexOf(targetKey)
  if (targetDockIndex >= 0) dock.splice(targetDockIndex, 1)

  if (sourcePageIndex >= 0 && sourcePageIndex !== targetPageIndex) {
    const packed = packFlowItems(sortItemsByVisualOrder(pages[sourcePageIndex].items))
    if (packed.overflow.length) return normalized
    pages[sourcePageIndex].items = packed.items
  }

  const targetSequence = sortItemsByVisualOrder(pages[targetPageIndex].items)
  const insertionIndex = Math.min(
    targetSequence.length,
    targetSequence.findIndex(item => visualOrderValue(item) >= visualOrderValue(targetItem)) >= 0
      ? targetSequence.findIndex(item => visualOrderValue(item) >= visualOrderValue(targetItem))
      : targetSequence.length
  )
  const folder = createFolderItem([targetKey, sourceKey], targetItem.x, targetItem.y, name)
  targetSequence.splice(insertionIndex, 0, folder)
  const packedTarget = packFlowItems(targetSequence)
  if (packedTarget.overflow.length) return normalized
  pages[targetPageIndex].items = packedTarget.items

  const compacted = compactLayoutPages(pages)
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys: collectPageAppKeys(compacted),
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted,
    dockAppKeys: dock
  })
}

export function addHomeAppToFolder(
  value: HomeAppearancePreferences,
  appKey: HomeAppKey,
  folderId: string
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) })) as HomeLayoutItem[] }))
  const dock = [...normalized.dockAppKeys]
  let sourcePageIndex = -1
  let sourceItem: HomeLayoutAppItem | undefined
  let folder: HomeLayoutFolderItem | undefined

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const folderItem = page.items.find(item => item.type === 'folder' && item.id === folderId)
    if (folderItem?.type === 'folder') folder = folderItem
    const appIndex = page.items.findIndex(item => item.type === 'app' && item.key === appKey)
    if (appIndex >= 0) {
      const [item] = page.items.splice(appIndex, 1)
      if (item?.type === 'app') {
        sourcePageIndex = pageIndex
        sourceItem = item
      }
    }
  }
  if (!folder || folder.appKeys.includes(appKey)) return normalized
  const dockIndex = dock.indexOf(appKey)
  if (!sourceItem && dockIndex < 0) return normalized
  if (dockIndex >= 0) dock.splice(dockIndex, 1)
  folder.appKeys = [...folder.appKeys, appKey]

  if (sourcePageIndex >= 0) {
    const packed = packFlowItems(sortItemsByVisualOrder(pages[sourcePageIndex].items))
    if (packed.overflow.length) return normalized
    pages[sourcePageIndex].items = packed.items
  }

  const compacted = compactLayoutPages(pages)
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys: collectPageAppKeys(compacted),
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted,
    dockAppKeys: dock
  })
}

export function removeHomeAppFromFolder(
  value: HomeAppearancePreferences,
  folderId: string,
  appKey: HomeAppKey,
  destinationPageIndex = 0
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) })) as HomeLayoutItem[] }))
  let folderPageIndex = -1
  let folderIndex = -1
  let folder: HomeLayoutFolderItem | undefined

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const index = pages[pageIndex].items.findIndex(item => item.type === 'folder' && item.id === folderId)
    if (index < 0) continue
    const item = pages[pageIndex].items[index]
    if (item?.type !== 'folder' || !item.appKeys.includes(appKey)) return normalized
    folderPageIndex = pageIndex
    folderIndex = index
    folder = item
    break
  }
  if (!folder || folderPageIndex < 0 || folderIndex < 0) return normalized

  folder.appKeys = folder.appKeys.filter(key => key !== appKey)
  if (folder.appKeys.length === 1) {
    const remaining = folder.appKeys[0]
    pages[folderPageIndex].items.splice(folderIndex, 1, createAppItem(remaining, folder.x, folder.y))
  } else if (folder.appKeys.length === 0) {
    pages[folderPageIndex].items.splice(folderIndex, 1)
  }

  const targetPageIndex = ensurePage(pages, Math.max(0, destinationPageIndex))
  let actualTargetPage = targetPageIndex
  let fit = findFirstFit(pages[targetPageIndex].items, 1, 1)
  if (!fit) {
    actualTargetPage = folderPageIndex
    fit = findFirstFit(pages[folderPageIndex]?.items ?? [], 1, 1)
  }
  if (!fit) return normalized
  pages[actualTargetPage].items.push(createAppItem(appKey, fit.x, fit.y))

  const compacted = compactLayoutPages(pages)
  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys: collectPageAppKeys(compacted),
    homePageKeys: deriveLegacyPageKeys(compacted),
    homeLayoutPages: compacted
  })
}


export function reorderHomeFolderApps(
  value: HomeAppearancePreferences,
  folderId: string,
  appKey: HomeAppKey,
  beforeKey: HomeAppKey
): HomeAppearancePreferences {
  if (appKey === beforeKey) return normalizeHomeAppearance(value)
  const normalized = normalizeHomeAppearance(value)
  const pages = normalized.homeLayoutPages.map(page => ({
    items: page.items.map(item => item.type === 'folder' ? { ...item, appKeys: [...item.appKeys] } : { ...item }) as HomeLayoutItem[]
  }))
  let changed = false
  for (const page of pages) {
    const folder = page.items.find(item => item.type === 'folder' && item.id === folderId)
    if (folder?.type !== 'folder') continue
    if (!folder.appKeys.includes(appKey) || !folder.appKeys.includes(beforeKey)) return normalized
    const next = folder.appKeys.filter(key => key !== appKey)
    const index = next.indexOf(beforeKey)
    next.splice(index < 0 ? next.length : index, 0, appKey)
    folder.appKeys = next
    changed = true
    break
  }
  if (!changed) return normalized
  return normalizeHomeAppearance({ ...normalized, homeLayoutPages: pages })
}

export function moveHomeFolderAppToGrid(
  value: HomeAppearancePreferences,
  folderId: string,
  appKey: HomeAppKey,
  destinationPageIndex: number,
  x: number,
  y: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const folder = normalized.homeLayoutPages
    .flatMap(page => page.items)
    .find((item): item is HomeLayoutFolderItem => item.type === 'folder' && item.id === folderId)
  if (!folder || !folder.appKeys.includes(appKey)) return normalized
  const extracted = removeHomeAppFromFolder(normalized, folderId, appKey, destinationPageIndex)
  const stillNested = extracted.homeLayoutPages.some(page => page.items.some(item =>
    item.type === 'folder' && item.id === folderId && item.appKeys.includes(appKey)
  ))
  if (stillNested) return normalized
  return moveHomeAppToGrid(extracted, appKey, destinationPageIndex, x, y)
}

export function moveHomeFolderAppToDock(
  value: HomeAppearancePreferences,
  folderId: string,
  appKey: HomeAppKey,
  beforeKey?: HomeAppKey
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const folder = normalized.homeLayoutPages
    .flatMap(page => page.items)
    .find((item): item is HomeLayoutFolderItem => item.type === 'folder' && item.id === folderId)
  if (!folder || !folder.appKeys.includes(appKey)) return normalized
  const folderPageIndex = normalized.homeLayoutPages.findIndex(page => page.items.some(item => item.type === 'folder' && item.id === folderId))
  const extracted = removeHomeAppFromFolder(normalized, folderId, appKey, Math.max(0, folderPageIndex))
  const stillNested = extracted.homeLayoutPages.some(page => page.items.some(item =>
    item.type === 'folder' && item.id === folderId && item.appKeys.includes(appKey)
  ))
  if (stillNested) return normalized
  return moveHomeAppPlacement(extracted, appKey, 'dock', beforeKey)
}

export function renameHomeFolder(
  value: HomeAppearancePreferences,
  folderId: string,
  name: string
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const nextName = name.trim().slice(0, 24) || '文件夹'
  const pages = normalized.homeLayoutPages.map(page => ({
    items: page.items.map(item => item.type === 'folder' && item.id === folderId ? { ...item, name: nextName } : { ...item })
  }))
  return normalizeHomeAppearance({ ...normalized, homeLayoutPages: pages })
}

export function removeHomeLayoutPages(
  value: HomeAppearancePreferences,
  pageIndexes: readonly number[]
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const removed = new Set(pageIndexes.filter(index => Number.isInteger(index) && index >= 0))
  if (!removed.size) return normalized

  const pages = compactLayoutPages(
    normalized.homeLayoutPages
      .filter((_, index) => !removed.has(index))
      .map(page => ({ items: page.items.map(item => ({ ...item })) }))
  )
  const homeAppKeys = collectPageAppKeys(pages)
  const homeWidgetKeys = pages.flatMap(page => page.items
    .filter((item): item is HomeLayoutWidgetItem => item.type === 'widget')
    .map(item => item.key))

  return normalizeHomeAppearance({
    ...normalized,
    homeAppKeys,
    homeWidgetKeys,
    homePageKeys: deriveLegacyPageKeys(pages),
    homeLayoutPages: pages
  })
}


/**
 * 修复“数据认为页面非空，但当前页面视觉上完全空白”的幽灵页。
 * 不丢弃任何 App / Widget / Folder：只有当目标页里的全部项目都能被放回前面的
 * 已存在页面时，才真正移除该页；否则保持原布局不变。
 */
export function collapseHomeLayoutPageIntoPrevious(
  value: HomeAppearancePreferences,
  pageIndex: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  if (!Number.isInteger(pageIndex) || pageIndex <= 0 || pageIndex >= normalized.homeLayoutPages.length) return normalized

  const source = normalized.homeLayoutPages[pageIndex]
  if (!source?.items.length) return removeHomeLayoutPages(normalized, [pageIndex])

  const before = normalized.homeLayoutPages.slice(0, pageIndex).map(page => ({
    items: page.items.map(item => ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) })) as HomeLayoutItem[]
  }))
  const after = normalized.homeLayoutPages.slice(pageIndex + 1).map(page => ({
    items: page.items.map(item => ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) })) as HomeLayoutItem[]
  }))

  const moving = sortItemsByVisualOrder(source.items).map(item =>
    ({ ...item, ...(item.type === 'folder' ? { appKeys: [...item.appKeys] } : {}) }) as HomeLayoutItem
  )

  // 优先放到紧邻的上一页，再向更前面的页面寻找空间；不自动新建页面。
  for (const item of moving) {
    let placed = false
    for (let target = before.length - 1; target >= 0; target -= 1) {
      const fit = findFirstFit(before[target].items, item.w, item.h)
      if (!fit) continue
      before[target].items.push({ ...item, x: fit.x, y: fit.y } as HomeLayoutItem)
      placed = true
      break
    }
    if (!placed) return normalized
  }

  return normalizeHomeAppearance({
    ...normalized,
    homeLayoutPages: compactLayoutPages([...before, ...after])
  })
}

export function resizeHomeWidgetInGrid(
  value: HomeAppearancePreferences,
  key: HomeWidgetKey,
  w: number,
  h: number
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const allowed = getWidgetGridSizes(key)
  const requested = allowed.find(size => size.w === w && size.h === h)
  if (!requested) return normalized

  const pages = normalized.homeLayoutPages.map(page => ({ items: page.items.map(item => ({ ...item })) }))
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex]
    const itemIndex = page.items.findIndex(item => item.type === 'widget' && item.key === key)
    if (itemIndex < 0) continue
    const item = page.items[itemIndex]
    if (item.type !== 'widget') return normalized
    page.items.splice(itemIndex, 1)

    const x = Math.min(item.x, HOME_GRID_COLUMNS - requested.w)
    const y = Math.min(item.y, HOME_GRID_ROWS - requested.h)
    if (canPlace(page.items, x, y, requested.w, requested.h)) {
      page.items.push(createWidgetItem(key, x, y, requested))
    } else {
      const fit = findFirstFit(page.items, requested.w, requested.h)
      if (!fit) return normalized
      page.items.push(createWidgetItem(key, fit.x, fit.y, requested))
    }
    return normalizeHomeAppearance({ ...normalized, homeLayoutPages: pages })
  }
  return normalized
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
    homeAppKeys: collectPageAppKeys(compacted),
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
  themePreset?: unknown
  homeWidgetSettings?: unknown
  homeLayoutRevision?: unknown
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
    widgetStyle: 'frosted',
    themePreset: 'default',
    homeWidgetSettings: {},
    homeLayoutRevision: HOME_LAYOUT_REVISION
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
  const normalized = normalizeHomeAppearance({
    wallpaperDataUrl: row?.wallpaperDataUrl,
    iconScale: row?.iconScale,
    showAppLabels: row?.showAppLabels,
    homeAppKeys: row?.homeAppKeys,
    homePageKeys: row?.homePageKeys,
    homeLayoutPages: row?.homeLayoutPages,
    dockAppKeys: row?.dockAppKeys,
    homeWidgetKeys: row?.homeWidgetKeys,
    widgetStyle: row?.widgetStyle,
    themePreset: row?.homeThemePreset,
    homeWidgetSettings: row?.homeWidgetSettings,
    homeLayoutRevision: row?.homeLayoutRevision
  })

  // Launcher V9 自愈：历史版本可能把临时空页/旧 revision 留在 IndexedDB。
  // 读取时已经会归一化；这里把归一化结果回写一次，避免下一次启动继续携带幽灵页。
  if (row) {
    const storedPages = Array.isArray(row.homeLayoutPages) ? row.homeLayoutPages : []
    const storedRevision = Number(row.homeLayoutRevision || 0)
    const pagesChanged = JSON.stringify(storedPages) !== JSON.stringify(normalized.homeLayoutPages)
    if (pagesChanged || storedRevision !== HOME_LAYOUT_REVISION) {
      await saveHomeAppearance(worldId, normalized)
    }
  }

  return normalized
}

export async function saveHomeAppearance(worldId: string, value: HomeAppearancePreferences) {
  const normalized = normalizeHomeAppearance(value)
  assertHomeLayoutPages(normalized.homeLayoutPages)
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
    homeThemePreset: normalized.themePreset,
    homeWidgetSettings: normalized.homeWidgetSettings,
    homeLayoutRevision: normalized.homeLayoutRevision,
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
  const rawLayoutPages = normalizeLayoutPages(value.homeLayoutPages, requestedHomeAppKeys, homeWidgetKeys, legacyPages)
  const storedRevision = Number.isFinite(value.homeLayoutRevision) ? Number(value.homeLayoutRevision) : 0
  const migratedPages = storedRevision < HOME_LAYOUT_REVISION
    ? migrateLegacyWidgetSizes(rawLayoutPages)
    : rawLayoutPages
  // 无论来自旧数据、迁移结果还是当前写入，都必须经过最终空页压缩。
  // 这样中间空页、尾部空页和历史临时页都不可能进入稳定 HomeLayout。
  const homeLayoutPages = compactLayoutPages(migratedPages)
  const homeAppKeys = collectPageAppKeys(homeLayoutPages)
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
    widgetStyle: value.widgetStyle === 'clear' || value.widgetStyle === 'solid' ? value.widgetStyle : 'frosted',
    themePreset: normalizeThemePreset(value.themePreset),
    homeWidgetSettings: normalizeWidgetSettings(value.homeWidgetSettings),
    homeLayoutRevision: HOME_LAYOUT_REVISION
  }
}


function migrateLegacyWidgetSizes(pages: HomeLayoutPage[]): HomeLayoutPage[] {
  return pages.map(page => ({
    items: page.items.map<HomeLayoutItem>(item => {
      if (item.type !== 'widget') return { ...item }
      // 5.1.11 的默认 Widget 偏大。只有旧 revision 才执行一次性收窄；
      // 之后用户主动选的大尺寸不会再被覆盖。
      if ((item.key === 'companion' || item.key === 'world') && item.w === 2 && item.h === 2) {
        return { ...item, w: 2, h: 1 }
      }
      if (item.key === 'music' && item.w === 4 && item.h === 2) {
        return { ...item, w: 4, h: 1 }
      }
      return { ...item }
    })
  }))
}

function normalizeThemePreset(value: unknown): HomeThemePreset {
  return value === 'dark' || value === 'clear' || value === 'tinted' ? value : 'default'
}

function normalizeWidgetSettings(value: unknown): HomeWidgetSettings {
  if (!value || typeof value !== 'object') return {}
  const row = value as Record<string, unknown>
  const photoRaw = row.photo && typeof row.photo === 'object' ? row.photo as Record<string, unknown> : undefined
  const calendarRaw = row.calendar && typeof row.calendar === 'object' ? row.calendar as Record<string, unknown> : undefined
  const photo = photoRaw
    ? {
        imageDataUrl: typeof photoRaw.imageDataUrl === 'string' && photoRaw.imageDataUrl.startsWith('data:image/')
          ? photoRaw.imageDataUrl
          : undefined,
        caption: typeof photoRaw.caption === 'string' ? photoRaw.caption.slice(0, 80) : undefined
      }
    : undefined
  const calendar = calendarRaw
    ? { startWeekOnMonday: calendarRaw.startWeekOnMonday !== false }
    : undefined
  return {
    ...(photo ? { photo } : {}),
    ...(calendar ? { calendar } : {})
  }
}

export function updateHomeWidgetSettings(
  value: HomeAppearancePreferences,
  key: HomeWidgetKey,
  patch: Record<string, unknown>
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const current = normalized.homeWidgetSettings
  if (key === 'photo') {
    const next = normalizeWidgetSettings({
      ...current,
      photo: { ...(current.photo ?? {}), ...patch }
    })
    return normalizeHomeAppearance({ ...normalized, homeWidgetSettings: next })
  }
  if (key === 'calendar') {
    const next = normalizeWidgetSettings({
      ...current,
      calendar: { ...(current.calendar ?? {}), ...patch }
    })
    return normalizeHomeAppearance({ ...normalized, homeWidgetSettings: next })
  }
  return normalized
}

export function applyHomeThemePreset(
  value: HomeAppearancePreferences,
  preset: HomeThemePreset
): HomeAppearancePreferences {
  const normalized = normalizeHomeAppearance(value)
  const widgetStyle: HomeWidgetStyle = preset === 'clear' ? 'clear' : preset === 'dark' ? 'solid' : 'frosted'
  return normalizeHomeAppearance({ ...normalized, themePreset: preset, widgetStyle })
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
