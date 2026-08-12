<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { DEFAULT_WORLD_ID } from '../db/seed'
import { deleteCommunityResource, deleteCommunityResourceArchive, importCommunityFile, listCommunityResources } from '../services/communityResourceService'
import { setResourceBinding } from '../services/resourceBindingService'
import type { Character, CommunityResourceArchive, ConversationState, LorebookResource, PromptPreset, RegexScript, ResourceBinding, ResourceType } from '../types/domain'

const router = useRouter()
const tab = ref<'lorebooks'|'state'|'presets'|'regex'|'library'>('lorebooks')
const characters = ref<Character[]>([])
const selectedCharacterId = ref('')
const bindingScope = ref<'character'|'global'>('character')
const lorebooks = ref<LorebookResource[]>([])
const presets = ref<PromptPreset[]>([])
const regexes = ref<RegexScript[]>([])
const bindings = ref<ResourceBinding[]>([])
const archives = ref<CommunityResourceArchive[]>([])
const states = ref<Array<{ character?: Character; state: ConversationState }>>([])
const legacyEntryCount = ref(0)
const importInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const reports = ref<Array<{ name: string; summary: string[]; supported: string[]; warnings: string[] }>>([])
const busy = ref(false)

const selectedCharacter = computed(() => characters.value.find(item => item.id === selectedCharacterId.value))

function isBound(type: ResourceType, id: string) {
  return bindings.value.some(item => {
    const scope = item.scope || (item.characterId ? 'character' : 'global')
    const scopeId = item.scopeId || item.characterId
    if (item.resourceType !== type || item.resourceId !== id || !item.enabled) return false
    if (bindingScope.value === 'global') return scope === 'global'
    return scope === 'character' && Boolean(selectedCharacterId.value) && scopeId === selectedCharacterId.value
  })
}

async function refresh() {
  const resources = await listCommunityResources(DEFAULT_WORLD_ID)
  lorebooks.value = resources.lorebooks
  presets.value = resources.presets
  regexes.value = resources.regexes
  bindings.value = resources.bindings
  archives.value = resources.archives
  characters.value = await db.characters.where('worldId').equals(DEFAULT_WORLD_ID).toArray()
  if (!selectedCharacterId.value && characters.value.length) selectedCharacterId.value = characters.value[0].id
  const conversations = await db.conversations.where('worldId').equals(DEFAULT_WORLD_ID).toArray()
  const allStates = await db.conversationStates.toArray()
  states.value = allStates.flatMap(state => {
    const conversation = conversations.find(item => item.id === state.id)
    const character = characters.value.find(item => conversation?.memberIds.includes(item.id))
    return conversation ? [{ character, state }] : []
  })
  legacyEntryCount.value = (await db.lorebookEntries.toArray()).filter(item => !item.lorebookId).length
}

function checkedFromEvent(event: Event) {
  return Boolean((event.target as HTMLInputElement | null)?.checked)
}

