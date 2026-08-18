<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { DEFAULT_WORLD_ID } from '../db/seed'
import { deleteCommunityResource, deleteCommunityResourceArchive, importCommunityFile, listCommunityResources } from '../services/communityResourceService'
import { setResourceBinding } from '../services/resourceBindingService'
import { regexExecutionOrder } from '../services/regexRuntime'
import type { Character, CommunityResourceArchive, ConversationState, LorebookResource, PromptPreset, RegexScript, ResourceBinding, ResourceType } from '../types/domain'

const route = useRoute()
const router = useRouter()
type TabName = 'lorebooks'|'state'|'presets'|'regex'|'library'
const tab = ref<TabName>('lorebooks')
const characters = ref<Character[]>([])
const selectedCharacterId = ref('')
const bindingScope = ref<'character'|'global'>('character')
const lorebooks = ref<LorebookResource[]>([])
const presets = ref<PromptPreset[]>([])
const regexes = ref<RegexScript[]>([])
const bindings = ref<ResourceBinding[]>([])
const archives = ref<CommunityResourceArchive[]>([])
const states = ref<Array<{ character?: Character; state: ConversationState }>>([])
const lorebookEntryCounts = ref<Record<string, number>>({})
const legacyEntryCount = ref(0)
const importInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const reports = ref<Array<{ name: string; summary: string[]; supported: string[]; warnings: string[] }>>([])
const busy = ref(false)
const editingRegex = ref<RegexScript | null>(null)
const regexForm = reactive({
  name: '',
  findRegex: '',
  replaceString: '',
  trimStringsText: '',
  placementText: '',
  enabled: true,
  markdownOnly: false,
  promptOnly: false,
  runOnEdit: false,
  substituteRegex: 0,
  order: 0,
  minDepth: '',
  maxDepth: ''
})

const selectedCharacter = computed(() => characters.value.find(item => item.id === selectedCharacterId.value))

function normalizedScope(item: ResourceBinding) {
  return item.scope || (item.characterId ? 'character' : 'global')
}
function normalizedScopeId(item: ResourceBinding) {
  return item.scopeId || item.characterId
}

function isBound(type: ResourceType, id: string) {
  return bindings.value.some(item => {
    if (item.resourceType !== type || item.resourceId !== id || !item.enabled) return false
    if (bindingScope.value === 'global') return normalizedScope(item) === 'global'
    return normalizedScope(item) === 'character' && Boolean(selectedCharacterId.value) && normalizedScopeId(item) === selectedCharacterId.value
  })
}

function usageLabel(type: ResourceType, id: string) {
  const active = bindings.value.filter(item => item.enabled && item.resourceType === type && item.resourceId === id)
  const labels: string[] = []
  if (active.some(item => normalizedScope(item) === 'global')) labels.push('全局')
  for (const binding of active.filter(item => normalizedScope(item) === 'character')) {
    const name = characters.value.find(item => item.id === normalizedScopeId(binding))?.name
    if (name && !labels.includes(name)) labels.push(name)
  }
  return labels.length ? `已用于：${labels.join('、')}` : '尚未绑定角色'
}

function originLabel(resource: LorebookResource | RegexScript) {
  if (resource.sourceCharacterName) return `来自角色卡：${resource.sourceCharacterName} · 可复用`
  if (resource.sourceFormat === 'character-card') return '来自角色卡 · 可复用'
  return resource.sourceFormat && resource.sourceFormat !== 'native' ? `${resource.sourceFormat} · 可复用` : '共享资源 · 可复用'
}

