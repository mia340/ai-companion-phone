import type { Message, MessageImage } from '../types/domain'

export function getMessageImages(message?: Message): MessageImage[] {
  if (!message) return []
  if (message.images?.length) return message.images.filter(image => Boolean(image.dataUrl || image.name))
  if (message.imageDataUrl || message.imageName || message.imageWidth || message.imageHeight || message.imageBytes) {
    return [{
      dataUrl: message.imageDataUrl,
      name: message.imageName,
      width: message.imageWidth,
      height: message.imageHeight,
      bytes: message.imageBytes
    }]
  }
  return []
}

export function getMessageImageUrls(message?: Message) {
  return getMessageImages(message).map(image => image.dataUrl || '').filter(Boolean)
}
