<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  addMemory,
  listMemories,
  lowerMemoryImportance,
  markMemoryInvalid,
  memoryLayerLabel,
  removeMemory,
  resolveMemoryConflict,
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
  PromptDebugTrace
} from '../types/domain'

const route = useRoute()
const conversationId = computed(() => String(route.params.id || ''))
const conversation = ref<Conversation>()
const character = ref<Character>()
const memories = ref<CharacterMemory[]>([])
const latestTrace = ref<PromptDebugTrace>()
const stateHistory = ref<ConversationStateHistory[]>([])
const filter = ref<'all' | MemoryLayer | 'conflict' | 'invalid' | 'hits'>('all')
const newContent = ref('')
const newLayer = ref<MemoryLayer>('fact')
const notice = ref('')

const hitIds = computed(() => new Set(latestTrace.value?.memoryHits.map(item => item.id) || []))
const filtered = computed(() => memories.value.filter(memory => {
  if (filter.value === 'all') return true
  if (filter.value === 'conflict') return memory.status === 'conflict'
  if (filter.value === 'invalid') return memory.status === 'invalid'
  if (filter.value === 'hits') return hitIds.value.has(memory.id)
  return (memory.layer || 'fact') === filter.value
}))
const counts = computed(() => ({
  all: memories.value.length,
  conflict: memories.value.filter(item => item.status === 'conflict').length,
  invalid: memories.value.filter(item => item.status === 'invalid').length,
  hits: memories.value.filter(item => hitIds.value.has(item.id)).length
}))

function layerCategory(layer: MemoryLayer): CharacterMemory['category'] {
  if (layer === 'promise') return 'promise'
  if (layer === 'relationship') return 'relationship'
  if (layer === 'shared') return 'event'
  return 'other'
}
function layerText(memory: CharacterMemory) { return memoryLayerLabel(memory) }
function conflictRows(memory: CharacterMemory) {
  const ids = new Set(memory.conflictWith || [])
  return memories.value.filter(item => ids.has(item.id))
}
function dateText(value?: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '' }
function flash(value: string) { notice.value = value; window.setTimeout(() => { if (notice.value === value) notice.value = '' }, 2200) }

async function load() {
  const id = conversationId.value
  if (!id) return
  conversation.value = await db.conversations.get(id)
  character.value = conversation.value?.memberIds[0] ? await db.characters.get(conversation.value.memberIds[0]) : undefined
  memories.value = await listMemories(id)
  latestTrace.value = (await listPromptDebugTraces(id))[0]
  stateHistory.value = await listConversationStateHistory(id, 30)
}

async function create() {
  if (!newContent.value.trim() || !character.value) return
  await addMemory({
    conversationId: conversationId.value,
    characterId: character.value.id,
    content: newContent.value,
    category: layerCategory(newLayer.value),
    layer: newLayer.value,
    importance: newLayer.value === 'promise' || newLayer.value === 'relationship' ? 5 : 3
  })
  newContent.value = ''
  await load()
  flash('记忆已添加。')
}

