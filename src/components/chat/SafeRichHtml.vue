<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ html: string }>()
const emit = defineEmits<{ selectGreeting: [index: number] }>()
const host = ref<HTMLElement | null>(null)
let shadow: ShadowRoot | null = null
let interactionCleanups: Array<() => void> = []

function safeUrl(value: string) {
  const trimmed = value.trim()
  if (/^(?:javascript|vbscript):/i.test(trimmed)) return ''
  return trimmed
}

function sanitize(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.querySelector('#root') as HTMLElement
  root.querySelectorAll('script,iframe,object,embed,link,meta,base,form,input,textarea,select').forEach(node => node.remove())
  root.querySelectorAll('*').forEach(node => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      if (name === 'onclick') {
        const switchTab = attr.value.match(/switchTab\(\s*['"]([^'"]+)['"]\s*,\s*this\s*\)/i)
        if (switchTab?.[1]) node.setAttribute('data-safe-switch-tab', switchTab[1])
        if (/classList\.toggle\(\s*['"]following['"]\s*\)/i.test(attr.value)) node.setAttribute('data-safe-follow-toggle', '1')
        // SillyTavern / 酒馆助手常见的开场 swipe 跳转。只提取数字，不执行原 JS。
        const triggerStory = attr.value.match(/triggerStory\(\s*(\d+)\s*\)/i)
        const directSwipe = attr.value.match(/setChatMessages\([\s\S]*?swipe_id\s*:\s*(\d+)/i)
        const greetingIndex = triggerStory?.[1] || directSwipe?.[1]
        if (greetingIndex) node.setAttribute('data-safe-greeting-index', greetingIndex)
      }
      if (name.startsWith('on') || name === 'srcdoc') node.removeAttribute(attr.name)
      if (['href', 'src', 'poster', 'xlink:href'].includes(name)) {
        const safe = safeUrl(attr.value)
        if (!safe) node.removeAttribute(attr.name)
        else node.setAttribute(attr.name, safe)
      }
    }
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  root.querySelectorAll('style').forEach(style => {
    style.textContent = (style.textContent || '')
      .replace(/@import[^;]+;?/gi, '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/url\s*\(\s*['"]?javascript:[^)]+\)/gi, 'none')
      // 完整 HTML 模板里的 body/html 在 Shadow DOM 中不存在，映射到宿主组件。
      .replace(/(^|})\s*(?:html\s*,\s*body|body\s*,\s*html|body|html)\s*\{/gim, '$1:host{')
  })
  return root.innerHTML
}


function bindSafeInteractions() {
  if (!shadow) return
  interactionCleanups.forEach(cleanup => cleanup())
  interactionCleanups = []

  // 不执行社区 JS，但兼容常见 data-target Tab：仅做同一 ShadowRoot 内的 active 切换。
  const triggers = [...shadow.querySelectorAll<HTMLElement>('[data-target]')]
  for (const trigger of triggers) {
    const targetId = trigger.dataset.target?.trim()
    if (!targetId || !/^[A-Za-z][\w:.-]*$/.test(targetId)) continue
    const target = shadow.getElementById(targetId)
    if (!target) continue

    const handler = () => {
      const group = trigger.parentElement
      const siblings = group ? [...group.querySelectorAll<HTMLElement>('[data-target]')] : triggers
      const targetIds = siblings.map(item => item.dataset.target?.trim()).filter((value): value is string => Boolean(value))
      siblings.forEach(item => item.classList.remove('active'))
      trigger.classList.add('active')
      const index = Math.max(0, siblings.indexOf(trigger))
      group?.style.setProperty('--active-index', String(index))
      targetIds.forEach(id => shadow?.getElementById(id)?.classList.remove('active'))
      target.classList.add('active')
    }

    trigger.addEventListener('click', handler)
    interactionCleanups.push(() => trigger.removeEventListener('click', handler))
  }

  // 酒馆社区 UI 常见 switchTab('posts', this) 写法：转成纯 DOM active 切换，不执行原 JS。
  const safeTabs = [...shadow.querySelectorAll<HTMLElement>('[data-safe-switch-tab]')]
  for (const trigger of safeTabs) {
    const key = trigger.dataset.safeSwitchTab?.trim()
    if (!key || !/^[A-Za-z0-9_-]+$/.test(key)) continue
    const target = shadow.getElementById(`${key}-feed`) || shadow.getElementById(key)
    if (!target) continue
    const handler = () => {
      safeTabs.forEach(item => item.classList.remove('active'))
      trigger.classList.add('active')
      const candidateIds = safeTabs
        .map(item => item.dataset.safeSwitchTab?.trim())
        .filter((value): value is string => Boolean(value))
      candidateIds.forEach(id => {
        const pane = shadow?.getElementById(`${id}-feed`) || shadow?.getElementById(id)
        pane?.classList.remove('active')
      })
      target.classList.add('active')
    }
    trigger.addEventListener('click', handler)
    interactionCleanups.push(() => trigger.removeEventListener('click', handler))
  }

  // 社区开场页常用 triggerStory(n) / setChatMessages swipe。
  // 不执行第三方 JS，只把 swipe 编号交回聊天页，由本地代码安全地切换开场并重置当前剧情分支。
  const greetingTriggers = [...shadow.querySelectorAll<HTMLElement>('[data-safe-greeting-index]')]
  for (const trigger of greetingTriggers) {
    const index = Number(trigger.dataset.safeGreetingIndex)
    if (!Number.isInteger(index) || index < 0) continue
    const handler = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      emit('selectGreeting', index)
    }
    trigger.addEventListener('click', handler)
    interactionCleanups.push(() => trigger.removeEventListener('click', handler))
  }

  // 关注按钮仅允许切换本地视觉状态。
  const followButtons = [...shadow.querySelectorAll<HTMLElement>('[data-safe-follow-toggle]')]
  for (const button of followButtons) {
    const handler = () => {
      const following = button.classList.toggle('following')
      button.textContent = following ? '已关注' : '关注'
    }
    button.addEventListener('click', handler)
    interactionCleanups.push(() => button.removeEventListener('click', handler))
  }

  // 常见“点击揭开”遮罩：只隐藏当前遮罩，不触发外部函数、不修改聊天数据。
  const revealOverlays = [...shadow.querySelectorAll<HTMLElement>('.blur-overlay, [data-reveal-overlay]')]
  for (const overlay of revealOverlays) {
    overlay.style.cursor = 'pointer'
    const handler = (event: Event) => {
      event.stopPropagation()
      overlay.style.display = 'none'
      const greetingHost = overlay.closest<HTMLElement>('[data-safe-greeting-index]')
      const index = Number(greetingHost?.dataset.safeGreetingIndex)
      if (Number.isInteger(index) && index >= 0) emit('selectGreeting', index)
    }
    overlay.addEventListener('click', handler)
    interactionCleanups.push(() => overlay.removeEventListener('click', handler))
  }
}

function render() {
  if (!host.value) return
  shadow ||= host.value.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>:host{display:block;width:100%;max-width:100%;min-width:0;font:inherit;color:inherit;white-space:normal}*,*::before,*::after{box-sizing:border-box}img,video,canvas,svg{max-width:100%;height:auto}audio{max-width:100%}details,table{max-width:100%}a{color:inherit}</style>${sanitize(props.html)}`
  bindSafeInteractions()
}

onMounted(render)
onBeforeUnmount(() => interactionCleanups.forEach(cleanup => cleanup()))
watch(() => props.html, render)
</script>

<template><div ref="host" class="safe-rich-html" /></template>

<style scoped>
.safe-rich-html{max-width:min(100%,430px);overflow:hidden}
</style>
