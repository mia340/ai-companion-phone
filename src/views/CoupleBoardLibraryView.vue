<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { getActiveWorldId } from '../services/momentService'
import {
  COUPLE_BOARD_EVENT_CARDS,
  COUPLE_BOARD_PROMPTS,
  createCoupleBoardCustomEventCard,
  createCoupleBoardCustomPrompt,
  exportCoupleBoardLibrary,
  importCoupleBoardLibrary,
  loadCoupleBoardArchive,
  loadCoupleBoardPreferences,
  removeCoupleBoardArchiveEntry,
  saveCoupleBoardPreferences,
  updateCoupleBoardCustomEventCard,
  updateCoupleBoardCustomPrompt,
  type CoupleBoardArchive,
  type CoupleBoardEventCard,
  type CoupleBoardIntensity,
  type CoupleBoardMode,
  type CoupleBoardPreferences,
  type CoupleBoardPrompt,
  type CoupleBoardPromptType
} from '../services/coupleBoardGameService'

const router = useRouter()
const worldId = ref('world-default')
const loading = ref(true)
const tab = ref<'prompts' | 'events' | 'history'>('prompts')
const scope = ref<'mine' | 'system'>('mine')
const query = ref('')
const typeFilter = ref<'all' | CoupleBoardPromptType>('all')
const intensityFilter = ref<'all' | CoupleBoardIntensity>('all')
const notice = ref('')
const expandedArchiveId = ref('')
const importInput = ref<HTMLInputElement>()
let noticeTimer: number | undefined

const preferences = ref<CoupleBoardPreferences>({
  version: 2,
  customPrompts: [],
  customEventCards: [],
  disabledBuiltinPromptIds: [],
  disabledBuiltinEventCardIds: [],
  updatedAt: new Date(0).toISOString()
})
const archive = ref<CoupleBoardArchive>({ version: 1, entries: [], updatedAt: new Date(0).toISOString() })

const promptDraft = reactive<{
  type: CoupleBoardPromptType
  intensity: CoupleBoardIntensity
  mode: 'both' | CoupleBoardMode
  text: string
}>({ type: 'truth', intensity: 2, mode: 'both', text: '' })
const editingPromptId = ref('')

const eventDraft = reactive({
  title: '',
  text: '',
  emoji: '💌',
  heartDeltaActor: 1,
  heartDeltaOther: 1,
  swapPositions: false,
  extraTurn: false
})
const editingEventId = ref('')

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2600)
}

async function reload() {
  const [prefs, history] = await Promise.all([
    loadCoupleBoardPreferences(worldId.value),
    loadCoupleBoardArchive(worldId.value)
  ])
  preferences.value = prefs
  archive.value = history
}

async function persistPreferences(next: Partial<Pick<CoupleBoardPreferences,
  'customPrompts' | 'customEventCards' | 'disabledBuiltinPromptIds' | 'disabledBuiltinEventCardIds'>>) {
  preferences.value = await saveCoupleBoardPreferences(worldId.value, {
    customPrompts: next.customPrompts ?? preferences.value.customPrompts,
    customEventCards: next.customEventCards ?? preferences.value.customEventCards,
    disabledBuiltinPromptIds: next.disabledBuiltinPromptIds ?? preferences.value.disabledBuiltinPromptIds,
    disabledBuiltinEventCardIds: next.disabledBuiltinEventCardIds ?? preferences.value.disabledBuiltinEventCardIds
  })
}

function normalizedQuery() {
  return query.value.trim().toLocaleLowerCase('zh-CN')
}

function matchesPrompt(prompt: CoupleBoardPrompt) {
  const q = normalizedQuery()
  if (typeFilter.value !== 'all' && prompt.type !== typeFilter.value) return false
  if (intensityFilter.value !== 'all' && prompt.intensity !== intensityFilter.value) return false
  if (!q) return true
  return `${prompt.text} ${prompt.type} L${prompt.intensity}`.toLocaleLowerCase('zh-CN').includes(q)
}