async function edit(memory: CharacterMemory) {
  const value = window.prompt('修改记忆内容', memory.content)
  if (value === null || !value.trim()) return
  await updateMemory(memory.id, { content: value.trim() })
  await load(); flash('记忆已更新。')
}
async function toggleLock(memory: CharacterMemory) { await toggleMemoryLock(memory.id); await load(); flash(memory.locked ? '已取消锁定。' : '已锁定为高可信记忆。') }
async function lower(memory: CharacterMemory) { await lowerMemoryImportance(memory.id); await load(); flash('已降低权重。') }
async function invalidate(memory: CharacterMemory) { if (!window.confirm('把这条记忆标记为错误吗？它不会再进入 Prompt。')) return; await markMemoryInvalid(memory.id); await load(); flash('已标记为错误记忆。') }
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
        <small>{{ character?.name || conversation?.title || '当前聊天' }}</small>
        <h2>长期记忆与共同经历</h2>
        <p>客观事实和角色主观记忆分开保存。冲突项不会直接进入 Prompt，锁定项会被视为高可信事实。</p>
      </section>

      <section class="summary-grid">
        <article><b>{{ counts.all }}</b><small>全部记忆</small></article>
        <article><b>{{ counts.hits }}</b><small>本轮命中</small></article>
        <article><b>{{ counts.conflict }}</b><small>待处理冲突</small></article>
        <article><b>{{ stateHistory.length }}</b><small>近期状态变化</small></article>
      </section>

      <section class="add-card">
        <label><span>记忆层级</span><select v-model="newLayer"><option value="fact">客观事实</option><option value="subjective">角色主观记忆</option><option value="shared">共同经历</option><option value="promise">承诺和约定</option><option value="relationship">关系事件</option><option value="story">长期剧情</option></select></label>
        <textarea v-model="newContent" rows="3" placeholder="例如：用户下周三有面试；她提到面试时有些紧张，我答应会提醒她。"></textarea>
        <button type="button" @click="create">添加记忆</button>
      </section>

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
          <div class="memory-meta">
            <span>{{ layerText(memory) }}</span>
            <span>重要度 {{ memory.importance }}</span>
            <span v-if="memory.locked">🔒 已锁定</span>
            <span v-if="hitIds.has(memory.id)">本轮命中</span>
            <span v-if="memory.status==='conflict'">存在冲突</span>
            <span v-if="memory.status==='invalid'">错误记忆</span>
          </div>
          <p>{{ memory.content }}</p>
          <small v-if="memory.dueAt">关联时间：{{ dateText(memory.dueAt) }}</small>
          <small v-if="memory.lastHitAt">最近命中：{{ dateText(memory.lastHitAt) }} · 共 {{ memory.hitCount || 0 }} 次</small>
          <small v-if="memory.note">{{ memory.note }}</small>
          <div v-if="memory.status==='conflict' && conflictRows(memory).length" class="conflict-box">
            <b>与下面记忆冲突</b>
            <p v-for="row in conflictRows(memory)" :key="row.id">{{ row.content }}</p>
          </div>
          <div class="actions">
            <button @click="edit(memory)">编辑</button>
            <button @click="toggleLock(memory)">{{ memory.locked ? '取消锁定' : '锁定' }}</button>
            <button :disabled="memory.importance<=1" @click="lower(memory)">降权</button>
            <template v-if="memory.status==='conflict'">
              <button class="resolve" @click="resolve(memory,'keep-this')">采用这条</button>
              <button class="resolve" @click="resolve(memory,'keep-other')">保留另一条</button>
              <button class="resolve" @click="resolve(memory,'keep-both')">两者都保留</button>
            </template>
            <button v-if="memory.status!=='invalid'" @click="invalidate(memory)">标记错误</button>
            <button class="danger" @click="remove(memory)">删除</button>
          </div>
        </article>
        <p v-if="!filtered.length" class="empty">这个分类还没有记忆。</p>
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
.memory-page{min-height:100%;padding:14px 14px 40px;background:#f7f0f3;color:#5d4350}.notice{position:sticky;top:6px;z-index:3;margin:0 0 10px;padding:9px 12px;border-radius:12px;background:#744f60;color:#fff;text-align:center}.hero,.add-card,.history-card{margin-bottom:12px;padding:15px;border:1px solid rgba(92,58,73,.08);border-radius:20px;background:#fff}.hero small{color:#a17c8d}.hero h2{margin:4px 0 8px}.hero p{margin:0;color:#927482;font-size:12px;line-height:1.7}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}.summary-grid article{display:grid;gap:3px;padding:13px;border-radius:16px;background:#fff}.summary-grid b{color:#bf6289;font-size:22px}.summary-grid small{color:#927482}.add-card{display:grid;gap:10px}.add-card label{display:flex;align-items:center;justify-content:space-between;gap:12px}.add-card select,.add-card textarea{border:1px solid #eadce2;border-radius:12px;background:#fff;padding:10px;color:inherit}.add-card textarea{width:100%;resize:vertical}.add-card button{border:0;border-radius:13px;background:#d96b99;color:#fff;padding:11px;font-weight:800}.filters{display:flex;gap:6px;overflow-x:auto;margin:0 -14px 12px;padding:0 14px 4px;scrollbar-width:none}.filters button{flex:0 0 auto;border:0;border-radius:999px;background:#fff;color:#8d6d7a;padding:8px 11px}.filters button.active{background:#d96b99;color:#fff}.memory-list{display:grid;gap:10px}.memory-card{padding:13px;border:1px solid rgba(95,60,75,.08);border-radius:18px;background:#fff}.memory-card.status-conflict{border-color:#e4a451;background:#fffaf1}.memory-card.status-invalid{opacity:.68;background:#f4eff1}.memory-meta{display:flex;flex-wrap:wrap;gap:5px}.memory-meta span{border-radius:999px;background:#f4e8ed;color:#9b5f78;padding:4px 7px;font-size:10px}.memory-card p{margin:10px 0 7px;line-height:1.65}.memory-card>small{display:block;margin-top:3px;color:#9a7b88}.conflict-box{margin-top:9px;padding:9px 10px;border-radius:12px;background:#fff3df;color:#8d6743}.conflict-box b{font-size:11px}.conflict-box p{margin:4px 0 0;font-size:12px;line-height:1.45}.actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:11px}.actions button{border:0;border-radius:10px;background:#f3e8ed;color:#8f5e72;padding:7px 9px}.actions button:disabled{opacity:.35}.actions .resolve{background:#e8f3eb;color:#44755a}.actions .danger{background:#fff0f2;color:#b34f69}.history-card summary{cursor:pointer;font-weight:800}.history-card article{margin-top:9px;padding:10px;border-radius:12px;background:#f8f0f3}.history-card p{margin:4px 0}.history-card small{color:#9b7d89}.empty{padding:24px;color:#9a7d8a;text-align:center}
</style>