async function refresh() {
  const resources = await listCommunityResources(DEFAULT_WORLD_ID)
  lorebooks.value = resources.lorebooks
  presets.value = resources.presets
  regexes.value = resources.regexes.slice().sort((a, b) => regexExecutionOrder(a) - regexExecutionOrder(b) || a.name.localeCompare(b.name, 'zh-CN'))
  bindings.value = resources.bindings
  archives.value = resources.archives
  characters.value = (await db.characters.where('worldId').equals(DEFAULT_WORLD_ID).toArray())
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  if (selectedCharacterId.value && !characters.value.some(item => item.id === selectedCharacterId.value)) selectedCharacterId.value = ''
  if (!selectedCharacterId.value && characters.value.length) selectedCharacterId.value = characters.value[0].id

  const allEntries = await db.lorebookEntries.toArray()
  const counts: Record<string, number> = {}
  allEntries.forEach(entry => {
    if (entry.lorebookId) counts[entry.lorebookId] = (counts[entry.lorebookId] || 0) + 1
  })
  lorebookEntryCounts.value = counts
  legacyEntryCount.value = allEntries.filter(item => !item.lorebookId).length

  const conversations = await db.conversations.where('worldId').equals(DEFAULT_WORLD_ID).toArray()
  const allStates = await db.conversationStates.toArray()
  states.value = allStates.flatMap(state => {
    const conversation = conversations.find(item => item.id === state.id)
    const character = characters.value.find(item => conversation?.memberIds.includes(item.id))
    return conversation ? [{ character, state }] : []
  })
}

function checkedFromEvent(event: Event) {
  return Boolean((event.target as HTMLInputElement | null)?.checked)
}

function numberFromEvent(event: Event, fallback = 0) {
  const value = Number((event.target as HTMLInputElement | null)?.value)
  return Number.isFinite(value) ? value : fallback
}

