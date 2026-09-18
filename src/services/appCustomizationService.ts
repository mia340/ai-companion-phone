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
  homeAppKeys: HomeAppKey[]
  dockAppKeys: HomeAppKey[]
  homeWidgetKeys: HomeWidgetKey[]
  widgetStyle: HomeWidgetStyle
}

/**
 * 宽松的存储输入。IndexedDB 中旧版本记录使用 string[]，因此加载时先接收 unknown，
 * 再统一经过 normalizeHomeAppearance 白名单收窄，避免旧数据与新联合类型直接冲突。
 */
type HomeAppearanceInput = {
  wallpaperDataUrl?: unknown
  iconScale?: unknown
  showAppLabels?: unknown
  homeAppKeys?: unknown
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

export const DEFAULT_HOME_APPEARANCE: HomeAppearancePreferences = {
  iconScale: 1,
  showAppLabels: true,
  homeAppKeys: HOME_APPS.map(app => app.key),
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
  return {
    wallpaperDataUrl: typeof value.wallpaperDataUrl === 'string' && value.wallpaperDataUrl ? value.wallpaperDataUrl : undefined,
    iconScale: clampIconScale(value.iconScale),
    showAppLabels: value.showAppLabels !== false,
    homeAppKeys: normalizeAppKeys(value.homeAppKeys, DEFAULT_HOME_APPEARANCE.homeAppKeys),
    dockAppKeys: normalizeAppKeys(value.dockAppKeys, DEFAULT_HOME_APPEARANCE.dockAppKeys).slice(0, 4),
    homeWidgetKeys: normalizeWidgetKeys(value.homeWidgetKeys, DEFAULT_HOME_APPEARANCE.homeWidgetKeys),
    widgetStyle: value.widgetStyle === 'clear' || value.widgetStyle === 'solid' ? value.widgetStyle : 'frosted'
  }
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
