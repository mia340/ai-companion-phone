<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import RelationshipArcPanel from '../components/timeline/RelationshipArcPanel.vue'
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
  reorderManualTimelineEventGroup,
  resolveSharedTimelineEventSummary,
  upsertManualTimelineEventGroup,
  type SharedTimelineEvent
} from '../services/sharedTimelineEventService'
import {
  loadSharedTimelineEventContexts,
  type SharedTimelineEvidenceContext
} from '../services/sharedTimelineEventContextService'
import {
  proposeSharedTimelineEventInsight,
  type SharedTimelineEventInsight
} from '../services/sharedTimelineEventInsightService'
import { buildSharedTimelineAnniversaries } from '../services/sharedTimelineAnniversaryService'
import { relatedSharedTimelineEvents } from '../services/sharedTimelineRelationService'
import { buildSharedTimelineChatShare, mergeTimelineShareIntoDraft } from '../services/sharedTimelineEventShareService'
import {
  buildRelationshipArcs,
  resolveRelationshipArcSummary,
  type RelationshipArc
} from '../services/relationshipArcService'
import {
  proposeRelationshipArcInsight,
  type RelationshipArcInsight
} from '../services/relationshipArcInsightService'
import { buildRelationshipArcChatShare, mergeRelationshipArcShareIntoDraft } from '../services/relationshipArcShareService'
import type { Character } from '../types/domain'

