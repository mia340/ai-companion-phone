<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ html: string }>()
const host = ref<HTMLElement | null>(null)
let shadow: ShadowRoot | null = null

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
  })
  return root.innerHTML
}

function render() {
  if (!host.value) return
  shadow ||= host.value.attachShadow({ mode: 'open' })
  shadow.innerHTML = `<style>:host{display:block;max-width:100%;font:inherit;color:inherit}*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}details{max-width:100%}a{color:inherit}</style>${sanitize(props.html)}`
}

onMounted(render)
watch(() => props.html, render)
</script>

<template><div ref="host" class="safe-rich-html" /></template>

<style scoped>
.safe-rich-html{max-width:min(100%,430px);overflow:hidden}
</style>
