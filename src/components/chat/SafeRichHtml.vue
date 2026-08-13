<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ html: string }>()
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
  root.querySelectorAll('script,iframe,object,embed,link,meta,base,form,input,button,textarea,select').forEach(node => node.remove())
  root.querySelectorAll('*').forEach(node => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
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
}

function render() {
  if (!host.value) return
  shadow ||= host.value.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>:host{display:block;max-width:100%;font:inherit;color:inherit;white-space:pre-wrap}*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}details{max-width:100%}a{color:inherit}</style>${sanitize(props.html)}`
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