const visibleCustomPrompts = computed(() => preferences.value.customPrompts.filter(matchesPrompt))
const visibleSystemPrompts = computed(() => COUPLE_BOARD_PROMPTS.filter(matchesPrompt))
const visibleCustomEvents = computed(() => {
  const q = normalizedQuery()
  return preferences.value.customEventCards.filter(card => !q || `${card.title} ${card.text}`.toLocaleLowerCase('zh-CN').includes(q))
})
const visibleSystemEvents = computed(() => {
  const q = normalizedQuery()
  return COUPLE_BOARD_EVENT_CARDS.filter(card => !q || `${card.title} ${card.text}`.toLocaleLowerCase('zh-CN').includes(q))
})
const enabledSystemPromptCount = computed(() => COUPLE_BOARD_PROMPTS.length - preferences.value.disabledBuiltinPromptIds.length)
const enabledSystemEventCount = computed(() => COUPLE_BOARD_EVENT_CARDS.length - preferences.value.disabledBuiltinEventCardIds.length)
const archiveTotals = computed(() => archive.value.entries.reduce((sum, row) => ({
  hearts: sum.hearts + row.totalHearts,
  completed: sum.completed + row.completed,
  evidence: sum.evidence + row.evidencePromptCount
}), { hearts: 0, completed: 0, evidence: 0 }))

function resetPromptDraft() {
  editingPromptId.value = ''
  promptDraft.type = 'truth'
  promptDraft.intensity = 2
  promptDraft.mode = 'both'
  promptDraft.text = ''
}

function editPrompt(prompt: CoupleBoardPrompt) {
  editingPromptId.value = prompt.id
  promptDraft.type = prompt.type
  promptDraft.intensity = prompt.intensity
  promptDraft.mode = prompt.modes.length === 2 ? 'both' : prompt.modes[0]
  promptDraft.text = prompt.text
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function savePrompt() {
  try {
    const modes: CoupleBoardMode[] = promptDraft.mode === 'both' ? ['chat', 'reality'] : [promptDraft.mode]
    const draft = { type: promptDraft.type, intensity: promptDraft.intensity, modes, text: promptDraft.text }
    let rows = [...preferences.value.customPrompts]
    if (editingPromptId.value) {
      const existing = rows.find(row => row.id === editingPromptId.value)
      if (!existing) throw new Error('要编辑的题目已经不存在。')
      rows = rows.map(row => row.id === existing.id ? updateCoupleBoardCustomPrompt(existing, draft) : row)
    } else {
      rows.push(createCoupleBoardCustomPrompt(draft))
    }
    const wasEditing = Boolean(editingPromptId.value)
    await persistPreferences({ customPrompts: rows })
    resetPromptDraft()
    showNotice(wasEditing ? '题目已更新。' : '题目已加入专属题库。')
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '保存题目失败。')
  }
}

async function removePrompt(promptId: string) {
  if (!window.confirm('删除这道自定义题？正在进行的棋局不会受影响。')) return
  await persistPreferences({ customPrompts: preferences.value.customPrompts.filter(row => row.id !== promptId) })
  if (editingPromptId.value === promptId) resetPromptDraft()
  showNotice('已删除；正在进行的棋局仍使用开局快照。')
}

async function toggleSystemPrompt(promptId: string) {
  const disabled = new Set(preferences.value.disabledBuiltinPromptIds)
  disabled.has(promptId) ? disabled.delete(promptId) : disabled.add(promptId)
  await persistPreferences({ disabledBuiltinPromptIds: [...disabled] })
}

function resetEventDraft() {
  editingEventId.value = ''
  eventDraft.title = ''
  eventDraft.text = ''
  eventDraft.emoji = '💌'
  eventDraft.heartDeltaActor = 1
  eventDraft.heartDeltaOther = 1
  eventDraft.swapPositions = false
  eventDraft.extraTurn = false
}

