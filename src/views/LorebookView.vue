<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  deleteLorebookEntry,
  listLorebookEntries,
  saveLorebookEntry
} from '../services/lorebookService'
import { DEFAULT_WORLD_ID } from '../db/seed'
import type { LorebookEntry, LorebookResource } from '../types/domain'

const route = useRoute()
const router = useRouter()
const bookId = computed(() => String(route.query.book || ''))
const book = ref<LorebookResource>()
const entries = ref<LorebookEntry[]>([])
const editingId = ref('')
const viewingEntry = ref<LorebookEntry>()
const message = ref('')

const form = reactive({
  title: '',
  keywordsText: '',
  secondaryKeysText: '',
  content: '',
  constant: false,
  caseSensitive: false,
  enabled: true,
  priority: 50,
  matchWholeWords: false,
  useRegex: false,
  selective: false,
  selectiveLogicText: '',
  insertionOrderText: '',
  positionText: '',
  depthText: '',
  roleText: '',
  useProbability: false,
  probability: 100,
  sticky: 0,
  cooldown: 0,
  delay: 0,
  group: '',
  groupOverride: false,
  groupWeight: 100,
  scanDepth: 16,
  excludeRecursion: false,
  preventRecursion: false,
  delayUntilRecursion: false,
  useGroupScoring: false,
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false
})

const canCreateEntry = computed(() => Boolean(book.value?.id))

function parseKeywords(value: string) {
  return Array.from(new Set(value.split(/[,，、\n]+/).map(item => item.trim()).filter(Boolean)))
}

function optionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) ? number : undefined
}

function numberOrString(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const number = Number(trimmed)
  return Number.isFinite(number) && String(number) === trimmed ? number : trimmed
}

function resetForm() {
  editingId.value = ''
  Object.assign(form, {
    title: '', keywordsText: '', secondaryKeysText: '', content: '', constant: false, caseSensitive: false,
    enabled: true, priority: 50, matchWholeWords: false, useRegex: false, selective: false,
    selectiveLogicText: '', insertionOrderText: '', positionText: '', depthText: '', roleText: '',
    useProbability: false, probability: 100, sticky: 0, cooldown: 0, delay: 0, group: '',
    groupOverride: false, groupWeight: 100, scanDepth: 16, excludeRecursion: false,
    preventRecursion: false, delayUntilRecursion: false, useGroupScoring: false,
    matchPersonaDescription: false, matchCharacterDescription: false, matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false, matchScenario: false, matchCreatorNotes: false
  })
}

