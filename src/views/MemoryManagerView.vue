<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  addMemory,
  listMemories,
  listCharacterSharedMemories,
  lowerMemoryImportance,
  markMemoryInvalid,
  memoryLayerLabel,
  memoryScopeFor,
  removeMemory,
  resolveMemoryConflict,
  setMemoryScope,
  toggleMemoryLock,
  updateMemory
} from '../services/memoryService'
import { listPromptDebugTraces } from '../services/promptDebugService'
import { listConversationStateHistory } from '../services/stateHistoryService'
import type {
  Character,
  CharacterMemory,
  Conversation,
  ConversationStateHistory,
  MemoryLayer,
  MemoryScope,
  PromptDebugTrace
} from '../types/domain'

const route = useRoute()
const conversationId = computed(() => String(route.params.id || ''))
const conversation = ref<Conversation>()
const character = ref<Character>()
const currentMemories = ref<CharacterMemory[]>([])
const sharedMemories = ref<CharacterMemory[]>([])
const latestTrace = ref<PromptDebugTrace>()
const stateHistory = ref<ConversationStateHistory[]>([])
const filter = ref<'all' | MemoryLayer | 'conflict' | 'invalid' | 'hits'>('all')
const viewMode = ref<'all' | 'current' | 'shared'>('all')
const newContent = ref('')
const newLayer = ref<MemoryLayer>('fact')
const newScope = ref<MemoryScope>('character')
const notice = ref('')

const allMemories = computed(() => {
  const map = new Map<string, CharacterMemory>()
  for (const row of [...sharedMemories.value, ...currentMemories.value]) map.set(row.id, row)
  return Array.from(map.values())
})

const visibleBase = computed(() => {
  if (viewMode.value === 'current') return currentMemories.value
  if (viewMode.value === 'shared') return sharedMemories.value
  return allMemories.value
})

const hitIds = computed(() => new Set(latestTrace.value?.memoryHits.map(item => item.id) || []))
const filtered = computed(() => visibleBase.value.filter(memory => {
  if (filter.value === 'all') return true
  if (filter.value === 'conflict') return memory.status === 'conflict'
  if (filter.value === 'invalid') return memory.status === 'invalid'
  if (filter.value === 'hits') return hitIds.value.has(memory.id)
  return (memory.layer || 'fact') === filter.value
}))
const counts = computed(() => ({
  all: visibleBase.value.length,
  shared: sharedMemories.value.length,
  current: currentMemories.value.length,
  conflict: visibleBase.value.filter(item => item.status === 'conflict').length,
  invalid: visibleBase.value.filter(item => item.status === 'invalid').length,
  hits: visibleBase.value.filter(item => hitIds.value.has(item.id)).length
}))

function layerCategory(layer: MemoryLayer): CharacterMemory['category'] {
  if (layer === 'promise') return 'promise'
  if (layer === 'relationship') return 'relationship'
  if (layer === 'shared') return 'event'
  return 'other'
}
function layerText(memory: CharacterMemory) { return memoryLayerLabel(memory) }
function scopeText(memory: CharacterMemory) { return memoryScopeFor(memory) === 'character' ? '角色共享' : '仅当前聊天' }
function conflictRows(memory: CharacterMemory) {
  const ids = new Set(memory.conflictWith || [])
  return allMemories.value.filter(item => ids.has(item.id))
}
function dateText(value?: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '' }
function flash(value: string) {
  notice.value = value
  window.setTimeout(() => { if (notice.value === value) notice.value = '' }, 2200)
}

async function load() {
  const id = conversationId.value
  if (!id) return
  conversation.value = await db.conversations.get(id)
  character.value = conversation.value?.memberIds[0] ? await db.characters.get(conversation.value.memberIds[0]) : undefined
  currentMemories.value = await listMemories(id)
  sharedMemories.value = character.value ? await listCharacterSharedMemories(character.value.id) : []
  latestTrace.value = (await listPromptDebugTraces(id))[0]
  stateHistory.value = await listConversationStateHistory(id, 30)
}

function syncDefaultScope(layer: MemoryLayer) {
  newScope.value = ['fact', 'promise', 'relationship'].includes(layer) ? 'character' : 'conversation'
}

async function create() {
  if (!newContent.value.trim() || !character.value) return
  await addMemory({
    conversationId: conversationId.value,
    characterId: character.value.id,
    content: newContent.value,
    category: layerCategory(newLayer.value),
    layer: newLayer.value,
    importance: newLayer.value === 'promise' || newLayer.value === 'relationship' ? 5 : 3,
    scope: newScope.value
  })
  newContent.value = ''
  await load()
  flash(newScope.value === 'character' ? '已添加为角色共享记忆。' : '已添加到当前聊天。')
}