async function toggleBinding(type: ResourceType, id: string, checked: boolean) {
  const character = selectedCharacter.value
  if (bindingScope.value === 'character' && !character) {
    message.value = '先选择要应用资源的角色。'
    return
  }
  if (type === 'preset' && checked) {
    const other = bindings.value.filter(item => {
      const scope = item.scope || (item.characterId ? 'character' : 'global')
      const scopeId = item.scopeId || item.characterId
      const sameScope = bindingScope.value === 'global' ? scope === 'global' : scope === 'character' && scopeId === character?.id
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
  message.value = checked ? `已应用到${target}。` : `已从${target}取消应用。`
  await refresh()
}

function chooseImport() {
  importInput.value?.click()
}

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
      `已处理 ${imported.length} 个资源。`,
      runnableCount ? ` ${runnableCount} 个运行资源已应用到${bindingScope.value === 'global' ? '全局' : selectedCharacter.value ? ` ${selectedCharacter.value.name}` : '资源库'}。` : '',
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
  if (!window.confirm(`确定删除“${name}”吗？角色绑定也会一起移除。`)) return
  await deleteCommunityResource(type, id)
  message.value = '资源已删除。'
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
  if (!window.confirm(`只删除“${archive.name}”的原始归档吗？已经解析出的世界书/预设/正则不会被删除。`)) return
  await deleteCommunityResourceArchive(archive.id)
  message.value = '原始资源归档已删除；运行资源仍保留。'
  await refresh()
}

function openLorebook(book?: LorebookResource) {
  router.push({ path: '/settings/lorebook', query: book ? { book: book.id } : {} })
}

onMounted(refresh)
</script>

<template>
  <PhoneFrame title="世界" show-back>
    <main class="world-center">
      <section class="hero-card">
        <div class="hero-icon">✨</div>
        <div><small>WORLD & RESOURCES</small><h1>世界与资源中心</h1><p>角色卡、世界书、预设、正则与持续世界状态统一在这里管理。</p></div>
      </section>

      <nav class="tabs">
        <button :class="{active:tab==='lorebooks'}" @click="tab='lorebooks'">世界书</button>
        <button :class="{active:tab==='state'}" @click="tab='state'">世界状态</button>
        <button :class="{active:tab==='presets'}" @click="tab='presets'">预设</button>
        <button :class="{active:tab==='regex'}" @click="tab='regex'">正则</button>
        <button :class="{active:tab==='library'}" @click="tab='library'">资源库</button>
      </nav>

      <section v-if="tab!=='state'" class="apply-card">
        <div class="scope-switch"><button :class="{active:bindingScope==='character'}" @click="bindingScope='character'">当前角色</button><button :class="{active:bindingScope==='global'}" @click="bindingScope='global'">全局</button></div>
        <label v-if="bindingScope==='character'">当前应用角色
          <select v-model="selectedCharacterId"><option value="">仅导入，不绑定</option><option v-for="item in characters" :key="item.id" :value="item.id">{{ item.name }}</option></select>
        </label>
        <div v-if="bindingScope==='character' && selectedCharacter" class="character-chip"><CharacterAvatar :avatar="selectedCharacter.avatar" :name="selectedCharacter.name" :size="34" /><span>勾选资源即可给 {{ selectedCharacter.name }} 使用</span></div>
        <div v-else-if="bindingScope==='global'" class="global-chip">🌐 全局资源会参与所有角色聊天；角色自己的同类预设优先级更高。</div>
      </section>

      <p v-if="message" class="notice">{{ message }}</p>

      <section v-if="tab==='lorebooks'" class="resource-list">
        <header class="section-head"><div><h2>世界书</h2><p>独立世界书可给多个角色重复应用；角色卡内嵌世界书默认只服务原角色。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="book in lorebooks" :key="book.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">📚</div><div><b>{{ book.name }}</b><small>{{ book.characterId ? '角色卡内嵌' : '独立世界书' }} · {{ book.sourceFormat || 'native' }}</small><p v-if="book.description">{{ book.description }}</p></div></div>
          <div class="resource-actions">
            <label class="toggle"><input type="checkbox" :checked="isBound('lorebook',book.id)" :disabled="(bindingScope==='character' && !selectedCharacterId) || Boolean(book.characterId && (bindingScope==='global' || book.characterId !== selectedCharacterId))" @change="toggleBinding('lorebook',book.id,checkedFromEvent($event))" />{{ book.characterId ? '角色专属' : '应用' }}</label>
            <button @click="openLorebook(book)">编辑条目</button><button class="danger" @click="remove('lorebook',book.id,book.name)">删除</button>
          </div>
        </article>
        <article v-if="legacyEntryCount" class="resource-card legacy"><div><b>旧版散装世界书</b><small>{{ legacyEntryCount }} 条 · 兼容 V0.4.2 以前数据</small></div><button @click="openLorebook()">管理</button></article>
        <p v-if="!lorebooks.length && !legacyEntryCount" class="empty">还没有世界书。到“资源库”导入 Tavo / SillyTavern 世界书即可。</p>
      </section>

      <section v-else-if="tab==='state'" class="resource-list">
        <header class="section-head"><div><h2>持续世界状态</h2><p>这里显示各私聊当前的地点、剧情时间、相处状态与行动目标。</p></div></header>
        <article v-for="row in states" :key="row.state.id" class="state-card">
          <div class="state-title"><CharacterAvatar v-if="row.character" :avatar="row.character.avatar" :name="row.character.name" :size="36" /><b>{{ row.character?.name || '会话' }}</b><span :class="['presence',row.state.presence]">{{ row.state.presence==='together'?'在身边':'远程' }}</span></div>
          <dl><div><dt>地点</dt><dd>{{ row.state.location || '未确定' }}</dd></div><div><dt>剧情时间</dt><dd>{{ row.state.timePeriod || '跟随现实' }}</dd></div><div><dt>活动</dt><dd>{{ row.state.innerActivity || '—' }}</dd></div><div><dt>心情</dt><dd>{{ row.state.innerMood || '—' }}</dd></div></dl>
        </article>
        <p v-if="!states.length" class="empty">还没有持续世界状态。开始聊天后会自动建立。</p>
      </section>

      <section v-else-if="tab==='presets'" class="resource-list">
        <header class="section-head"><div><h2>Prompt 预设</h2><p>每个角色同时使用一套预设；启用新预设会自动关闭该角色之前的预设。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="preset in presets" :key="preset.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">🧩</div><div><b>{{ preset.name }}</b><small>{{ preset.prompts.length }} 个 Prompt · {{ preset.prompts.filter(p=>p.enabled).length }} 个启用</small></div></div>
          <div class="resource-actions"><label class="toggle"><input type="checkbox" :checked="isBound('preset',preset.id)" :disabled="bindingScope==='character' && !selectedCharacterId" @change="toggleBinding('preset',preset.id,checkedFromEvent($event))" />应用</label><button class="danger" @click="remove('preset',preset.id,preset.name)">删除</button></div>
        </article><p v-if="!presets.length" class="empty">还没有导入预设。</p>
      </section>

      <section v-else-if="tab==='regex'" class="resource-list">
        <header class="section-head"><div><h2>正则</h2><p>支持角色消息、HTML/CSS UI 替换与常见 Tavo / SillyTavern placement。第三方 JavaScript 不执行。</p></div><button @click="tab='library'; chooseImport()">导入</button></header>
        <article v-for="script in regexes" :key="script.id" class="resource-card">
          <div class="resource-main"><div class="resource-icon">🧷</div><div><b>{{ script.name }}</b><small>{{ script.characterId ? '角色卡内嵌' : '独立正则' }} · placement {{ script.placement.join(',') || '默认' }}</small><code>{{ script.findRegex.slice(0,90) }}{{ script.findRegex.length>90?'…':'' }}</code></div></div>
          <div class="resource-actions"><label class="toggle"><input type="checkbox" :checked="isBound('regex',script.id)" :disabled="(bindingScope==='character' && !selectedCharacterId) || Boolean(script.characterId && (bindingScope==='global' || script.characterId !== selectedCharacterId))" @change="toggleBinding('regex',script.id,checkedFromEvent($event))" />{{ script.characterId ? '角色专属' : '应用' }}</label><button class="danger" @click="remove('regex',script.id,script.name)">删除</button></div>
        </article><p v-if="!regexes.length" class="empty">还没有正则脚本。</p>
      </section>

      <section v-else class="library">
        <div class="import-card"><div class="import-icon">📦</div><h2>导入社区资源</h2><p>自动识别世界书、Prompt 预设、正则、角色卡、Persona 与常见美化 JSON；暂不能运行的社区资源也会先无损归档。</p><button :disabled="busy" @click="chooseImport">{{ busy ? '正在解析…' : '选择 JSON / ZIP / TXT' }}</button><input ref="importInput" type="file" accept=".json,.zip,.txt,.md,application/json,application/zip,text/plain,text/markdown" hidden @change="onImport" /></div>
        <article v-for="report in reports" :key="report.name" class="report-card"><h3>{{ report.name }}</h3><p>{{ report.summary.join(' · ') }}</p><div class="report-ok">✓ {{ report.supported.join(' · ') }}</div><div v-for="warning in report.warnings" :key="warning" class="report-warning">⚠ {{ warning }}</div></article>

        <section class="archive-section">
          <header class="section-head"><div><h2>原始资源归档</h2><p>导入后的原始 JSON 会完整保留。未来兼容层升级后，可以重新解释原文件，而不是要求你重新下载。</p></div><span class="archive-count">{{ archives.length }}</span></header>
          <article v-for="archive in archives" :key="archive.id" class="archive-card">
            <div class="archive-head"><div><b>{{ archive.name }}</b><small>{{ archiveKindLabel(archive.kind) }} · {{ archive.compatibility.format }}</small></div><span>{{ archive.fileName }}</span></div>
            <p>{{ archive.compatibility.summary.join(' · ') }}</p>
            <div class="archive-supported">✓ {{ archive.compatibility.supported.join(' · ') }}</div>
            <div v-for="warning in archive.compatibility.warnings" :key="warning" class="report-warning">⚠ {{ warning }}</div>
            <div class="archive-actions"><button @click="copyArchiveRaw(archive)">复制原始</button><button @click="downloadArchiveRaw(archive)">导出原始</button><button class="danger" @click="removeArchive(archive)">删归档</button></div>
          </article>
          <p v-if="!archives.length" class="empty">还没有原始社区资源归档。导入世界书、预设或正则后会自动生成。</p>
        </section>
        <section class="compat-card"><h3>兼容原则</h3><p>能识别 → 正确运行；部分支持 → 安全降级；暂不支持 → 原始资源仍保存在归档中；危险脚本 → 不执行。</p><ul><li>HTML / CSS：隔离渲染</li><li>details / summary：可交互</li><li>外部图片：允许加载</li><li>script / onclick / iframe：阻止执行</li><li>未知社区扩展字段：保留原始资源，等待后续兼容</li></ul></section>
      </section>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.world-center{min-height:100%;padding:14px 14px 40px;background:#f8f1f4;color:#5a404c}.hero-card{display:flex;gap:14px;align-items:center;padding:18px;border-radius:24px;background:linear-gradient(145deg,#fff,#fff6fa);box-shadow:0 10px 30px rgba(83,48,63,.07)}.hero-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:#fbe5ef;font-size:29px}.hero-card small{color:#c06c90;font-weight:800;letter-spacing:.08em}.hero-card h1{margin:2px 0 4px;font-size:22px}.hero-card p,.section-head p,.apply-card span{margin:0;color:#9b7887;font-size:12px;line-height:1.6}.tabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:12px 0;padding:4px;border-radius:16px;background:#eadfe4}.tabs button{border:0;border-radius:12px;background:transparent;padding:9px 2px;color:#92717f;font-size:11px}.tabs button.active{background:#fff;color:#684a57;font-weight:800;box-shadow:0 2px 10px rgba(78,45,59,.08)}.apply-card,.import-card,.compat-card,.report-card{padding:14px;border-radius:18px;background:#fff;margin-bottom:12px}.scope-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;padding:4px;border-radius:13px;background:#f2e7ec}.scope-switch button{border:0;border-radius:10px;background:transparent;padding:8px;color:#987583}.scope-switch button.active{background:#fff;color:#9d5574;font-weight:800}.global-chip{padding:10px 11px;border-radius:12px;background:#fbf4f7;color:#8b6877;font-size:11px;line-height:1.55}.apply-card label{display:grid;gap:6px;font-size:12px;font-weight:800}.apply-card select{border:1px solid #ecdde4;border-radius:12px;background:#fffbfc;padding:10px;color:#614652}.character-chip{display:flex;align-items:center;gap:8px;margin-top:10px}.notice{padding:10px 12px;border-radius:12px;background:#fff2f7;color:#ad5a7d;font-size:12px}.resource-list{display:grid;gap:10px}.section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:8px 2px}.section-head h2{margin:0 0 3px;font-size:18px}.section-head button,.resource-actions button,.legacy button{border:0;border-radius:10px;background:#f4e6ec;color:#a45375;padding:8px 10px}.resource-card,.state-card{padding:14px;border:1px solid rgba(103,67,83,.07);border-radius:18px;background:#fff;box-shadow:0 6px 20px rgba(81,48,62,.04)}.resource-main{display:flex;gap:10px}.resource-icon{width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:#faeaf1;font-size:20px}.resource-main b,.resource-main small{display:block}.resource-main small{margin-top:3px;color:#a17e8d;font-size:10px}.resource-main p{margin:7px 0 0;color:#795d69;font-size:12px}.resource-main code{display:block;margin-top:7px;max-width:300px;overflow:hidden;color:#866572;font-size:10px;white-space:nowrap}.resource-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin-top:11px}.toggle{display:flex;align-items:center;gap:5px;color:#9e5875;font-size:11px}.toggle input{accent-color:#d96a99}.fixed-tag{padding:5px 8px;border-radius:999px;background:#f6e8ee;color:#a96882;font-size:10px}.danger{color:#b54f65!important}.legacy{display:flex;align-items:center;justify-content:space-between}.legacy small{display:block;color:#9e7d8b}.state-title{display:flex;align-items:center;gap:8px}.presence{margin-left:auto;padding:4px 8px;border-radius:999px;background:#eee;color:#856b76;font-size:10px}.presence.together{background:#fbe3ed;color:#b24e78}.state-card dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 0}.state-card dl div{padding:9px;border-radius:11px;background:#fbf6f8}.state-card dt{color:#a17f8d;font-size:9px}.state-card dd{margin:3px 0 0;font-size:12px}.library{display:grid;gap:12px}.import-card{text-align:center;padding:24px 18px}.import-icon{font-size:40px}.import-card h2{margin:8px 0}.import-card p{color:#977482;line-height:1.6;font-size:12px}.import-card button{width:100%;border:0;border-radius:14px;background:#d96c9a;color:#fff;padding:12px;font-weight:800}.report-card h3,.compat-card h3{margin:0 0 8px}.report-card p,.report-ok,.report-warning,.compat-card p,.compat-card li{font-size:11px;line-height:1.6}.report-ok{color:#557a65}.report-warning{margin-top:6px;color:#aa6b40}.compat-card ul{margin:8px 0 0;padding-left:18px}.empty{text-align:center;padding:30px 10px;color:#a88996;font-size:12px}.archive-section{display:grid;gap:10px}.archive-count{min-width:28px;height:28px;display:grid;place-items:center;border-radius:999px;background:#f3e4ea;color:#a25978;font-size:11px;font-weight:800}.archive-card{padding:14px;border-radius:18px;background:#fff;border:1px solid rgba(103,67,83,.07)}.archive-head{display:flex;justify-content:space-between;gap:10px}.archive-head b,.archive-head small{display:block}.archive-head small{margin-top:3px;color:#a17e8d;font-size:10px}.archive-head>span{max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#af8b99;font-size:9px}.archive-card p,.archive-supported{font-size:11px;line-height:1.55}.archive-supported{color:#557a65}.archive-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:10px}.archive-actions button{border:0;border-radius:10px;background:#f4e6ec;color:#9c5572;padding:8px 10px;font-size:10px}@media(max-width:390px){.tabs button{font-size:10px}.state-card dl{grid-template-columns:1fr}}
</style>