function optionalNumberFromText(value: string) {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseNumberList(value: string) {
  return value
    .split(/[，,\s]+/)
    .map(item => Number(item.trim()))
    .filter(item => Number.isFinite(item) && item >= 0)
}

function openRegexEditor(script: RegexScript) {
  editingRegex.value = script
  regexForm.name = script.name
  regexForm.findRegex = script.findRegex
  regexForm.replaceString = script.replaceString
  regexForm.trimStringsText = script.trimStrings.join('\n')
  regexForm.placementText = script.placement.join(', ')
  regexForm.enabled = script.enabled
  regexForm.markdownOnly = script.markdownOnly
  regexForm.promptOnly = script.promptOnly
  regexForm.runOnEdit = script.runOnEdit
  regexForm.substituteRegex = script.substituteRegex
  regexForm.order = regexExecutionOrder(script)
  regexForm.minDepth = script.minDepth == null ? '' : String(script.minDepth)
  regexForm.maxDepth = script.maxDepth == null ? '' : String(script.maxDepth)
}

function closeRegexEditor() { editingRegex.value = null }

async function toggleRegexScriptEnabled(script: RegexScript, enabled: boolean) {
  await db.regexScripts.update(script.id, { enabled, updatedAt: new Date().toISOString() })
  message.value = enabled ? `已启用正则脚本“${script.name}”。` : `已停用正则脚本“${script.name}”；绑定关系仍保留。`
  await refresh()
}

async function updateRegexOrder(script: RegexScript, order: number) {
  await db.regexScripts.update(script.id, { order, updatedAt: new Date().toISOString() })
  message.value = `已更新“${script.name}”的执行顺序。`
  await refresh()
}

async function saveRegexEditor() {
  const original = editingRegex.value
  if (!original) return
  if (!regexForm.name.trim() || !regexForm.findRegex.trim()) {
    message.value = '正则名称和 findRegex 不能为空。'
    return
  }
  await db.regexScripts.put({
    ...original,
    name: regexForm.name.trim(),
    findRegex: regexForm.findRegex,
    replaceString: regexForm.replaceString,
    trimStrings: regexForm.trimStringsText.split(/\r?\n/).map(item => item.trim()).filter(Boolean),
    placement: parseNumberList(regexForm.placementText),
    enabled: regexForm.enabled,
    markdownOnly: regexForm.markdownOnly,
    promptOnly: regexForm.promptOnly,
    runOnEdit: regexForm.runOnEdit,
    substituteRegex: Number.isFinite(Number(regexForm.substituteRegex)) ? Number(regexForm.substituteRegex) : 0,
    order: Number.isFinite(Number(regexForm.order)) ? Number(regexForm.order) : 0,
    minDepth: optionalNumberFromText(regexForm.minDepth),
    maxDepth: optionalNumberFromText(regexForm.maxDepth),
    updatedAt: new Date().toISOString()
  })
  message.value = `已保存正则脚本“${regexForm.name.trim()}”。`
  editingRegex.value = null
  await refresh()
}

async function toggleBinding(type: ResourceType, id: string, checked: boolean) {
  const character = selectedCharacter.value
  if (bindingScope.value === 'character' && !character) {
    message.value = '先选择要使用资源的角色。'
    return
  }
  if (type === 'preset' && checked) {
    const other = bindings.value.filter(item => {
      const sameScope = bindingScope.value === 'global'
        ? normalizedScope(item) === 'global'
        : normalizedScope(item) === 'character' && normalizedScopeId(item) === character?.id
      return sameScope && item.resourceType === 'preset' && item.resourceId !== id && item.enabled
    })
    for (const binding of other) {
      await setResourceBinding({
        worldId: DEFAULT_WORLD_ID,
        characterId: bindingScope.value === 'character' ? character?.id : undefined,
        scope: bindingScope.value,
        scopeId: bindingScope.value === 'character' ? character?.id : undefined,
        resourceType: 'preset',
        resourceId: binding.resourceId,
        enabled: false,
        order: binding.order
      })
    }
  }
  await setResourceBinding({
    worldId: DEFAULT_WORLD_ID,
    characterId: bindingScope.value === 'character' ? character?.id : undefined,
    scope: bindingScope.value,
    scopeId: bindingScope.value === 'character' ? character?.id : undefined,
    resourceType: type,
    resourceId: id,
    enabled: checked
  })
  const target = bindingScope.value === 'global' ? '所有角色' : character?.name || '当前角色'
  message.value = checked ? `已给${target}启用这个资源。` : `已从${target}停用这个资源。`
  await refresh()
}

function chooseImport() { importInput.value?.click() }

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  busy.value = true
  message.value = ''
  try {
    const imported = await importCommunityFile({
      file,
      worldId: DEFAULT_WORLD_ID,
      characterId: bindingScope.value === 'character' ? selectedCharacterId.value || undefined : undefined,
      autoBind: bindingScope.value === 'character' && Boolean(selectedCharacterId.value)
    })
    reports.value = imported.map(item => ({ name: item.report.name, summary: item.report.summary, supported: item.report.supported, warnings: item.report.warnings }))
    if (bindingScope.value === 'global') {
      for (const item of imported) {
        if (item.type === 'lorebook') await setResourceBinding({ worldId: DEFAULT_WORLD_ID, scope: 'global', resourceType: 'lorebook', resourceId: item.id, enabled: true })
        if (item.type === 'preset') await setResourceBinding({ worldId: DEFAULT_WORLD_ID, scope: 'global', resourceType: 'preset', resourceId: item.id, enabled: true })
        if (item.type === 'regex') for (const id of item.ids) await setResourceBinding({ worldId: DEFAULT_WORLD_ID, scope: 'global', resourceType: 'regex', resourceId: id, enabled: true })
      }
    }
    const runnableCount = imported.filter(item => item.type !== 'archive').length
    const archivedOnly = imported.length - runnableCount
    message.value = [
      `已处理 ${imported.length} 个资源。资源本体已进入共享资源库。`,
      runnableCount ? ` ${runnableCount} 个运行资源已${bindingScope.value === 'global' ? '全局启用' : selectedCharacter.value ? `绑定给 ${selectedCharacter.value.name}` : '仅导入'}。` : '',
      archivedOnly ? ` ${archivedOnly} 个资源已安全归档，暂未自动运行。` : ''
    ].join('')
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '资源导入失败。'
  } finally {
    busy.value = false
  }
}

async function remove(type: ResourceType, id: string, name: string) {
  if (!window.confirm(`确定从共享资源库删除“${name}”吗？所有角色对它的绑定也会一起移除。`)) return
  await deleteCommunityResource(type, id)
  message.value = '共享资源已删除。'
  await refresh()
}

function archiveKindLabel(kind: CommunityResourceArchive['kind']) {
  if (kind === 'lorebook') return '世界书'
  if (kind === 'preset') return '预设'
  if (kind === 'regex') return '正则'
  if (kind === 'character-card') return '角色卡'
  if (kind === 'persona') return 'Persona'
  if (kind === 'theme') return '美化'
  return '未知资源'
}