async function edit(memory: CharacterMemory) {
  const value = window.prompt('修改记忆内容', memory.content)
  if (value === null || !value.trim()) return
  await updateMemory(memory.id, { content: value.trim() })
  await load(); flash('记忆已更新。')
}
async function toggleLock(memory: CharacterMemory) { await toggleMemoryLock(memory.id); await load(); flash(memory.locked ? '已取消锁定。' : '已锁定为高可信记忆。') }
async function toggleScope(memory: CharacterMemory) {
  const next = memoryScopeFor(memory) === 'character' ? 'conversation' : 'character'
  await setMemoryScope(memory.id, next)
  await load()
  flash(next === 'character' ? '这条记忆现在会跨聊天共享。' : '这条记忆现在只属于当前聊天。')
}
async function lower(memory: CharacterMemory) { await lowerMemoryImportance(memory.id); await load(); flash('已降低权重。') }
async function invalidate(memory: CharacterMemory) { if (!window.confirm('把这条记忆标记为错误吗？它不会再进入 Prompt。')) return; await markMemoryInvalid(memory.id); await load(); flash('已标记为错误。') }
async function resolve(memory: CharacterMemory, mode: 'keep-this'|'keep-other'|'keep-both') {
  const label = mode === 'keep-this' ? '采用当前这条，并将另一条标记为错误？' : mode === 'keep-other' ? '保留另一条冲突记忆，并将当前这条标记为错误？' : '确认两条都保留？这适用于不同时间或不同情境都成立的情况。'
  if (!window.confirm(label)) return
  await resolveMemoryConflict(memory.id, mode)
  await load()
  flash('冲突已处理。')
}
async function remove(memory: CharacterMemory) { if (!window.confirm('永久删除这条记忆吗？')) return; await removeMemory(memory.id); await load(); flash('记忆已删除。') }

onMounted(load)
watch(conversationId, load)
</script>

