import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type ComputedRef,
  type Ref
} from 'vue'
import {
  createSpeechRecognition,
  isSpeechPlaybackSupported,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
  selectSpeechVoice,
  type SpeechRecognitionLike
} from '../services/speechService'
import type {
  Character,
  ChatSettings,
  Message
} from '../types/domain'

export function useChatSpeech(options: {
  draft: Ref<string>
  title: ComputedRef<string>
  chatSettings: Ref<ChatSettings | undefined>
  character: Ref<Character | undefined>
  noticeMessage: Ref<string>
  afterDraftUpdated?: () => void
}) {
  const voiceInputAvailable = ref(isSpeechRecognitionSupported())
  const speechPlaybackAvailable = ref(isSpeechPlaybackSupported())
  const isRecording = ref(false)
  const isRecognizingSpeech = ref(false)
  const recordingSeconds = ref(0)
  const speakingMessageId = ref('')
  const isSpeechPaused = ref(false)
  const speechVoices = ref<SpeechSynthesisVoice[]>([])

  let recognition: SpeechRecognitionLike | undefined
  let recordingTimer: number | undefined
  let finalText = ''
  let interimText = ''
  let cancelResult = false

  function refreshSpeechVoices() {
    if (!speechPlaybackAvailable.value) {
      speechVoices.value = []
      return
    }
    speechVoices.value = window.speechSynthesis.getVoices().slice().sort((a, b) => {
      const aZh = /^zh[-_]/i.test(a.lang) ? 0 : 1
      const bZh = /^zh[-_]/i.test(b.lang) ? 0 : 1
      return aZh - bZh || a.name.localeCompare(b.name)
    })
  }

  function confirmMicrophonePrivacy() {
    if (localStorage.getItem('ai-companion-microphone-privacy-accepted') === 'yes') return true
    const accepted = window.confirm([
      '语音输入会使用设备麦克风，并由浏览器完成语音识别。',
      '',
      '请不要在公共场所录入敏感信息。',
      '',
      '是否继续？'
    ].join('\n'))
    if (accepted) localStorage.setItem('ai-companion-microphone-privacy-accepted', 'yes')
    return accepted
  }

  function clearTimer() {
    if (recordingTimer !== undefined) {
      window.clearInterval(recordingTimer)
      recordingTimer = undefined
    }
  }

  function resetRecognition() {
    clearTimer()
    recognition = undefined
    isRecording.value = false
    isRecognizingSpeech.value = false
    recordingSeconds.value = 0
    finalText = ''
    interimText = ''
    cancelResult = false
  }

  function appendRecognizedText(text: string) {
    const normalized = text.trim()
    if (!normalized) return
    const separator = options.draft.value && !/\s$/.test(options.draft.value) ? ' ' : ''
    options.draft.value = `${options.draft.value}${separator}${normalized}`
    void nextTick(() => options.afterDraftUpdated?.())
  }

  async function startVoiceRecording() {
    if (!voiceInputAvailable.value || isRecording.value || isRecognizingSpeech.value) return
    if (!confirmMicrophonePrivacy()) return
    finalText = ''
    interimText = ''
    cancelResult = false

    try {
      await requestMicrophoneAccess()
      recognition = createSpeechRecognition({
        onTranscript: (interim, final) => {
          interimText = interim
          if (final) finalText += final
        },
        onError: message => {
          cancelResult = true
          options.noticeMessage.value = `${message} 可以点击麦克风重试。`
        },
        onEnd: () => {
          const text = `${finalText}${interimText}`.trim()
          const shouldAppend = !cancelResult && Boolean(text)
          const shouldRetry = !cancelResult && !text
          clearTimer()
          recognition = undefined
          isRecording.value = false
          isRecognizingSpeech.value = false
          recordingSeconds.value = 0
          if (shouldAppend) appendRecognizedText(text)
          else if (shouldRetry) options.noticeMessage.value = '没有识别到内容，可以点击麦克风重试。'
          finalText = ''
          interimText = ''
          cancelResult = false
        }
      })
      recognition.start()
      isRecording.value = true
      isRecognizingSpeech.value = false
      recordingSeconds.value = 0
      options.noticeMessage.value = ''
      recordingTimer = window.setInterval(() => recordingSeconds.value += 1, 1000)
    } catch (error) {
      resetRecognition()
      options.noticeMessage.value = error instanceof Error
        ? `${error.message} 可以点击麦克风重试。`
        : '无法开始语音输入，可以点击麦克风重试。'
    }
  }

  function stopVoiceRecording() {
    if (!recognition || !isRecording.value) return
    isRecording.value = false
    isRecognizingSpeech.value = true
    clearTimer()
    recognition.stop()
  }

  function cancelVoiceRecording() {
    cancelResult = true
    clearTimer()
    isRecording.value = false
    isRecognizingSpeech.value = false
    recordingSeconds.value = 0
    recognition?.abort()
  }

  function roleRate() {
    const base = options.chatSettings.value?.voiceRate ?? 1
    const style = `${options.character.value?.mood ?? ''}${options.character.value?.speakingStyle ?? ''}`
    let adjustment = 0
    if (/温柔|安静|疲惫|难过|低落|沉稳/.test(style)) adjustment -= 0.06
    if (/活泼|开心|兴奋|轻快/.test(style)) adjustment += 0.05
    return Math.min(1.4, Math.max(0.7, base + adjustment))
  }

  function prepareText(text: string) {
    return text
  }

  function stopSpeechPlayback() {
    if (!speechPlaybackAvailable.value) return
    window.speechSynthesis.cancel()
    speakingMessageId.value = ''
    isSpeechPaused.value = false
  }

  function speakText(text: string, messageId = '') {
    if (!speechPlaybackAvailable.value || !text.trim()) return
    stopSpeechPlayback()
    const utterance = new SpeechSynthesisUtterance(prepareText(text))
    const voice = selectSpeechVoice(speechVoices.value, options.chatSettings.value?.voiceName ?? '')
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang || 'zh-CN'
    utterance.rate = roleRate()
    utterance.pitch = 1
    utterance.onend = () => {
      speakingMessageId.value = ''
      isSpeechPaused.value = false
    }
    utterance.onerror = () => {
      speakingMessageId.value = ''
      isSpeechPaused.value = false
      options.noticeMessage.value = '语音播放没有完成，可以再次点击朗读。'
    }
    speakingMessageId.value = messageId
    isSpeechPaused.value = false
    window.speechSynthesis.speak(utterance)
  }

  function previewCurrentVoice() {
    speakText(`我是${options.title.value}。以后想听我说话时，点一下朗读就好。`)
  }

  function toggleMessageSpeech(message: Message) {
    if (!speechPlaybackAvailable.value || message.senderId === 'user') return
    if (speakingMessageId.value === message.id) {
      if (isSpeechPaused.value) {
        window.speechSynthesis.resume()
        isSpeechPaused.value = false
      } else {
        window.speechSynthesis.pause()
        isSpeechPaused.value = true
      }
      return
    }
    speakText(message.content, message.id)
  }

  function speechStateForMessage(id: string): 'idle' | 'playing' | 'paused' {
    if (speakingMessageId.value !== id) return 'idle'
    return isSpeechPaused.value ? 'paused' : 'playing'
  }

  onMounted(() => {
    refreshSpeechVoices()
    if (speechPlaybackAvailable.value) {
      window.speechSynthesis.addEventListener('voiceschanged', refreshSpeechVoices)
    }
  })

  onUnmounted(() => {
    clearTimer()
    recognition?.abort()
    stopSpeechPlayback()
    if (speechPlaybackAvailable.value) {
      window.speechSynthesis.removeEventListener('voiceschanged', refreshSpeechVoices)
    }
  })

  return {
    voiceInputAvailable,
    speechPlaybackAvailable,
    isRecording,
    isRecognizingSpeech,
    recordingSeconds,
    speechVoices,
    startVoiceRecording,
    stopVoiceRecording,
    cancelVoiceRecording,
    stopSpeechPlayback,
    speakText,
    previewCurrentVoice,
    toggleMessageSpeech,
    speechStateForMessage
  }
}
