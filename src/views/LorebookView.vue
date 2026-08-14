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
  content: '',
  constant: false,
  caseSensitive: false,
  enabled: true,
  priority: 50
})

const canCreateEntry = computed(() => Boolean(book.value?.id))

function parseKeywords(value: string) {
  return Array.from(new Set(value.split(/[,，、\n]+/).map(item => item.trim()).filter(Boolean)))
}

function resetForm() {
  editingId.value = ''
  form.title = ''
  form.keywordsText = ''
  form.content = ''
  form.constant = false
  form.caseSensitive = false
  form.enabled = true
  form.priority = 50
}

function edit(entry: LorebookEntry) {
  editingId.value = entry.id
  form.title = entry.title
  form.keywordsText = entry.keywords.join('、')
  form.content = entry.content
  form.constant = entry.constant
  form.caseSensitive = entry.caseSensitive
  form.enabled = entry.enabled
  form.priority = entry.priority
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
    // V0.4.4.2：条目属于世界书本体，谁使用它由 ResourceBinding 决定。
    characterId: undefined,
    title: form.title,
    keywords: parseKeywords(form.keywordsText),
    content: form.content,
    constant: form.constant,
    caseSensitive: form.caseSensitive,
    enabled: form.enabled,
    priority: form.priority
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

async function toggle(entry: LorebookEntry) {
  await saveLorebookEntry({ ...entry, characterId: undefined, enabled: !entry.enabled })
  await refresh()
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
        <p v-if="book">来源只用于说明这本资源从哪里来；是否给某个角色使用，由“世界 → 世界书”里的绑定决定，同一本世界书可以同时给多个角色使用。</p>
        <p v-else>世界书、Regex 和 Preset 都是共享资源。请先到“世界”选择一本世界书，再进入全文编辑。</p>
        <button v-if="!book" type="button" class="manage-button" @click="router.push({ path: '/world', query: { tab: 'lorebooks' } })">打开共享资源库</button>
      </section>

      <form v-if="canCreateEntry" class="editor-card" @submit.prevent="submit">
        <div class="section-title"><h2>{{ editingId ? '编辑条目' : '新建条目' }}</h2><button v-if="editingId" type="button" @click="resetForm">取消</button></div>
        <label>标题<input v-model="form.title" maxlength="120" placeholder="例如：星澜学院" /></label>
        <label v-if="!form.constant">触发关键词<textarea v-model="form.keywordsText" rows="2" placeholder="星澜学院、学院、校庆" /></label>
        <label>设定内容<textarea v-model="form.content" rows="12" placeholder="完整保存角色应该知道的世界事实、HTML 模板、协议或其它原始内容" /></label>
        <div class="two-fields"><label>优先级<input v-model.number="form.priority" type="number" min="0" max="100" /></label><label class="switch"><input v-model="form.enabled" type="checkbox" />启用</label></div>
        <label class="switch"><input v-model="form.constant" type="checkbox" />常驻条目（每轮都注入）</label>
        <label class="switch"><input v-model="form.caseSensitive" type="checkbox" />关键词区分大小写</label>
        <button class="primary" type="submit">{{ editingId ? '保存修改' : '创建条目' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="entry-list">
        <article v-for="entry in entries" :key="entry.id" :class="['entry-card',{disabled:!entry.enabled}]">
          <div class="entry-head">
            <div>
              <b>{{ entry.title }}</b>
              <small>共享条目 · 优先级 {{ entry.priority }}</small>
            </div>
            <button type="button" @click="toggle(entry)">{{ entry.enabled ? '停用' : '启用' }}</button>
          </div>
          <div class="keywords">{{ entry.constant ? '常驻' : (entry.keywords.join(' · ') || '无关键词') }}</div>
          <pre class="entry-preview">{{ entry.content }}</pre>
          <div class="entry-actions">
            <button type="button" class="read-full" @click="viewingEntry = entry">查看全文</button>
            <button type="button" @click="edit(entry)">编辑</button>
            <button class="danger" type="button" @click="remove(entry)">删除</button>
          </div>
        </article>
        <p v-if="!entries.length" class="empty">{{ book ? '这本世界书还没有条目。' : '请选择一本世界书。' }}</p>
      </section>

      <div v-if="viewingEntry" class="reader-backdrop" role="presentation" @click.self="viewingEntry = undefined">
        <section class="reader-sheet" role="dialog" aria-modal="true" :aria-label="`${viewingEntry.title} 全文`">
          <header class="reader-head">
            <div><small>世界书全文</small><h2>{{ viewingEntry.title }}</h2></div>
            <button type="button" aria-label="关闭" @click="viewingEntry = undefined">×</button>
          </header>
          <div class="reader-meta">
            <span>{{ viewingEntry.constant ? '常驻' : (viewingEntry.keywords.join(' · ') || '无关键词') }}</span>
            <span>优先级 {{ viewingEntry.priority }}</span>
          </div>
          <pre class="reader-content">{{ viewingEntry.content }}</pre>
          <footer class="reader-actions">
            <button type="button" @click="copyFullContent(viewingEntry)">复制全文</button>
            <button type="button" class="primary-reader" @click="edit(viewingEntry); viewingEntry = undefined">编辑这条</button>
          </footer>
        </section>
      </div>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.lore-page{min-height:100%;padding:14px;background:#f7f0f3;color:#5d4350}.intro-card,.editor-card,.entry-card{border:1px solid rgba(109,70,87,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.intro-card{padding:16px;margin-bottom:12px}.intro-card p{margin:6px 0 0;color:#947482;line-height:1.6;font-size:13px}.manage-button{margin-top:12px;border:0;border-radius:12px;background:#f5e9ee;color:#9b6078;padding:9px 12px;font-weight:800}.editor-card{display:grid;gap:12px;padding:16px}.section-title,.entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title h2{margin:0;font-size:18px}.section-title button,.entry-head button,.entry-actions button{border:0;border-radius:10px;background:#f5e9ee;color:#9b6078;padding:7px 10px}.editor-card label{display:grid;gap:6px;font-size:13px;font-weight:700}.editor-card input,.editor-card textarea{box-sizing:border-box;width:100%;border:1px solid #eadce2;border-radius:12px;background:#fffbfc;padding:10px 12px;color:#593f4b;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.switch{display:flex!important;align-items:center;gap:8px}.switch input{width:auto}.primary{border:0;border-radius:14px;background:#dc76a0;color:#fff;padding:12px;font-weight:800}.message{padding:10px 12px;border-radius:12px;background:#fff5f8;color:#b65178}.entry-list{display:grid;gap:10px;margin-top:14px;padding-bottom:30px}.entry-card{min-width:0;padding:14px;overflow:hidden}.entry-card.disabled{opacity:.58}.entry-head{min-width:0}.entry-head>div{min-width:0}.entry-head b{display:block;overflow-wrap:anywhere}.entry-head small{display:block;margin-top:3px;color:#a1818e}.keywords{display:inline-block;max-width:100%;box-sizing:border-box;margin-top:10px;border-radius:999px;background:#f6e8ee;padding:4px 9px;color:#b25d80;font-size:11px;overflow-wrap:anywhere}.entry-preview{position:relative;max-height:280px;overflow:hidden;margin:12px 0 0;padding:0;border:0;background:transparent;color:#725662;font:inherit;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}.entry-preview::after{content:"";position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(transparent,#fff)}.entry-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:12px}.entry-actions .read-full{margin-right:auto;background:#fce8f1;color:#a94f77;font-weight:800}.entry-actions .danger{color:#b64c63}.empty{text-align:center;color:#a88895}.reader-backdrop{position:fixed;z-index:1200;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(57,39,47,.38);backdrop-filter:blur(6px)}.reader-sheet{box-sizing:border-box;width:min(100%,680px);height:min(88dvh,860px);display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;padding:18px;border-radius:28px 28px 0 0;background:#fffafb;box-shadow:0 -18px 48px rgba(74,43,57,.2);overflow:hidden}.reader-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.reader-head small{color:#a37c8b}.reader-head h2{margin:4px 0 0;font-size:21px;overflow-wrap:anywhere}.reader-head>button{flex:0 0 auto;width:38px;height:38px;border:0;border-radius:50%;background:#f5e9ee;color:#7d5d69;font-size:25px}.reader-meta{display:flex;gap:7px;flex-wrap:wrap}.reader-meta span{padding:5px 8px;border-radius:999px;background:#f6e8ee;color:#9d6078;font-size:11px}.reader-content{min-width:0;min-height:0;margin:0;padding:14px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1px #f0e3e8;color:#5f4651;font:inherit;font-size:13px;line-height:1.7;white-space:pre-wrap;overflow:auto;overflow-wrap:anywhere;word-break:break-word;tab-size:2}.reader-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.reader-actions button{border:0;border-radius:13px;background:#f5e9ee;color:#9b6078;padding:11px;font-weight:800}.reader-actions .primary-reader{background:#dc76a0;color:#fff}@media(max-width:390px){.two-fields{grid-template-columns:1fr}.reader-sheet{height:92dvh;padding:14px}.reader-actions{grid-template-columns:1fr}}
</style>