<template>
  <PhoneFrame title="记忆管理" show-back>
    <main class="memory-page">
      <p v-if="notice" class="notice">{{ notice }}</p>

      <section class="hero">
        <div class="hero-orb">✦</div>
        <div>
          <small>{{ character?.name || conversation?.title || '当前聊天' }}</small>
          <h2>记忆中心</h2>
          <p>不再让多个聊天互相污染：稳定事实可以跨聊天共享，剧情细节默认留在当前故事线。</p>
        </div>
      </section>

      <section class="memory-rule">
        <div><span class="rule-dot shared"></span><b>角色共享</b><small>事实、关系、承诺</small></div>
        <div><span class="rule-dot local"></span><b>当前聊天</b><small>剧情、主观感受、临时场景</small></div>
      </section>

      <section class="summary-grid">
        <article><b>{{ counts.all }}</b><small>{{ viewMode === 'shared' ? '共享记忆' : viewMode === 'current' ? '当前聊天' : '可见记忆' }}</small></article>
        <article><b>{{ counts.shared }}</b><small>跨聊天共享</small></article>
        <article><b>{{ counts.conflict }}</b><small>待处理冲突</small></article>
        <article><b>{{ counts.hits }}</b><small>本轮命中</small></article>
      </section>

      <section class="add-card">
        <div class="section-title"><b>添加一条记忆</b><span>默认按层级推荐归属</span></div>
        <label><span>记忆层级</span><select v-model="newLayer" @change="syncDefaultScope(newLayer)"><option value="fact">客观事实</option><option value="subjective">角色主观记忆</option><option value="shared">共同经历</option><option value="promise">承诺和约定</option><option value="relationship">关系事件</option><option value="story">长期剧情</option></select></label>
        <div class="scope-picker">
          <button type="button" :class="{active:newScope==='character'}" @click="newScope='character'">角色共享</button>
          <button type="button" :class="{active:newScope==='conversation'}" @click="newScope='conversation'">仅当前聊天</button>
        </div>
        <textarea v-model="newContent" rows="3" placeholder="例如：我下周三有面试；她答应会提醒我。"></textarea>
        <button class="add-button" type="button" @click="create">保存记忆</button>
      </section>

      <nav class="memory-tabs">
        <button :class="{active:viewMode==='all'}" @click="viewMode='all'">全部 {{ counts.all }}</button>
        <button :class="{active:viewMode==='current'}" @click="viewMode='current'">当前聊天 {{ counts.current }}</button>
        <button :class="{active:viewMode==='shared'}" @click="viewMode='shared'">角色共享 {{ counts.shared }}</button>
      </nav>

      <nav class="filters">
        <button :class="{active:filter==='all'}" @click="filter='all'">全部</button>
        <button :class="{active:filter==='hits'}" @click="filter='hits'">本轮命中</button>
        <button :class="{active:filter==='fact'}" @click="filter='fact'">事实</button>
        <button :class="{active:filter==='subjective'}" @click="filter='subjective'">主观</button>
        <button :class="{active:filter==='shared'}" @click="filter='shared'">经历</button>
        <button :class="{active:filter==='promise'}" @click="filter='promise'">承诺</button>
        <button :class="{active:filter==='relationship'}" @click="filter='relationship'">关系</button>
        <button :class="{active:filter==='story'}" @click="filter='story'">剧情</button>
        <button v-if="counts.conflict" :class="{active:filter==='conflict'}" @click="filter='conflict'">冲突 {{ counts.conflict }}</button>
        <button v-if="counts.invalid" :class="{active:filter==='invalid'}" @click="filter='invalid'">错误</button>
      </nav>

      <section class="memory-list">
        <article v-for="memory in filtered" :key="memory.id" :class="['memory-card',`status-${memory.status || 'active'}`]">
          <div class="memory-head">
            <div class="memory-meta">
              <span class="layer-chip">{{ layerText(memory) }}</span>
              <span class="scope-chip" :class="memoryScopeFor(memory)==='character'?'is-shared':''">{{ scopeText(memory) }}</span>
              <span>重要度 {{ memory.importance }}</span>
              <span v-if="memory.locked">已锁定</span>
              <span v-if="hitIds.has(memory.id)">本轮命中</span>
            </div>
            <span v-if="memory.status==='conflict'" class="status-chip conflict">冲突</span>
            <span v-else-if="memory.status==='invalid'" class="status-chip invalid">错误</span>
          </div>
          <p class="memory-content">{{ memory.content }}</p>
          <div class="memory-foot">
            <small v-if="memory.dueAt">关联时间：{{ dateText(memory.dueAt) }}</small>
            <small v-if="memory.lastHitAt">最近命中：{{ dateText(memory.lastHitAt) }} · {{ memory.hitCount || 0 }} 次</small>
          </div>
          <div v-if="memory.status==='conflict' && conflictRows(memory).length" class="conflict-box">
            <b>冲突对象</b>
            <p v-for="row in conflictRows(memory)" :key="row.id">{{ row.content }}</p>
          </div>
          <div class="actions">
            <button @click="edit(memory)">编辑</button>
            <button @click="toggleScope(memory)">{{ memoryScopeFor(memory)==='character' ? '移出共享' : '跨聊天共享' }}</button>
            <button @click="toggleLock(memory)">{{ memory.locked ? '取消锁定' : '锁定' }}</button>
            <button :disabled="memory.importance<=1" @click="lower(memory)">降权</button>
            <template v-if="memory.status==='conflict'">
              <button class="resolve" @click="resolve(memory,'keep-this')">采用这条</button>
              <button class="resolve" @click="resolve(memory,'keep-other')">保留另一条</button>
              <button class="resolve" @click="resolve(memory,'keep-both')">都保留</button>
            </template>
            <button v-if="memory.status!=='invalid'" @click="invalidate(memory)">标记错误</button>
            <button class="danger" @click="remove(memory)">删除</button>
          </div>
        </article>
        <p v-if="!filtered.length" class="empty">这个视图还没有记忆。</p>
      </section>

      <details class="history-card">
        <summary>近期状态变化</summary>
        <article v-for="item in stateHistory" :key="item.id"><b>{{ item.label }}</b><p><span v-if="item.previousValue">{{ item.previousValue }} → </span>{{ item.nextValue }}</p><small>{{ dateText(item.createdAt) }}</small></article>
        <p v-if="!stateHistory.length" class="empty">还没有状态变化记录。</p>
      </details>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.memory-page{min-height:100%;padding:14px 14px 40px;background:linear-gradient(180deg,#f6fbff 0,#eef7fc 100%);color:#40566a}.notice{position:sticky;top:6px;z-index:8;margin:0 0 10px;padding:9px 12px;border-radius:14px;background:#5f8fb4;color:#fff;text-align:center;box-shadow:0 10px 24px rgba(68,108,138,.16)}.hero{display:flex;gap:12px;align-items:center;margin-bottom:10px;padding:16px;border:1px solid rgba(130,173,202,.18);border-radius:22px;background:rgba(255,255,255,.78);box-shadow:0 12px 30px rgba(65,103,130,.07);backdrop-filter:blur(16px)}.hero-orb{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:14px;background:linear-gradient(145deg,#9dc9e8,#d4e9f6);color:#5f8fb4;font-size:21px}.hero small{color:#87a0b2;font-size:11px}.hero h2{margin:3px 0 5px;color:#29445a;font-size:21px}.hero p{margin:0;color:#788e9f;font-size:11px;line-height:1.6}.memory-rule{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:10px}.memory-rule>div{display:grid;grid-template-columns:8px 1fr;column-gap:7px;padding:10px 11px;border-radius:15px;background:rgba(255,255,255,.68);border:1px solid rgba(126,169,199,.12)}.memory-rule .rule-dot{grid-row:1 / span 2;width:8px;height:8px;margin-top:4px;border-radius:50%;background:#80b8dc}.memory-rule .rule-dot.local{background:#b3c2cc}.memory-rule b{font-size:11px;color:#506d83}.memory-rule small{font-size:9px;color:#93a5b2;line-height:1.4}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px}.summary-grid article{display:grid;gap:3px;padding:12px 13px;border:1px solid rgba(130,173,202,.12);border-radius:16px;background:rgba(255,255,255,.8)}.summary-grid b{color:#6d9fc8;font-size:21px}.summary-grid small{color:#7890a2;font-size:10px}.add-card,.history-card{margin-bottom:11px;padding:14px;border:1px solid rgba(130,173,202,.15);border-radius:20px;background:rgba(255,255,255,.86);box-shadow:0 10px 26px rgba(65,103,130,.05)}.section-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px}.section-title b{font-size:13px;color:#365269}.section-title span{font-size:9px;color:#9aabb8}.add-card label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px;font-size:11px;color:#668096}.add-card select,.add-card textarea{border:1px solid #d9e7f0;border-radius:13px;background:#fbfdff;padding:10px;color:inherit}.add-card select{width:auto;min-width:120px}.add-card textarea{width:100%;resize:vertical;line-height:1.55}.scope-picker{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:9px}.scope-picker button{border:1px solid #dce9f2;border-radius:11px;background:#f7fbfe;color:#7b92a3;padding:8px;font-size:10px}.scope-picker button.active{border-color:#9bc5e3;background:#eaf5fc;color:#5f91b6;font-weight:700}.add-button{width:100%;margin-top:9px;border:0;border-radius:13px;background:#72acd5;color:#fff;padding:11px;font-weight:750}.memory-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px}.memory-tabs button{border:1px solid rgba(126,169,199,.14);border-radius:12px;background:#fff;color:#6e8799;padding:9px 5px;font-size:10px}.memory-tabs button.active{background:#6eaed8;color:#fff;border-color:#6eaed8}.filters{display:flex;gap:6px;overflow-x:auto;margin:0 -14px 10px;padding:0 14px 4px;scrollbar-width:none}.filters button{flex:0 0 auto;border:0;border-radius:999px;background:#fff;color:#6d8498;padding:7px 10px;font-size:10px;box-shadow:0 3px 10px rgba(64,99,124,.04)}.filters button.active{background:#dfeff9;color:#5d8db2}.memory-list{display:grid;gap:9px}.memory-card{padding:13px;border:1px solid rgba(130,173,202,.14);border-radius:18px;background:#fff;box-shadow:0 7px 18px rgba(61,98,123,.045)}.memory-card.status-conflict{border-color:#e5bb80;background:#fffaf3}.memory-card.status-invalid{opacity:.65;background:#f4f7f9}.memory-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.memory-meta{display:flex;flex-wrap:wrap;gap:5px}.memory-meta span{border-radius:999px;background:#edf5fa;color:#7691a4;padding:4px 7px;font-size:9px}.memory-meta .layer-chip{background:#e8f3fa;color:#5e8cad}.memory-meta .scope-chip.is-shared{background:#edf7f1;color:#5d8b6c}.status-chip{flex:0 0 auto;padding:4px 7px;border-radius:999px;font-size:9px}.status-chip.conflict{background:#fff0d7;color:#9b713c}.status-chip.invalid{background:#f1e9ec;color:#8e6f7b}.memory-content{margin:10px 0 7px;line-height:1.65;font-size:13px;color:#40586c}.memory-foot{display:grid;gap:2px}.memory-foot small{color:#9aaab5;font-size:9px}.conflict-box{margin-top:9px;padding:9px 10px;border-radius:12px;background:#fff3df;color:#8d6743}.conflict-box b{font-size:10px}.conflict-box p{margin:4px 0 0;font-size:11px;line-height:1.45}.actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.actions button{border:0;border-radius:9px;background:#edf5fa;color:#5f7f99;padding:7px 8px;font-size:10px}.actions button:disabled{opacity:.35}.actions .resolve{background:#eaf4ee;color:#44755a}.actions .danger{background:#fff0f2;color:#b34f69}.history-card summary{cursor:pointer;font-weight:750;font-size:12px;color:#466278}.history-card article{margin-top:8px;padding:9px;border-radius:12px;background:#f2f8fc}.history-card p{margin:4px 0;font-size:11px}.history-card small{color:#73889c;font-size:9px}.empty{padding:24px;color:#9aabb7;text-align:center;font-size:11px}
</style>
