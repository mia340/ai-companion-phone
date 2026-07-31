export interface SpeechRecognitionAlternativeLike {
  transcript: string
  confidence: number
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

export interface SpeechRecognitionResultListLike {
  readonly length: number
  [index: number]: SpeechRecognitionResultLike
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string
  readonly message?: string
}

export interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

export interface RecognitionCallbacks {
  onTranscript: (text: string, finalText: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false
  const target = window as SpeechWindow
  return Boolean(target.SpeechRecognition || target.webkitSpeechRecognition)
}

export function isSpeechPlaybackSupported() {
  return typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
}

export async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) return

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  stream.getTracks().forEach(track => track.stop())
}

export function createSpeechRecognition(
  callbacks: RecognitionCallbacks,
  language = 'zh-CN'
): SpeechRecognitionLike {
  const target = window as SpeechWindow
  const Recognition = target.SpeechRecognition || target.webkitSpeechRecognition

  if (!Recognition) {
    throw new Error('当前浏览器暂不支持语音输入。')
  }

  const recognition = new Recognition()
  recognition.lang = language
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onresult = event => {
    let finalText = ''
    let interimText = ''

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript ?? ''
      if (result.isFinal) finalText += transcript
      else interimText += transcript
    }

    callbacks.onTranscript(interimText, finalText)
  }

  recognition.onerror = event => {
    const messages: Record<string, string> = {
      'audio-capture': '没有检测到可用的麦克风。',
      'network': '语音识别暂时不可用，请稍后重试。',
      'no-speech': '没有听清内容，请再试一次。',
      'not-allowed': '麦克风权限未开启。',
      'service-not-allowed': '当前环境不允许使用语音输入。'
    }

    callbacks.onError(
      messages[event.error] || event.message || '语音识别失败，请重试。'
    )
  }

  recognition.onend = callbacks.onEnd
  return recognition
}

export function selectSpeechVoice(
  voices: SpeechSynthesisVoice[],
  preferredName: string
) {
  if (preferredName) {
    const preferred = voices.find(voice => voice.name === preferredName)
    if (preferred) return preferred
  }

  return voices.find(voice => /^zh[-_]/i.test(voice.lang)) || voices[0]
}