const route = useRoute()
const router = useRouter()
const worldId = ref('world-default')
const items = ref<SharedTimelineItem[]>([])
const characters = ref<Character[]>([])
const preferences = ref<SharedTimelinePreferences>({
  ...EMPTY_SHARED_TIMELINE_PREFERENCES,
  customTitles: {},
  eventGroups: [],
  eventNotes: {},
  eventSummaries: {},
  relationshipArcSummaries: {}
})
const selectedCharacterId = ref('')
const onlyStarred = ref(false)
const showHidden = ref(false)
const searchQuery = ref('')
const timeFilter = ref<SharedTimelineTimeFilter>('all')
const viewMode = ref<'events' | 'evidence' | 'arc'>('events')
const selectingEvidence = ref(false)
const selectedEvidenceIds = ref<string[]>([])
const loading = ref(true)
const aiBusy = ref(false)
const aiMessage = ref('')
const proposals = ref<SharedTimelineProposal[]>([])
const eventContexts = ref<SharedTimelineEvidenceContext[]>([])
const eventContextLoading = ref(false)
const eventInsightBusy = ref(false)
const eventInsightMessage = ref('')
const eventInsightDraft = ref<SharedTimelineEventInsight>()
const relationshipArcInsightBusy = ref(false)
const relationshipArcInsightMessage = ref('')
const relationshipArcInsightDraft = ref<RelationshipArcInsight>()

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
const anniversaries = computed(() => buildSharedTimelineAnniversaries(
  projectSharedTimelineEvents(allEvents.value, items.value.filter(item => !item.hidden)),
  new Date(),
  30
))
const detailEvents = computed(() => projectSharedTimelineEvents(
  allEvents.value,
  items.value.filter(item => showHidden.value || !item.hidden)
))
const selectedEvent = computed(() => {
  const eventId = typeof route.query.event === 'string' ? route.query.event : ''
  return eventId ? detailEvents.value.find(event => event.id === eventId) : undefined
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

const relationshipArcEvents = computed(() => projectSharedTimelineEvents(
  allEvents.value,
  items.value.filter(item => !item.hidden)
))
const relationshipArcs = computed(() => buildRelationshipArcs(
  relationshipArcEvents.value,
  filterCharacters.value.map(character => character.id),
  preferences.value
))
const selectedRelationshipArc = computed<RelationshipArc | undefined>(() =>
  relationshipArcs.value.find(arc => arc.characterId === selectedCharacterId.value)
)
const selectedRelationshipArcSummary = computed(() =>
  selectedRelationshipArc.value
    ? resolveRelationshipArcSummary(selectedRelationshipArc.value, preferences.value)
    : undefined
)

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

async function setEventTitle(event: SharedTimelineEvent, title: string) {
  const next = title.trim().slice(0, 32)
  const groups = [...(preferences.value.eventGroups || [])]
  if (event.manualGroupId) {
    const updated = groups.map(group => group.id === event.manualGroupId
      ? { ...group, ...(next ? { title: next } : { title: undefined }) }
      : group)
    await persist({ ...preferences.value, eventGroups: updated })
    return event.id
  }
  if (event.itemIds.length < 2) {
    const customTitles = { ...preferences.value.customTitles }
    if (next) customTitles[event.items[0].id] = next
    else delete customTitles[event.items[0].id]
    await persist({ ...preferences.value, customTitles })
    return event.id
  }
  const group = createManualTimelineEventGroup(event.itemIds, next || event.title)
  if (!group) return event.id
  await persist({
    ...preferences.value,
    eventGroups: upsertManualTimelineEventGroup(groups, group)
  })
  const nextId = `manual:${group.id}`
  await router.replace({ query: { ...route.query, event: nextId } })
  return nextId
}

async function editEventTitle(event: SharedTimelineEvent) {
  const next = window.prompt('给这个共同事件起个名字', event.title)?.trim()
  if (next === undefined) return
  await setEventTitle(event, next)
}

function eventAcceptedSummary(event: SharedTimelineEvent) {
  return resolveSharedTimelineEventSummary(event, preferences.value)
}

function eventSummaryText(event: SharedTimelineEvent) {
  return eventAcceptedSummary(event)?.summary || event.summary
}

function eventNote(event: SharedTimelineEvent) {
  return preferences.value.eventNotes?.[event.evidenceKey] || ''
}

async function editEventNote(event: SharedTimelineEvent) {
  const current = eventNote(event)
  const next = window.prompt('写一段只属于你的事件备注', current)?.trim()
  if (next === undefined) return
  const eventNotes = { ...(preferences.value.eventNotes || {}) }
  if (next) eventNotes[event.evidenceKey] = next.slice(0, 600)
  else delete eventNotes[event.evidenceKey]
  await persist({ ...preferences.value, eventNotes })
}

async function moveEventEvidence(event: SharedTimelineEvent, itemId: string, direction: -1 | 1) {
  let groups = [...(preferences.value.eventGroups || [])]
  let groupId = event.manualGroupId
  let nextEventId = event.id
  if (!groupId) {
    const group = createManualTimelineEventGroup(event.itemIds, event.title)
    if (!group) return
    groupId = group.id
    groups = upsertManualTimelineEventGroup(groups, group)
    nextEventId = `manual:${group.id}`
  }
  groups = reorderManualTimelineEventGroup(groups, groupId, itemId, direction)
  await persist({ ...preferences.value, eventGroups: groups })
  if (nextEventId !== event.id) {
    await router.replace({ query: { ...route.query, event: nextEventId } })
  }
}

async function summarizeEventWithAi(event: SharedTimelineEvent) {
  if (eventInsightBusy.value) return
  eventInsightBusy.value = true
  eventInsightDraft.value = undefined
  eventInsightMessage.value = 'AI 正在只依据这个事件的完整 evidence 生成摘要…'
  try {
    const result = await proposeSharedTimelineEventInsight(event)
    eventInsightDraft.value = result.insight
    eventInsightMessage.value = result.insight
      ? '已生成候选摘要；只有你确认后才会保存。'
      : '模型返回的 event/evidence 证明不完整，Runtime 已拒绝这次摘要。'
  } catch (error) {
    eventInsightMessage.value = error instanceof Error ? error.message : '事件摘要失败，请稍后再试。'
  } finally {
    eventInsightBusy.value = false
  }
}

async function acceptEventSummary(event: SharedTimelineEvent) {
  const draft = eventInsightDraft.value
  if (!draft || draft.eventId !== event.id) return
  const eventSummaries = { ...(preferences.value.eventSummaries || {}) }
  eventSummaries[event.evidenceKey] = {
    summary: draft.summary,
    evidenceIds: [...draft.evidenceIds],
    updatedAt: new Date().toISOString()
  }
  await persist({ ...preferences.value, eventSummaries })
  eventInsightMessage.value = '摘要已保存；如果事件 evidence 发生变化，它会自动失效。'
}

async function applyEventInsightTitle(event: SharedTimelineEvent) {
  const draft = eventInsightDraft.value
  if (!draft || draft.eventId !== event.id) return
  await setEventTitle(event, draft.title)
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

function selectedEventRelations(event: SharedTimelineEvent) {
  return relatedSharedTimelineEvents(event.id, visibleEvents.value, 4)
}

function openRelatedEvent(event: SharedTimelineEvent) {
  void router.replace({ query: { ...route.query, event: event.id } })
}

function openAnniversary(eventId: string) {
  const event = allEvents.value.find(row => row.id === eventId)
  if (event) openEvent(event)
}

function bringEventBackToChat(event: SharedTimelineEvent) {
  const share = buildSharedTimelineChatShare(event, eventSummaryText(event))
  if (!share) {
    window.alert('这个事件没有可定位的真实聊天会话，暂时不能带回聊天。')
    return
  }
  const key = `ai-companion-draft:${share.conversationId}`
  const existing = localStorage.getItem(key) || ''
  localStorage.setItem(key, mergeTimelineShareIntoDraft(existing, share))
  void router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
}

function selectRelationshipArcCharacter(characterId: string) {
  selectedCharacterId.value = characterId
  relationshipArcInsightDraft.value = undefined
  relationshipArcInsightMessage.value = ''
}

function openRelationshipArcEvent(eventId: string) {
  const event = relationshipArcEvents.value.find(row => row.id === eventId)
  if (!event) return
  void router.replace({ query: { ...route.query, event: event.id } })
}

async function generateRelationshipArcInsight() {
  const arc = selectedRelationshipArc.value
  if (!arc || relationshipArcInsightBusy.value) return
  relationshipArcInsightBusy.value = true
  relationshipArcInsightDraft.value = undefined
  relationshipArcInsightMessage.value = 'AI 正在只依据当前关系脉络的 Runtime 节点整理候选摘要…'
  try {
    const result = await proposeRelationshipArcInsight(arc)
    relationshipArcInsightDraft.value = result.insight
    relationshipArcInsightMessage.value = result.insight
      ? '候选已生成；只有你确认后才会保存，也不会自动进入角色 Prompt。'
      : '模型返回的 arc / node / evidence provenance 不完整，Runtime 已拒绝这次结果。'
  } catch (error) {
    relationshipArcInsightMessage.value = error instanceof Error ? error.message : '关系脉络整理失败，请稍后再试。'
  } finally {
    relationshipArcInsightBusy.value = false
  }
}

async function acceptRelationshipArcInsight() {
  const arc = selectedRelationshipArc.value
  const draft = relationshipArcInsightDraft.value
  if (!arc || !draft || draft.arcFingerprint !== arc.fingerprint || draft.characterId !== arc.characterId) return
  const relationshipArcSummaries = { ...(preferences.value.relationshipArcSummaries || {}) }
  relationshipArcSummaries[arc.fingerprint] = {
    characterId: arc.characterId,
    summary: draft.summary,
    nodeIds: [...draft.nodeIds],
    evidenceIds: [...draft.evidenceIds],
    ...(draft.turningPoints.length ? { turningPointNodeIds: draft.turningPoints.map(point => point.nodeId) } : {}),
    updatedAt: new Date().toISOString()
  }
  await persist({ ...preferences.value, relationshipArcSummaries })
  relationshipArcInsightMessage.value = '关系脉络摘要已保存；节点或 evidence 变化后它会自动失效。'
}

function bringRelationshipArcBackToChat() {
  const arc = selectedRelationshipArc.value
  if (!arc) return
  const share = buildRelationshipArcChatShare(arc, selectedRelationshipArcSummary.value)
  if (!share) {
    window.alert('这条关系脉络没有可定位的真实聊天会话，暂时不能带回聊天。')
    return
  }
  const key = `ai-companion-draft:${share.conversationId}`
  const existing = localStorage.getItem(key) || ''
  localStorage.setItem(key, mergeRelationshipArcShareIntoDraft(existing, share))
  void router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
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

function contextSenderLabel(senderId: string, event?: SharedTimelineEvent) {
  if (senderId === 'user') return '我'
  return characterMap.value.get(senderId)?.name || event?.characterName || '角色'
}

async function refreshSelectedEventContext(event?: SharedTimelineEvent) {
  eventContexts.value = []
  if (!event) return
  eventContextLoading.value = true
  try {
    eventContexts.value = await loadSharedTimelineEventContexts(event, { radius: 1 })
  } catch (error) {
    console.warn('[shared-timeline] event context unavailable:', error)
  } finally {
    eventContextLoading.value = false
  }
}

watch(() => selectedEvent.value ? `${selectedEvent.value.id}|${selectedEvent.value.evidenceKey}` : '', () => {
  eventInsightDraft.value = undefined
  eventInsightMessage.value = ''
  void refreshSelectedEventContext(selectedEvent.value)
}, { immediate: true })

watch(() => selectedRelationshipArc.value?.fingerprint || '', () => {
  relationshipArcInsightDraft.value = undefined
  relationshipArcInsightMessage.value = ''
})

onMounted(load)
</script>

<template>
  <PhoneFrame title="时光" show-back>
    <main class="timeline-page">
      <section class="hero-card">
        <div>
          <small>Shared Timeline</small>
          <h2>共同回忆</h2>
          <p>把真实 evidence 聚成共同事件，再把事件串成可追溯的关系脉络；每个节点仍能回到来源。</p>
        </div>
        <div class="hero-mark">◷</div>
      </section>

      <section class="stats-row">
        <article><b>{{ totals.events }}</b><small>共同事件</small></article>
        <article><b>{{ totals.all }}</b><small>真实证据</small></article>
        <article><b>{{ totals.starred }}</b><small>已收藏</small></article>
      </section>

      <section v-if="anniversaries.length" class="anniversary-card">
        <header><b>即将到来的时光</b><small>只根据真实事件日期计算</small></header>
        <button v-for="row in anniversaries.slice(0, 3)" :key="row.evidenceKey" type="button" @click="openAnniversary(row.eventId)">
          <span>{{ row.isToday ? '今天' : `${row.daysUntil} 天后` }}</span><b>{{ row.title }}</b><small>{{ row.years }} 周年 · {{ row.originalDate }}</small>
        </button>
      </section>

      <section class="control-card">
        <label v-if="viewMode !== 'arc'" class="search-box">
          <span>⌕</span>
          <input v-model="searchQuery" type="search" placeholder="搜索标题、内容、角色或来源" />
          <button v-if="searchQuery" type="button" @click="searchQuery = ''">×</button>
        </label>
        <div class="view-switch">
          <button type="button" :class="{ active: viewMode === 'events' }" @click="viewMode = 'events'; cancelSelection()">事件</button>
          <button type="button" :class="{ active: viewMode === 'evidence' }" @click="viewMode = 'evidence'">证据</button>
          <button type="button" :class="{ active: viewMode === 'arc' }" @click="viewMode = 'arc'; cancelSelection()">关系脉络</button>
        </div>
        <div class="filter-row">
          <select v-model="selectedCharacterId" aria-label="筛选角色">
            <option value="">所有角色</option>
            <option v-for="character in filterCharacters" :key="character.id" :value="character.id">{{ character.name }}</option>
          </select>
          <button v-if="viewMode !== 'arc'" type="button" :class="{ active: onlyStarred }" @click="onlyStarred = !onlyStarred">★ 收藏</button>
          <button v-if="viewMode !== 'arc' && totals.hidden" type="button" :class="{ active: showHidden }" @click="showHidden = !showHidden">隐藏 {{ totals.hidden }}</button>
        </div>
        <div v-if="viewMode !== 'arc'" class="time-filter-row">
          <button type="button" :class="{ active: timeFilter === 'recent' }" @click="setTimeFilter('recent')">最近 30 天 · {{ highlights.recent }}</button>
          <button type="button" :class="{ active: timeFilter === 'anniversary' }" @click="setTimeFilter('anniversary')">往年今天 · {{ highlights.anniversary }}</button>
          <button type="button" :class="{ active: timeFilter === 'earliest' }" @click="setTimeFilter('earliest')">最初记录 · {{ highlights.earliest }}</button>
          <span v-if="highlights.media">媒体 {{ highlights.media }}</span>
        </div>
        <div v-if="viewMode !== 'arc'" class="action-row">
          <button class="ai-button" type="button" :disabled="aiBusy || !visibleItems.length" @click="organizeWithAi">
            <span>✦</span>{{ aiBusy ? '正在整理…' : 'AI 从当前证据中整理候选' }}
          </button>
          <button v-if="viewMode === 'evidence'" class="merge-button" type="button" :class="{ active: selectingEvidence }" @click="selectingEvidence ? cancelSelection() : (selectingEvidence = true)">
            {{ selectingEvidence ? '取消合并' : '合并证据' }}
          </button>
        </div>
        <div v-if="viewMode !== 'arc' && selectingEvidence" class="selection-bar">
          <span>已选 {{ selectedEvidenceIds.length }} 条</span>
          <button type="button" :disabled="selectedEvidenceIds.length < 2" @click="mergeSelectedEvidence">合并为共同事件</button>
        </div>
        <p v-if="viewMode !== 'arc' && aiMessage" class="ai-message">{{ aiMessage }}</p>
      </section>

      <section v-if="loading" class="empty-card">
        <div>◷</div><b>正在整理时间线…</b>
      </section>

      <RelationshipArcPanel
        v-else-if="viewMode === 'arc'"
        :arcs="relationshipArcs"
        :selected-character-id="selectedCharacterId"
        :characters="characters"
        :accepted-summary="selectedRelationshipArcSummary"
        :insight-draft="relationshipArcInsightDraft"
        :insight-busy="relationshipArcInsightBusy"
        :insight-message="relationshipArcInsightMessage"
        @select-character="selectRelationshipArcCharacter"
        @open-event="openRelationshipArcEvent"
        @generate-insight="generateRelationshipArcInsight"
        @accept-insight="acceptRelationshipArcInsight"
        @bring-chat="bringRelationshipArcBackToChat"
      />

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
              <p class="summary">{{ eventSummaryText(event) }}</p>
              <div class="evidence-row">
                <span v-for="label in event.sourceLabels" :key="label">{{ label }}</span>
                <span v-if="event.manual" class="manual-chip">人工合并</span>
                <span v-else-if="event.itemIds.length > 1">自动归并</span>
                <span v-if="eventAcceptedSummary(event)" class="insight-chip">AI 摘要已确认</span>
                <span v-if="eventNote(event)" class="note-chip">有备注</span>
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

      <p class="privacy-note">事件与关系脉络都只是对真实 evidence 的投影，不复制或改写事实。AI 结果必须带完整 provenance，且只有你确认后才保存。</p>
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
        <p class="event-summary">{{ eventSummaryText(selectedEvent) }}</p>
        <p v-if="eventAcceptedSummary(selectedEvent)" class="accepted-summary-note">✓ 这是你确认过的 AI 摘要；只有完整 evidence 仍一致时才会显示。</p>
        <section v-if="eventNote(selectedEvent)" class="event-note-card">
          <small>我的备注</small>
          <p>{{ eventNote(selectedEvent) }}</p>
        </section>
        <div class="detail-actions">
          <button type="button" @click="toggleEventStar(selectedEvent)">{{ selectedEvent.starred ? '取消收藏' : '收藏事件' }}</button>
          <button type="button" @click="editEventTitle(selectedEvent)">修改标题</button>
          <button type="button" @click="editEventNote(selectedEvent)">{{ eventNote(selectedEvent) ? '修改备注' : '写备注' }}</button>
          <button type="button" @click="bringEventBackToChat(selectedEvent)">带回聊天</button>
          <button v-if="selectedEvent.manual" type="button" class="danger" @click="splitEvent(selectedEvent)">拆分事件</button>
        </div>

        <section class="event-insight-card">
          <header><div><b>AI 事件摘要</b><small>必须原样引用这个事件的全部 evidence id</small></div><button type="button" :disabled="eventInsightBusy" @click="summarizeEventWithAi(selectedEvent)">{{ eventInsightBusy ? '整理中…' : '生成候选' }}</button></header>
          <p v-if="eventInsightMessage">{{ eventInsightMessage }}</p>
          <div v-if="eventInsightDraft && eventInsightDraft.eventId === selectedEvent.id" class="insight-draft">
            <b>{{ eventInsightDraft.title }}</b>
            <p>{{ eventInsightDraft.summary }}</p>
            <small>evidence: {{ eventInsightDraft.evidenceIds.join(' · ') }}</small>
            <div><button type="button" @click="acceptEventSummary(selectedEvent)">采用摘要</button><button type="button" @click="applyEventInsightTitle(selectedEvent)">采用标题</button></div>
          </div>
        </section>

        <div class="evidence-chain">
          <article v-for="(item, index) in selectedEvent.items" :key="item.id">
            <div class="chain-dot"></div>
            <header><b>{{ displayTitle(item) }}</b><small>{{ dateText(item.occurredAt) }} · {{ item.sourceLabel }}</small></header>
            <p>{{ item.summary }}</p>
            <div class="chain-actions">
              <button type="button" @click="openSource(item)">回到真实来源 →</button>
              <button type="button" :disabled="index === 0" @click="moveEventEvidence(selectedEvent, item.id, -1)">↑</button>
              <button type="button" :disabled="index === selectedEvent.items.length - 1" @click="moveEventEvidence(selectedEvent, item.id, 1)">↓</button>
            </div>
          </article>
        </div>

        <section v-if="selectedEventRelations(selectedEvent).length" class="relation-section">
          <header><b>相关时光</b><small>只按同角色、时间距离与来源类型建立关系，不生成新事实</small></header>
          <button v-for="row in selectedEventRelations(selectedEvent)" :key="row.event.id" type="button" @click="openRelatedEvent(row.event)">
            <span>{{ row.relation.label }}</span><b>{{ row.event.title }}</b><small>{{ eventDateText(row.event) }}</small>
          </button>
        </section>

        <section class="context-section">
          <header><b>聊天上下文</b><small>只读取真实来源消息前后各 1 条；不会写回记忆</small></header>
          <p v-if="eventContextLoading" class="context-empty">正在读取来源上下文…</p>
          <p v-else-if="!eventContexts.length" class="context-empty">这个事件没有可用的聊天消息上下文。</p>
          <article v-for="context in eventContexts" :key="context.sourceMessageId" class="context-window">
            <div v-for="message in context.messages" :key="message.id" class="context-line" :class="{ source: message.isSource }">
              <b>{{ contextSenderLabel(message.senderId, selectedEvent) }}</b><span>{{ message.text || `[${message.type}]` }}</span>
            </div>
          </article>
        </section>
      </section>
    </div>
  </PhoneFrame>
</template>

<style scoped>
.timeline-page{min-height:100%;padding:10px 14px 44px;background:linear-gradient(180deg,#f7f4f1,#f1f5f7 42%,#eef3f6);color:#2f4658}.hero-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 16px;border:1px solid rgba(81,75,68,.08);border-radius:21px;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(62,72,80,.05)}.hero-card small,.sheet-head small{color:#a27f73;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hero-card h2{margin:2px 0 6px;font-size:25px;letter-spacing:-.04em}.hero-card p{margin:0;max-width:275px;color:#86939b;font-size:10px;line-height:1.6}.hero-mark{width:50px;height:50px;display:grid;place-items:center;flex:0 0 auto;border-radius:17px;background:linear-gradient(145deg,#c99f91,#e7c8bd);color:#fff;font-size:25px;box-shadow:inset 0 1px 0 rgba(255,255,255,.72),0 9px 20px rgba(141,101,87,.18)}.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:10px 0}.stats-row article{display:grid;gap:2px;padding:10px 6px;border:1px solid rgba(70,86,97,.06);border-radius:14px;background:#fff;text-align:center}.stats-row b{color:#876d76;font-size:17px}.stats-row small{color:#91a0aa;font-size:8px}.control-card{display:grid;gap:8px;margin-bottom:12px;padding:10px;border:1px solid rgba(70,86,97,.07);border-radius:16px;background:#fff}.search-box{height:36px;display:flex;align-items:center;gap:7px;padding:0 9px;border:1px solid rgba(70,86,97,.08);border-radius:11px;background:#f6f8f9;color:#8a98a1}.search-box input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#536b79;font-size:10px}.search-box button{width:24px;height:24px;border:0;border-radius:8px;background:#e9eef1;color:#7d8c95}.view-switch{display:grid;grid-template-columns:repeat(3,1fr);padding:3px;border-radius:11px;background:#f1f4f5}.view-switch button{height:30px;border:0;border-radius:9px;background:transparent;color:#83919a;font-size:9px}.view-switch button.active{background:#fff;color:#8f6c62;box-shadow:0 2px 8px rgba(70,80,88,.08)}.filter-row,.time-filter-row,.action-row{display:flex;gap:6px;overflow-x:auto}.filter-row select,.filter-row button,.time-filter-row button,.time-filter-row span{min-height:30px;border:1px solid rgba(70,86,97,.08);border-radius:9px;background:#f5f7f8;color:#667985;font-size:8px;white-space:nowrap}.filter-row select{min-width:110px;padding:0 9px}.filter-row button,.time-filter-row button,.time-filter-row span{padding:0 9px}.filter-row button.active,.time-filter-row button.active{background:#efe7e4;color:#8b665c}.time-filter-row span{display:flex;align-items:center;margin-left:auto}.ai-button,.merge-button{min-height:36px;border:0;border-radius:11px;font-size:9px;font-weight:700}.ai-button{flex:1;background:linear-gradient(135deg,#8e716d,#b88b7e);color:#fff}.merge-button{padding:0 12px;background:#e9eef1;color:#607985}.merge-button.active{background:#efe3df;color:#906b61}.ai-button:disabled,.selection-bar button:disabled{opacity:.45}.selection-bar{display:flex;align-items:center;justify-content:space-between;padding:7px 8px;border-radius:10px;background:#f8f1ee;color:#8d746d;font-size:9px}.selection-bar button{border:0;border-radius:8px;padding:6px 9px;background:#a77b70;color:#fff;font-size:8px}.ai-message{margin:0;color:#8b7b78;font-size:9px;line-height:1.5}.timeline-groups{display:grid;gap:14px}.timeline-group{display:grid;gap:7px}.month-header{display:flex;align-items:center;justify-content:space-between;padding:0 4px;color:#71848f}.month-header b{font-size:11px}.month-header span{font-size:8px;color:#a0abb1}.event-list{display:grid;gap:10px}.event-card{padding:12px;border:1px solid rgba(65,81,92,.07);border-radius:18px;background:#fff;box-shadow:0 5px 16px rgba(64,79,90,.04)}.event-card.manual{border-color:rgba(176,126,112,.22)}.event-cover{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px;height:130px;margin:-4px -4px 10px;overflow:hidden;border-radius:13px;background:#eef2f4}.event-cover img{width:100%;height:130px;object-fit:cover}.event-head,.card-head{display:flex;justify-content:space-between;gap:8px}.person-line{min-width:0;display:flex;align-items:center;gap:8px}.person-line>div{min-width:0;display:grid;gap:2px}.person-line b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3f5260;font-size:13px}.person-line small{color:#9aa5ac;font-size:8px}.star-button{width:31px;height:31px;flex:0 0 auto;border:0;border-radius:10px;background:#f5f6f7;color:#a6afb5;font-size:18px}.star-button.on{background:#f7ecd8;color:#b58132}.summary,.event-summary{margin:10px 0 7px;color:#536b79;font-size:11px;line-height:1.7;white-space:pre-wrap}.evidence-row{display:flex;flex-wrap:wrap;gap:5px}.evidence-row span{padding:3px 6px;border-radius:999px;background:#eef2f4;color:#78909d;font-size:8px}.evidence-row .proposal-chip,.evidence-row .manual-chip{background:#f4e9e5;color:#a06f63}.card-actions{display:flex;gap:6px;margin-top:10px}.card-actions button{flex:1;min-height:31px;border:0;border-radius:9px;background:#f2f5f6;color:#6c7f8b;font-size:9px}.card-actions button:first-child{background:#eaf0f4;color:#507186}.timeline-list{position:relative;display:grid;gap:12px;padding-left:17px}.timeline-list::before{content:'';position:absolute;left:5px;top:14px;bottom:14px;width:1px;background:linear-gradient(#d8c0b7,#d8e1e6)}.memory-card{position:relative}.memory-card.selected .card-shell{outline:2px solid rgba(169,119,105,.26);background:#fffaf8}.select-dot{position:absolute;z-index:3;left:-22px;top:19px;width:22px;height:22px;border:1px solid #d6b8af;border-radius:50%;background:#fff;color:#9c7065;font-size:11px}.timeline-dot{position:absolute;left:-16px;top:23px;width:9px;height:9px;border:2px solid #f4f3f1;border-radius:50%;background:#b98a7d}.card-shell{padding:12px;border:1px solid rgba(65,81,92,.07);border-radius:17px;background:rgba(255,255,255,.96)}.memory-card.suggested .card-shell{border-color:rgba(176,126,112,.24)}.memory-card.hidden{opacity:.62}.media-preview{margin:10px 0 6px;border-radius:13px;overflow:hidden;background:#f1f4f5}.image-preview{max-height:190px}.image-preview img{display:block;width:100%;max-height:190px;object-fit:cover}.music-preview{display:flex;align-items:center;gap:10px;padding:10px 11px;background:linear-gradient(135deg,#eef0f8,#f5edf1);color:#6d7084}.music-preview>span{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#fff;font-size:20px}.music-preview>div{display:grid;gap:2px}.music-preview b{font-size:10px}.music-preview small{font-size:8px;color:#9696a3}.source-excerpt{margin:7px 0;padding:7px 9px;border-left:2px solid #d6c4bd;border-radius:0 9px 9px 0;background:#f7f5f3;color:#8b7e79;font-size:9px;line-height:1.5}.proposal-note{display:grid;gap:4px;margin-top:8px;padding:8px 9px;border-radius:11px;background:#fbf4f1;color:#826e69}.proposal-note b{font-size:9px}.proposal-note span{font-size:9px;line-height:1.45}.proposal-note button{justify-self:start;padding:5px 8px;border:0;border-radius:8px;background:#fff;color:#956d62;font-size:8px}.empty-card{display:grid;justify-items:center;gap:5px;padding:42px 18px;color:#8797a1;text-align:center}.empty-card div{width:47px;height:47px;display:grid;place-items:center;border-radius:16px;background:#eee8e5;color:#9a756c;font-size:20px}.empty-card b{color:#566c7a;font-size:13px}.empty-card p{margin:0;max-width:280px;font-size:10px;line-height:1.55}.privacy-note{margin:16px 5px 0;color:#9ca7ad;font-size:8px;line-height:1.6}.event-overlay{position:fixed;z-index:80;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(31,42,49,.34);backdrop-filter:blur(4px)}.event-sheet{width:min(100%,430px);max-height:82vh;overflow:auto;padding:16px 15px 28px;border-radius:24px 24px 0 0;background:#fbfbfa;box-shadow:0 -16px 40px rgba(30,40,46,.16)}.sheet-head{display:flex;justify-content:space-between;gap:12px}.sheet-head h3{margin:2px 0 3px;color:#435966;font-size:20px}.sheet-head p{margin:0;color:#98a3aa;font-size:8px}.sheet-head>button{width:34px;height:34px;border:0;border-radius:12px;background:#eef1f2;color:#75858e;font-size:20px}.detail-gallery{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;height:170px;margin:14px 0 8px;overflow:hidden;border-radius:16px;background:#edf1f2}.detail-gallery img{width:100%;height:170px;object-fit:cover}.detail-actions{display:flex;gap:6px;margin:10px 0}.detail-actions button{flex:1;min-height:32px;border:0;border-radius:9px;background:#eaf0f3;color:#5f7886;font-size:8px}.detail-actions .danger{background:#f7ece9;color:#a36c60}.evidence-chain{display:grid;gap:9px;margin-top:14px}.evidence-chain article{position:relative;padding:11px 11px 10px 17px;border-radius:13px;background:#fff;border:1px solid rgba(67,85,96,.07)}.chain-dot{position:absolute;left:7px;top:16px;width:5px;height:5px;border-radius:50%;background:#bd8d80}.evidence-chain header{display:grid;gap:2px}.evidence-chain b{color:#4a606d;font-size:10px}.evidence-chain small{color:#9aa5ab;font-size:8px}.evidence-chain p{margin:7px 0;color:#657985;font-size:9px;line-height:1.55}.evidence-chain button{padding:0;border:0;background:transparent;color:#7f6f6a;font-size:8px}

.evidence-row .insight-chip{background:#eaf2ee;color:#5d7c6c}.evidence-row .note-chip{background:#f0edf7;color:#776b91}.accepted-summary-note{margin:-2px 0 10px;color:#6d8879;font-size:8px;line-height:1.5}.event-note-card{margin:10px 0;padding:10px 11px;border-radius:12px;background:#f5f1f8;border:1px solid rgba(102,83,127,.08)}.event-note-card small{color:#8f7ca0;font-size:8px;font-weight:700}.event-note-card p{margin:5px 0 0;color:#5f576a;font-size:9px;line-height:1.6;white-space:pre-wrap}.detail-actions{flex-wrap:wrap}.detail-actions button{min-width:calc(50% - 3px)}.event-insight-card{display:grid;gap:8px;margin:12px 0;padding:11px;border:1px solid rgba(148,103,91,.1);border-radius:14px;background:#fff8f5}.event-insight-card>header{display:flex;align-items:center;justify-content:space-between;gap:10px}.event-insight-card>header>div{display:grid;gap:2px}.event-insight-card b{color:#6f574f;font-size:10px}.event-insight-card small{color:#a08f89;font-size:7px;line-height:1.4}.event-insight-card>header>button,.insight-draft button{border:0;border-radius:8px;background:#a97d70;color:#fff;font-size:8px;padding:7px 9px}.event-insight-card>header>button:disabled{opacity:.5}.event-insight-card>p{margin:0;color:#8f7a73;font-size:8px;line-height:1.5}.insight-draft{display:grid;gap:5px;padding:9px;border-radius:10px;background:#fff}.insight-draft p{margin:0;color:#5f6e76;font-size:9px;line-height:1.55}.insight-draft>div{display:flex;gap:6px}.insight-draft>div button:last-child{background:#e9edef;color:#647986}.chain-actions{display:flex;align-items:center;gap:8px}.chain-actions button:first-child{margin-right:auto}.chain-actions button:disabled{opacity:.3}.context-section{display:grid;gap:8px;margin-top:15px}.context-section>header{display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.context-section>header b{color:#536b79;font-size:11px}.context-section>header small{max-width:220px;color:#9aa5ab;font-size:7px;text-align:right;line-height:1.4}.context-empty{margin:0;padding:10px;border-radius:10px;background:#f3f5f6;color:#8d999f;font-size:8px}.context-window{display:grid;gap:4px;padding:8px;border-radius:12px;background:#f3f6f7}.context-line{display:grid;grid-template-columns:48px 1fr;gap:7px;padding:6px 7px;border-radius:8px;color:#697b85;font-size:8px;line-height:1.45}.context-line b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#829099;font-size:8px}.context-line.source{background:#fff;border:1px solid rgba(180,132,118,.14);color:#4f6672}.context-line.source b{color:#9a7065}

.anniversary-card,.relation-section{display:grid;gap:7px;margin:10px 0 12px;padding:10px;border:1px solid rgba(70,86,97,.07);border-radius:16px;background:#fff}.anniversary-card>header,.relation-section>header{display:flex;align-items:end;justify-content:space-between;gap:8px}.anniversary-card>header b,.relation-section>header b{color:#536b79;font-size:10px}.anniversary-card>header small,.relation-section>header small{color:#9aa5ab;font-size:7px}.anniversary-card>button,.relation-section>button{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;padding:8px;border:0;border-radius:10px;background:#f5f7f8;text-align:left}.anniversary-card>button span,.relation-section>button span{padding:3px 5px;border-radius:7px;background:#eee4df;color:#936d62;font-size:7px}.anniversary-card>button b,.relation-section>button b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#536b79;font-size:9px}.anniversary-card>button small,.relation-section>button small{color:#98a3aa;font-size:7px}.relation-section{margin-top:15px}

</style>