function editEvent(card: CoupleBoardEventCard) {
  editingEventId.value = card.id
  eventDraft.title = card.title
  eventDraft.text = card.text
  eventDraft.emoji = card.emoji
  eventDraft.heartDeltaActor = card.heartDeltaActor
  eventDraft.heartDeltaOther = card.heartDeltaOther
  eventDraft.swapPositions = Boolean(card.swapPositions)
  eventDraft.extraTurn = Boolean(card.extraTurn)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function saveEvent() {
  try {
    const draft = { ...eventDraft }
    let rows = [...preferences.value.customEventCards]
    if (editingEventId.value) {
      const existing = rows.find(row => row.id === editingEventId.value)
      if (!existing) throw new Error('要编辑的事件卡已经不存在。')
      rows = rows.map(row => row.id === existing.id ? updateCoupleBoardCustomEventCard(existing, draft) : row)
    } else {
      rows.push(createCoupleBoardCustomEventCard(draft))
    }
    await persistPreferences({ customEventCards: rows })
    resetEventDraft()
    showNotice('事件卡已保存。')
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '保存事件卡失败。')
  }
}

async function removeEvent(eventId: string) {
  if (!window.confirm('删除这张自定义事件卡？正在进行的棋局不会受影响。')) return
  await persistPreferences({ customEventCards: preferences.value.customEventCards.filter(row => row.id !== eventId) })
  if (editingEventId.value === eventId) resetEventDraft()
  showNotice('事件卡已删除。')
}

async function toggleSystemEvent(eventId: string) {
  const disabled = new Set(preferences.value.disabledBuiltinEventCardIds)
  disabled.has(eventId) ? disabled.delete(eventId) : disabled.add(eventId)
  await persistPreferences({ disabledBuiltinEventCardIds: [...disabled] })
}

function eventEffect(card: CoupleBoardEventCard) {
  const parts: string[] = []
  if (card.heartDeltaActor) parts.push(`当前 ${card.heartDeltaActor > 0 ? '+' : ''}${card.heartDeltaActor}♥`)
  if (card.heartDeltaOther) parts.push(`对方 ${card.heartDeltaOther > 0 ? '+' : ''}${card.heartDeltaOther}♥`)
  if (card.swapPositions) parts.push('交换位置')
  if (card.extraTurn) parts.push('再掷一次')
  return parts.join(' · ')
}

function exportLibrary() {
  const text = exportCoupleBoardLibrary(preferences.value)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `couple-board-library-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  showNotice('题库 JSON 已导出。')
}

function exportArchive() {
  const text = JSON.stringify({
    format: 'ai-companion-phone-couple-board-history',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: archive.value
  }, null, 2)
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `couple-board-history-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  showNotice('回忆册 JSON 已导出。')
}

async function importLibraryFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const imported = importCoupleBoardLibrary(await file.text())
    await persistPreferences(imported)
    showNotice(`导入完成：${imported.customPrompts.length} 道题、${imported.customEventCards.length} 张事件卡。`)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '导入失败。')
  }
}

async function deleteArchive(gameId: string) {
  if (!window.confirm('从回忆册删除这一局？不会影响聊天和记忆。')) return
  archive.value = await removeCoupleBoardArchiveEntry(worldId.value, gameId)
  showNotice('这一局已从回忆册移除。')
}

function formatDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

