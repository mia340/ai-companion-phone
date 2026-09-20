import { db } from '../db/database'
import { estimateDataUrlBytes, prepareChatImage } from './imageService'

/** Cover shares the backed-up appCustomizations store; no schema migration needed. */
export const MOMENT_COVER_KEY = '__moments-cover__'
export const MAX_MOMENT_COVER_BYTES = 2 * 1024 * 1024
export const MAX_MOMENT_COVER_FILE_BYTES = 15 * 1024 * 1024

export function momentCoverId(worldId: string) {
  return `${worldId}:${MOMENT_COVER_KEY}`
}

export function validateMomentCoverDataUrl(value: string): boolean {
  return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(value)
    && estimateDataUrlBytes(value) <= MAX_MOMENT_COVER_BYTES
}

export async function getMomentCover(worldId: string): Promise<string | undefined> {
  const record = await db.appCustomizations.get(momentCoverId(worldId))
  return record?.wallpaperDataUrl && validateMomentCoverDataUrl(record.wallpaperDataUrl)
    ? record.wallpaperDataUrl
    : undefined
}

export async function saveMomentCover(worldId: string, dataUrl: string) {
  if (!validateMomentCoverDataUrl(dataUrl)) throw new Error('封面图片格式不支持或超过 2 MB，请换一张图片。')
  await db.appCustomizations.put({
    id: momentCoverId(worldId), worldId, appKey: MOMENT_COVER_KEY,
    wallpaperDataUrl: dataUrl, updatedAt: new Date().toISOString()
  })
}

export async function prepareMomentCover(file: File): Promise<string> {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) throw new Error('封面仅支持 JPG、PNG 或 WebP 图片。')
  if (!file.size || file.size > MAX_MOMENT_COVER_FILE_BYTES) throw new Error('请选择不超过 15 MB 的封面图片。')
  // Reuse browser-side encoding and downscaling; never persist an unbounded original.
  const result = await prepareChatImage(file)
  if (!validateMomentCoverDataUrl(result.dataUrl)) throw new Error('图片处理后仍然过大，请换一张图片。')
  return result.dataUrl
}

export async function resetMomentCover(worldId: string) {
  await db.appCustomizations.delete(momentCoverId(worldId))
}
