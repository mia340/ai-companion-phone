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

function dataFieldLabel(key: string) {
  const normalized = key.toLowerCase().replace(/^data-/, '')
  const labels: Record<string, string> = {
    'lyric-title': '标题', title: '标题', time: '时间', date: '日期', location: '地点',
    chars: '人物', characters: '人物', people: '人物', outfit: '衣着', clothing: '衣着',
    weather: '天气', season: '季节', mood: '心情', inner: '内心', action: '行动'
  }
  return labels[normalized] || normalized.replace(/[-_]+/g, ' ')
}

function isPlaceholderContent(value: string) {
  const text = value.replace(/\s+/g, '')
  return !text || /^(?:正在解析|加载中|暂无(?:数据|内容|心事)?|loading)[.…。]*$/i.test(text)
}

function compileSimpleDataContainer(root: HTMLElement) {
  let compiled = 0
  const containers = [...root.querySelectorAll<HTMLElement>('[id*="data-container"], [class*="data-container"]')]
  for (const container of containers) {
    const dataItems = [...container.querySelectorAll<HTMLElement>('[id^="data-"]')]
      .map(node => ({ key: node.id.slice(5), value: (node.textContent || '').trim() }))
      .filter(item => item.key && item.value)
    if (!dataItems.length) continue

    const titleItem = dataItems.find(item => /(?:^|[-_])(title|lyric)(?:$|[-_])/i.test(item.key))
    const summary = root.querySelector<HTMLElement>('#summary-title, .summary-title')
    if (summary && isPlaceholderContent(summary.textContent || '')) {
      summary.textContent = titleItem?.value || '场景信息'
      compiled += 1
    }

    const content = root.querySelector<HTMLElement>('#scene-content-wrapper, .scene-content-wrapper')
    if (content && isPlaceholderContent(content.textContent || '')) {
      const documentRef = content.ownerDocument
      content.textContent = ''
      for (const item of dataItems.filter(row => row !== titleItem)) {
        const row = documentRef.createElement('div')
        row.className = 'info-item safe-compiled-info-item'
        const label = documentRef.createElement('span')
        label.className = 'info-label safe-compiled-info-label'
        label.textContent = `${dataFieldLabel(item.key)}：${item.value}`
        row.appendChild(label)
        content.appendChild(row)
      }
      compiled += 1
    }
  }
  return compiled
}

interface StructuredBlock {
  label: string
  fields: Array<{ key: string; value: string }>
}

function parseStructuredBlocks(text: string): StructuredBlock[] {
  const blocks: StructuredBlock[] = []
  const blockPattern = /\[([^\]\r\n]{1,40})\]([\s\S]*?)\[\/\1\]/g
  let match: RegExpExecArray | null
  while ((match = blockPattern.exec(text))) {
    const fields: Array<{ key: string; value: string }> = []
    let current: { key: string; value: string } | undefined
    for (const rawLine of (match[2] || '').replace(/\r\n/g, '\n').split('\n')) {
      const line = rawLine.trimEnd()
      const fieldMatch = line.match(/^\s*([^:：\n]{1,40})\s*[:：]\s*(.*)$/)
      if (fieldMatch) {
        if (current) fields.push(current)
        current = { key: fieldMatch[1].trim(), value: fieldMatch[2].trim() }
      } else if (current && line.trim()) {
        current.value += `${current.value ? '\n' : ''}${line.trim()}`
      }
    }
    if (current) fields.push(current)
    if (fields.length) blocks.push({ label: match[1].trim(), fields })
  }
  return blocks
}

