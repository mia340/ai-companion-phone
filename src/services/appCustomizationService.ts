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

export interface HomeAppDefinition {
  key: HomeAppKey
  label: string
  route: string
  icon: HomeAppKey
  tone: [string, string]
}

export interface HomeAppearancePreferences {
  wallpaperDataUrl?: string
  iconScale: number
  showAppLabels: boolean
}

export const DEFAULT_HOME_APPEARANCE: HomeAppearancePreferences = {
  iconScale: 1,
  showAppLabels: true
}

const APPEARANCE_APP_KEY = '__home-appearance__'

export const HOME_APPS: HomeAppDefinition[] = [
  { key: 'banxin', label: '知间', route: '/companion', icon: 'banxin', tone: ['#16b874', '#62d6a4'] },
  { key: 'profile', label: '我的资料', route: '/profile', icon: 'profile', tone: ['#9aa6df', '#c5cdf0'] },
  { key: 'memory', label: '记忆', route: '/memory', icon: 'memory', tone: ['#a8a1dc', '#d0c9ee'] },
  { key: 'world', label: '世界', route: '/world', icon: 'world', tone: ['#7eafd6', '#b6d5ea'] },
  { key: 'backup', label: '数据备份', route: '/backup', icon: 'backup', tone: ['#9caebb', '#c8d3dc'] },
  { key: 'settings', label: '设置', route: '/settings', icon: 'settings', tone: ['#a7b4c3', '#d1d9e2'] }
]

/** 当前空间桌面不再使用 Dock；保留导出避免旧调用与历史数据升级时出现断点。 */
export const DOCK_APPS: HomeAppDefinition[] = []

/** 旧入口不再显示在桌面，继续保留其自定义图标及历史路由数据。 */
export const CUSTOMIZABLE_APPS: HomeAppDefinition[] = Array.from(
  new Map([...HOME_APPS, ...DOCK_APPS].map(app => [app.key, app])).values()
)

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
  return {
    wallpaperDataUrl: row?.wallpaperDataUrl,
    iconScale: clampIconScale(row?.iconScale),
    showAppLabels: row?.showAppLabels !== false
  }
}

export async function saveHomeAppearance(worldId: string, value: HomeAppearancePreferences) {
  const row: AppCustomization = {
    id: customizationId(worldId, APPEARANCE_APP_KEY),
    worldId,
    appKey: APPEARANCE_APP_KEY,
    wallpaperDataUrl: value.wallpaperDataUrl,
    iconScale: clampIconScale(value.iconScale),
    showAppLabels: value.showAppLabels,
    updatedAt: new Date().toISOString()
  }
  await db.appCustomizations.put(row)
  return row
}

export async function resetHomeWallpaper(worldId: string) {
  const current = await loadHomeAppearance(worldId)
  await saveHomeAppearance(worldId, { ...current, wallpaperDataUrl: undefined })
}

function clampIconScale(value?: number) {
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

/**
 * Prepare a player-uploaded icon for IndexedDB. The source is center-cropped
 * into a 512px square and encoded as WebP to keep the home screen light.
 */
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

/**
 * Home wallpapers are resized before entering IndexedDB so a single photo does
 * not bloat backup files or make the simulated phone sluggish on mobile Safari.
 */
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
