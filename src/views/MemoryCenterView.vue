<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { memoryScopeFor } from '../services/memoryService'
import type { Character, CharacterMemory, Conversation } from '../types/domain'

interface CharacterMemorySummary {
  character: Character
  conversations: Conversation[]
  total: number
  shared: number
  local: number
  conflicts: number
  latestConversation?: Conversation
}

const router = useRouter()
const characters = ref<Character[]>([])
const conversations = ref<Conversation[]>([])
const memories = ref<CharacterMemory[]>([])
const query = ref('')

const summaries = computed<CharacterMemorySummary[]>(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  return characters.value
    .map(character => {
      const characterConversations = conversations.value
        .filter(conversation => conversation.type === 'single' && conversation.memberIds.includes(character.id))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      const characterMemories = memories.value.filter(memory => memory.characterId === character.id)
      return {
        character,
        conversations: characterConversations,
        total: characterMemories.length,
        shared: characterMemories.filter(memory => memoryScopeFor(memory) === 'character').length,
        local: characterMemories.filter(memory => memoryScopeFor(memory) === 'conversation').length,
        conflicts: characterMemories.filter(memory => memory.status === 'conflict').length,
        latestConversation: characterConversations[0]
      }
    })
    .filter(item => !normalizedQuery || item.character.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aTime = a.latestConversation?.updatedAt || a.character.updatedAt || a.character.createdAt
      const bTime = b.latestConversation?.updatedAt || b.character.updatedAt || b.character.createdAt
      return String(bTime).localeCompare(String(aTime))
    })
})

const totals = computed(() => ({
  all: memories.value.length,
  shared: memories.value.filter(memory => memoryScopeFor(memory) === 'character').length,
  local: memories.value.filter(memory => memoryScopeFor(memory) === 'conversation').length,
  conflict: memories.value.filter(memory => memory.status === 'conflict').length
}))

async function load() {
  const [characterRows, conversationRows, memoryRows] = await Promise.all([
    db.characters.toArray(),
    db.conversations.toArray(),
    db.memories.toArray()
  ])
  characters.value = characterRows
  conversations.value = conversationRows
  memories.value = memoryRows
}

function openCharacter(item: CharacterMemorySummary) {
  if (item.latestConversation) {
    void router.push(`/chat/${item.latestConversation.id}/memory`)
    return
  }
  void router.push(`/characters/${item.character.id}`)
}

function openConversation(conversation: Conversation) {
  void router.push(`/chat/${conversation.id}/memory`)
}

