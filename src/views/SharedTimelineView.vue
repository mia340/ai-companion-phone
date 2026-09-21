<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import {
  buildSharedTimelineHighlights,
  filterSharedTimelineItems,
  groupSharedTimelineItems,
  type SharedTimelineTimeFilter
} from '../services/sharedTimelineBrowseService'
import {
  buildSharedTimelineEvents,
  createManualTimelineEventGroup,
  projectSharedTimelineEvents,
  removeManualTimelineEventGroup,
  upsertManualTimelineEventGroup,
  type SharedTimelineEvent
} from '../services/sharedTimelineEventService'
import type { Character } from '../types/domain'

const route = useRoute()
const router = useRouter()
const worldId = ref('world-default')
const items = ref<SharedTimelineItem[]>([])
const characters = ref<Character[]>([])
const preferences = ref<SharedTimelinePreferences>({
  ...EMPTY_SHARED_TIMELINE_PREFERENCES,
  customTitles: {},
  eventGroups: []
})
const selectedCharacterId = ref('')
const onlyStarred = ref(false)
const showHidden = ref(false)
const searchQuery = ref('')
const timeFilter = ref<SharedTimelineTimeFilter>('all')
const viewMode = ref<'events' | 'evidence'>('events')
const selectingEvidence = ref(false)
const selectedEvidenceIds = ref<string[]>([])
const loading = ref(true)
const aiBusy = ref(false)
const aiMessage = ref('')
const proposals = ref<SharedTimelineProposal[]>([])

const characterMap = computed(() => new Map(characters.value.map(item => [item.id, item])))
const proposalMap = computed(() => new Map(proposals.value.map(item => [item.id, item])))

const visibleItems = computed(() => filterSharedTimelineItems(items.value, {
  query: searchQuery.value,
  characterId: selectedCharacterId.value,
  onlyStarred: onlyStarred.value,
  showHidden: showHidden.value,
  timeFilter: timeFilter.value
}))
const groupedVisibleItems = computed(() => groupSharedTimelineItems(visibleItems.value))
const allEvents = computed(() => buildSharedTimelineEvents(items.value, preferences.value))
const visibleEvents = computed(() => projectSharedTimelineEvents(allEvents.value, visibleItems.value))
const highlights = computed(() => buildSharedTimelineHighlights(items.value))
const selectedEvent = computed(() => {
  const eventId = typeof route.query.event === 'string' ? route.query.event : ''
  return eventId ? visibleEvents.value.find(event => event.id === eventId) : undefined
})
const groupedVisibleEvents = computed(() => {
  const groups = new Map<string, { key: string; label: string; events: SharedTimelineEvent[] }>()
  for (const event of visibleEvents.value) {
    const date = new Date(event.occurredAt)
    const valid = Number.isFinite(date.getTime())
    const key = valid ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'unknown'
    const label = valid ? `${date.getFullYear()}年${date.getMonth() + 1}月` : '时间未知'
    const group = groups.get(key) || { key, label, events: [] }
    group.events.push(event)
    groups.set(key, group)
  }
  return [...groups.values()]
})

