<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import {
  applySharedTimelinePreferences,
  loadSharedTimeline,
  loadSharedTimelinePreferences,
  saveSharedTimelinePreferences,
  type SharedTimelineItem,
  type SharedTimelinePreferences,
  EMPTY_SHARED_TIMELINE_PREFERENCES
} from '../services/sharedTimelineService'
import {
  proposeSharedTimelineMilestones,
  type SharedTimelineProposal
} from '../services/sharedTimelineProposalService'
import type { Character } from '../types/domain'

const router = useRouter()
const worldId = ref('world-default')
const items = ref<SharedTimelineItem[]>([])
const characters = ref<Character[]>([])
const preferences = ref<SharedTimelinePreferences>({ ...EMPTY_SHARED_TIMELINE_PREFERENCES, customTitles: {} })
const selectedCharacterId = ref('')
const onlyStarred = ref(false)
const showHidden = ref(false)
const loading = ref(true)
const aiBusy = ref(false)
const aiMessage = ref('')
const proposals = ref<SharedTimelineProposal[]>([])

const characterMap = computed(() => new Map(characters.value.map(item => [item.id, item])))
const proposalMap = computed(() => new Map(proposals.value.map(item => [item.id, item])))

const visibleItems = computed(() => items.value.filter(item => {
  if (!showHidden.value && item.hidden) return false
  if (onlyStarred.value && !item.starred) return false
  if (selectedCharacterId.value && item.characterId !== selectedCharacterId.value) return false
  return true
}))

const totals = computed(() => ({
  all: items.value.filter(item => !item.hidden).length,
  starred: items.value.filter(item => item.starred && !item.hidden).length,
  hidden: items.value.filter(item => item.hidden).length,
  suggested: proposals.value.length
}))

