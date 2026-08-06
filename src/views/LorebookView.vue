<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  deleteLorebookEntry,
  listLorebookEntries,
  saveLorebookEntry
} from '../services/lorebookService'
import { DEFAULT_WORLD_ID } from '../db/seed'
import type { Character, LorebookEntry } from '../types/domain'

const route = useRoute()
const characterId = computed(() => String(route.query.character || ''))
const character = ref<Character>()
const entries = ref<LorebookEntry[]>([])
const editingId = ref('')
const message = ref('')
const form = reactive({
  title: '',
  keywordsText: '',
  content: '',
  constant: false,
  caseSensitive: false,
  enabled: true,
  priority: 50,
  characterOnly: Boolean(characterId.value)
})

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
  form.characterOnly = Boolean(characterId.value)
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
  form.characterOnly = Boolean(entry.characterId)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refresh() {
  entries.value = await listLorebookEntries({
    worldId: character.value?.worldId || DEFAULT_WORLD_ID,
    characterId: characterId.value || undefined
  })
}

async function submit() {
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
    worldId: character.value?.worldId || DEFAULT_WORLD_ID,
    characterId: form.characterOnly && characterId.value ? characterId.value : undefined,
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
  message.value = '世界书条目已删除。'
  await refresh()
}

async function toggle(entry: LorebookEntry) {
  await saveLorebookEntry({ ...entry, enabled: !entry.enabled })
  await refresh()
}

onMounted(async () => {
  if (characterId.value) character.value = await db.characters.get(characterId.value)
  await refresh()
})
</script>

<template>
  <PhoneFrame :title="character ? `${character.name}的世界书` : '世界书 Lorebook'" show-back>
    <main class="lore-page">
      <section class="intro-card">
        <b>按关键词注入世界设定</b>
        <p>聊天提到人物、地点、组织或事件时，相关设定才会进入上下文。非常驻内容不会每轮占用空间。</p>
      </section>

      <form class="editor-card" @submit.prevent="submit">
        <div class="section-title"><h2>{{ editingId ? '编辑条目' : '新建条目' }}</h2><button v-if="editingId" type="button" @click="resetForm">取消</button></div>
        <label>标题<input v-model="form.title" maxlength="60" placeholder="例如：星澜学院" /></label>
        <label v-if="!form.constant">触发关键词<textarea v-model="form.keywordsText" rows="2" placeholder="星澜学院、学院、校庆" /></label>
        <label>设定内容<textarea v-model="form.content" rows="7" placeholder="这里写角色应该知道的世界事实、人物关系和事件背景" /></label>
        <div class="two-fields"><label>优先级<input v-model.number="form.priority" type="number" min="0" max="100" /></label><label class="switch"><input v-model="form.enabled" type="checkbox" />启用</label></div>
        <label class="switch"><input v-model="form.constant" type="checkbox" />常驻条目（每轮都注入）</label>
        <label class="switch"><input v-model="form.caseSensitive" type="checkbox" />关键词区分大小写</label>
        <label v-if="characterId" class="switch"><input v-model="form.characterOnly" type="checkbox" />只对 {{ character?.name || '当前角色' }} 生效</label>
        <button class="primary" type="submit">{{ editingId ? '保存修改' : '创建条目' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="entry-list">
        <article v-for="entry in entries" :key="entry.id" :class="['entry-card',{disabled:!entry.enabled}]">
          <div class="entry-head"><div><b>{{ entry.title }}</b><small>{{ entry.characterId ? '角色专属' : '全局' }} · 优先级 {{ entry.priority }}</small></div><button type="button" @click="toggle(entry)">{{ entry.enabled ? '停用' : '启用' }}</button></div>
          <div class="keywords">{{ entry.constant ? '常驻' : entry.keywords.join(' · ') }}</div>
          <p>{{ entry.content }}</p>
          <div class="entry-actions"><button type="button" @click="edit(entry)">编辑</button><button class="danger" type="button" @click="remove(entry)">删除</button></div>
        </article>
        <p v-if="!entries.length" class="empty">还没有世界书条目。</p>
      </section>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.lore-page{min-height:100%;padding:14px;background:#f7f0f3;color:#5d4350}.intro-card,.editor-card,.entry-card{border:1px solid rgba(109,70,87,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.intro-card{padding:16px;margin-bottom:12px}.intro-card p{margin:6px 0 0;color:#947482;line-height:1.6;font-size:13px}.editor-card{display:grid;gap:12px;padding:16px}.section-title,.entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title h2{margin:0;font-size:18px}.section-title button,.entry-head button,.entry-actions button{border:0;border-radius:10px;background:#f5e9ee;color:#9b6078;padding:7px 10px}.editor-card label{display:grid;gap:6px;font-size:13px;font-weight:700}.editor-card input,.editor-card textarea{box-sizing:border-box;width:100%;border:1px solid #eadce2;border-radius:12px;background:#fffbfc;padding:10px 12px;color:#593f4b;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.switch{display:flex!important;align-items:center;gap:8px}.switch input{width:auto}.primary{border:0;border-radius:14px;background:#dc76a0;color:#fff;padding:12px;font-weight:800}.message{padding:10px 12px;border-radius:12px;background:#fff5f8;color:#b65178}.entry-list{display:grid;gap:10px;margin-top:14px;padding-bottom:30px}.entry-card{padding:14px}.entry-card.disabled{opacity:.58}.entry-head b{display:block}.entry-head small{display:block;margin-top:3px;color:#a1818e}.keywords{display:inline-block;margin-top:10px;border-radius:999px;background:#f6e8ee;padding:4px 9px;color:#b25d80;font-size:11px}.entry-card p{white-space:pre-wrap;color:#725662;line-height:1.6;font-size:13px}.entry-actions{display:flex;justify-content:flex-end;gap:7px}.entry-actions .danger{color:#b64c63}.empty{text-align:center;color:#a88895}@media(max-width:390px){.two-fields{grid-template-columns:1fr}}
</style>
