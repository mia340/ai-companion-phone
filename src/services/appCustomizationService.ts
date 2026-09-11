import { db } from '../db/database'
import type { AppCustomization } from '../types/domain'

export type HomeAppKey =
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

export const HOME_APPS: HomeAppDefinition[] = [
  { key: 'chat', label: '聊天', route: '/chat', icon: 'chat', tone: ['#79b7ee', '#a8d8f7'] },
  { key: 'contacts', label: '通讯录', route: '/contacts', icon: 'contacts', tone: ['#71cdbd', '#a8e4d5'] },
  { key: 'moments', label: '朋友圈', route: '/app/朋友圈', icon: 'moments', tone: ['#ef9fbc', '#f7c2d7'] },
  { key: 'diary', label: '日记', route: '/app/日记', icon: 'diary', tone: ['#e9bb83', '#f5d6a5'] },
  { key: 'music', label: '音乐', route: '/app/音乐', icon: 'music', tone: ['#8f9cde', '#b9c4ef'] },
  { key: 'wallet', label: '钱包', route: '/app/钱包', icon: 'wallet', tone: ['#82c5a0', '#b6dfc5'] },
  { key: 'turtle-soup', label: '海龟汤', route: '/app/海龟汤', icon: 'turtle-soup', tone: ['#75bcc4', '#a8d8d3'] },
  { key: 'profile', label: '我的资料', route: '/profile', icon: 'profile', tone: ['#9aa6df', '#c5cdf0'] },
  { key: 'memory', label: '记忆', route: '/app/记忆管理', icon: 'memory', tone: ['#a8a1dc', '#d0c9ee'] },
  { key: 'world', label: '世界', route: '/world', icon: 'world', tone: ['#7eafd6', '#b6d5ea'] },
  { key: 'backup', label: '数据备份', route: '/backup', icon: 'backup', tone: ['#9caebb', '#c8d3dc'] },
  { key: 'settings', label: '设置', route: '/settings', icon: 'settings', tone: ['#a7b4c3', '#d1d9e2'] }
]

export const DOCK_APPS: HomeAppDefinition[] = [
  HOME_APPS[0],
  HOME_APPS[1],
  { key: 'new-character', label: '新建角色', route: '/characters/new', icon: 'new-character', tone: ['#8ebce8', '#bddcf4'] },
  HOME_APPS[11]
]

function customizationId(worldId: string, appKey: HomeAppKey) {
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

function readAsDataUrl(file: File) {
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
  return readAsDataUrl(new File([blob], file.name || 'app-icon.webp', { type: 'image/webp' }))
}