function edit(entry: LorebookEntry) {
  editingId.value = entry.id
  Object.assign(form, {
    title: entry.title,
    keywordsText: entry.keywords.join('、'),
    secondaryKeysText: (entry.secondaryKeys || []).join('、'),
    content: entry.content,
    constant: entry.constant,
    caseSensitive: entry.caseSensitive,
    enabled: entry.enabled,
    priority: entry.priority,
    matchWholeWords: Boolean(entry.matchWholeWords),
    useRegex: Boolean(entry.useRegex),
    selective: Boolean(entry.selective),
    selectiveLogicText: entry.selectiveLogic == null ? '' : String(entry.selectiveLogic),
    insertionOrderText: entry.insertionOrder == null ? '' : String(entry.insertionOrder),
    positionText: entry.position == null ? '' : String(entry.position),
    depthText: entry.depth == null ? '' : String(entry.depth),
    roleText: entry.role == null ? '' : String(entry.role),
    useProbability: Boolean(entry.useProbability),
    probability: entry.probability ?? 100,
    sticky: entry.sticky ?? 0,
    cooldown: entry.cooldown ?? 0,
    delay: entry.delay ?? 0,
    group: entry.group || '',
    groupOverride: Boolean(entry.groupOverride),
    groupWeight: entry.groupWeight ?? 100,
    scanDepth: entry.scanDepth ?? 16,
    excludeRecursion: Boolean(entry.excludeRecursion),
    preventRecursion: Boolean(entry.preventRecursion),
    delayUntilRecursion: Boolean(entry.delayUntilRecursion),
    useGroupScoring: Boolean(entry.useGroupScoring),
    matchPersonaDescription: Boolean(entry.matchPersonaDescription),
    matchCharacterDescription: Boolean(entry.matchCharacterDescription),
    matchCharacterPersonality: Boolean(entry.matchCharacterPersonality),
    matchCharacterDepthPrompt: Boolean(entry.matchCharacterDepthPrompt),
    matchScenario: Boolean(entry.matchScenario),
    matchCreatorNotes: Boolean(entry.matchCreatorNotes)
  })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refresh() {
  entries.value = await listLorebookEntries({
    worldId: book.value?.worldId || DEFAULT_WORLD_ID,
    lorebookId: bookId.value || undefined
  })
}

async function submit() {
  if (!book.value) {
    message.value = '请先从“世界”里的共享资源库选择一本世界书，再新增条目。'
    return
  }
  if (!form.title.trim() || !form.content.trim()) {
    message.value = '标题和设定内容不能为空。'
    return
  }
  if (!form.constant && !parseKeywords(form.keywordsText).length) {
    message.value = '非常驻条目至少需要一个触发关键词。'
    return
  }

  await saveLorebookEntry({
    id: editingId.value || undefined,
    worldId: book.value.worldId,
    lorebookId: book.value.id,
    characterId: undefined,
    title: form.title,
    keywords: parseKeywords(form.keywordsText),
    secondaryKeys: parseKeywords(form.secondaryKeysText),
    content: form.content,
    constant: form.constant,
    caseSensitive: form.caseSensitive,
    enabled: form.enabled,
    priority: form.priority,
    matchWholeWords: form.matchWholeWords,
    useRegex: form.useRegex,
    selective: form.selective,
    selectiveLogic: numberOrString(form.selectiveLogicText),
    insertionOrder: optionalNumber(form.insertionOrderText),
    position: numberOrString(form.positionText),
    depth: optionalNumber(form.depthText),
    role: numberOrString(form.roleText),
    useProbability: form.useProbability,
    probability: form.probability,
    sticky: form.sticky,
    cooldown: form.cooldown,
    delay: form.delay,
    group: form.group.trim() || undefined,
    groupOverride: form.groupOverride,
    groupWeight: form.groupWeight,
    scanDepth: form.scanDepth,
    excludeRecursion: form.excludeRecursion,
    preventRecursion: form.preventRecursion,
    delayUntilRecursion: form.delayUntilRecursion,
    useGroupScoring: form.useGroupScoring,
    matchPersonaDescription: form.matchPersonaDescription,
    matchCharacterDescription: form.matchCharacterDescription,
    matchCharacterPersonality: form.matchCharacterPersonality,
    matchCharacterDepthPrompt: form.matchCharacterDepthPrompt,
    matchScenario: form.matchScenario,
    matchCreatorNotes: form.matchCreatorNotes
  })
  message.value = editingId.value ? '世界书条目已更新。' : '世界书条目已创建。'
  resetForm()
  await refresh()
}

async function remove(entry: LorebookEntry) {
  if (!window.confirm(`确定删除“${entry.title}”吗？`)) return
  await deleteLorebookEntry(entry.id)
  if (viewingEntry.value?.id === entry.id) viewingEntry.value = undefined
  message.value = '世界书条目已删除。'
  await refresh()
}

async function quickPatch(entry: LorebookEntry, patch: Partial<LorebookEntry>) {
  await saveLorebookEntry({ ...entry, ...patch, characterId: undefined })
  await refresh()
}

function checkedFromEvent(event: Event) {
  return Boolean((event.target as HTMLInputElement | null)?.checked)
}

function numericFromEvent(event: Event) {
  const value = Number((event.target as HTMLInputElement | null)?.value)
  return Number.isFinite(value) ? value : undefined
}

async function copyFullContent(entry: LorebookEntry) {
  try {
    await navigator.clipboard.writeText(entry.content)
    message.value = `已复制“${entry.title}”全文。`
  } catch {
    message.value = '复制失败，请长按全文手动复制。'
  }
}

onMounted(async () => {
  if (bookId.value) book.value = await db.lorebooks.get(bookId.value)
  await refresh()
})
</script>

<template>
  <PhoneFrame :title="book?.name || '世界书'" show-back>
    <main class="lore-page">
      <section class="intro-card">
        <b>{{ book ? `共享世界书：${book.name}` : '共享世界书编辑器' }}</b>
        <p v-if="book">来源只用于说明这本资源从哪里来；是否给某个角色使用，由“世界 → 世界书”里的绑定决定。同一本世界书可给多个角色使用，条目启停和原作者 order / position / depth 等字段在这里编辑。</p>
        <p v-else>世界书、Regex 和 Preset 都是共享资源。请先到“世界”选择一本世界书，再进入全文编辑。</p>
        <button v-if="!book" type="button" class="manage-button" @click="router.push({ path: '/world', query: { tab: 'lorebooks' } })">打开共享资源库</button>
      </section>

      <form v-if="canCreateEntry" class="editor-card" @submit.prevent="submit">
        <div class="section-title"><h2>{{ editingId ? '编辑条目' : '新建条目' }}</h2><button v-if="editingId" type="button" @click="resetForm">取消</button></div>
        <label>标题<input v-model="form.title" maxlength="120" placeholder="例如：星澜学院" /></label>
        <label v-if="!form.constant">主触发关键词<textarea v-model="form.keywordsText" rows="2" placeholder="星澜学院、学院、校庆" /></label>
        <label>设定内容<textarea v-model="form.content" rows="12" placeholder="完整保存作者世界设定、HTML 模板、协议或其它原始内容" /></label>
        <div class="two-fields"><label>兼容优先级<input v-model.number="form.priority" type="number" min="0" max="100" /></label><label class="switch"><input v-model="form.enabled" type="checkbox" />条目启用</label></div>
        <label class="switch"><input v-model="form.constant" type="checkbox" />常驻条目</label>
        <label class="switch"><input v-model="form.caseSensitive" type="checkbox" />关键词区分大小写</label>

        <details class="advanced-fields">
          <summary>高级社区字段（按原卡数据编辑）</summary>
          <div class="advanced-grid">
            <label>辅助关键词<textarea v-model="form.secondaryKeysText" rows="2" placeholder="secondary_keys" /></label>
            <div class="two-fields">
              <label>order / insertion_order<input v-model="form.insertionOrderText" inputmode="numeric" placeholder="例如：20" /></label>
              <label>position<input v-model="form.positionText" placeholder="例如：before_char / 0" /></label>
            </div>
            <div class="two-fields">
              <label>depth<input v-model="form.depthText" inputmode="numeric" placeholder="可留空" /></label>
              <label>role<input v-model="form.roleText" placeholder="system / user / 数字" /></label>
            </div>
            <div class="two-fields">
              <label>scanDepth<input v-model.number="form.scanDepth" type="number" min="1" max="200" /></label>
              <label>selectiveLogic<input v-model="form.selectiveLogicText" placeholder="0 / 1 / 2 / 3" /></label>
            </div>
            <label class="switch"><input v-model="form.selective" type="checkbox" />selective：启用辅助关键词逻辑</label>
            <label class="switch"><input v-model="form.useRegex" type="checkbox" />useRegex：关键词按正则匹配</label>
            <label class="switch"><input v-model="form.matchWholeWords" type="checkbox" />matchWholeWords</label>
            <div class="two-fields">
              <label>sticky<input v-model.number="form.sticky" type="number" min="0" /></label>
              <label>cooldown<input v-model.number="form.cooldown" type="number" min="0" /></label>
            </div>
            <div class="two-fields">
              <label>delay<input v-model.number="form.delay" type="number" min="0" /></label>
              <label>groupWeight<input v-model.number="form.groupWeight" type="number" min="0" /></label>
            </div>
            <label>group<input v-model="form.group" placeholder="同组条目按原规则竞争" /></label>
            <label class="switch"><input v-model="form.groupOverride" type="checkbox" />groupOverride</label>
            <label class="switch"><input v-model="form.useGroupScoring" type="checkbox" />useGroupScoring</label>
            <label class="switch"><input v-model="form.useProbability" type="checkbox" />useProbability</label>
            <label v-if="form.useProbability">probability（0-100）<input v-model.number="form.probability" type="number" min="0" max="100" /></label>
            <label class="switch"><input v-model="form.excludeRecursion" type="checkbox" />excludeRecursion</label>
            <label class="switch"><input v-model="form.preventRecursion" type="checkbox" />preventRecursion</label>
            <label class="switch"><input v-model="form.delayUntilRecursion" type="checkbox" />delayUntilRecursion</label>
            <fieldset class="match-fields"><legend>额外匹配来源</legend>
              <label class="switch"><input v-model="form.matchPersonaDescription" type="checkbox" />Persona description</label>
              <label class="switch"><input v-model="form.matchCharacterDescription" type="checkbox" />Character description</label>
              <label class="switch"><input v-model="form.matchCharacterPersonality" type="checkbox" />Character personality</label>
              <label class="switch"><input v-model="form.matchCharacterDepthPrompt" type="checkbox" />Character depth prompt</label>
              <label class="switch"><input v-model="form.matchScenario" type="checkbox" />Scenario</label>
              <label class="switch"><input v-model="form.matchCreatorNotes" type="checkbox" />Creator notes</label>
            </fieldset>
          </div>
        </details>

        <button class="primary" type="submit">{{ editingId ? '保存修改' : '创建条目' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="entry-list">
        <article v-for="entry in entries" :key="entry.id" :class="['entry-card',{disabled:!entry.enabled}]">
          <div class="entry-head">
            <div><b>{{ entry.title }}</b><small>共享条目 · priority {{ entry.priority }} · order {{ entry.insertionOrder ?? '未设' }}</small></div>
            <label class="inline-toggle"><input type="checkbox" :checked="entry.enabled" @change="quickPatch(entry,{ enabled: checkedFromEvent($event) })" />启用</label>
          </div>
          <div class="quick-controls">
            <label>priority<input type="number" min="0" max="100" :value="entry.priority" @change="quickPatch(entry,{ priority: numericFromEvent($event) ?? entry.priority })" /></label>
            <label>order<input type="number" :value="entry.insertionOrder ?? ''" placeholder="原值" @change="quickPatch(entry,{ insertionOrder: numericFromEvent($event) })" /></label>
          </div>
          <div class="keywords">{{ entry.constant ? '常驻' : (entry.keywords.join(' · ') || '无关键词') }}</div>
          <pre class="entry-preview">{{ entry.content }}</pre>
          <div class="entry-actions">
            <button type="button" class="read-full" @click="viewingEntry = entry">查看全文</button>
            <button type="button" @click="edit(entry)">完整编辑</button>
            <button class="danger" type="button" @click="remove(entry)">删除</button>
          </div>
        </article>
        <p v-if="!entries.length" class="empty">{{ book ? '这本世界书还没有条目。' : '请选择一本世界书。' }}</p>
      </section>

      <div v-if="viewingEntry" class="reader-backdrop" role="presentation" @click.self="viewingEntry = undefined">
        <section class="reader-sheet" role="dialog" aria-modal="true" :aria-label="`${viewingEntry.title} 全文`">
          <header class="reader-head"><div><small>世界书全文</small><h2>{{ viewingEntry.title }}</h2></div><button type="button" aria-label="关闭" @click="viewingEntry = undefined">×</button></header>
          <div class="reader-meta"><span>{{ viewingEntry.constant ? '常驻' : (viewingEntry.keywords.join(' · ') || '无关键词') }}</span><span>priority {{ viewingEntry.priority }}</span><span>order {{ viewingEntry.insertionOrder ?? '未设' }}</span><span v-if="viewingEntry.position != null">position {{ viewingEntry.position }}</span></div>
          <pre class="reader-content">{{ viewingEntry.content }}</pre>
          <footer class="reader-actions"><button type="button" @click="copyFullContent(viewingEntry)">复制全文</button><button type="button" class="primary-reader" @click="edit(viewingEntry); viewingEntry = undefined">编辑这条</button></footer>
        </section>
      </div>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.lore-page{min-height:100%;padding:14px;background:#f7f0f3;color:#5d4350}.intro-card,.editor-card,.entry-card{border:1px solid rgba(109,70,87,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.intro-card{padding:16px;margin-bottom:12px}.intro-card p{margin:6px 0 0;color:#947482;line-height:1.6;font-size:13px}.manage-button{margin-top:12px;border:0;border-radius:12px;background:#f5e9ee;color:#9b6078;padding:9px 12px;font-weight:800}.editor-card{display:grid;gap:12px;padding:16px}.section-title,.entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title h2{margin:0;font-size:18px}.section-title button,.entry-actions button{border:0;border-radius:10px;background:#f5e9ee;color:#9b6078;padding:7px 10px}.editor-card label{display:grid;gap:6px;font-size:13px;font-weight:700}.editor-card input,.editor-card textarea,.quick-controls input{box-sizing:border-box;width:100%;border:1px solid #eadce2;border-radius:12px;background:#fffbfc;padding:10px 12px;color:#593f4b;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.switch,.inline-toggle{display:flex!important;align-items:center;gap:8px}.switch input,.inline-toggle input{width:auto}.inline-toggle{flex:0 0 auto;font-size:12px;color:#9e5875}.advanced-fields{border:1px solid #efdee5;border-radius:14px;background:#fff8fb;padding:10px}.advanced-fields summary{cursor:pointer;font-weight:800;color:#9d5b76}.advanced-grid{display:grid;gap:10px;margin-top:12px}.match-fields{display:grid;gap:7px;border:1px dashed #ead6df;border-radius:12px;padding:10px}.match-fields legend{padding:0 6px;color:#9d6078;font-size:12px;font-weight:800}.primary{border:0;border-radius:14px;background:#dc76a0;color:#fff;padding:12px;font-weight:800}.message{padding:10px 12px;border-radius:12px;background:#fff5f8;color:#b65178}.entry-list{display:grid;gap:10px;margin-top:14px;padding-bottom:30px}.entry-card{min-width:0;padding:14px;overflow:hidden}.entry-card.disabled{opacity:.58}.entry-head{min-width:0}.entry-head>div{min-width:0}.entry-head b{display:block;overflow-wrap:anywhere}.entry-head small{display:block;margin-top:3px;color:#a1818e}.quick-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.quick-controls label{display:grid;gap:4px;color:#9b7887;font-size:10px;font-weight:700}.quick-controls input{min-height:36px;padding:7px 9px;border-radius:9px}.keywords{display:inline-block;max-width:100%;box-sizing:border-box;margin-top:10px;border-radius:999px;background:#f6e8ee;padding:4px 9px;color:#b25d80;font-size:11px;overflow-wrap:anywhere}.entry-preview{position:relative;max-height:280px;overflow:hidden;margin:12px 0 0;padding:0;border:0;background:transparent;color:#725662;font:inherit;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.entry-preview::after{content:"";position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(transparent,#fff)}.entry-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:12px}.entry-actions .read-full{margin-right:auto;background:#fce8f1;color:#a94f77;font-weight:800}.entry-actions .danger{color:#b64c63}.empty{text-align:center;color:#a88895}.reader-backdrop{position:fixed;z-index:1200;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(57,39,47,.38);backdrop-filter:blur(6px)}.reader-sheet{box-sizing:border-box;width:min(100%,680px);height:min(88dvh,860px);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;padding:18px;border-radius:28px 28px 0 0;background:#fffafb;box-shadow:0 -18px 48px rgba(74,43,57,.2);overflow:hidden}.reader-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.reader-head small{color:#a37c8b}.reader-head h2{margin:4px 0 0;font-size:21px;overflow-wrap:anywhere}.reader-head>button{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:50%;background:#f5e9ee;color:#7d5d69;font-size:25px}.reader-meta{display:flex;gap:7px;flex-wrap:wrap}.reader-meta span{padding:5px 8px;border-radius:999px;background:#f6e8ee;color:#9d6078;font-size:11px}.reader-content{min-width:0;min-height:0;margin:0;padding:14px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px #f0e3e8;color:#5f4651;font:inherit;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow:auto;overflow-wrap:anywhere;word-break:break-word;tab-size:2}.reader-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.reader-actions button{border:0;border-radius:13px;background:#f5e9ee;color:#9b6078;padding:11px;font-weight:800}.reader-actions .primary-reader{background:#dc76a0;color:#fff}@media(max-width:390px){.two-fields,.quick-controls{grid-template-columns:1fr}.reader-sheet{height:92dvh;padding:14px}.reader-actions{grid-template-columns:1fr}}
</style>