function dateText(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

onMounted(load)
</script>

<template>
  <PhoneFrame title="记忆" show-back>
    <main class="memory-center">
      <section class="overview">
        <div>
          <small>Memory</small>
          <h2>记忆</h2>
          <p>按角色管理长期共享记忆与每条剧情线的聊天记忆。</p>
        </div>
        <div class="memory-orb">✦</div>
      </section>

      <section class="stats">
        <article><b>{{ totals.all }}</b><small>全部</small></article>
        <article><b>{{ totals.shared }}</b><small>角色共享</small></article>
        <article><b>{{ totals.local }}</b><small>聊天内</small></article>
        <article><b>{{ totals.conflict }}</b><small>待处理冲突</small></article>
      </section>

      <label class="search-box">
        <span>⌕</span>
        <input v-model="query" type="search" placeholder="搜索角色">
      </label>

      <section class="character-list">
        <article v-for="item in summaries" :key="item.character.id" class="character-card">
          <button class="character-main" type="button" @click="openCharacter(item)">
            <CharacterAvatar :avatar="item.character.avatar" :name="item.character.name" :size="48" />
            <span class="character-copy">
              <b>{{ item.character.name }}</b>
              <small v-if="item.latestConversation">最近聊天 · {{ dateText(item.latestConversation.updatedAt) }}</small>
              <small v-else>还没有聊天</small>
              <span class="chips">
                <em>{{ item.shared }} 共享</em>
                <em>{{ item.local }} 聊天内</em>
                <em v-if="item.conflicts" class="warning">{{ item.conflicts }} 冲突</em>
              </span>
            </span>
            <span class="arrow">›</span>
          </button>

          <div v-if="item.conversations.length > 1" class="conversation-strip">
            <button
              v-for="conversation in item.conversations.slice(0, 4)"
              :key="conversation.id"
              type="button"
              @click="openConversation(conversation)"
            >
              <span>{{ conversation.title || '未命名聊天' }}</span>
              <small>{{ dateText(conversation.updatedAt) }}</small>
            </button>
          </div>
        </article>

        <div v-if="!summaries.length" class="empty">
          <div>✦</div>
          <b>{{ query ? '没有匹配的角色' : '还没有记忆' }}</b>
          <p>{{ query ? '换个角色名试试。' : '先创建角色并开始聊天，记忆会在这里集中管理。' }}</p>
        </div>
      </section>

      <p class="footnote">稳定事实、承诺与关系可跨同角色聊天共享；剧情、经历与主观感受默认保留在各自聊天中。</p>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.memory-center{min-height:100%;padding:10px 14px 42px;background:#f3f7fa;color:#2b4357}.overview{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 16px;margin-bottom:10px;border:1px solid rgba(47,76,99,.07);border-radius:20px;background:#fff;box-shadow:0 6px 20px rgba(52,78,98,.045)}.overview small{color:#9a8bc0;font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.overview h2{margin:2px 0 5px;font-size:24px;letter-spacing:-.03em}.overview p{margin:0;max-width:260px;color:#81919e;font-size:10px;line-height:1.55}.memory-orb{width:48px;height:48px;display:grid;place-items:center;flex:0 0 auto;border-radius:16px;background:linear-gradient(145deg,#b8b1e3,#ddd8f4);color:#fff;font-size:24px;box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 8px 18px rgba(104,93,154,.16)}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:10px}.stats article{display:grid;gap:2px;padding:10px 6px;border-radius:14px;background:#fff;border:1px solid rgba(47,76,99,.06);text-align:center}.stats b{color:#6f69a4;font-size:17px}.stats small{color:#8c9ba7;font-size:8px}.search-box{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:0 12px;height:40px;border:1px solid rgba(47,76,99,.07);border-radius:13px;background:#fff;color:#8d9eaa}.search-box span{font-size:19px}.search-box input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#2f475b;font-size:12px}.character-list{display:grid;gap:9px}.character-card{overflow:hidden;border:1px solid rgba(47,76,99,.07);border-radius:17px;background:#fff;box-shadow:0 4px 15px rgba(52,78,98,.04)}.character-main{width:100%;display:flex;align-items:center;gap:11px;padding:12px;border:0;background:#fff;text-align:left;color:inherit}.character-main:active{background:#f5f8fa}.character-copy{min-width:0;flex:1;display:grid;gap:3px}.character-copy>b{font-size:14px}.character-copy>small{color:#8a99a5;font-size:9px}.chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:3px}.chips em{padding:3px 6px;border-radius:999px;background:#f0eff9;color:#756da0;font-size:8px;font-style:normal}.chips .warning{background:#fff1d9;color:#9a6e34}.arrow{color:#b7c1c9;font-size:24px}.conversation-strip{display:flex;gap:7px;overflow-x:auto;padding:0 12px 12px;scrollbar-width:none}.conversation-strip button{min-width:112px;max-width:150px;display:grid;gap:2px;padding:8px 9px;border:0;border-radius:11px;background:#f3f6f8;color:#536a7c;text-align:left}.conversation-strip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.conversation-strip small{color:#9aa7b0;font-size:8px}.empty{display:grid;justify-items:center;gap:5px;padding:38px 18px;color:#82929f;text-align:center}.empty div{width:45px;height:45px;display:grid;place-items:center;border-radius:15px;background:#eceaf8;color:#8a80b5;font-size:20px}.empty b{color:#536b7d;font-size:13px}.empty p{margin:0;font-size:10px;line-height:1.5}.footnote{margin:13px 5px 0;color:#97a4ae;font-size:9px;line-height:1.6}
</style>