onMounted(async () => {
  try {
    worldId.value = await getActiveWorldId()
    await reload()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <PhoneFrame>
    <main class="library-shell">
      <header class="topbar">
        <button class="circle" @click="router.push('/app/心跳飞行棋')">‹</button>
        <div><small>COUPLE BOARD · V1.2</small><b>情侣内容中心</b></div>
        <button class="circle home" @click="router.push('/home')">⌂</button>
      </header>

      <section class="hero">
        <small>YOUR PRIVATE COUPLE SPACE</small>
        <h1>把只属于你们的<br><em>题、事件和回忆</em>放进来。</h1>
        <div class="hero-stats">
          <span><b>{{ preferences.customPrompts.length }}</b>专属题</span>
          <span><b>{{ preferences.customEventCards.length }}</b>事件卡</span>
          <span><b>{{ archive.entries.length }}</b>局回忆</span>
        </div>
      </section>

      <nav class="tabs">
        <button :class="{ active: tab === 'prompts' }" @click="tab = 'prompts'; scope = 'mine'">题库</button>
        <button :class="{ active: tab === 'events' }" @click="tab = 'events'; scope = 'mine'">事件卡</button>
        <button :class="{ active: tab === 'history' }" @click="tab = 'history'">回忆册</button>
      </nav>

      <section v-if="loading" class="loading">正在整理你们的内容…</section>

      <template v-else-if="tab === 'prompts'">
        <section class="editor-card">
          <header><div><small>{{ editingPromptId ? 'EDIT CARD' : 'NEW CARD' }}</small><b>{{ editingPromptId ? '编辑专属题' : '写一道只有你们懂的题' }}</b></div><button v-if="editingPromptId" @click="resetPromptDraft">取消编辑</button></header>
          <div class="segmented"><button :class="{ active: promptDraft.type === 'truth' }" @click="promptDraft.type = 'truth'">真心话</button><button :class="{ active: promptDraft.type === 'dare' }" @click="promptDraft.type = 'dare'">大冒险</button></div>
          <div class="field-grid">
            <label>强度<select v-model.number="promptDraft.intensity"><option :value="1">L1 纯爱</option><option :value="2">L2 暧昧</option><option :value="3">L3 亲密</option><option :value="4">L4 成人</option></select></label>
            <label>模式<select v-model="promptDraft.mode"><option value="both">聊天 + 面对面</option><option value="chat">仅聊天</option><option value="reality">仅面对面</option></select></label>
          </div>
          <textarea v-model="promptDraft.text" maxlength="160" placeholder="例如：说一个只有我们两个人懂的小梗，然后告诉对方为什么你一直记得。"></textarea>
          <button class="primary" :disabled="!promptDraft.text.trim()" @click="savePrompt">{{ editingPromptId ? '保存修改' : '＋ 加入专属题库' }}</button>
        </section>

        <section class="library-tools">
          <div class="scope-switch"><button :class="{ active: scope === 'mine' }" @click="scope = 'mine'">我的题 {{ preferences.customPrompts.length }}</button><button :class="{ active: scope === 'system' }" @click="scope = 'system'">系统题 {{ enabledSystemPromptCount }}/{{ COUPLE_BOARD_PROMPTS.length }}</button></div>
          <input v-model="query" placeholder="搜索题目…">
          <div class="filters"><select v-model="typeFilter"><option value="all">全部类型</option><option value="truth">真心话</option><option value="dare">大冒险</option></select><select v-model="intensityFilter"><option value="all">全部强度</option><option :value="1">L1</option><option :value="2">L2</option><option :value="3">L3</option><option :value="4">L4</option></select></div>
        </section>

        <section class="card-list" v-if="scope === 'mine'">
          <article v-for="prompt in visibleCustomPrompts" :key="prompt.id" class="content-card">
            <span class="kind" :class="prompt.type">{{ prompt.type === 'truth' ? '真心话' : '大冒险' }}</span>
            <div><small>L{{ prompt.intensity }} · {{ prompt.modes.length === 2 ? '双模式' : prompt.modes[0] === 'chat' ? '聊天' : '面对面' }}</small><p>{{ prompt.text }}</p></div>
            <div class="card-actions"><button @click="editPrompt(prompt)">✎</button><button @click="removePrompt(prompt.id)">×</button></div>
          </article>
          <div v-if="!visibleCustomPrompts.length" class="empty">还没有符合条件的专属题。与其一次塞很多，更推荐写几道只有你们懂的。</div>
        </section>

        <section class="card-list" v-else>
          <article v-for="prompt in visibleSystemPrompts" :key="prompt.id" class="content-card system" :class="{ disabled: preferences.disabledBuiltinPromptIds.includes(prompt.id) }">
            <span class="kind" :class="prompt.type">{{ prompt.type === 'truth' ? '真心话' : '大冒险' }}</span>
            <div><small>L{{ prompt.intensity }} · {{ prompt.modes.length === 2 ? '双模式' : prompt.modes.join(' / ') }}</small><p>{{ prompt.text }}</p></div>
            <button class="toggle" :aria-label="preferences.disabledBuiltinPromptIds.includes(prompt.id) ? '启用' : '停用'" @click="toggleSystemPrompt(prompt.id)"><i></i></button>
          </article>
        </section>
      </template>

      <template v-else-if="tab === 'events'">
        <section class="editor-card event-editor">
          <header><div><small>{{ editingEventId ? 'EDIT EVENT' : 'NEW EVENT' }}</small><b>{{ editingEventId ? '编辑专属事件卡' : '做一张情侣事件卡' }}</b></div><button v-if="editingEventId" @click="resetEventDraft">取消编辑</button></header>
          <div class="event-title-row"><input v-model="eventDraft.emoji" maxlength="4" aria-label="事件卡图标"><input v-model="eventDraft.title" maxlength="48" placeholder="事件卡标题"></div>
          <textarea v-model="eventDraft.text" maxlength="180" placeholder="写下抽到这张卡时要发生的事。不要把同意当作默认前提。"></textarea>
          <div class="field-grid"><label>当前玩家心动<select v-model.number="eventDraft.heartDeltaActor"><option v-for="n in 9" :key="n-4" :value="n-4">{{ n-4 > 0 ? '+' : '' }}{{ n-4 }}</option></select></label><label>对方心动<select v-model.number="eventDraft.heartDeltaOther"><option v-for="n in 9" :key="n-4" :value="n-4">{{ n-4 > 0 ? '+' : '' }}{{ n-4 }}</option></select></label></div>
          <div class="effect-checks"><label><input v-model="eventDraft.swapPositions" type="checkbox"><span>🔁 交换双方棋子位置</span></label><label><input v-model="eventDraft.extraTurn" type="checkbox"><span>🎲 当前玩家再掷一次</span></label></div>
          <button class="primary" :disabled="!eventDraft.title.trim() || !eventDraft.text.trim()" @click="saveEvent">{{ editingEventId ? '保存修改' : '＋ 加入事件牌组' }}</button>
        </section>

        <section class="library-tools">
          <div class="scope-switch"><button :class="{ active: scope === 'mine' }" @click="scope = 'mine'">我的事件 {{ preferences.customEventCards.length }}</button><button :class="{ active: scope === 'system' }" @click="scope = 'system'">系统事件 {{ enabledSystemEventCount }}/{{ COUPLE_BOARD_EVENT_CARDS.length }}</button></div>
          <input v-model="query" placeholder="搜索事件卡…">
        </section>

        <section class="card-list" v-if="scope === 'mine'">
          <article v-for="card in visibleCustomEvents" :key="card.id" class="event-card-row"><span>{{ card.emoji }}</span><div><small>{{ eventEffect(card) }}</small><b>{{ card.title }}</b><p>{{ card.text }}</p></div><div class="card-actions"><button @click="editEvent(card)">✎</button><button @click="removeEvent(card.id)">×</button></div></article>
          <div v-if="!visibleCustomEvents.length" class="empty">还没有专属事件卡。可以先做一张“双方 +1 心动”的轻松事件。</div>
        </section>
        <section class="card-list" v-else>
          <article v-for="card in visibleSystemEvents" :key="card.id" class="event-card-row system" :class="{ disabled: preferences.disabledBuiltinEventCardIds.includes(card.id) }"><span>{{ card.emoji }}</span><div><small>{{ eventEffect(card) }}</small><b>{{ card.title }}</b><p>{{ card.text }}</p></div><button class="toggle" @click="toggleSystemEvent(card.id)"><i></i></button></article>
        </section>
      </template>

      <template v-else>
        <section class="history-summary">
          <span><small>累计心动</small><b>{{ archiveTotals.hearts }} ♥</b></span><span><small>完成挑战</small><b>{{ archiveTotals.completed }}</b></span><span><small>证据题</small><b>{{ archiveTotals.evidence }}</b></span>
        </section>
        <section class="history-list">
          <article v-for="row in archive.entries" :key="row.id" class="history-card" :class="{ expanded: expandedArchiveId === row.id }">
            <button class="history-main" @click="expandedArchiveId = expandedArchiveId === row.id ? '' : row.id"><span class="history-heart">♥</span><div><small>{{ formatDate(row.finishedAt) }} · {{ row.mode === 'chat' ? '聊天' : '面对面' }} · L{{ row.intensity }}</small><b>和 {{ row.characterName }} 的一局</b><p>{{ row.totalHearts }} 点心动 · {{ row.completed }} 个完成 · {{ row.eventCount }} 张事件卡</p></div><i>{{ expandedArchiveId === row.id ? '⌃' : '⌄' }}</i></button>
            <div v-if="expandedArchiveId === row.id" class="history-detail">
              <div class="highlight-mini" v-for="item in row.highlights" :key="item.id"><span>{{ item.emoji }}</span><p><b>{{ item.title }}</b><small>{{ item.detail }}</small></p></div>
              <div class="history-meta"><span>回合节点 {{ row.turnCount }}</span><span>真实证据题 {{ row.evidencePromptCount }}</span><span>跳过 {{ row.skipped }}</span></div>
              <button class="danger" @click="deleteArchive(row.gameId)">从回忆册删除</button>
            </div>
          </article>
          <div v-if="!archive.entries.length" class="empty history-empty">完成一局心跳飞行棋后，这里会留下本局高光。回忆册不会自动写入角色记忆。</div>
        </section>
      </template>

      <footer class="library-footer">
        <button @click="exportLibrary">导出题库</button>
        <button @click="importInput?.click()">导入题库</button>
        <button @click="exportArchive">导出回忆册</button>
        <input ref="importInput" hidden type="file" accept="application/json,.json" @change="importLibraryFile">
        <small>题库导入只覆盖飞行棋题库/事件偏好；回忆册只提供导出备份。两者都不会修改角色、聊天、记忆或正在进行的棋局。</small>
      </footer>

      <transition name="toast"><div v-if="notice" class="toast">{{ notice }}</div></transition>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.library-shell{--ink:#4c2d39;--wine:#7d3152;--rose:#bd5a7d;min-height:100%;height:100%;overflow:auto;padding:9px 15px 30px;background:radial-gradient(100% 55% at 0 -5%,#ffe8ee,transparent 64%),radial-gradient(80% 45% at 105% 10%,#eee3fb,transparent 65%),linear-gradient(#fffaf8,#faeef2);color:var(--ink);scrollbar-width:none}.library-shell::-webkit-scrollbar{display:none}.topbar{display:grid;grid-template-columns:34px 1fr 34px;align-items:center;min-height:50px}.topbar>div{text-align:center;display:grid}.topbar small{font-size:5.5px;letter-spacing:.18em;color:#b97d93}.topbar b{font:600 11px Georgia,"Songti SC",serif}.circle{width:31px;height:31px;border:1px solid rgba(111,55,76,.08);border-radius:50%;background:rgba(255,255,255,.7);color:#764258;font-size:19px}.circle.home{font-size:13px}.hero{padding:20px;margin-top:7px;border:1px solid rgba(111,55,76,.07);border-radius:25px;background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,243,247,.8));box-shadow:0 18px 45px rgba(100,42,64,.09)}.hero>small{font-size:5.5px;letter-spacing:.2em;color:#ba7891}.hero h1{margin:7px 0 13px;font:500 25px/1.2 Georgia,"Songti SC",serif}.hero h1 em{font-style:italic;color:#a34769}.hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.hero-stats span{display:grid;padding:8px;border-radius:13px;background:#f7e9ee;color:#9a6679;font-size:6px}.hero-stats b{color:#73354f;font:600 16px Georgia,serif}.tabs{position:sticky;top:0;z-index:20;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:12px 0;padding:5px;border-radius:16px;background:rgba(255,249,249,.9);backdrop-filter:blur(13px);box-shadow:0 8px 25px rgba(83,36,54,.07)}.tabs button,.scope-switch button{border:0;border-radius:11px;background:transparent;color:#9b7483;padding:8px;font-size:7.5px;font-weight:800}.tabs button.active,.scope-switch button.active{background:#7d3152;color:#fff}.loading,.empty{padding:24px 14px;border:1px dashed #ddc1cc;border-radius:16px;color:#9d7d89;text-align:center;font-size:7.5px;line-height:1.6}.editor-card{padding:13px;border:1px solid rgba(111,55,76,.07);border-radius:20px;background:rgba(255,255,255,.82);box-shadow:0 12px 32px rgba(87,38,57,.06)}.editor-card>header{display:flex;justify-content:space-between;align-items:flex-start}.editor-card>header>div{display:grid}.editor-card header small{font-size:5.3px;letter-spacing:.16em;color:#b37a8f}.editor-card header b{font-size:10px;margin-top:2px}.editor-card header button{border:0;background:transparent;color:#a05e77;font-size:7px}.segmented,.scope-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;margin-top:10px;border-radius:12px;background:#f7ecef}.segmented button{border:0;border-radius:9px;background:transparent;padding:7px;color:#906477;font-size:7.5px}.segmented button.active{background:#fff;color:#7a3150;box-shadow:0 4px 13px rgba(92,40,59,.08);font-weight:800}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.field-grid label{display:grid;gap:3px;padding:7px 8px;border-radius:11px;background:#f8f1f3;color:#a07c89;font-size:5.8px}.field-grid select{border:0;background:transparent;color:#62404d;font-size:7.5px;outline:none}.editor-card textarea{width:100%;min-height:78px;box-sizing:border-box;resize:none;margin-top:7px;padding:10px;border:1px solid #ead5dd;border-radius:12px;background:#fff;color:#5e3948;font:8px/1.55 inherit;outline:none}.editor-card textarea:focus,.event-title-row input:focus,.library-tools>input:focus{border-color:#c688a0}.primary{width:100%;margin-top:7px;padding:9px;border:0;border-radius:11px;background:linear-gradient(135deg,#7d3152,#b34e72);color:#fff;font-size:8px;font-weight:900}.primary:disabled{opacity:.42}.library-tools{margin:11px 0 8px}.library-tools>input{width:100%;box-sizing:border-box;margin-top:7px;padding:9px 10px;border:1px solid #ead7de;border-radius:11px;background:rgba(255,255,255,.8);font-size:7.5px;outline:none}.filters{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.filters select{border:1px solid #ead7de;border-radius:10px;background:#fff;padding:7px;color:#745263;font-size:7px}.card-list{display:grid;gap:6px}.content-card{display:grid;grid-template-columns:auto 1fr auto;align-items:start;gap:8px;padding:9px;border:1px solid rgba(111,55,76,.07);border-radius:14px;background:rgba(255,255,255,.84)}.kind{padding:4px 5px;border-radius:7px;font-size:5.5px;font-weight:900}.kind.truth{background:#eee7f6;color:#765f87}.kind.dare{background:#f8e0e8;color:#9e4264}.content-card>div:nth-child(2){display:grid}.content-card small,.event-card-row small{font-size:5.8px;color:#ad8191}.content-card p,.event-card-row p{margin:3px 0 0;color:#674654;font-size:7.3px;line-height:1.45}.card-actions{display:flex;gap:3px}.card-actions button{width:23px;height:23px;border:0;border-radius:8px;background:#f5ebef;color:#915c71;font-size:8px}.system.disabled{opacity:.48}.toggle{position:relative;width:31px;height:18px;border:0;border-radius:999px;background:#d9c8ce;align-self:center}.toggle i{position:absolute;width:14px;height:14px;right:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.15)}.disabled .toggle{background:#e3d8dc}.disabled .toggle i{right:15px}.event-title-row{display:grid;grid-template-columns:52px 1fr;gap:6px;margin-top:10px}.event-title-row input{min-width:0;padding:9px;border:1px solid #ead5dd;border-radius:11px;background:#fff;color:#674654;font-size:8px;outline:none}.event-title-row input:first-child{text-align:center;font-size:18px}.effect-checks{display:grid;gap:5px;margin-top:7px}.effect-checks label{display:flex;align-items:center;gap:7px;padding:8px;border-radius:11px;background:#f8eff2;color:#74515f;font-size:7px}.event-card-row{display:grid;grid-template-columns:34px 1fr auto;gap:8px;align-items:start;padding:10px;border:1px solid rgba(111,55,76,.07);border-radius:14px;background:rgba(255,255,255,.84)}.event-card-row>span{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:#f5e5eb;font-size:18px}.event-card-row>div:nth-child(2){display:grid}.event-card-row b{font-size:8.5px;margin-top:1px}.history-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}.history-summary span{display:grid;padding:10px;border-radius:14px;background:rgba(255,255,255,.82);border:1px solid rgba(111,55,76,.06)}.history-summary small{font-size:5.7px;color:#a2808d}.history-summary b{margin-top:2px;font:600 14px Georgia,serif;color:#7b3652}.history-list{display:grid;gap:7px}.history-card{overflow:hidden;border:1px solid rgba(111,55,76,.07);border-radius:16px;background:rgba(255,255,255,.84)}.history-main{width:100%;display:grid;grid-template-columns:36px 1fr 16px;align-items:center;gap:8px;border:0;background:transparent;padding:10px;color:inherit;text-align:left}.history-heart{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(145deg,#f5dbe4,#eab6c8);color:#9e4264;font-size:16px}.history-main>div{display:grid}.history-main small{font-size:5.5px;color:#aa8291}.history-main b{font-size:8.5px;margin-top:2px}.history-main p{margin:2px 0 0;color:#8e6977;font-size:6.3px}.history-main i{font-style:normal;color:#a77c8d}.history-detail{padding:0 10px 11px;border-top:1px solid #f1e4e8}.highlight-mini{display:grid;grid-template-columns:24px 1fr;gap:6px;padding:8px 0;border-bottom:1px solid #f4e9ec}.highlight-mini>span{font-size:15px}.highlight-mini p{display:grid;margin:0}.highlight-mini b{font-size:7px}.highlight-mini small{margin-top:2px;color:#8e6e7a;font-size:6px;line-height:1.4}.history-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.history-meta span{padding:4px 6px;border-radius:999px;background:#f5e9ed;color:#96687a;font-size:5.7px}.danger{margin-top:8px;border:0;border-radius:9px;background:#f6e8ec;color:#a24968;padding:7px 9px;font-size:6.5px}.history-empty{margin-top:4px}.library-footer{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:18px;padding-top:12px;border-top:1px solid rgba(111,55,76,.08)}.library-footer button{border:1px solid #e1c8d1;border-radius:10px;background:rgba(255,255,255,.76);color:#845269;padding:8px;font-size:7px}.library-footer small{grid-column:1/-1;color:#a4828f;font-size:5.8px;line-height:1.5}.toast{position:fixed;z-index:90;left:50%;bottom:28px;transform:translateX(-50%);max-width:290px;padding:9px 13px;border-radius:999px;background:rgba(62,28,41,.94);color:#fff;font-size:7.5px;text-align:center;box-shadow:0 9px 26px rgba(62,28,41,.2)}.toast-enter-active,.toast-leave-active{transition:.2s}.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,8px)}
@media(max-width:370px){.library-shell{padding-left:11px;padding-right:11px}.hero h1{font-size:22px}.event-title-row{grid-template-columns:46px 1fr}.content-card{gap:6px;padding:8px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}.toast-enter-active,.toast-leave-active{transition:none}}
</style>