function compileStructuredStatus(root: HTMLElement) {
  let compiled = 0
  const sources = [...root.querySelectorAll<HTMLElement>('.status-bar-data-container, [class*="status-data"], [data-status-source]')]
  for (const source of sources) {
    const raw = (source.textContent || '').trim()
    if (!raw) continue
    const blocks = parseStructuredBlocks(raw)
    const shell = source.parentElement || root
    const target = shell.querySelector<HTMLElement>('.status-bar-content, [data-status-content]')
      || root.querySelector<HTMLElement>('.status-bar-content, [data-status-content]')
    if (!target || (!isPlaceholderContent(target.textContent || '') && target.children.length > 1)) continue

    const documentRef = target.ownerDocument
    target.textContent = ''
    if (blocks.length) {
      for (const block of blocks) {
        const card = documentRef.createElement('div')
        card.className = 'data-block safe-compiled-data-block'
        const nameField = block.fields.find(field => /^(?:人物|角色|姓名|name|character)$/i.test(field.key))
        const title = documentRef.createElement('div')
        title.className = 'data-block-title'
        title.textContent = nameField?.value || block.label
        card.appendChild(title)
        for (const field of block.fields) {
          if (field === nameField) continue
          const item = documentRef.createElement('div')
          item.className = 'data-item'
          const key = documentRef.createElement('span')
          key.className = 'data-key'
          key.textContent = field.key
          const value = documentRef.createElement('div')
          value.className = /(?:行动|action)/i.test(field.key) ? 'data-value action-value' : 'data-value thought-value'
          value.textContent = field.value
          item.append(key, value)
          card.appendChild(item)
        }
        target.appendChild(card)
      }
    } else {
      const pre = documentRef.createElement('pre')
      pre.className = 'safe-compiled-raw-data'
      pre.textContent = raw
      target.appendChild(pre)
    }
    target.setAttribute('data-safe-compiled-content', '1')
    compiled += 1
  }
  return compiled
}

function compileFallbackForScriptData(root: HTMLElement, hadScripts: boolean, compiledCount: number) {
  if (!hadScripts || compiledCount > 0) return 0
  const source = [...root.querySelectorAll<HTMLElement>('[id*="data-container"], [class*="data-container"], [style*="display:none"], [style*="display: none"]')]
    .map(node => (node.textContent || '').trim())
    .find(text => text.length >= 8)

  const details = root.ownerDocument.createElement('details')
  details.className = 'safe-ui-fallback'
  const summary = root.ownerDocument.createElement('summary')
  summary.textContent = source ? '社区 UI 数据（安全模式）' : '社区 UI 脚本已安全阻止'
  const pre = root.ownerDocument.createElement('pre')
  pre.textContent = source || '这个社区界面依赖第三方 JavaScript 动态生成内容。小手机不会执行作者脚本，因此无法安全还原这一部分交互；AI 原始回复仍保留在消息与 Prompt 调试中。'
  details.append(summary, pre)
  root.appendChild(details)
  return 1
}

function sanitize(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.querySelector('#root') as HTMLElement
  const hadScripts = root.querySelectorAll('script').length > 0

  // 不执行第三方 JS。先读取它已经放进 HTML 的静态数据，用本地安全编译器恢复常见 UI。
  let compiledCount = compileSimpleDataContainer(root)
  compiledCount += compileStructuredStatus(root)
  compiledCount += compileFallbackForScriptData(root, hadScripts, compiledCount)

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

  // 常见状态栏脚本只是“点击标题展开/收起”。本地实现同样的视觉行为，不执行原 JS。
  const statusHeaders = [...shadow.querySelectorAll<HTMLElement>('.status-bar-header, [data-safe-toggle-header]')]
  for (const header of statusHeaders) {
    const container = header.closest<HTMLElement>('.status-bar-container') || header.parentElement
    const content = container?.querySelector<HTMLElement>('.status-bar-content, [data-safe-compiled-content], [data-safe-toggle-content]')
    if (!content) continue
    const icon = header.querySelector<HTMLElement>('.header-icon')
    const handler = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      const open = content.style.display === 'block'
      content.style.display = open ? 'none' : 'block'
      if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)'
    }
    header.addEventListener('click', handler)
    interactionCleanups.push(() => header.removeEventListener('click', handler))
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
  shadow.innerHTML = `<style>:host{display:block;width:100%;max-width:100%;min-width:0;font:inherit;color:inherit;white-space:normal}*,*::before,*::after{box-sizing:border-box}img,video,canvas,svg{max-width:100%;height:auto}audio{max-width:100%}details,table{max-width:100%}a{color:inherit}.safe-ui-fallback{margin:10px 0;padding:10px;border:1px dashed rgba(120,90,105,.25);border-radius:10px}.safe-ui-fallback summary{cursor:pointer;font-size:12px}.safe-ui-fallback pre,.safe-compiled-raw-data{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;font:inherit;font-size:12px;line-height:1.6}</style>${sanitize(props.html)}`
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