const filterCharacters = computed(() => characters.value
  .filter(character => items.value.some(item => item.characterId === character.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))

async function load() {
  loading.value = true
  try {
    const world = await db.worlds.limit(1).first()
    worldId.value = world?.id || 'world-default'
    const [timeline, characterRows, storedPreferences] = await Promise.all([
      loadSharedTimeline(worldId.value),
      db.characters.where('worldId').equals(worldId.value).toArray(),
      loadSharedTimelinePreferences(worldId.value)
    ])
    preferences.value = storedPreferences
    characters.value = characterRows
    items.value = applySharedTimelinePreferences(timeline, storedPreferences)
  } finally {
    loading.value = false
  }
}

async function persist(next: SharedTimelinePreferences) {
  preferences.value = await saveSharedTimelinePreferences(worldId.value, next)
  items.value = applySharedTimelinePreferences(items.value, preferences.value)
}

async function toggleStar(item: SharedTimelineItem) {
  const set = new Set(preferences.value.starredIds)
  if (set.has(item.id)) set.delete(item.id)
  else set.add(item.id)
  await persist({ ...preferences.value, starredIds: [...set] })
}

async function toggleHidden(item: SharedTimelineItem) {
  const set = new Set(preferences.value.hiddenIds)
  if (set.has(item.id)) set.delete(item.id)
  else set.add(item.id)
  await persist({ ...preferences.value, hiddenIds: [...set] })
}

async function editTitle(item: SharedTimelineItem) {
  const current = item.customTitle || item.title
  const next = window.prompt('给这段回忆起个名字', current)?.trim()
  if (next === undefined) return
  const customTitles = { ...preferences.value.customTitles }
  if (next) customTitles[item.id] = next.slice(0, 32)
  else delete customTitles[item.id]
  await persist({ ...preferences.value, customTitles })
}

async function acceptProposal(item: SharedTimelineItem) {
  const proposal = proposalMap.value.get(item.id)
  if (!proposal) return
  const starred = new Set(preferences.value.starredIds)
  starred.add(item.id)
  await persist({
    ...preferences.value,
    starredIds: [...starred],
    customTitles: { ...preferences.value.customTitles, [item.id]: proposal.title }
  })
}

function openSource(item: SharedTimelineItem) {
  void router.push(item.sourceRoute)
}

async function organizeWithAi() {
  if (aiBusy.value) return
  aiBusy.value = true
  aiMessage.value = 'AI 正在从现有证据里挑选值得收藏的节点…'
  try {
    const result = await proposeSharedTimelineMilestones(items.value)
    proposals.value = result.proposals
    aiMessage.value = result.proposals.length
      ? `已基于现有记录提出 ${result.proposals.length} 条候选；不会自动写入记忆。`
      : '这批记录里没有足够明确的候选节点。'
  } catch (error) {
    aiMessage.value = error instanceof Error ? error.message : 'AI 整理失败，请稍后再试。'
  } finally {
    aiBusy.value = false
  }
}

function displayTitle(item: SharedTimelineItem) {
  return item.customTitle || item.title
}

function dateText(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
}

function sourceKindLabel(item: SharedTimelineItem) {
  if (item.sourceKind === 'memory') return '记忆'
  if (item.sourceKind === 'moment') return '动态'
  return '状态'
}

onMounted(load)
</script>

<template>
  <PhoneFrame title="时光" show-back>
    <main class="timeline-page">
      <section class="hero-card">
        <div>
          <small>Shared Timeline</small>
          <h2>共同回忆</h2>
          <p>这里只整理已经发生、能追溯来源的记录。AI 可以提议，但不能凭空制造经历。</p>
        </div>
        <div class="hero-mark">◷</div>
      </section>

      <section class="stats-row">
        <article><b>{{ totals.all }}</b><small>可见记录</small></article>
        <article><b>{{ totals.starred }}</b><small>已收藏</small></article>
        <article><b>{{ totals.suggested }}</b><small>AI 候选</small></article>
      </section>

      <section class="control-card">
        <div class="filter-row">
          <select v-model="selectedCharacterId" aria-label="筛选角色">
            <option value="">所有角色</option>
            <option v-for="character in filterCharacters" :key="character.id" :value="character.id">{{ character.name }}</option>
          </select>
          <button type="button" :class="{ active: onlyStarred }" @click="onlyStarred = !onlyStarred">★ 收藏</button>
          <button v-if="totals.hidden" type="button" :class="{ active: showHidden }" @click="showHidden = !showHidden">隐藏 {{ totals.hidden }}</button>
        </div>
        <button class="ai-button" type="button" :disabled="aiBusy || !items.length" @click="organizeWithAi">
          <span>✦</span>{{ aiBusy ? '正在整理…' : 'AI 从证据中整理候选' }}
        </button>
        <p v-if="aiMessage" class="ai-message">{{ aiMessage }}</p>
      </section>

      <section v-if="loading" class="empty-card">
        <div>◷</div><b>正在整理时间线…</b>
      </section>

      <section v-else-if="visibleItems.length" class="timeline-list">
        <article v-for="item in visibleItems" :key="item.id" class="memory-card" :class="{ hidden: item.hidden, suggested: proposalMap.has(item.id) }">
          <div class="timeline-dot"></div>
          <div class="card-shell">
            <header class="card-head">
              <div class="person-line">
                <CharacterAvatar
                  v-if="item.characterId && characterMap.get(item.characterId)"
                  :avatar="characterMap.get(item.characterId)?.avatar || '🙂'"
                  :name="characterMap.get(item.characterId)?.name || item.characterName || '角色'"
                  :size="34"
                />
                <div>
                  <b>{{ displayTitle(item) }}</b>
                  <small>{{ dateText(item.occurredAt) }} · {{ item.characterName || '共同记录' }}</small>
                </div>
              </div>
              <button class="star-button" type="button" :class="{ on: item.starred }" @click="toggleStar(item)">{{ item.starred ? '★' : '☆' }}</button>
            </header>

            <p class="summary">{{ item.summary }}</p>
            <blockquote v-if="item.sourceExcerpt" class="source-excerpt">原消息：{{ item.sourceExcerpt }}</blockquote>

            <div class="evidence-row">
              <span>{{ sourceKindLabel(item) }}</span>
              <span>{{ item.sourceLabel }}</span>
              <span v-if="proposalMap.has(item.id)" class="proposal-chip">AI 候选</span>
            </div>

            <div v-if="proposalMap.get(item.id)" class="proposal-note">
              <b>AI 建议标题：{{ proposalMap.get(item.id)?.title }}</b>
              <span>{{ proposalMap.get(item.id)?.reason }}</span>
              <button type="button" @click="acceptProposal(item)">采用标题并收藏</button>
            </div>

            <footer class="card-actions">
              <button type="button" @click="openSource(item)">查看来源</button>
              <button type="button" @click="editTitle(item)">改标题</button>
              <button type="button" @click="toggleHidden(item)">{{ item.hidden ? '恢复显示' : '隐藏' }}</button>
            </footer>
          </div>
        </article>
      </section>

      <section v-else class="empty-card">
        <div>✦</div>
        <b>{{ items.length ? '当前筛选下没有记录' : '还没有可整理的共同回忆' }}</b>
        <p>{{ items.length ? '换个角色或关闭筛选试试。' : '聊天里的重要记忆、关系/事件状态和朋友圈动态会逐渐汇到这里。' }}</p>
      </section>

      <p class="privacy-note">AI 整理只会把当前候选记录的摘要发送给你已经配置的模型；返回结果必须引用现有 evidence ID，未知来源会被 Runtime 丢弃。</p>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.timeline-page{min-height:100%;padding:10px 14px 44px;background:linear-gradient(180deg,#f7f4f1,#f1f5f7 42%,#eef3f6);color:#2f4658}.hero-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 16px;border:1px solid rgba(81,75,68,.08);border-radius:21px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(62,72,80,.05)}.hero-card small{color:#a27f73;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero-card h2{margin:2px 0 6px;font-size:25px;letter-spacing:-.04em}.hero-card p{margin:0;max-width:275px;color:#86939b;font-size:10px;line-height:1.6}.hero-mark{width:50px;height:50px;display:grid;place-items:center;flex:0 0 auto;border-radius:17px;background:linear-gradient(145deg,#c99f91,#e7c8bd);color:#fff;font-size:25px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 9px 20px rgba(141,101,87,.18)}.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.stats-row article{display:grid;gap:2px;padding:10px 6px;border:1px solid rgba(70,86,97,.06);border-radius:14px;background:#fff;text-align:center}.stats-row b{color:#876d76;font-size:17px}.stats-row small{color:#91a0aa;font-size:8px}.control-card{display:grid;gap:8px;margin-bottom:12px;padding:10px;border:1px solid rgba(70,86,97,.07);border-radius:16px;background:#fff}.filter-row{display:flex;gap:6px;overflow-x:auto}.filter-row select,.filter-row button{min-height:32px;border:1px solid rgba(70,86,97,.08);border-radius:10px;background:#f5f7f8;color:#667985;font-size:9px}.filter-row select{min-width:110px;padding:0 9px}.filter-row button{padding:0 10px;white-space:nowrap}.filter-row button.active{background:#efe7e4;color:#8b665c;border-color:rgba(139,102,92,.14)}.ai-button{height:38px;border:0;border-radius:12px;background:linear-gradient(135deg,#8e716d,#b88b7e);color:#fff;font-size:10px;font-weight:700;box-shadow:0 6px 14px rgba(130,92,82,.15)}.ai-button:disabled{opacity:.45}.ai-button span{margin-right:6px}.ai-message{margin:0;color:#8b7b78;font-size:9px;line-height:1.5}.timeline-list{position:relative;display:grid;gap:12px;padding-left:17px}.timeline-list::before{content:'';position:absolute;left:5px;top:14px;bottom:14px;width:1px;background:linear-gradient(#d8c0b7,#d8e1e6)}.memory-card{position:relative}.timeline-dot{position:absolute;left:-16px;top:23px;width:9px;height:9px;border:2px solid #f4f3f1;border-radius:50%;background:#b98a7d;box-shadow:0 0 0 2px rgba(185,138,125,.16)}.card-shell{padding:12px;border:1px solid rgba(65,81,92,.07);border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 5px 16px rgba(64,79,90,.04)}.memory-card.suggested .card-shell{border-color:rgba(176,126,112,.24);box-shadow:0 7px 20px rgba(151,102,89,.07)}.memory-card.hidden{opacity:.62}.card-head{display:flex;justify-content:space-between;gap:8px}.person-line{min-width:0;display:flex;align-items:center;gap:8px}.person-line>div{min-width:0;display:grid;gap:2px}.person-line b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3f5260;font-size:13px}.person-line small{color:#9aa5ac;font-size:8px}.star-button{width:31px;height:31px;flex:0 0 auto;border:0;border-radius:10px;background:#f5f6f7;color:#a6afb5;font-size:18px}.star-button.on{background:#f7ecd8;color:#b58132}.summary{margin:10px 0 7px;color:#536b79;font-size:11px;line-height:1.7;white-space:pre-wrap}.source-excerpt{margin:7px 0;padding:7px 9px;border-left:2px solid #d6c4bd;border-radius:0 9px 9px 0;background:#f7f5f3;color:#8b7e79;font-size:9px;line-height:1.5}.evidence-row{display:flex;flex-wrap:wrap;gap:5px}.evidence-row span{padding:3px 6px;border-radius:999px;background:#eef2f4;color:#78909d;font-size:8px}.evidence-row .proposal-chip{background:#f4e9e5;color:#a06f63}.proposal-note{display:grid;gap:4px;margin-top:8px;padding:8px 9px;border-radius:11px;background:#fbf4f1;color:#826e69}.proposal-note b{font-size:9px}.proposal-note span{font-size:9px;line-height:1.45}.proposal-note button{justify-self:start;padding:5px 8px;border:0;border-radius:8px;background:#fff;color:#956d62;font-size:8px}.card-actions{display:flex;gap:6px;margin-top:10px}.card-actions button{flex:1;min-height:31px;border:0;border-radius:9px;background:#f2f5f6;color:#6c7f8b;font-size:9px}.card-actions button:first-child{background:#eaf0f4;color:#507186}.empty-card{display:grid;justify-items:center;gap:5px;padding:42px 18px;color:#8797a1;text-align:center}.empty-card div{width:47px;height:47px;display:grid;place-items:center;border-radius:16px;background:#eee8e5;color:#9a756c;font-size:20px}.empty-card b{color:#566c7a;font-size:13px}.empty-card p{margin:0;max-width:280px;font-size:10px;line-height:1.55}.privacy-note{margin:16px 5px 0;color:#9ca7ad;font-size:8px;line-height:1.6}
</style>
