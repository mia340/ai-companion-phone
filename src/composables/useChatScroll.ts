import { nextTick, ref, type Ref } from 'vue'

export interface ChatMessageListHandle {
  getElement: () => HTMLElement | undefined
}

export function useChatScroll(options: {
  messageListRef: Ref<ChatMessageListHandle | undefined>
  getConversationId: () => string | undefined
}) {
  const showScrollButton = ref(false)
  const storageKey = (id: string) => `ai-companion-scroll:${id}`
  const element = () => options.messageListRef.value?.getElement()

  async function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    await nextTick()
    const target = element()
    if (!target) return
    target.scrollTo({ top: target.scrollHeight, behavior })
    showScrollButton.value = false
  }

  function updateScrollButton() {
    const target = element()
    if (!target) return
    const distance = target.scrollHeight - target.scrollTop - target.clientHeight
    showScrollButton.value = distance > 120
  }

  function rememberScrollPosition() {
    const target = element()
    const id = options.getConversationId()
    if (!target || !id) return
    sessionStorage.setItem(storageKey(id), String(target.scrollTop))
  }

  function handleMessageScroll() {
    rememberScrollPosition()
    updateScrollButton()
  }

  async function restoreScrollPosition(id: string) {
    await nextTick()
    const target = element()
    if (!target) return
    const saved = sessionStorage.getItem(storageKey(id))
    target.scrollTop = saved === null ? target.scrollHeight : Number(saved) || 0
  }

  function handleComposerFocus() {
    window.setTimeout(() => void scrollToBottom('smooth'), 180)
  }

  return {
    showScrollButton,
    scrollToBottom,
    updateScrollButton,
    handleMessageScroll,
    rememberScrollPosition,
    restoreScrollPosition,
    handleComposerFocus
  }
}