const totals = computed(() => ({
  all: items.value.filter(item => !item.hidden).length,
  events: projectSharedTimelineEvents(allEvents.value, items.value.filter(item => !item.hidden)).length,
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

async function toggleEventStar(event: SharedTimelineEvent) {
  const set = new Set(preferences.value.starredIds)
  const makeStarred = !event.items.every(item => set.has(item.id))
  for (const item of event.items) makeStarred ? set.add(item.id) : set.delete(item.id)
  await persist({ ...preferences.value, starredIds: [...set] })
}

async function toggleEventHidden(event: SharedTimelineEvent) {
  const set = new Set(preferences.value.hiddenIds)
  const makeHidden = !event.items.every(item => set.has(item.id))
  for (const item of event.items) makeHidden ? set.add(item.id) : set.delete(item.id)
  await persist({ ...preferences.value, hiddenIds: [...set] })
  if (makeHidden && !showHidden.value) closeEvent()
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

async function editEventTitle(event: SharedTimelineEvent) {
  const next = window.prompt('给这个共同事件起个名字', event.title)?.trim()
  if (next === undefined) return
  const groups = [...(preferences.value.eventGroups || [])]
  if (event.manualGroupId) {
    const updated = groups.map(group => group.id === event.manualGroupId
      ? { ...group, ...(next ? { title: next.slice(0, 32) } : { title: undefined }) }
      : group)
    await persist({ ...preferences.value, eventGroups: updated })
    return
  }
  if (event.itemIds.length < 2) {
    await editTitle(event.items[0])
    return
  }
  const group = createManualTimelineEventGroup(event.itemIds, next || event.title)
  if (!group) return
  await persist({
    ...preferences.value,
    eventGroups: upsertManualTimelineEventGroup(groups, group)
  })
  await router.replace({ query: { ...route.query, event: `manual:${group.id}` } })
}

async function splitEvent(event: SharedTimelineEvent) {
  if (!event.manualGroupId) return
  if (!window.confirm('拆分这个人工事件？证据本身不会删除。')) return
  await persist({
    ...preferences.value,
    eventGroups: removeManualTimelineEventGroup(preferences.value.eventGroups || [], event.manualGroupId)
  })
  closeEvent()
}

function toggleEvidenceSelection(itemId: string) {
  const next = new Set(selectedEvidenceIds.value)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  selectedEvidenceIds.value = [...next]
}

function cancelSelection() {
  selectingEvidence.value = false
  selectedEvidenceIds.value = []
}

async function mergeSelectedEvidence() {
  const selected = visibleItems.value.filter(item => selectedEvidenceIds.value.includes(item.id))
  if (selected.length < 2) {
    window.alert('至少选择两条证据才能合并成一个事件。')
    return
  }
  const characterIds = new Set(selected.map(item => item.characterId).filter(Boolean))
  if (characterIds.size > 1) {
    window.alert('不同角色的证据不能合并成同一个共同事件。')
    return
  }
  const suggestedTitle = selected.find(item => item.customTitle)?.customTitle || selected[0]?.title || '共同事件'
  const title = window.prompt('给合并后的共同事件起个名字', suggestedTitle)?.trim()
  if (title === undefined) return
  const group = createManualTimelineEventGroup(selected.map(item => item.id), title)
  if (!group) return
  await persist({
    ...preferences.value,
    eventGroups: upsertManualTimelineEventGroup(preferences.value.eventGroups || [], group)
  })
  cancelSelection()
  viewMode.value = 'events'
  await router.replace({ query: { ...route.query, event: `manual:${group.id}` } })
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

function openEvent(event: SharedTimelineEvent) {
  void router.replace({ query: { ...route.query, event: event.id } })
}

function closeEvent() {
  const query = { ...route.query }
  delete query.event
  void router.replace({ query })
}

async function organizeWithAi() {
  if (aiBusy.value) return
  aiBusy.value = true
  aiMessage.value = 'AI 正在从当前证据里挑选值得收藏的节点…'
  try {
    const result = await proposeSharedTimelineMilestones(visibleItems.value)
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
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
    : '时间未知'
}

function eventDateText(event: SharedTimelineEvent) {
  const start = dateText(event.startedAt)
  const end = dateText(event.endedAt)
  return start === end ? start : `${start} — ${end}`
}

function sourceKindLabel(item: SharedTimelineItem) {
  if (item.sourceKind === 'memory') return '记忆'
  if (item.sourceKind === 'moment') return '动态'
  if (item.sourceKind === 'media') return item.mediaKind === 'music' ? '音乐' : '图片'
  return '状态'
}

function setTimeFilter(value: SharedTimelineTimeFilter) {
  timeFilter.value = timeFilter.value === value && value !== 'all' ? 'all' : value
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
          <p>把同一件事的聊天、图片、动态与状态证据串成一个事件；所有内容仍能回到真实来源。</p>
        </div>
        <div class="hero-mark">◷</div>
      </section>

      <section class="stats-row">
        <article><b>{{ totals.events }}</b><small>共同事件</small></article>
        <article><b>{{ totals.all }}</b><small>真实证据</small></article>
        <article><b>{{ totals.starred }}</b><small>已收藏</small></article>
      </section>

      <section class="control-card">
        <label class="search-box">
          <span>⌕</span>
          <input v-model="searchQuery" type="search" placeholder="搜索标题、内容、角色或来源" />
          <button v-if="searchQuery" type="button" @click="searchQuery = ''">×</button>
        </label>
        <div class="view-switch">
          <button type="button" :class="{ active: viewMode === 'events' }" @click="viewMode = 'events'; cancelSelection()">事件</button>
          <button type="button" :class="{ active: viewMode === 'evidence' }" @click="viewMode = 'evidence'">证据</button>
        </div>
        <div class="filter-row">
          <select v-model="selectedCharacterId" aria-label="筛选角色">
            <option value="">所有角色</option>
            <option v-for="character in filterCharacters" :key="character.id" :value="character.id">{{ character.name }}</option>
          </select>
          <button type="button" :class="{ active: onlyStarred }" @click="onlyStarred = !onlyStarred">★ 收藏</button>
          <button v-if="totals.hidden" type="button" :class="{ active: showHidden }" @click="showHidden = !showHidden">隐藏 {{ totals.hidden }}</button>
        </div>
        <div class="time-filter-row">
          <button type="button" :class="{ active: timeFilter === 'recent' }" @click="setTimeFilter('recent')">最近 30 天 · {{ highlights.recent }}</button>
          <button type="button" :class="{ active: timeFilter === 'anniversary' }" @click="setTimeFilter('anniversary')">往年今天 · {{ highlights.anniversary }}</button>
          <button type="button" :class="{ active: timeFilter === 'earliest' }" @click="setTimeFilter('earliest')">最初记录 · {{ highlights.earliest }}</button>
          <span v-if="highlights.media">媒体 {{ highlights.media }}</span>
        </div>
        <div class="action-row">
          <button class="ai-button" type="button" :disabled="aiBusy || !visibleItems.length" @click="organizeWithAi">
            <span>✦</span>{{ aiBusy ? '正在整理…' : 'AI 从当前证据中整理候选' }}
          </button>
          <button v-if="viewMode === 'evidence'" class="merge-button" type="button" :class="{ active: selectingEvidence }" @click="selectingEvidence ? cancelSelection() : (selectingEvidence = true)">
            {{ selectingEvidence ? '取消合并' : '合并证据' }}
          </button>
        </div>
        <div v-if="selectingEvidence" class="selection-bar">
          <span>已选 {{ selectedEvidenceIds.length }} 条</span>
          <button type="button" :disabled="selectedEvidenceIds.length < 2" @click="mergeSelectedEvidence">合并为共同事件</button>
        </div>
        <p v-if="aiMessage" class="ai-message">{{ aiMessage }}</p>
      </section>

      <section v-if="loading" class="empty-card">
        <div>◷</div><b>正在整理时间线…</b>
      </section>

      <section v-else-if="viewMode === 'events' && visibleEvents.length" class="timeline-groups">
        <section v-for="group in groupedVisibleEvents" :key="group.key" class="timeline-group">
          <header class="month-header"><b>{{ group.label }}</b><span>{{ group.events.length }} 个事件</span></header>
          <div class="event-list">
            <article v-for="event in group.events" :key="event.id" class="event-card" :class="{ manual: event.manual }">
              <div class="event-cover" v-if="event.mediaPreviewUrls.length">
                <img v-for="url in event.mediaPreviewUrls.slice(0, 3)" :key="url" :src="url" alt="共同事件图片" />
              </div>
              <header class="event-head">
                <div class="person-line">
                  <CharacterAvatar
                    v-if="event.characterId && characterMap.get(event.characterId)"
                    :avatar="characterMap.get(event.characterId)?.avatar || '🙂'"
                    :name="characterMap.get(event.characterId)?.name || event.characterName || '角色'"
                    :size="36"
                  />
                  <div>
                    <b>{{ event.title }}</b>
                    <small>{{ eventDateText(event) }} · {{ event.itemIds.length }} 条证据</small>
                  </div>
                </div>
                <button class="star-button" type="button" :class="{ on: event.starred }" @click="toggleEventStar(event)">{{ event.starred ? '★' : '☆' }}</button>
              </header>
              <p class="summary">{{ event.summary }}</p>
              <div class="evidence-row">
                <span v-for="label in event.sourceLabels" :key="label">{{ label }}</span>
                <span v-if="event.manual" class="manual-chip">人工合并</span>
                <span v-else-if="event.itemIds.length > 1">自动归并</span>
              </div>
              <footer class="card-actions">
                <button type="button" @click="openEvent(event)">查看事件</button>
                <button type="button" @click="editEventTitle(event)">改标题</button>
                <button type="button" @click="toggleEventHidden(event)">{{ event.hidden ? '恢复显示' : '隐藏事件' }}</button>
              </footer>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="viewMode === 'evidence' && visibleItems.length" class="timeline-groups">
        <section v-for="group in groupedVisibleItems" :key="group.key" class="timeline-group">
          <header class="month-header"><b>{{ group.label }}</b><span>{{ group.items.length }} 条证据</span></header>
          <div class="timeline-list">
            <article v-for="item in group.items" :key="item.id" class="memory-card" :class="{ hidden: item.hidden, suggested: proposalMap.has(item.id), selected: selectedEvidenceIds.includes(item.id) }">
              <button v-if="selectingEvidence" class="select-dot" type="button" @click="toggleEvidenceSelection(item.id)">{{ selectedEvidenceIds.includes(item.id) ? '✓' : '' }}</button>
              <div class="timeline-dot"></div>
              <div class="card-shell" @click="selectingEvidence && toggleEvidenceSelection(item.id)">
                <header class="card-head">
                  <div class="person-line">
                    <CharacterAvatar
                      v-if="item.characterId && characterMap.get(item.characterId)"
                      :avatar="characterMap.get(item.characterId)?.avatar || '🙂'"
                      :name="characterMap.get(item.characterId)?.name || item.characterName || '角色'"
                      :size="34"
                    />
                    <div><b>{{ displayTitle(item) }}</b><small>{{ dateText(item.occurredAt) }} · {{ item.characterName || '共同记录' }}</small></div>
                  </div>
                  <button v-if="!selectingEvidence" class="star-button" type="button" :class="{ on: item.starred }" @click.stop="toggleStar(item)">{{ item.starred ? '★' : '☆' }}</button>
                </header>

                <div v-if="item.mediaKind === 'image' && item.mediaPreviewUrl" class="media-preview image-preview">
                  <img :src="item.mediaPreviewUrl" :alt="item.mediaLabel || '共同回忆图片'" />
                </div>
                <div v-else-if="item.mediaKind === 'music'" class="media-preview music-preview">
                  <span>♫</span><div><b>一起听歌</b><small>{{ item.mediaLabel || '聊天里的音乐片段' }}</small></div>
                </div>

                <p class="summary">{{ item.summary }}</p>
                <blockquote v-if="item.sourceExcerpt && item.sourceExcerpt !== item.summary" class="source-excerpt">原消息：{{ item.sourceExcerpt }}</blockquote>
                <div class="evidence-row">
                  <span>{{ sourceKindLabel(item) }}</span><span>{{ item.sourceLabel }}</span><span v-if="proposalMap.has(item.id)" class="proposal-chip">AI 候选</span>
                </div>
                <div v-if="proposalMap.get(item.id) && !selectingEvidence" class="proposal-note">
                  <b>AI 建议标题：{{ proposalMap.get(item.id)?.title }}</b>
                  <span>{{ proposalMap.get(item.id)?.reason }}</span>
                  <button type="button" @click.stop="acceptProposal(item)">采用标题并收藏</button>
                </div>
                <footer v-if="!selectingEvidence" class="card-actions">
                  <button type="button" @click.stop="openSource(item)">查看来源</button>
                  <button type="button" @click.stop="editTitle(item)">改标题</button>
                  <button type="button" @click.stop="toggleHidden(item)">{{ item.hidden ? '恢复显示' : '隐藏' }}</button>
                </footer>
              </div>
            </article>
          </div>
        </section>
      </section>

      <section v-else class="empty-card">
        <div>✦</div>
        <b>{{ items.length ? '当前搜索或筛选下没有记录' : '还没有可整理的共同回忆' }}</b>
        <p>{{ items.length ? '清空搜索、切回全部时间或换个角色试试。' : '聊天里的重要记忆、状态、图片、音乐与朋友圈会逐渐汇到这里。' }}</p>
      </section>

      <p class="privacy-note">事件只是对真实 evidence 的归并，不复制或改写事实。AI 整理仍必须引用现有 evidence ID；人工合并也只保存 evidence ID 列表。</p>
    </main>

    <div v-if="selectedEvent" class="event-overlay" @click.self="closeEvent">
      <section class="event-sheet">
        <header class="sheet-head">
          <div><small>Shared Event</small><h3>{{ selectedEvent.title }}</h3><p>{{ eventDateText(selectedEvent) }} · {{ selectedEvent.itemIds.length }} 条真实证据</p></div>
          <button type="button" @click="closeEvent">×</button>
        </header>
        <div v-if="selectedEvent.mediaPreviewUrls.length" class="detail-gallery">
          <img v-for="url in selectedEvent.mediaPreviewUrls" :key="url" :src="url" alt="事件证据图片" />
        </div>
        <p class="event-summary">{{ selectedEvent.summary }}</p>
        <div class="detail-actions">
          <button type="button" @click="toggleEventStar(selectedEvent)">{{ selectedEvent.starred ? '取消收藏' : '收藏事件' }}</button>
          <button type="button" @click="editEventTitle(selectedEvent)">修改标题</button>
          <button v-if="selectedEvent.manual" type="button" class="danger" @click="splitEvent(selectedEvent)">拆分事件</button>
        </div>
        <div class="evidence-chain">
          <article v-for="item in selectedEvent.items" :key="item.id">
            <div class="chain-dot"></div>
            <header><b>{{ displayTitle(item) }}</b><small>{{ dateText(item.occurredAt) }} · {{ item.sourceLabel }}</small></header>
            <p>{{ item.summary }}</p>
            <button type="button" @click="openSource(item)">回到真实来源 →</button>
          </article>
        </div>
      </section>
    </div>
  </PhoneFrame>
</template>

<style scoped>
.timeline-page{min-height:100%;padding:10px 14px 44px;background:linear-gradient(180deg,#f7f4f1,#f1f5f7 42%,#eef3f6);color:#2f4658}.hero-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 16px;border:1px solid rgba(81,75,68,.08);border-radius:21px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(62,72,80,.05)}.hero-card small,.sheet-head small{color:#a27f73;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero-card h2{margin:2px 0 6px;font-size:25px;letter-spacing:-.04em}.hero-card p{margin:0;max-width:275px;color:#86939b;font-size:10px;line-height:1.6}.hero-mark{width:50px;height:50px;display:grid;place-items:center;flex:0 0 auto;border-radius:17px;background:linear-gradient(145deg,#c99f91,#e7c8bd);color:#fff;font-size:25px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 9px 20px rgba(141,101,87,.18)}.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.stats-row article{display:grid;gap:2px;padding:10px 6px;border:1px solid rgba(70,86,97,.06);border-radius:14px;background:#fff;text-align:center}.stats-row b{color:#876d76;font-size:17px}.stats-row small{color:#91a0aa;font-size:8px}.control-card{display:grid;gap:8px;margin-bottom:12px;padding:10px;border:1px solid rgba(70,86,97,.07);border-radius:16px;background:#fff}.search-box{height:36px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid rgba(70,86,97,.08);border-radius:11px;background:#f6f8f9;color:#8a98a1}.search-box input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#536b79;font-size:10px}.search-box button{width:24px;height:24px;border:0;border-radius:8px;background:#e9eef1;color:#7d8c95}.view-switch{display:grid;grid-template-columns:1fr 1fr;padding:3px;border-radius:11px;background:#f1f4f5}.view-switch button{height:30px;border:0;border-radius:9px;background:transparent;color:#83919a;font-size:9px}.view-switch button.active{background:#fff;color:#8f6c62;box-shadow:0 2px 8px rgba(70,80,88,.08)}.filter-row,.time-filter-row,.action-row{display:flex;gap:6px;overflow-x:auto}.filter-row select,.filter-row button,.time-filter-row button,.time-filter-row span{min-height:30px;border:1px solid rgba(70,86,97,.08);border-radius:9px;background:#f5f7f8;color:#667985;font-size:8px;white-space:nowrap}.filter-row select{min-width:110px;padding:0 9px}.filter-row button,.time-filter-row button,.time-filter-row span{padding:0 9px}.filter-row button.active,.time-filter-row button.active{background:#efe7e4;color:#8b665c}.time-filter-row span{display:flex;align-items:center;margin-left:auto}.ai-button,.merge-button{min-height:36px;border:0;border-radius:11px;font-size:9px;font-weight:700}.ai-button{flex:1;background:linear-gradient(135deg,#8e716d,#b88b7e);color:#fff}.merge-button{padding:0 12px;background:#e9eef1;color:#607985}.merge-button.active{background:#efe3df;color:#906b61}.ai-button:disabled,.selection-bar button:disabled{opacity:.45}.selection-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 8px;border-radius:10px;background:#f8f1ee;color:#8d746d;font-size:9px}.selection-bar button{border:0;border-radius:8px;padding:6px 9px;background:#a77b70;color:#fff;font-size:8px}.ai-message{margin:0;color:#8b7b78;font-size:9px;line-height:1.5}.timeline-groups{display:grid;gap:14px}.timeline-group{display:grid;gap:7px}.month-header{display:flex;align-items:center;justify-content:space-between;padding:0 4px;color:#71848f}.month-header b{font-size:11px}.month-header span{font-size:8px;color:#a0abb1}.event-list{display:grid;gap:10px}.event-card{padding:12px;border:1px solid rgba(65,81,92,.07);border-radius:18px;background:#fff;box-shadow:0 5px 16px rgba(64,79,90,.04)}.event-card.manual{border-color:rgba(176,126,112,.22)}.event-cover{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;height:130px;margin:-4px -4px 10px;overflow:hidden;border-radius:13px;background:#eef2f4}.event-cover img{width:100%;height:130px;object-fit:cover}.event-head,.card-head{display:flex;justify-content:space-between;gap:8px}.person-line{min-width:0;display:flex;align-items:center;gap:8px}.person-line>div{min-width:0;display:grid;gap:2px}.person-line b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3f5260;font-size:13px}.person-line small{color:#9aa5ac;font-size:8px}.star-button{width:31px;height:31px;flex:0 0 auto;border:0;border-radius:10px;background:#f5f6f7;color:#a6afb5;font-size:18px}.star-button.on{background:#f7ecd8;color:#b58132}.summary,.event-summary{margin:10px 0 7px;color:#536b79;font-size:11px;line-height:1.7;white-space:pre-wrap}.evidence-row{display:flex;flex-wrap:wrap;gap:5px}.evidence-row span{padding:3px 6px;border-radius:999px;background:#eef2f4;color:#78909d;font-size:8px}.evidence-row .proposal-chip,.evidence-row .manual-chip{background:#f4e9e5;color:#a06f63}.card-actions{display:flex;gap:6px;margin-top:10px}.card-actions button{flex:1;min-height:31px;border:0;border-radius:9px;background:#f2f5f6;color:#6c7f8b;font-size:9px}.card-actions button:first-child{background:#eaf0f4;color:#507186}.timeline-list{position:relative;display:grid;gap:12px;padding-left:17px}.timeline-list::before{content:'';position:absolute;left:5px;top:14px;bottom:14px;width:1px;background:linear-gradient(#d8c0b7,#d8e1e6)}.memory-card{position:relative}.memory-card.selected .card-shell{outline:2px solid rgba(169,119,105,.26);background:#fffaf8}.select-dot{position:absolute;z-index:3;left:-22px;top:19px;width:22px;height:22px;border:1px solid #d6b8af;border-radius:50%;background:#fff;color:#9c7065;font-size:11px}.timeline-dot{position:absolute;left:-16px;top:23px;width:9px;height:9px;border:2px solid #f4f3f1;border-radius:50%;background:#b98a7d}.card-shell{padding:12px;border:1px solid rgba(65,81,92,.07);border-radius:17px;background:rgba(255,255,255,.96)}.memory-card.suggested .card-shell{border-color:rgba(176,126,112,.24)}.memory-card.hidden{opacity:.62}.media-preview{margin:10px 0 6px;border-radius:13px;overflow:hidden;background:#f1f4f5}.image-preview{max-height:190px}.image-preview img{display:block;width:100%;max-height:190px;object-fit:cover}.music-preview{display:flex;align-items:center;gap:10px;padding:10px 11px;background:linear-gradient(135deg,#eef0f8,#f5edf1);color:#6d7084}.music-preview>span{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#fff;font-size:20px}.music-preview>div{display:grid;gap:2px}.music-preview b{font-size:10px}.music-preview small{font-size:8px;color:#9696a3}.source-excerpt{margin:7px 0;padding:7px 9px;border-left:2px solid #d6c4bd;border-radius:0 9px 9px 0;background:#f7f5f3;color:#8b7e79;font-size:9px;line-height:1.5}.proposal-note{display:grid;gap:4px;margin-top:8px;padding:8px 9px;border-radius:11px;background:#fbf4f1;color:#826e69}.proposal-note b{font-size:9px}.proposal-note span{font-size:9px;line-height:1.45}.proposal-note button{justify-self:start;padding:5px 8px;border:0;border-radius:8px;background:#fff;color:#956d62;font-size:8px}.empty-card{display:grid;justify-items:center;gap:5px;padding:42px 18px;color:#8797a1;text-align:center}.empty-card div{width:47px;height:47px;display:grid;place-items:center;border-radius:16px;background:#eee8e5;color:#9a756c;font-size:20px}.empty-card b{color:#566c7a;font-size:13px}.empty-card p{margin:0;max-width:280px;font-size:10px;line-height:1.55}.privacy-note{margin:16px 5px 0;color:#9ca7ad;font-size:8px;line-height:1.6}.event-overlay{position:fixed;z-index:80;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(31,42,49,.34);backdrop-filter:blur(4px)}.event-sheet{width:min(100%,430px);max-height:82vh;overflow:auto;padding:16px 15px 28px;border-radius:24px 24px 0 0;background:#fbfbfa;box-shadow:0 -16px 40px rgba(30,40,46,.16)}.sheet-head{display:flex;justify-content:space-between;gap:12px}.sheet-head h3{margin:2px 0 3px;color:#435966;font-size:20px}.sheet-head p{margin:0;color:#98a3aa;font-size:8px}.sheet-head>button{width:34px;height:34px;border:0;border-radius:12px;background:#eef1f2;color:#75858e;font-size:20px}.detail-gallery{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;height:170px;margin:14px 0 8px;overflow:hidden;border-radius:16px;background:#edf1f2}.detail-gallery img{width:100%;height:170px;object-fit:cover}.detail-actions{display:flex;gap:6px;margin:10px 0}.detail-actions button{flex:1;min-height:32px;border:0;border-radius:9px;background:#eaf0f3;color:#5f7886;font-size:8px}.detail-actions .danger{background:#f7ece9;color:#a36c60}.evidence-chain{display:grid;gap:9px;margin-top:14px}.evidence-chain article{position:relative;padding:11px 11px 10px 17px;border-radius:13px;background:#fff;border:1px solid rgba(67,85,96,.07)}.chain-dot{position:absolute;left:7px;top:16px;width:5px;height:5px;border-radius:50%;background:#bd8d80}.evidence-chain header{display:grid;gap:2px}.evidence-chain b{color:#4a606d;font-size:10px}.evidence-chain small{color:#9aa5ab;font-size:8px}.evidence-chain p{margin:7px 0;color:#657985;font-size:9px;line-height:1.55}.evidence-chain button{padding:0;border:0;background:transparent;color:#7f6f6a;font-size:8px}
</style>
