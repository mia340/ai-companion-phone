export type ImageProcessingMode = 'original' | 'jpeg' | 'webp'

export interface PreparedChatImage {
  id: string
  dataUrl: string
  name: string
  width: number
  height: number
  bytes: number
  originalBytes: number
  originalType: string
  outputType: string
  processingMode: ImageProcessingMode
  attempts: string[]
  sourceFile?: File
}

export interface ImagePreparationFailure {
  id: string
  file: File
  name: string
  reason: string
  code: string
  originalBytes: number
  originalType: string
  attempts: string[]
  canUseOriginal: boolean
}

export interface PreparedImageBatch {
  prepared: PreparedChatImage[]
  rejected: ImagePreparationFailure[]
}

export interface ImageBatchProgress {
  completed: number
  total: number
  currentName: string
  status: 'processing' | 'prepared' | 'failed'
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

class ChatImageError extends Error {
  code: string
  attempts: string[]

  constructor(message: string, code: string, attempts: string[] = []) {
    super(message)
    this.name = 'ChatImageError'
    this.code = code
    this.attempts = attempts
  }
}

const MAX_IMAGE_BYTES = 15 * 1024 * 1024
const TARGET_IMAGE_BYTES = 760 * 1024
const SAFE_ORIGINAL_TYPES = /^(?:image\/(?:jpeg|png|webp|gif))$/i

function createImageId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `image-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new ChatImageError('图片文件读取失败。', 'read-failed'))
    reader.onabort = () => reject(new ChatImageError('图片读取已取消。', 'read-aborted'))
    reader.readAsDataURL(blob)
  })
}

async function decodeWithImageBitmap(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap !== 'function') {
    throw new ChatImageError('当前浏览器不支持 ImageBitmap。', 'bitmap-unavailable')
  }

  const bitmap = await createImageBitmap(file)
  if (!bitmap.width || !bitmap.height) {
    bitmap.close()
    throw new ChatImageError('图片尺寸无效。', 'invalid-dimensions')
  }

  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release: () => bitmap.close()
  }
}

function decodeWithImageElement(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'

    const cleanup = () => URL.revokeObjectURL(objectUrl)

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        cleanup()
        reject(new ChatImageError('图片尺寸无效。', 'invalid-dimensions'))
        return
      }

      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: cleanup
      })
    }

    image.onerror = () => {
      cleanup()
      reject(new ChatImageError('浏览器无法解析这张图片。', 'decode-failed'))
    }

    image.src = objectUrl
  })
}

async function decodeImage(file: File, attempts: string[]): Promise<DecodedImage> {
  try {
    attempts.push('ImageBitmap 解码')
    return await decodeWithImageBitmap(file)
  } catch {
    attempts.push('HTMLImageElement 解码')
    return decodeWithImageElement(file)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob || blob.size <= 0) {
          reject(new ChatImageError(`${type} 编码失败。`, 'encode-failed'))
          return
        }
        if (blob.type && blob.type !== type) {
          reject(new ChatImageError(`浏览器不支持 ${type} 编码。`, 'format-unsupported'))
          return
        }
        resolve(blob)
      }, type, quality)
    } catch (error) {
      reject(new ChatImageError(
        error instanceof Error ? error.message : `${type} 编码失败。`,
        'encode-failed'
      ))
    }
  })
}

function preferredMaxSide() {
  const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0)
  if (memory > 0 && memory <= 2) return 1080
  if (memory > 0 && memory <= 4) return 1280
  return 1440
}

function scaledDimensions(width: number, height: number) {
  const maxSide = preferredMaxSide()
  const maxPixels = 8_000_000
  const sideScale = Math.min(1, maxSide / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)))
  const scale = Math.min(sideScale, pixelScale)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/webp',
  attempts: string[]
) {
  const label = type === 'image/webp' ? 'WebP' : 'JPEG'
  let quality = type === 'image/webp' ? 0.88 : 0.9
  let best: Blob | undefined

  while (quality >= 0.54) {
    attempts.push(`${label} ${Math.round(quality * 100)}%`)
    const blob = await canvasToBlob(canvas, type, quality)
    best = blob
    if (blob.size <= TARGET_IMAGE_BYTES) break
    quality -= 0.08
  }

  if (!best) throw new ChatImageError(`${label} 编码没有生成结果。`, 'encode-empty', attempts)
  return best
}

function assertImageFile(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new ChatImageError(`${file.name || '该文件'}不是图片文件。`, 'not-image')
  }
  if (file.size <= 0) {
    throw new ChatImageError(`${file.name || '该图片'}是空文件。`, 'empty-file')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ChatImageError(`${file.name || '该图片'}超过 15 MB。`, 'too-large')
  }
}

export function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? ''
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding)
}

export async function prepareOriginalChatImage(
  file: File,
  previousAttempts: string[] = []
): Promise<PreparedChatImage> {
  assertImageFile(file)
  const attempts = [...previousAttempts, '保留原图']
  const dataUrl = await readBlobAsDataUrl(file)
  let width = 0
  let height = 0
  let decoded: DecodedImage | undefined

  try {
    decoded = await decodeImage(file, attempts)
    width = decoded.width
    height = decoded.height
  } catch {
    // 原图仍可交给支持该格式的视觉接口；尺寸未知时界面按方图兜底。
  } finally {
    decoded?.release()
  }

  return {
    id: createImageId(),
    dataUrl,
    name: file.name || '未命名图片',
    width,
    height,
    bytes: estimateDataUrlBytes(dataUrl),
    originalBytes: file.size,
    originalType: file.type || 'image/*',
    outputType: file.type || 'image/*',
    processingMode: 'original',
    attempts,
    sourceFile: file
  }
}

export async function prepareChatImage(
  file: File,
  options?: { forceOriginal?: boolean; allowOriginalFallback?: boolean }
): Promise<PreparedChatImage> {
  assertImageFile(file)
  if (options?.forceOriginal) return prepareOriginalChatImage(file)

  const attempts: string[] = []
  let decoded: DecodedImage | undefined
  let canvas: HTMLCanvasElement | undefined

  try {
    decoded = await decodeImage(file, attempts)
    const dimensions = scaledDimensions(decoded.width, decoded.height)

    if (
      dimensions.scale === 1 &&
      file.size <= 1.2 * 1024 * 1024 &&
      SAFE_ORIGINAL_TYPES.test(file.type)
    ) {
      return prepareOriginalChatImage(file, attempts)
    }

    canvas = document.createElement('canvas')
    canvas.width = dimensions.width
    canvas.height = dimensions.height
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new ChatImageError('当前浏览器无法创建图片画布。', 'canvas-unavailable', attempts)

    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height)

    const formats: Array<'image/jpeg' | 'image/webp'> = ['image/jpeg', 'image/webp']

    let lastError: unknown
    for (const type of formats) {
      try {
        if (type === 'image/jpeg' && file.type === 'image/png') {
          const jpegCanvas = document.createElement('canvas')
          jpegCanvas.width = dimensions.width
          jpegCanvas.height = dimensions.height
          const jpegContext = jpegCanvas.getContext('2d')
          if (!jpegContext) throw new ChatImageError('无法创建 JPEG 画布。', 'canvas-unavailable', attempts)
          jpegContext.fillStyle = '#ffffff'
          jpegContext.fillRect(0, 0, dimensions.width, dimensions.height)
          jpegContext.drawImage(canvas, 0, 0)
          const blob = await encodeCanvas(jpegCanvas, type, attempts)
          jpegCanvas.width = 1
          jpegCanvas.height = 1
          return {
            id: createImageId(),
            dataUrl: await readBlobAsDataUrl(blob),
            name: file.name || '未命名图片',
            width: dimensions.width,
            height: dimensions.height,
            bytes: blob.size,
            originalBytes: file.size,
            originalType: file.type || 'image/*',
            outputType: blob.type,
            processingMode: 'jpeg',
            attempts,
            sourceFile: file
          }
        }

        const blob = await encodeCanvas(canvas, type, attempts)
        return {
          id: createImageId(),
          dataUrl: await readBlobAsDataUrl(blob),
          name: file.name || '未命名图片',
          width: dimensions.width,
          height: dimensions.height,
          bytes: blob.size,
          originalBytes: file.size,
          originalType: file.type || 'image/*',
          outputType: blob.type,
          processingMode: type === 'image/webp' ? 'webp' : 'jpeg',
          attempts,
          sourceFile: file
        }
      } catch (error) {
        lastError = error
      }
    }

    if (options?.allowOriginalFallback !== false && SAFE_ORIGINAL_TYPES.test(file.type)) {
      return prepareOriginalChatImage(file, attempts)
    }

    throw lastError instanceof Error
      ? lastError
      : new ChatImageError('图片压缩失败。', 'compression-failed', attempts)
  } catch (error) {
    if (
      options?.allowOriginalFallback !== false &&
      SAFE_ORIGINAL_TYPES.test(file.type) &&
      !(error instanceof ChatImageError && ['read-failed', 'too-large', 'empty-file'].includes(error.code))
    ) {
      try {
        return await prepareOriginalChatImage(file, attempts)
      } catch {
        // 保留最初错误，便于用户看到真正失败原因。
      }
    }

    if (error instanceof ChatImageError) {
      error.attempts = error.attempts.length ? error.attempts : attempts
      throw error
    }
    throw new ChatImageError(
      error instanceof Error ? error.message : '图片处理失败。',
      'unknown',
      attempts
    )
  } finally {
    decoded?.release()
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
  }
}

export function formatImageSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function imageProcessingModeLabel(mode: ImageProcessingMode) {
  if (mode === 'original') return '原图'
  if (mode === 'webp') return 'WebP 压缩'
  return 'JPEG 压缩'
}

export const MAX_CHAT_IMAGES = 6

export async function prepareChatImages(
  files: File[],
  options?: { maxCount?: number }
): Promise<PreparedChatImage[]> {
  const result = await prepareChatImageBatch(files, options)
  if (result.rejected.length) throw new Error(result.rejected[0].reason)
  return result.prepared
}

export function totalPreparedImageBytes(images: PreparedChatImage[]) {
  return images.reduce((total, image) => total + image.bytes, 0)
}

function toFailure(file: File, error: unknown): ImagePreparationFailure {
  const chatError = error instanceof ChatImageError
    ? error
    : new ChatImageError(error instanceof Error ? error.message : '图片处理失败。', 'unknown')
  return {
    id: createImageId(),
    file,
    name: file.name || '未命名图片',
    reason: chatError.message,
    code: chatError.code,
    originalBytes: file.size,
    originalType: file.type || 'image/*',
    attempts: chatError.attempts,
    canUseOriginal: SAFE_ORIGINAL_TYPES.test(file.type)
  }
}

export async function prepareChatImageBatch(
  files: File[],
  options?: {
    maxCount?: number
    onProgress?: (progress: ImageBatchProgress) => void
  }
): Promise<PreparedImageBatch> {
  const maxCount = options?.maxCount ?? MAX_CHAT_IMAGES
  const selected = files.slice(0, maxCount)
  const prepared: PreparedChatImage[] = []
  const rejected: ImagePreparationFailure[] = []

  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index]
    options?.onProgress?.({
      completed: index,
      total: selected.length,
      currentName: file.name || `第 ${index + 1} 张图片`,
      status: 'processing'
    })

    try {
      prepared.push(await prepareChatImage(file, { allowOriginalFallback: true }))
      options?.onProgress?.({
        completed: index + 1,
        total: selected.length,
        currentName: file.name || `第 ${index + 1} 张图片`,
        status: 'prepared'
      })
    } catch (error) {
      rejected.push(toFailure(file, error))
      options?.onProgress?.({
        completed: index + 1,
        total: selected.length,
        currentName: file.name || `第 ${index + 1} 张图片`,
        status: 'failed'
      })
    }

    // 主动把控制权交还浏览器，避免连续处理高分辨率图片时界面无响应。
    await new Promise<void>(resolve => window.setTimeout(resolve, 0))
  }

  return { prepared, rejected }
}
