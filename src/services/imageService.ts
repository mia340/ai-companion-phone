export interface PreparedChatImage {
  dataUrl: string
  name: string
  width: number
  height: number
  bytes: number
  originalBytes: number
}

function readFileAsDataUrl(file: Blob) {
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
    image.onerror = () => reject(new Error('无法解析这张图片。'))
    image.src = dataUrl
  })
}

export function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? ''
  const padding = base64.endsWith('==')
    ? 2
    : base64.endsWith('=')
      ? 1
      : 0

  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding)
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number
) {
  return canvas.toDataURL('image/jpeg', quality)
}

export async function prepareChatImage(
  file: File
): Promise<PreparedChatImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件。')
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('图片不能超过 15 MB。')
  }

  const source = await readFileAsDataUrl(file)
  const image = await loadImage(source)
  const maxSide = 1280
  const scale = Math.min(
    1,
    maxSide / Math.max(image.naturalWidth, image.naturalHeight)
  )

  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))

  if (
    scale === 1 &&
    file.size <= 1.2 * 1024 * 1024 &&
    /^image\/(?:jpeg|png|webp)$/i.test(file.type)
  ) {
    return {
      dataUrl: source,
      name: file.name,
      width,
      height,
      bytes: estimateDataUrlBytes(source),
      originalBytes: file.size
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('当前浏览器无法处理图片。')
  }

  context.drawImage(image, 0, 0, width, height)

  let quality = 0.86
  let dataUrl = canvasToJpeg(canvas, quality)
  const targetBytes = 900 * 1024

  while (
    estimateDataUrlBytes(dataUrl) > targetBytes &&
    quality > 0.58
  ) {
    quality -= 0.08
    dataUrl = canvasToJpeg(canvas, quality)
  }

  return {
    dataUrl,
    name: file.name,
    width,
    height,
    bytes: estimateDataUrlBytes(dataUrl),
    originalBytes: file.size
  }
}

export function formatImageSize(bytes?: number) {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const MAX_CHAT_IMAGES = 6

export async function prepareChatImages(
  files: File[],
  options?: { maxCount?: number }
): Promise<PreparedChatImage[]> {
  const maxCount = options?.maxCount ?? MAX_CHAT_IMAGES
  if (!files.length) return []
  if (files.length > maxCount) throw new Error(`一次最多选择 ${maxCount} 张图片。`)
  const results: PreparedChatImage[] = []
  for (const file of files) results.push(await prepareChatImage(file))
  return results
}

export function totalPreparedImageBytes(images: PreparedChatImage[]) {
  return images.reduce((total, image) => total + image.bytes, 0)
}