async function copyArchiveRaw(archive: CommunityResourceArchive) {
  const text = archive.rawText || (archive.rawJson ? JSON.stringify(archive.rawJson, null, 2) : '')
  if (!text) { message.value = '这个归档没有可复制的原始文本。'; return }
  await navigator.clipboard.writeText(text)
  message.value = `已复制“${archive.name}”的原始资源。`
}

function downloadArchiveRaw(archive: CommunityResourceArchive) {
  const text = archive.rawText || (archive.rawJson ? JSON.stringify(archive.rawJson, null, 2) : '')
  if (!text) { message.value = '这个归档没有可下载的原始文本。'; return }
  const blob = new Blob([text], { type: archive.mimeType || 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = archive.fileName.split(' / ').pop() || `${archive.name}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function removeArchive(archive: CommunityResourceArchive) {
  if (!window.confirm(`只删除“${archive.name}”的原始归档吗？已经解析出的共享资源不会被删除。`)) return
  await deleteCommunityResourceArchive(archive.id)
  message.value = '原始资源归档已删除；运行资源仍保留。'
  await refresh()
}

function openLorebook(book?: LorebookResource) {
  router.push({ path: '/settings/lorebook', query: book ? { book: book.id } : {} })
}

function presenceLabel(value?: string) {
  if (value === 'together') return '在身边'
  if (value === 'remote') return '远程'
  return '未确定'
}

onMounted(async () => {
  const requestedTab = String(route.query.tab || '') as TabName
  if (['lorebooks', 'state', 'presets', 'regex', 'library'].includes(requestedTab)) tab.value = requestedTab
  selectedCharacterId.value = String(route.query.character || '')
  await refresh()
})
</script>

<template>
  <PhoneFrame title="世界" show-back>
    <main class="world-center">
      <section class="hero-card">
        <div class="hero-icon">✨</div>
        <div><small>WORLD & RESOURCES</small><h1>世界与资源中心</h1><p>世界书、Preset、Regex 都是共享资源；角色卡只决定默认绑定，不决定资源归属。</p></div>
      </section>

      <nav class="tabs">
        <button :class="{active:tab==='lorebooks'}" @click="tab='lorebooks'">世界书</button>
        <button :class="{active:tab==='state'}" @click="tab='state'">世界状态</button>
        <button :class="{active:tab==='presets'}" @click="tab='presets'">预设</button>
        <button :class="{active:tab==='regex'}" @click="tab='regex'">正则</button>
        <button :class="{active:tab==='library'}" @click="tab='library'">资源库</button>
      </nav>

      <section v-if="tab!=='state'" class="apply-card">
        <div class="scope-switch"><button :class="{active:bindingScope==='character'}" @click="bindingScope='character'">给角色使用</button><button :class="{active:bindingScope==='global'}" @click="bindingScope='global'">所有角色</button></div>
        <label v-if="bindingScope==='character'">选择角色
          <select v-model="selectedCharacterId"><option value="">仅导入，不绑定</option><option v-for="item in characters" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        </label>
        <div v-if="bindingScope==='character' && selectedCharacter" class="character-chip"><CharacterAvatar :avatar="selectedCharacter.avatar" :name="selectedCharacter.name" :size="34" /><span>下面任何来源的资源都可以给 {{ selectedCharacter.name }} 使用</span></div>
        <div v-else-if="bindingScope==='global'" class="global-chip">🌐 勾选后所有角色都使用该资源；资源来源不会限制绑定对象。</div>
      </section>

      <p v-if="message" class="notice">{{ message }}</p>

      <section v-if="tab==='lorebooks'" class="resource-list">
        <header class="section-head"><div><h2>世界书</h2><p>全部进入共享资源库。角色卡内嵌只表示“从哪里来”，可以给任意其它角色复用。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="book in lorebooks" :key="book.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">📚</div><div><b>{{ book.name }}</b><small>{{ originLabel(book) }} · {{ lorebookEntryCounts[book.id] || 0 }} 条</small><p v-if="book.description">{{ book.description }}</p><span class="usage-line">{{ usageLabel('lorebook', book.id) }}</span></div></div>
          <div class="resource-actions">
            <label class="toggle"><input type="checkbox" :checked="isBound('lorebook',book.id)" :disabled="bindingScope==='character' && !selectedCharacterId" @change="toggleBinding('lorebook',book.id,checkedFromEvent($event))" />应用</label>
            <button @click="openLorebook(book)">查看 / 编辑</button><button class="danger" @click="remove('lorebook',book.id,book.name)">删除</button>
          </div>
        </article>
        <article v-if="legacyEntryCount" class="resource-card legacy"><div><b>旧版散装世界书</b><small>{{ legacyEntryCount }} 条 · V14 会逐步转换为共享资源</small></div><button @click="openLorebook()">管理</button></article>
        <p v-if="!lorebooks.length && !legacyEntryCount" class="empty">还没有世界书。到“资源库”导入 Tavo / SillyTavern 世界书即可。</p>
      </section>

      <section v-else-if="tab==='state'" class="resource-list">
        <header class="section-head"><div><h2>持续世界状态</h2><p>只显示已有事实；没有明确状态时保持未确定，不用应用占位值补齐。</p></div></header>
        <article v-for="row in states" :key="row.state.id" class="state-card">
          <div class="state-title"><CharacterAvatar v-if="row.character" :avatar="row.character.avatar" :name="row.character.name" :size="36" /><b>{{ row.character?.name || '会话' }}</b><span :class="['presence',row.state.presence]">{{ presenceLabel(row.state.presence) }}</span></div>
          <dl><div><dt>地点</dt><dd>{{ row.state.location || '—' }}</dd></div><div><dt>剧情时间</dt><dd>{{ row.state.timePeriod || '—' }}</dd></div><div><dt>活动</dt><dd>{{ row.state.innerActivity || '—' }}</dd></div><div><dt>心情</dt><dd>{{ row.state.innerMood || '—' }}</dd></div></dl>
        </article>
        <p v-if="!states.length" class="empty">还没有持续世界状态。</p>
      </section>

      <section v-else-if="tab==='presets'" class="resource-list">
        <header class="section-head"><div><h2>Prompt 预设</h2><p>预设同样是共享资源；按角色或全局选择是否启用。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="preset in presets" :key="preset.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">🧩</div><div><b>{{ preset.name }}</b><small>{{ preset.prompts.length }} 个 Prompt · {{ preset.prompts.filter(p=>p.enabled).length }} 个启用</small><span class="usage-line">{{ usageLabel('preset', preset.id) }}</span></div></div>
          <div class="resource-actions"><label class="toggle"><input type="checkbox" :checked="isBound('preset',preset.id)" :disabled="bindingScope==='character' && !selectedCharacterId" @change="toggleBinding('preset',preset.id,checkedFromEvent($event))" />应用</label><button class="danger" @click="remove('preset',preset.id,preset.name)">删除</button></div>
        </article><p v-if="!presets.length" class="empty">还没有导入预设。</p>
      </section>

      <section v-else-if="tab==='regex'" class="resource-list">
        <header class="section-head"><div><h2>正则</h2><p>Regex 是后处理器：脚本启停决定它是否运行，“应用”只决定当前角色/全局是否使用。未命中时保留 AI 原文；第三方 JavaScript 仍不执行。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="script in regexes" :key="script.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">🧷</div><div><b>{{ script.name }}</b><small>{{ originLabel(script) }} · placement {{ script.placement.join(',') || '默认' }} · order {{ regexExecutionOrder(script) }}</small><code>{{ script.findRegex.slice(0,120) }}{{ script.findRegex.length>120?'…':'' }}</code><span class="usage-line">{{ usageLabel('regex', script.id) }}</span></div></div>
          <div class="regex-quick-controls">
            <label class="toggle"><input type="checkbox" :checked="script.enabled" @change="toggleRegexScriptEnabled(script,checkedFromEvent($event))" />脚本启用</label>
            <label class="order-control">执行顺序 <input type="number" :value="regexExecutionOrder(script)" @change="updateRegexOrder(script,numberFromEvent($event,regexExecutionOrder(script)))" /></label>
          </div>
          <div class="resource-actions"><label class="toggle"><input type="checkbox" :checked="isBound('regex',script.id)" :disabled="bindingScope==='character' && !selectedCharacterId" @change="toggleBinding('regex',script.id,checkedFromEvent($event))" />应用</label><button @click="openRegexEditor(script)">编辑</button><button class="danger" @click="remove('regex',script.id,script.name)">删除</button></div>
        </article><p v-if="!regexes.length" class="empty">还没有正则脚本。</p>
      </section>

      <section v-else class="library">
        <div class="import-card"><div class="import-icon">📦</div><h2>导入社区资源</h2><p>导入后先进入共享资源库，再决定给哪个角色使用。角色卡里的世界书 / Regex 也遵循同一规则。</p><button :disabled="busy" @click="chooseImport">{{ busy ? '正在解析…' : '选择 JSON / ZIP / TXT' }}</button><input ref="importInput" type="file" accept=".json,.zip,.txt,.md,application/json,application/zip,text/plain,text/markdown" hidden @change="onImport" /></div>
        <article v-for="report in reports" :key="report.name" class="report-card"><h3>{{ report.name }}</h3><p>{{ report.summary.join(' · ') }}</p><div class="report-ok">✓ {{ report.supported.join(' · ') }}</div><div v-for="warning in report.warnings" :key="warning" class="report-warning">⚠ {{ warning }}</div></article>
        <section class="archive-section">
          <header class="section-head"><div><h2>原始资源归档</h2><p>原始 JSON 完整保留，解析出的共享资源与原始归档彼此独立。</p></div><span class="archive-count">{{ archives.length }}</span></header>
          <article v-for="archive in archives" :key="archive.id" class="archive-card">
            <div class="archive-head"><div><b>{{ archive.name }}</b><small>{{ archiveKindLabel(archive.kind) }} · {{ archive.compatibility.format }}</small></div><span>{{ archive.fileName }}</span></div>
            <p>{{ archive.compatibility.summary.join(' · ') }}</p><div class="archive-supported">✓ {{ archive.compatibility.supported.join(' · ') }}</div><div v-for="warning in archive.compatibility.warnings" :key="warning" class="report-warning">⚠ {{ warning }}</div>
            <div class="archive-actions"><button @click="copyArchiveRaw(archive)">复制原始</button><button @click="downloadArchiveRaw(archive)">导出原始</button><button class="danger" @click="removeArchive(archive)">删归档</button></div>
          </article>
          <p v-if="!archives.length" class="empty">还没有原始社区资源归档。</p>
        </section>
        <section class="compat-card"><h3>兼容原则</h3><p>能识别 → 正确运行；部分支持 → 安全降级；暂不支持 → 原始资源仍在归档；危险脚本 → 不执行。</p><ul><li>HTML / CSS：隔离渲染</li><li>details / summary：可交互</li><li>外部图片：允许加载</li><li>script / onclick / iframe：阻止执行</li><li>未知社区扩展字段：保留原始资源，等待兼容器升级</li></ul></section>
      </section>
    </main>

    <div v-if="editingRegex" class="regex-editor-backdrop" @click.self="closeRegexEditor">
      <section class="regex-editor-sheet">
        <header class="regex-editor-head"><div><small>REGEX · SHARED RESOURCE</small><h2>编辑正则</h2></div><button type="button" @click="closeRegexEditor">×</button></header>
        <p class="regex-editor-note">这里只编辑社区 Regex 自己的字段。执行顺序越小越先运行；Regex 未命中不会阻止 AI 回复。</p>
        <div class="regex-editor-fields">
          <label>名称<input v-model="regexForm.name" /></label>
          <label>findRegex<textarea v-model="regexForm.findRegex" rows="5" spellcheck="false" /></label>
          <label>replaceString<textarea v-model="regexForm.replaceString" rows="7" spellcheck="false" /></label>
          <label>trimStrings（每行一项）<textarea v-model="regexForm.trimStringsText" rows="3" /></label>
          <div class="regex-editor-grid"><label>placement<input v-model="regexForm.placementText" placeholder="例如 1, 2" /></label><label>执行顺序 order<input v-model.number="regexForm.order" type="number" /></label></div>
          <div class="regex-editor-grid"><label>minDepth<input v-model="regexForm.minDepth" type="number" placeholder="留空" /></label><label>maxDepth<input v-model="regexForm.maxDepth" type="number" placeholder="留空" /></label></div>
          <label>substituteRegex<input v-model.number="regexForm.substituteRegex" type="number" /></label>
          <div class="regex-editor-toggles">
            <label><input v-model="regexForm.enabled" type="checkbox" />脚本启用</label>
            <label><input v-model="regexForm.markdownOnly" type="checkbox" />markdownOnly</label>
            <label><input v-model="regexForm.promptOnly" type="checkbox" />promptOnly</label>
            <label><input v-model="regexForm.runOnEdit" type="checkbox" />runOnEdit</label>
          </div>
        </div>
        <div class="regex-editor-actions"><button type="button" @click="closeRegexEditor">取消</button><button type="button" class="primary" @click="saveRegexEditor">保存 Regex</button></div>
      </section>
    </div>
  </PhoneFrame>
</template>

<style scoped>
.world-center{min-height:100%;padding:14px 14px 40px;background:#f2f8fc;color:#5a404c}.hero-card{display:flex;gap:14px;align-items:center;padding:18px;border-radius:24px;background:linear-gradient(145deg,#fff,#f5faff);box-shadow:0 10px 30px rgba(83,48,63,.07)}.hero-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:#e5f1fa;font-size:29px}.hero-card small{color:#6f9fc6;font-weight:800;letter-spacing:.08em}.hero-card h1{margin:2px 0 4px;font-size:22px}.hero-card p,.section-head p,.apply-card span{margin:0;color:#73889c;font-size:12px;line-height:1.6}.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:12px 0;padding:4px;border-radius:16px;background:#eadfe4}.tabs button{border:0;border-radius:12px;background:transparent;padding:9px 2px;color:#73889c;font-size:11px}.tabs button.active{background:#fff;color:#40566a;font-weight:800;box-shadow:0 2px 10px rgba(78,45,59,.08)}.apply-card,.import-card,.compat-card,.report-card{padding:14px;border-radius:18px;background:#fff;margin-bottom:12px}.scope-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;padding:4px;border-radius:13px;background:#e7f1f8}.scope-switch button{border:0;border-radius:10px;background:transparent;padding:8px;color:#748b9e}.scope-switch button.active{background:#fff;color:#668eae;font-weight:800}.global-chip{padding:10px 11px;border-radius:12px;background:#fbf4f7;color:#8b6877;font-size:11px;line-height:1.55}.apply-card label{display:grid;gap:6px;font-size:12px;font-weight:800}.apply-card select{border:1px solid #ecdde4;border-radius:12px;background:#fbfdff;padding:10px;color:#40566a}.character-chip{display:flex;align-items:center;gap:8px;margin-top:10px}.notice{padding:10px 12px;border-radius:12px;background:#fff2f7;color:#ad5a7d;font-size:12px}.resource-list{display:grid;gap:10px}.section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:8px 2px}.section-head h2{margin:0 0 3px;font-size:18px}.section-head button,.resource-actions button,.legacy button{border:0;border-radius:10px;background:#e8f2f9;color:#a45375;padding:8px 10px}.resource-card,.state-card{padding:14px;border:1px solid rgba(103,67,83,.07);border-radius:18px;background:#fff;box-shadow:0 6px 20px rgba(81,48,62,.04)}.resource-main{display:flex;gap:10px}.resource-icon{width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:#faeaf1;font-size:20px}.resource-main b,.resource-main small{display:block}.resource-main small{margin-top:3px;color:#7d91a3;font-size:10px}.resource-main p{margin:7px 0 0;color:#795d69;font-size:12px;overflow-wrap:anywhere;word-break:break-word}.usage-line{display:block;margin-top:7px;color:#a35d79;font-size:10px;line-height:1.5}.resource-main code{display:block;margin-top:7px;max-width:300px;overflow:hidden;color:#866572;font-size:10px;white-space:nowrap}.resource-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:11px}.toggle{display:flex;align-items:center;gap:5px;color:#9e5875;font-size:11px}.toggle input{accent-color:#79add8}.fixed-tag{padding:5px 8px;border-radius:999px;background:#eaf3fa;color:#a96882;font-size:10px}.danger{color:#b54f65!important}.legacy{display:flex;align-items:center;justify-content:space-between}.legacy small{display:block;color:#9e7d8b}.state-title{display:flex;align-items:center;gap:8px}.presence{margin-left:auto;padding:4px 8px;border-radius:999px;background:#eee;color:#856b76;font-size:10px}.presence.together{background:#fbe3ed;color:#b24e78}.state-card dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 0}.state-card dl div{padding:9px;border-radius:11px;background:#fbf6f8}.state-card dt{color:#a17f8d;font-size:9px}.state-card dd{margin:3px 0 0;font-size:12px}.library{display:grid;gap:12px}.import-card{text-align:center;padding:24px 18px}.import-icon{font-size:40px}.import-card h2{margin:8px 0}.import-card p{color:#977482;line-height:1.6;font-size:12px}.import-card button{width:100%;border:0;border-radius:14px;background:#79add8;color:#fff;padding:12px;font-weight:800}.report-card h3,.compat-card h3{margin:0 0 8px}.report-card p,.report-ok,.report-warning,.compat-card p,.compat-card li{font-size:11px;line-height:1.6}.report-ok{color:#557a65}.report-warning{margin-top:6px;color:#aa6b40}.compat-card ul{margin:8px 0 0;padding-left:18px}.empty{text-align:center;padding:30px 10px;color:#a88996;font-size:12px}.archive-section{display:grid;gap:10px}.archive-count{min-width:28px;height:28px;display:grid;place-items:center;border-radius:999px;background:#f3e4ea;color:#a25978;font-size:11px;font-weight:800}.archive-card{padding:14px;border-radius:18px;background:#fff;border:1px solid rgba(103,67,83,.07)}.archive-head{display:flex;justify-content:space-between;gap:10px}.archive-head b,.archive-head small{display:block}.archive-head small{margin-top:3px;color:#7d91a3;font-size:10px}.archive-head>span{max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8396a7;font-size:9px}.archive-card p,.archive-supported{font-size:11px;line-height:1.55}.archive-supported{color:#557a65}.archive-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.archive-actions button{border:0;border-radius:10px;background:#e8f2f9;color:#9c5572;padding:8px 10px;font-size:10px}.regex-quick-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:9px 10px;border-radius:11px;background:#f5faff}.order-control{display:flex;align-items:center;gap:6px;color:#6d8498;font-size:10px}.order-control input{width:64px;border:1px solid #ecdde4;border-radius:8px;background:#fff;padding:5px 7px;color:#40566a}.regex-editor-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center;background:rgba(55,35,44,.35);backdrop-filter:blur(3px)}.regex-editor-sheet{width:min(100%,520px);max-height:88vh;overflow:auto;padding:18px;border-radius:24px 24px 0 0;background:#f8fcff;color:#5a404c;box-shadow:0 -18px 45px rgba(66,42,53,.18)}.regex-editor-head{display:flex;align-items:flex-start;justify-content:space-between}.regex-editor-head small{color:#6f9fc6;font-size:9px;font-weight:800;letter-spacing:.08em}.regex-editor-head h2{margin:2px 0 0}.regex-editor-head button{width:34px;height:34px;border:0;border-radius:999px;background:#f2e6eb;color:#506a80;font-size:22px}.regex-editor-note{margin:10px 0 14px;padding:10px;border-radius:12px;background:#eef6fc;color:#6d8498;font-size:11px;line-height:1.6}.regex-editor-fields{display:grid;gap:10px}.regex-editor-fields>label,.regex-editor-grid label{display:grid;gap:5px;color:#40566a;font-size:11px;font-weight:800}.regex-editor-fields input,.regex-editor-fields textarea{width:100%;border:1px solid #ead9e1;border-radius:11px;background:#fff;padding:9px;color:#40566a;font:inherit;font-size:11px;box-sizing:border-box}.regex-editor-fields textarea{resize:vertical;line-height:1.5}.regex-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.regex-editor-toggles{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px;border-radius:12px;background:#f3f9fd}.regex-editor-toggles label{display:flex;align-items:center;gap:6px;color:#506a80;font-size:10px}.regex-editor-toggles input{width:auto;accent-color:#79add8}.regex-editor-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin-top:14px}.regex-editor-actions button{border:0;border-radius:12px;background:#e6f0f7;color:#5d7d98;padding:11px;font-weight:800}.regex-editor-actions .primary{background:#79add8;color:white}@media(max-width:390px){.tabs button{font-size:10px}.state-card dl{grid-template-columns:1fr}}
</style>
