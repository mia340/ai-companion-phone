<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import { generateCoupleBoardMemoryPrompt } from '../services/coupleBoardMemoryPromptService'
import {
  COUPLE_BOARD_CELLS,
  COUPLE_BOARD_PROMPTS,
  attachCoupleBoardGeneratedPrompt,
  archiveCoupleBoardGame,
  buildCoupleBoardChatShare,
  buildCoupleBoardHighlights,
  buildCoupleBoardResultChatShare,
  clearCoupleBoardGame,
  cloneCoupleBoardGame,
  coupleBoardChallengeFingerprint,
  createCoupleBoardGame,
  getCoupleBoardGameEventCard,
  getCoupleBoardGamePrompt,
  loadCoupleBoardArchive,
  loadCoupleBoardGame,
  loadCoupleBoardPreferences,
  mergeCoupleBoardResultShareIntoDraft,
  mergeCoupleBoardShareIntoDraft,
  renderCoupleBoardPrompt,
  replaceCoupleBoardPrompt,
  resolveCoupleBoardChallenge,
  resolveCoupleBoardEvent,
  rollCoupleBoard,
  saveCoupleBoardGame,
  validateCoupleBoardAdultMode,
  type CoupleBoardEventCard,
  type CoupleBoardGame,
  type CoupleBoardIntensity,
  type CoupleBoardMode,
  type CoupleBoardPlayerId,
  type CoupleBoardPrompt,
  type CoupleBoardSettings
} from '../services/coupleBoardGameService'
import type { Character, Conversation } from '../types/domain'

const router = useRouter()
const worldId = ref('world-default')
const characters = ref<Character[]>([])
const selectedCharacterId = ref('')
const intensity = ref<CoupleBoardIntensity>(2)
const mode = ref<CoupleBoardMode>('chat')
const adultConfirmed = ref(false)
const game = ref<CoupleBoardGame>()
const savedGame = ref<CoupleBoardGame>()
const customPrompts = ref<CoupleBoardPrompt[]>([])
const customEventCards = ref<CoupleBoardEventCard[]>([])
const disabledBuiltinPromptIds = ref<string[]>([])
const disabledBuiltinEventCardIds = ref<string[]>([])
const archiveCount = ref(0)
const screen = ref<'setup' | 'game'>('setup')
const loading = ref(true)
const characterRow = ref<HTMLElement>()
const startLaunching = ref(false)
const diceRolling = ref(false)
const diceResolving = ref(false)
const diceFace = ref(1)
const memoryGenerating = ref(false)
const movingPlayer = ref<CoupleBoardPlayerId>()
const landingIndex = ref<number>()
const notice = ref('')
let diceTimer: number | undefined
let noticeTimer: number | undefined
let moveTimer: number | undefined

const INTENSITIES: Array<{ value: CoupleBoardIntensity; title: string; subtitle: string; badge?: string }> = [
  { value: 1, title: '纯爱', subtitle: '甜甜地了解彼此' },
  { value: 2, title: '暧昧', subtitle: '多一点心跳和靠近' },
  { value: 3, title: '亲密', subtitle: '边界、偏好与亲密感' },
  { value: 4, title: '成人', subtitle: '成年人限定 · 同意优先', badge: '18+' }
]

const selectedCharacter = computed(() => characters.value.find(row => row.id === selectedCharacterId.value))
const currentPlayer = computed(() => game.value ? game.value.players[game.value.currentPlayer] : undefined)
const pendingPrompt = computed(() => game.value?.pending ? getCoupleBoardGamePrompt(game.value, game.value.pending.promptId) : undefined)
const pendingEventCard = computed(() => game.value?.pendingEvent ? getCoupleBoardGameEventCard(game.value, game.value.pendingEvent.eventCardId) : undefined)
const pendingText = computed(() => {
  if (!game.value?.pending || !pendingPrompt.value) return ''
  const actor = game.value.players[game.value.pending.actor]
  const counterpart = game.value.pending.actor === 'partner' ? '我' : game.value.settings.characterName
  return renderCoupleBoardPrompt(pendingPrompt.value, actor.name, counterpart)
})
const pendingActorName = computed(() => {
  if (game.value?.pending) return game.value.players[game.value.pending.actor].name
  if (game.value?.pendingEvent) return game.value.players[game.value.pendingEvent.actor].name
  return ''
})
const winnerName = computed(() => game.value?.winner ? game.value.players[game.value.winner].name : '')
const selectedModeLabel = computed(() => mode.value === 'chat' ? '聊天互动' : '面对面')
const selectedIntensity = computed(() => INTENSITIES.find(row => row.value === intensity.value)!)
const partnerKnownMinor = computed(() => {
  const age = selectedCharacter.value?.age
  return typeof age === 'number' && age < 18
})
const diceGlyph = computed(() => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.max(1, Math.min(6, diceFace.value)) - 1])
const lastLog = computed(() => game.value?.history.at(-1))
const highlights = computed(() => game.value?.status === 'finished' ? buildCoupleBoardHighlights(game.value) : [])
const customAvailableCount = computed(() => customPrompts.value.filter(prompt =>
  prompt.intensity <= intensity.value && prompt.modes.includes(mode.value) && (!prompt.adultOnly || intensity.value === 4)
).length)
const builtinAvailableCount = computed(() => {
  const disabled = new Set(disabledBuiltinPromptIds.value)
  return COUPLE_BOARD_PROMPTS.filter(prompt =>
    !disabled.has(prompt.id) && prompt.intensity <= intensity.value && prompt.modes.includes(mode.value) && (!prompt.adultOnly || intensity.value === 4)
  ).length
})
const pendingSourceLabel = computed(() => {
  if (pendingPrompt.value?.source === 'memory-ai') return 'OUR MEMORY'
  if (pendingPrompt.value?.source === 'custom') return 'YOUR DECK'
  return 'BUILT-IN'
})
const turnHint = computed(() => {
  if (!game.value) return ''
  if (game.value.pending) return `轮到 ${pendingActorName.value} 完成这一格`
  if (game.value.pendingEvent) return `${pendingActorName.value} 抽到一张情侣事件卡`
  if (game.value.status === 'finished') return `${winnerName.value} 抵达终点`
  return `第 ${game.value.turn} 回合 · ${currentPlayer.value?.name || ''} 掷骰子`
})

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 3000)
}

function boardCellStyle(index: number) {
  const cols = 5
  const rowFromBottom = Math.floor(index / cols)
  const offset = index % cols
  const col = rowFromBottom % 2 === 0 ? offset + 1 : cols - offset
  return { gridColumn: col, gridRow: 6 - rowFromBottom }
}

function playerOnCell(player: CoupleBoardPlayerId, index: number) {
  return game.value?.players[player].position === index
}

function scrollCharacterRow(direction: 'prev' | 'next') {
  const row = characterRow.value
  if (!row) return
  const amount = Math.max(122, Math.round(row.clientWidth * 0.78))
  row.scrollBy({ left: direction === 'next' ? amount : -amount, behavior: 'smooth' })
}

function wheelCharacterRow(event: WheelEvent) {
  const row = characterRow.value
  if (!row || row.scrollWidth <= row.clientWidth) return
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (!delta) return
  row.scrollLeft += delta
  if (event.cancelable) event.preventDefault()
}

function chooseCharacter(characterId: string) {
  // Keep the actual selection synchronous so a tap can never be lost to scroll helpers.
  selectedCharacterId.value = characterId

  // Scrolling is only progressive enhancement. Avoid CSS.escape because older WebViews
  // may not implement it; selection itself must still work everywhere.
  window.requestAnimationFrame(() => {
    const row = characterRow.value
    if (!row) return
    const selected = Array.from(row.querySelectorAll<HTMLElement>('[data-character-id]'))
      .find(element => element.dataset.characterId === characterId)
    try {
      selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    } catch {
      // Some embedded browsers have incomplete scrollIntoView option support.
      if (selected) row.scrollLeft = Math.max(0, selected.offsetLeft - 8)
    }
  })
}

function buildSettings(character: Character): CoupleBoardSettings {
  return {
    characterId: character.id,
    characterName: character.name,
    characterAvatar: character.avatar,
    characterAge: character.age,
    intensity: intensity.value,
    mode: mode.value,
    adultConfirmed: adultConfirmed.value
  }
}

function chooseIntensity(value: CoupleBoardIntensity) {
  intensity.value = value
  if (value !== 4) adultConfirmed.value = false
}

async function startGame() {
  if (startLaunching.value) return
  const character = selectedCharacter.value
  if (!character) return showNotice('先选择一位搭档。')
  const settings = buildSettings(character)
  const adultError = validateCoupleBoardAdultMode(settings)
  if (adultError) return showNotice(adultError)

  startLaunching.value = true
  try {
    const next = createCoupleBoardGame(settings, new Date(), customPrompts.value, {
      customEventCards: customEventCards.value,
      disabledBuiltinPromptIds: disabledBuiltinPromptIds.value,
      disabledBuiltinEventCardIds: disabledBuiltinEventCardIds.value
    })
    // Persist first. If IndexedDB fails, keep the user on setup instead of showing a
    // half-started game that cannot be resumed after refresh.
    await saveCoupleBoardGame(worldId.value, next)
    game.value = next
    savedGame.value = next
    screen.value = 'game'
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '开局失败，请再试一次。')
  } finally {
    startLaunching.value = false
  }
}

function resumeGame() {
  if (!savedGame.value) return
  try {
    const next = cloneCoupleBoardGame(savedGame.value)
    game.value = next
    selectedCharacterId.value = next.settings.characterId
    intensity.value = next.settings.intensity
    mode.value = next.settings.mode
    adultConfirmed.value = next.settings.adultConfirmed
    screen.value = 'game'
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '恢复上一局失败，请重新开一局。')
  }
}

async function persist(next: CoupleBoardGame) {
  game.value = next
  savedGame.value = next
  await saveCoupleBoardGame(worldId.value, next)
  if (next.status === 'finished') {
    const archive = await archiveCoupleBoardGame(worldId.value, next)
    archiveCount.value = archive.entries.length
  }
}

function animateLanding(actor: CoupleBoardPlayerId, index: number) {
  movingPlayer.value = actor
  landingIndex.value = index
  if (moveTimer) window.clearTimeout(moveTimer)
  moveTimer = window.setTimeout(() => {
    movingPlayer.value = undefined
    landingIndex.value = undefined
  }, 760)
}

async function rollDice() {
  if (!game.value || game.value.pending || game.value.pendingEvent || game.value.status !== 'playing' || diceRolling.value || diceResolving.value) return
  const actor = game.value.currentPlayer
  diceRolling.value = true
  diceResolving.value = true
  try {
    for (let tick = 0; tick < 8; tick += 1) {
      diceFace.value = 1 + Math.floor(Math.random() * 6)
      await new Promise<void>(resolve => {
        diceTimer = window.setTimeout(resolve, 58)
      })
    }

    const finalDice = 1 + Math.floor(Math.random() * 6)
    diceFace.value = finalDice
    // Stop the visual spin before IndexedDB/archive work. A slow save must never look like an endless die.
    diceRolling.value = false

    const source = game.value
    if (!source) return
    const next = rollCoupleBoard(source, finalDice, Math.random())
    await persist(next)
    animateLanding(actor, next.players[actor].position)
    if ('vibrate' in navigator) navigator.vibrate?.(35)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '掷骰子失败，请再试一次。')
  } finally {
    diceRolling.value = false
    diceResolving.value = false
  }
}

async function completeChallenge() {
  if (!game.value?.pending) return
  await persist(resolveCoupleBoardChallenge(game.value, 'completed'))
  showNotice('完成！心动值 +2')
  if ('vibrate' in navigator) navigator.vibrate?.([25, 35, 25])
}

async function skipChallenge() {
  if (!game.value?.pending) return
  await persist(resolveCoupleBoardChallenge(game.value, 'skipped'))
  showNotice('已跳过。任何题目都不需要勉强。')
}

async function replaceChallenge() {
  if (!game.value?.pending) return
  await persist(replaceCoupleBoardPrompt(game.value, Math.random()))
  showNotice('换了一题，不扣分。')
}

function eventEffectSummary(card: CoupleBoardEventCard) {
  const parts: string[] = []
  if (card.heartDeltaActor) parts.push(`当前玩家 ${card.heartDeltaActor > 0 ? '+' : ''}${card.heartDeltaActor} ♥`)
  if (card.heartDeltaOther) parts.push(`对方 ${card.heartDeltaOther > 0 ? '+' : ''}${card.heartDeltaOther} ♥`)
  if (card.swapPositions) parts.push('交换棋子位置')
  if (card.extraTurn) parts.push('当前玩家再掷一次')
  return parts.join(' · ') || '这一张只留下一点氛围'
}

async function acceptEventCard() {
  if (!game.value?.pendingEvent || !pendingEventCard.value) return
  const summary = eventEffectSummary(pendingEventCard.value)
  await persist(resolveCoupleBoardEvent(game.value))
  showNotice(`事件卡生效 · ${summary}`)
  if ('vibrate' in navigator) navigator.vibrate?.([18, 24, 18])
}

function latestConversation(characterId: string, rows: Conversation[]) {
  return rows
    .filter(row => row.type === 'single' && row.memberIds.includes(characterId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

async function currentConversation() {
  if (!game.value) return undefined
  const rows = await db.conversations.where('worldId').equals(worldId.value).toArray()
  return latestConversation(game.value.settings.characterId, rows)
}

async function generateMemoryChallenge() {
  if (!game.value?.pending || !selectedCharacter.value || memoryGenerating.value) return
  const sourceGame = cloneCoupleBoardGame(game.value)
  const challengeFingerprint = coupleBoardChallengeFingerprint(sourceGame)
  memoryGenerating.value = true
  try {
    const conversation = await currentConversation()
    if (!conversation) return showNotice('还没有和这位搭档的单聊，暂时没有真实聊天记忆可用。')
    const result = await generateCoupleBoardMemoryPrompt({
      game: sourceGame,
      character: selectedCharacter.value,
      conversationId: conversation.id,
      worldId: worldId.value
    })
    if (!game.value?.pending || coupleBoardChallengeFingerprint(game.value) !== challengeFingerprint) {
      showNotice('当前题目已经变化，刚才生成的回忆题已安全丢弃。')
      return
    }
    await persist(attachCoupleBoardGeneratedPrompt(game.value, result.prompt))
    showNotice(`已用 ${result.evidence.length} 条真实记忆出题 · ${result.model}`)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '回忆出题失败，请再试一次。')
  } finally {
    memoryGenerating.value = false
  }
}

async function bringChallengeToChat() {
  if (!game.value?.pending) return
  const conversation = await currentConversation()
  if (!conversation) return showNotice('还没有和这位搭档的单聊，先去知间聊几句吧。')
  const share = buildCoupleBoardChatShare(game.value, conversation.id)
  if (!share) return
  const key = `ai-companion-draft:${share.conversationId}`
  const existing = localStorage.getItem(key) || ''
  localStorage.setItem(key, mergeCoupleBoardShareIntoDraft(existing, share))
  await router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
}

async function bringResultToChat() {
  if (!game.value || game.value.status !== 'finished') return
  const conversation = await currentConversation()
  if (!conversation) return showNotice('还没有和这位搭档的单聊，暂时不能带结算去聊天。')
  const share = buildCoupleBoardResultChatShare(game.value, conversation.id)
  if (!share) return
  const key = `ai-companion-draft:${share.conversationId}`
  const existing = localStorage.getItem(key) || ''
  localStorage.setItem(key, mergeCoupleBoardResultShareIntoDraft(existing, share))
  await router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
}

async function abandonGame() {
  if (game.value?.status === 'playing' && !window.confirm('结束这一局并回到设置？当前进度会被清空。')) return
  await clearCoupleBoardGame(worldId.value)
  game.value = undefined
  savedGame.value = undefined
  screen.value = 'setup'
}

function goSetupKeepingGame() {
  screen.value = 'setup'
}

async function rematch() {
  if (!game.value) return
  const next = createCoupleBoardGame(game.value.settings, new Date(), customPrompts.value, {
    customEventCards: customEventCards.value,
    disabledBuiltinPromptIds: disabledBuiltinPromptIds.value,
    disabledBuiltinEventCardIds: disabledBuiltinEventCardIds.value
  })
  await persist(next)
  screen.value = 'game'
}

function lastEventLabel() {
  const log = lastLog.value
  if (!log || !game.value) return '骰子会决定下一次心跳落在哪里。'
  const actor = game.value.players[log.actor].name
  const cell = COUPLE_BOARD_CELLS[log.to]
  if (game.value.status === 'finished' && game.value.winner === log.actor) return `${actor} 抵达终点，拿到最后 3 点心动值。`
  if (log.eventCardId) return `${actor} 抽到情侣事件卡「${getCoupleBoardGameEventCard(game.value, log.eventCardId)?.title || '心跳事件'}」。`
  if (cell.type === 'heart') return `${actor} 落在心动格，自动 +1。`
  if (cell.type === 'rest') return `${actor} 落在休息格，这一回合轻轻放过。`
  return `${actor} 掷出 ${log.dice}，来到「${cell.label}」。`
}

onMounted(async () => {
  loading.value = true
  try {
    worldId.value = await getActiveWorldId()
    const [characterRows, stored, preferences, archive] = await Promise.all([
      db.characters.where('worldId').equals(worldId.value).toArray(),
      loadCoupleBoardGame(worldId.value),
      loadCoupleBoardPreferences(worldId.value),
      loadCoupleBoardArchive(worldId.value)
    ])
    characters.value = characterRows.length ? characterRows : await db.characters.toArray()
    customPrompts.value = preferences.customPrompts
    customEventCards.value = preferences.customEventCards
    disabledBuiltinPromptIds.value = preferences.disabledBuiltinPromptIds
    disabledBuiltinEventCardIds.value = preferences.disabledBuiltinEventCardIds
    archiveCount.value = archive.entries.length
    const firstAdult = characters.value.find(row => typeof row.age !== 'number' || row.age >= 18)
    selectedCharacterId.value = stored?.settings.characterId || firstAdult?.id || characters.value[0]?.id || ''
    savedGame.value = stored
    if (stored?.status === 'finished') {
      game.value = stored
      const archived = await archiveCoupleBoardGame(worldId.value, stored)
      archiveCount.value = archived.entries.length
    }
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (diceTimer) window.clearTimeout(diceTimer)
  if (noticeTimer) window.clearTimeout(noticeTimer)
  if (moveTimer) window.clearTimeout(moveTimer)
})
</script>

<template>
  <PhoneFrame>
    <main class="love-game-shell" :class="{ 'is-game': screen === 'game' }">
      <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div>
      <div class="spark spark-1">✦</div><div class="spark spark-2">♡</div><div class="spark spark-3">✧</div>

      <header class="topbar">
        <button class="round-btn" aria-label="返回" @click="screen === 'game' ? goSetupKeepingGame() : router.push('/home')">‹</button>
        <div class="brand-lockup"><small>COUPLE BOARD · V1.2.2</small><b>心跳飞行棋</b></div>
        <button class="round-btn ghost" aria-label="回到主屏幕" @click="router.push('/home')">⌂</button>
      </header>

      <section v-if="loading" class="loading-card"><span class="loading-heart">♥</span><p>正在把棋盘铺好…</p></section>

      <template v-else-if="screen === 'setup'">
        <section class="hero-card">
          <div class="hero-orbit"><div class="hero-dice">♥<span>⚄</span></div></div>
          <div><span class="eyebrow">TRUTH · DARE · OUR MEMORY</span><h1>今晚，<br><em>让骰子替你开口。</em></h1><p>真心话、大冒险、情侣事件卡，还有只从你们真实共同回忆里长出来的题。</p></div>
          <div class="hero-tags"><span>随时跳过</span><span>真实记忆出题</span><span>本地保存</span></div>
        </section>

        <section v-if="savedGame?.status === 'playing'" class="resume-card">
          <div class="resume-avatars"><span>我</span><span class="heart-link">♥</span><CharacterAvatar :avatar="characters.find(row => row.id === savedGame?.settings.characterId)?.avatar || savedGame?.settings.characterAvatar" :name="savedGame?.settings.characterName" :size="36" /></div>
          <div><small>上一局还没结束</small><b>和 {{ savedGame.settings.characterName }} · 第 {{ savedGame.turn }} 回合</b></div>
          <button @click="resumeGame">继续</button>
        </section>

        <section class="setup-section">
          <header class="partner-picker-head"><span>01</span><div><b>选你的搭档</b><small>{{ characters.length > 3 ? `${characters.length} 位可选 · 左右滑动、滚轮或箭头查看更多` : '这一局只属于你们两个' }}</small></div><nav v-if="characters.length > 3" class="character-nav" aria-label="浏览搭档"><button type="button" aria-label="上一组搭档" @click="scrollCharacterRow('prev')">‹</button><button type="button" aria-label="下一组搭档" @click="scrollCharacterRow('next')">›</button></nav></header>
          <div v-if="characters.length" ref="characterRow" class="character-row" @wheel="wheelCharacterRow">
            <button v-for="character in characters" :key="character.id" type="button" class="character-chip" :data-character-id="character.id" :aria-pressed="selectedCharacterId === character.id" :class="{ selected: selectedCharacterId === character.id }" @click="chooseCharacter(character.id)">
              <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="42" /><span><b>{{ character.name }}</b><small>{{ character.age ? `${character.age} 岁` : '年龄未设置' }}</small></span><i>✓</i>
            </button>
          </div>
          <button v-else class="empty-button" @click="router.push('/characters/new')">还没有角色 · 去创建一个搭档</button>
        </section>

        <section class="setup-section">
          <header><span>02</span><div><b>怎么玩</b><small>聊天里玩，或者两个人面对面</small></div></header>
          <div class="mode-grid">
            <button :class="{ selected: mode === 'chat' }" @click="mode = 'chat'"><i>💌</i><b>聊天互动</b><small>题目可带回知间；不会自动发送</small></button>
            <button :class="{ selected: mode === 'reality' }" @click="mode = 'reality'"><i>🥂</i><b>面对面</b><small>现实互动始终由参与者自己同意</small></button>
          </div>
        </section>

        <section class="setup-section intensity-section">
          <header><span>03</span><div><b>心跳浓度</b><small>高等级会混入低等级题目，不会突然跳档</small></div></header>
          <div class="intensity-grid">
            <button v-for="level in INTENSITIES" :key="level.value" :class="{ selected: intensity === level.value, adult: level.value === 4 }" @click="chooseIntensity(level.value)">
              <span class="level-number">0{{ level.value }}</span><span><b>{{ level.title }}</b><small>{{ level.subtitle }}</small></span><em v-if="level.badge">{{ level.badge }}</em>
            </button>
          </div>
          <label v-if="intensity === 4" class="adult-confirm" :class="{ blocked: partnerKnownMinor }">
            <input v-model="adultConfirmed" type="checkbox" :disabled="partnerKnownMinor"><span class="checkmark">✓</span>
            <span><b>{{ partnerKnownMinor ? '该角色年龄明确小于 18 岁，无法开启成人模式' : '确认双方均为成年人，并同意成人向题目' }}</b><small>成人档仍以同意、边界和随时退出为前提，不会替任何一方默认同意。</small></span>
          </label>
        </section>

        <section class="setup-section deck-section">
          <header><span>04</span><div><b>情侣内容中心</b><small>题库、事件卡和对局回忆都在这里管理</small></div></header>
          <button class="deck-card" @click="router.push('/app/心跳飞行棋/library')">
            <span class="deck-icon">✦</span><span><b>{{ COUPLE_BOARD_PROMPTS.length - disabledBuiltinPromptIds.length }} 道内置题 · {{ customPrompts.length }} 道专属题</b><small>当前设置可抽 {{ builtinAvailableCount + customAvailableCount }} 道题 · {{ customEventCards.length }} 张专属事件 · {{ archiveCount }} 局回忆</small></span><i>›</i>
          </button>
        </section>

        <section class="ready-card"><div><small>READY TO PLAY</small><b>{{ selectedCharacter?.name || '选择搭档' }} · {{ selectedModeLabel }} · {{ selectedIntensity.title }}</b></div><button :disabled="!selectedCharacter || startLaunching" @click="startGame"><span>{{ startLaunching ? '正在开局…' : '开始这一局' }}</span><i>→</i></button></section>
      </template>

      <template v-else-if="game">
        <section class="game-head">
          <div class="player-card" :class="{ active: game.currentPlayer === 'user' && !game.pending && !game.pendingEvent }"><div class="avatar user-avatar">我</div><div><small>YOU</small><b>我</b><span>♥ {{ game.players.user.hearts }}</span></div><em>第 {{ game.players.user.position }} 格</em></div>
          <div class="versus"><span>♥</span><small>TURN {{ game.turn }}</small></div>
          <div class="player-card partner" :class="{ active: game.currentPlayer === 'partner' && !game.pending && !game.pendingEvent }"><CharacterAvatar :avatar="selectedCharacter?.avatar || game.settings.characterAvatar" :name="selectedCharacter?.name || game.settings.characterName" :size="42" /><div><small>PARTNER</small><b>{{ game.players.partner.name }}</b><span>♥ {{ game.players.partner.hearts }}</span></div><em>第 {{ game.players.partner.position }} 格</em></div>
        </section>

        <section class="board-card">
          <div class="board-topline"><div><small>{{ turnHint }}</small><b>{{ lastEventLabel() }}</b></div><span>{{ game.settings.mode === 'chat' ? '💌 聊天' : '🥂 面对面' }} · {{ INTENSITIES.find(row => row.value === game?.settings.intensity)?.title }}</span></div>
          <div class="board-grid">
            <div class="board-ribbon ribbon-one"></div><div class="board-ribbon ribbon-two"></div>
            <div v-for="cell in COUPLE_BOARD_CELLS" :key="cell.index" class="board-cell" :class="[`cell-${cell.type}`, { occupied: playerOnCell('user', cell.index) || playerOnCell('partner', cell.index), landing: landingIndex === cell.index }]" :style="boardCellStyle(cell.index)">
              <small>{{ cell.index === 0 ? 'S' : cell.index === 29 ? '♥' : cell.index }}</small><span>{{ cell.emoji }}</span><b>{{ cell.label }}</b>
              <div class="tokens"><i v-if="playerOnCell('user', cell.index)" class="token token-user" :class="{ moving: movingPlayer === 'user' }">我</i><i v-if="playerOnCell('partner', cell.index)" class="token token-partner" :class="{ moving: movingPlayer === 'partner' }">{{ game.settings.characterAvatar || '♥' }}</i></div>
            </div>
          </div>
        </section>

        <section v-if="game.status === 'playing'" class="dice-dock"><div><small>{{ game.pending ? 'CHALLENGE ACTIVE' : game.pendingEvent ? 'EVENT ACTIVE' : diceResolving ? 'SAVING TURN' : 'ROLL THE DICE' }}</small><b>{{ game.pending || game.pendingEvent ? `${pendingActorName} 还有一张卡没处理` : diceResolving ? '正在结算这一掷…' : `轮到 ${currentPlayer?.name}` }}</b></div><button class="dice-button" :class="{ rolling: diceRolling }" :disabled="Boolean(game.pending || game.pendingEvent) || diceRolling || diceResolving" @click="rollDice"><span>{{ diceGlyph }}</span><small>{{ diceRolling ? '...' : diceResolving ? '存' : '掷' }}</small></button></section>

        <section v-else class="finish-card">
          <small>HEARTBEAT HIGHLIGHTS</small><h2>{{ winnerName }} 先到终点 ♡</h2><p>输赢留在棋盘上，真正值得带走的是这一局里被说出口、被尊重、被记住的瞬间。</p>
          <div class="highlight-stack"><article v-for="item in highlights" :key="item.id" class="highlight-card"><span>{{ item.emoji }}</span><div><small>{{ item.eyebrow }}</small><b>{{ item.title }}</b><p>{{ item.detail }}</p></div></article></div>
          <div class="finish-actions"><button @click="rematch">再来一局</button><button v-if="game.settings.mode === 'chat'" class="secondary" @click="bringResultToChat">💌 分享结算</button><button class="secondary" @click="abandonGame">回到设置</button></div>
        </section>

        <transition name="card-pop">
          <div v-if="game.pending && pendingPrompt" class="challenge-backdrop">
            <section class="challenge-sheet">
              <div class="sheet-handle"></div>
              <header><span :class="pendingPrompt.type">{{ pendingPrompt.type === 'truth' ? 'TRUTH' : 'DARE' }}</span><div><small>{{ pendingSourceLabel }} · {{ pendingActorName }} · 第 {{ game.pending.cellIndex }} 格</small><b>{{ pendingPrompt.type === 'truth' ? '真心话' : '大冒险' }}</b></div><em>♥ +2</em></header>
              <p class="challenge-text">{{ pendingText }}</p>
              <div v-if="pendingPrompt.source === 'memory-ai'" class="memory-proof"><span>🕰️</span><p><b>来自真实共同回忆</b><small>AI 只拿已存的 {{ pendingPrompt.evidenceIds?.length || pendingPrompt.memoryEvidenceIds?.length || 0 }} 条真实证据（记忆 / 时光）作为依据；不会写回或修改原记录。</small></p></div>
              <div class="consent-note"><span>♡</span><p><b>舒服比输赢重要。</b><small>任何题目都能跳过或换题；现实动作必须由参与者自己同意。</small></p></div>
              <button class="memory-generate" :disabled="memoryGenerating" @click="generateMemoryChallenge"><span>✦</span><p><b>{{ memoryGenerating ? '正在翻找共同证据…' : '用真实共同证据重新出题' }}</b><small>会调用你已配置的模型 · 不自动写入记忆</small></p><i>›</i></button>
              <div class="challenge-actions"><button class="complete" @click="completeChallenge">完成了 <span>+2 ♥</span></button><button @click="replaceChallenge">换一题</button><button @click="skipChallenge">跳过</button></div>
              <button v-if="game.settings.mode === 'chat'" class="chat-share" @click="bringChallengeToChat">💌 带到知间聊天里完成 <span>不会自动发送 →</span></button>
            </section>
          </div>
        </transition>

        <transition name="card-pop">
          <div v-if="game.pendingEvent && pendingEventCard" class="challenge-backdrop event-backdrop">
            <section class="event-sheet">
              <div class="event-glow"></div><small>COUPLE EVENT · 第 {{ game.pendingEvent.cellIndex }} 格</small><div class="event-emoji">{{ pendingEventCard.emoji }}</div><h2>{{ pendingEventCard.title }}</h2><p>{{ pendingEventCard.text }}</p>
              <div class="event-reward"><span v-if="pendingEventCard.heartDeltaActor">{{ pendingActorName }} <b>{{ pendingEventCard.heartDeltaActor > 0 ? '+' : '' }}{{ pendingEventCard.heartDeltaActor }} ♥</b></span><span v-if="pendingEventCard.heartDeltaOther">{{ game.players[game.pendingEvent.actor === 'user' ? 'partner' : 'user'].name }} <b>{{ pendingEventCard.heartDeltaOther > 0 ? '+' : '' }}{{ pendingEventCard.heartDeltaOther }} ♥</b></span><span v-if="pendingEventCard.swapPositions">🔁 <b>交换位置</b></span><span v-if="pendingEventCard.extraTurn">🎲 <b>再掷一次</b></span></div>
              <button @click="acceptEventCard">收下这张事件卡 <span>→</span></button>
            </section>
          </div>
        </transition>
      </template>

      <transition name="toast"><div v-if="notice" class="toast">{{ notice }}</div></transition>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.love-game-shell{--wine:#6f2748;--rose:#c35e82;--blush:#f7d9df;--cream:#fff9f5;--ink:#4a2a38;--muted:#9f7c89;position:relative;min-height:100%;height:100%;overflow:auto;background:radial-gradient(120% 58% at 15% -5%,rgba(255,224,231,.92),transparent 62%),radial-gradient(85% 50% at 100% 5%,rgba(232,212,247,.76),transparent 66%),linear-gradient(180deg,#fffaf8 0%,#fff7f8 46%,#f9eef2 100%);color:var(--ink);padding:9px 15px 26px;scrollbar-width:none}.love-game-shell::-webkit-scrollbar{display:none}.ambient{position:absolute;border-radius:50%;filter:blur(2px);pointer-events:none}.ambient-a{width:140px;height:140px;right:-74px;top:94px;background:rgba(208,114,147,.08)}.ambient-b{width:110px;height:110px;left:-65px;top:410px;background:rgba(128,94,169,.07)}.spark{position:absolute;color:rgba(142,60,92,.24);font-family:Georgia,serif;pointer-events:none}.spark-1{top:122px;right:26px}.spark-2{top:260px;left:12px}.spark-3{top:540px;right:18px}.topbar{position:relative;z-index:8;display:grid;grid-template-columns:36px 1fr 36px;align-items:center;min-height:50px}.round-btn{width:31px;height:31px;border:1px solid rgba(112,55,77,.08);border-radius:50%;background:rgba(255,255,255,.62);box-shadow:0 8px 20px rgba(89,42,60,.06);color:#6f3e52;font-size:19px}.round-btn.ghost{font-size:13px}.brand-lockup{text-align:center;display:grid;gap:1px}.brand-lockup small{font-size:5.5px;letter-spacing:.19em;color:#bd859a}.brand-lockup b{font:600 11px Georgia,"Songti SC",serif}.loading-card{margin:35vh auto 0;display:grid;place-items:center;gap:8px}.loading-heart{font-size:26px;color:#c05f82;animation:pulse 1s ease-in-out infinite}.loading-card p{margin:0;color:#9d7887;font-size:11px}@keyframes pulse{50%{transform:scale(1.18);opacity:.65}}
.hero-card{position:relative;overflow:hidden;padding:24px 20px 17px;margin-top:7px;border:1px solid rgba(126,58,83,.08);border-radius:27px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(255,245,248,.78));box-shadow:0 24px 58px rgba(99,43,65,.11)}.hero-card>div:not(.hero-orbit){position:relative;z-index:2}.eyebrow{font-size:6px;letter-spacing:.23em;color:#bd7891}.hero-card h1{margin:7px 0 8px;font:500 31px/1.13 Georgia,"Songti SC",serif;letter-spacing:-.04em}.hero-card h1 em{color:#a34469;font-style:italic}.hero-card p{max-width:235px;margin:0;color:#906f7d;font-size:8px;line-height:1.65}.hero-orbit{position:absolute!important;right:-25px;top:-22px;width:140px;height:140px;border:1px solid rgba(174,88,119,.1);border-radius:50%}.hero-orbit:after{content:"";position:absolute;inset:24px;border:1px dashed rgba(174,88,119,.12);border-radius:50%}.hero-dice{position:absolute;right:37px;top:52px;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#8c385b,#c55f82);color:#fff;box-shadow:0 14px 30px rgba(128,50,80,.25);font-size:9px;transform:rotate(9deg)}.hero-dice span{font-size:25px;line-height:.8}.hero-tags{display:flex;gap:5px;margin-top:15px}.hero-tags span{padding:4px 7px;border-radius:999px;background:#f5e8ed;color:#99687a;font-size:6px}.resume-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin:12px 0;padding:11px 12px;border-radius:20px;background:linear-gradient(115deg,#6f2748,#9f4265);color:#fff;box-shadow:0 14px 32px rgba(108,39,72,.18)}.resume-avatars{display:flex;align-items:center}.resume-avatars>span:first-child{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff1f4;color:#963e60;font-size:9px;font-weight:800}.heart-link{margin:0 -3px;color:#ffdae4;font-size:10px;z-index:2}.resume-card>div:nth-child(2){display:grid;gap:2px}.resume-card small{font-size:7px;opacity:.68}.resume-card b{font-size:10px}.resume-card button{border:0;border-radius:999px;background:#fff;color:#8b3458;padding:7px 11px;font-size:8px;font-weight:800}
.setup-section{position:relative;margin-top:22px}.setup-section>header{display:grid;grid-template-columns:26px 1fr;align-items:center;gap:7px;margin-bottom:9px}.setup-section>header>span{font:italic 17px Georgia,serif;color:#d09aad}.setup-section>header>div{display:grid}.setup-section>header b{font-size:10px}.setup-section>header small{font-size:6.5px;color:#a48792;margin-top:1px}.partner-picker-head{grid-template-columns:26px 1fr auto!important}.character-nav{display:flex;gap:4px}.character-nav button{width:24px;height:24px;border:1px solid rgba(116,61,82,.1);border-radius:50%;background:rgba(255,255,255,.78);color:#99516d;font-size:16px;line-height:1}.character-row{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;padding:2px 1px 7px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:auto;scroll-snap-type:x proximity}.character-row::-webkit-scrollbar{display:none}.character-chip{position:relative;flex:0 0 122px;min-width:122px;scroll-snap-align:start;touch-action:auto;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:7px;padding:7px;border:1px solid rgba(116,61,82,.07);border-radius:17px;background:rgba(255,255,255,.68);text-align:left;color:inherit}.character-chip>span{display:grid;min-width:0}.character-chip b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.character-chip small{font-size:6px;color:#a0838e;margin-top:2px}.character-chip i{display:none;position:absolute;right:6px;top:6px;width:14px;height:14px;border-radius:50%;background:#9d4263;color:#fff;font-size:7px;font-style:normal;place-items:center}.character-chip.selected{border-color:#ce8da5;background:#fff;box-shadow:0 8px 22px rgba(140,61,92,.09)}.character-chip.selected i{display:grid}.empty-button{width:100%;border:1px dashed #d8b7c3;border-radius:16px;background:rgba(255,255,255,.6);padding:15px;color:#986b7c;font-size:8px}.mode-grid,.intensity-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mode-grid button{display:grid;justify-items:start;gap:2px;padding:12px;border:1px solid rgba(118,63,83,.07);border-radius:18px;background:rgba(255,255,255,.67);color:inherit;text-align:left}.mode-grid i{font-size:17px;font-style:normal}.mode-grid b{font-size:9px}.mode-grid small{font-size:6.2px;color:#9d7d89;line-height:1.4}.mode-grid button.selected{border-color:#cf8da5;background:#fff;box-shadow:0 8px 24px rgba(140,61,92,.09)}.intensity-grid button{position:relative;display:grid;grid-template-columns:29px 1fr;align-items:center;gap:6px;padding:10px;border:1px solid rgba(118,63,83,.07);border-radius:16px;background:rgba(255,255,255,.65);color:inherit;text-align:left}.intensity-grid button.selected{border-color:#ce8ca5;background:#fff7f9;box-shadow:0 8px 22px rgba(140,61,92,.08)}.intensity-grid button.adult{background:linear-gradient(145deg,rgba(88,36,58,.93),rgba(123,45,73,.9));color:#fff}.intensity-grid button.adult small{color:#eec8d5}.level-number{font:italic 15px Georgia,serif;color:#be7b95}.adult .level-number{color:#f1b6cb}.intensity-grid button>span:nth-child(2){display:grid}.intensity-grid b{font-size:9px}.intensity-grid small{font-size:6.3px;color:#a88995;margin-top:2px}.intensity-grid em{position:absolute;right:7px;top:6px;padding:2px 4px;border-radius:5px;background:#fff0f4;color:#923a5c;font-size:6px;font-style:normal;font-weight:900}.adult-confirm{display:grid;grid-template-columns:22px 1fr;gap:8px;margin-top:8px;padding:10px;border-radius:15px;background:rgba(101,43,66,.06);cursor:pointer}.adult-confirm input{display:none}.checkmark{width:20px;height:20px;border-radius:7px;border:1px solid #c99aae;background:#fff;display:grid;place-items:center;color:transparent;font-size:9px}.adult-confirm input:checked+.checkmark{background:#8f385c;color:#fff;border-color:#8f385c}.adult-confirm>span:last-child{display:grid}.adult-confirm b{font-size:8px}.adult-confirm small{font-size:6.5px;line-height:1.4;color:#9f7c89;margin-top:2px}.adult-confirm.blocked{opacity:.58;cursor:not-allowed}.deck-card{width:100%;display:grid;grid-template-columns:38px 1fr 14px;align-items:center;gap:9px;padding:11px;border:1px solid rgba(118,63,83,.08);border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.84),rgba(250,239,244,.74));color:inherit;text-align:left}.deck-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#f1dfe6;color:#91405f;font-size:16px}.deck-card>span:nth-child(2){display:grid}.deck-card b{font-size:9px}.deck-card small{font-size:6.3px;line-height:1.4;color:#a17c8b;margin-top:2px}.deck-card i{font-size:16px;font-style:normal;color:#b08092}.ready-card{position:sticky;bottom:8px;z-index:20;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:24px;padding:12px 12px 12px 14px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:rgba(82,36,55,.93);backdrop-filter:blur(14px);box-shadow:0 20px 40px rgba(84,37,56,.25);color:#fff}.ready-card>div{display:grid}.ready-card small{font-size:6px;letter-spacing:.16em;color:#d9a8ba}.ready-card b{font-size:9px;margin-top:3px}.ready-card button{display:flex;align-items:center;gap:8px;border:0;border-radius:13px;background:#fff;color:#7c2e4f;padding:9px 10px;font-size:8px;font-weight:900}.ready-card button:disabled{opacity:.4}.ready-card button i{font-size:13px;font-style:normal}
.game-head{display:grid;grid-template-columns:1fr 28px 1fr;gap:5px;align-items:center;margin:2px 0 10px}.player-card{position:relative;display:grid;grid-template-columns:38px 1fr;align-items:center;gap:7px;padding:8px;border:1px solid rgba(112,55,77,.07);border-radius:17px;background:rgba(255,255,255,.7);transition:.25s}.player-card.active{border-color:#d18ea8;background:#fff;box-shadow:0 10px 26px rgba(145,61,93,.12);transform:translateY(-1px)}.user-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#efd2dc,#d5a4b7);color:#7f3b56;font-size:9px;font-weight:800}.player-card>div:nth-child(2){display:grid;min-width:0}.player-card small{font-size:5.5px;letter-spacing:.12em;color:#ba8a9c}.player-card b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-card span{font-size:7px;color:#b14f75;margin-top:1px}.player-card em{position:absolute;right:7px;bottom:5px;font-size:5.5px;color:#b295a0;font-style:normal}.versus{text-align:center;display:grid;gap:1px}.versus span{color:#b34e75;font-size:12px}.versus small{font-size:5px;color:#b3909d}.board-card{position:relative;padding:11px;border:1px solid rgba(112,55,77,.07);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(255,246,248,.72));box-shadow:0 18px 45px rgba(102,55,73,.1);overflow:hidden}.board-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:1px 2px 10px}.board-topline>div{display:grid}.board-topline small{font-size:6.5px;color:#af8193}.board-topline b{font-size:8px;margin-top:2px;max-width:215px}.board-topline>span{white-space:nowrap;padding:4px 6px;border-radius:999px;background:#f4e5ea;color:#9a5a73;font-size:5.8px}.board-grid{position:relative;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(6,54px);gap:4px}.board-ribbon{position:absolute;z-index:0;border:1px dashed rgba(177,91,122,.1);border-radius:999px;pointer-events:none}.ribbon-one{inset:18px 5px 98px}.ribbon-two{inset:105px 42px 12px}.board-cell{position:relative;z-index:1;min-width:0;display:grid;place-items:center;align-content:center;border:1px solid rgba(118,63,83,.07);border-radius:14px;background:rgba(255,255,255,.78);box-shadow:0 4px 12px rgba(104,56,75,.04);transition:.25s}.board-cell>small{position:absolute;left:5px;top:4px;font-size:5px;color:#c0a1ad}.board-cell>span{font-size:14px;line-height:1}.board-cell>b{margin-top:2px;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.5px;color:#8d6877}.cell-truth{background:linear-gradient(145deg,#fff,#f7f0fa)}.cell-dare{background:linear-gradient(145deg,#fff,#fff0f3)}.cell-heart{background:linear-gradient(145deg,#fff8fa,#f8dfe7)}.cell-surprise{background:linear-gradient(145deg,#fff9f2,#f7e8d9)}.cell-boost{background:linear-gradient(145deg,#f8fbff,#e6edf9)}.cell-rewind{background:linear-gradient(145deg,#fbf7fb,#ece3ef)}.cell-start,.cell-finish{background:linear-gradient(145deg,#8b365a,#c36183);color:#fff}.cell-start>b,.cell-finish>b,.cell-start>small,.cell-finish>small{color:#fff}.board-cell.occupied{border-color:rgba(157,63,99,.28);box-shadow:0 7px 18px rgba(144,59,91,.13)}.board-cell.landing:after{content:"";position:absolute;inset:-3px;border:1px solid rgba(193,84,125,.5);border-radius:16px;animation:landingRing .7s ease-out both}@keyframes landingRing{0%{transform:scale(.8);opacity:0}35%{opacity:1}100%{transform:scale(1.16);opacity:0}}.tokens{position:absolute;right:3px;bottom:3px;display:flex}.token{width:17px;height:17px;margin-left:-3px;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;box-shadow:0 3px 7px rgba(95,47,66,.18);font-size:5px;font-style:normal;font-weight:800;overflow:hidden}.token-user{background:#f8dce6;color:#833550}.token-partner{background:#873655;color:#fff;font-size:8px}.token.moving{animation:tokenHop .62s cubic-bezier(.2,.8,.2,1)}@keyframes tokenHop{0%{transform:translateY(9px) scale(.78);opacity:.2}45%{transform:translateY(-8px) scale(1.18)}70%{transform:translateY(2px) scale(.96)}100%{transform:none;opacity:1}}.dice-dock{position:sticky;bottom:9px;z-index:18;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:10px;padding:10px 10px 10px 13px;border-radius:19px;background:rgba(75,31,49,.94);color:#fff;box-shadow:0 18px 42px rgba(75,31,49,.28);backdrop-filter:blur(12px)}.dice-dock>div{display:grid}.dice-dock small{font-size:5.5px;letter-spacing:.15em;color:#dcb0c0}.dice-dock b{font-size:9px;margin-top:2px}.dice-button{width:53px;height:53px;border:0;border-radius:16px;background:linear-gradient(145deg,#fff,#f6dfe7);box-shadow:inset 0 1px #fff,0 8px 20px rgba(35,12,22,.22);color:#7f2e50;display:grid;place-items:center;align-content:center;perspective:200px}.dice-button span{font-size:29px;line-height:.8;transform-origin:center}.dice-button small{font-size:6px;color:#9a5270;margin-top:3px}.dice-button:disabled{opacity:.48}.dice-button.rolling span{animation:diceFlip .22s linear 3}@keyframes diceFlip{50%{transform:rotateX(180deg) rotateZ(25deg) scale(.82)}}
.finish-card{margin-top:10px;padding:18px;border-radius:22px;background:linear-gradient(145deg,#6f2949,#9f4566 58%,#b95f7d);color:#fff;box-shadow:0 18px 40px rgba(96,37,62,.2)}.finish-card>small{font-size:6px;letter-spacing:.18em;color:#e6b5c7}.finish-card h2{margin:6px 0;font:500 22px Georgia,"Songti SC",serif}.finish-card>p{margin:0;color:#f1d9e2;font-size:8px;line-height:1.6}.highlight-stack{display:grid;gap:6px;margin-top:13px}.highlight-card{display:grid;grid-template-columns:27px 1fr;gap:7px;padding:9px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.09)}.highlight-card>span{font-size:18px}.highlight-card>div{display:grid}.highlight-card small{font-size:5.3px;letter-spacing:.14em;color:#e6b7c7}.highlight-card b{font-size:8px;margin-top:1px}.highlight-card p{margin:2px 0 0;color:#ecd5de;font-size:6.3px;line-height:1.45}.finish-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.finish-actions button{border:0;border-radius:11px;background:#fff;color:#7f3152;padding:8px 12px;font-size:8px;font-weight:800}.finish-actions button.secondary{background:rgba(255,255,255,.13);color:#fff}
.challenge-backdrop{position:absolute;z-index:50;inset:0;display:flex;align-items:flex-end;background:rgba(67,27,44,.2);backdrop-filter:blur(3px);padding:0 8px 8px}.challenge-sheet{width:100%;padding:8px 14px 14px;border:1px solid rgba(255,255,255,.7);border-radius:27px 27px 22px 22px;background:linear-gradient(160deg,rgba(255,255,255,.99),rgba(255,244,247,.98));box-shadow:0 -22px 65px rgba(72,30,47,.22)}.sheet-handle{width:38px;height:4px;border-radius:999px;background:#e1cbd3;margin:0 auto 13px}.challenge-sheet>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.challenge-sheet>header>span{padding:7px 8px;border-radius:10px;font-size:6.5px;font-weight:900;letter-spacing:.1em}.challenge-sheet>header>span.truth{background:#eee7f6;color:#7e668f}.challenge-sheet>header>span.dare{background:#f8e0e8;color:#a44468}.challenge-sheet>header>div{display:grid}.challenge-sheet header small{font-size:5.6px;color:#b58c9b;letter-spacing:.06em}.challenge-sheet header b{font-size:11px}.challenge-sheet header em{font-size:8px;font-style:normal;color:#b34870}.challenge-text{margin:16px 3px 13px;font:500 18px/1.55 Georgia,"Songti SC",serif;color:#512f3c}.consent-note,.memory-proof{display:flex;gap:8px;padding:9px 10px;border-radius:14px;background:#f7ecef}.memory-proof{margin-bottom:7px;background:linear-gradient(135deg,#f3eef8,#f9f0f3)}.consent-note>span,.memory-proof>span{color:#b44d73}.consent-note p,.memory-proof p{display:grid;margin:0}.consent-note b,.memory-proof b{font-size:7.5px}.consent-note small,.memory-proof small{font-size:6.3px;line-height:1.45;color:#9e7a87;margin-top:1px}.memory-generate{width:100%;display:grid;grid-template-columns:22px 1fr 12px;align-items:center;gap:7px;margin-top:7px;border:1px solid rgba(139,69,96,.1);border-radius:13px;background:#fff;color:#775163;padding:8px 9px;text-align:left}.memory-generate>span{width:22px;height:22px;border-radius:8px;display:grid;place-items:center;background:#f1e7f5;color:#8a5b9e}.memory-generate p{display:grid;margin:0}.memory-generate b{font-size:7.3px}.memory-generate small{font-size:5.8px;color:#a38390;margin-top:1px}.memory-generate i{font-style:normal}.memory-generate:disabled{opacity:.55}.challenge-actions{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:6px;margin-top:8px}.challenge-actions button{border:0;border-radius:12px;background:#f2e8eb;color:#875269;padding:10px 6px;font-size:8px;font-weight:800}.challenge-actions .complete{background:linear-gradient(135deg,#853555,#b64f73);color:#fff}.challenge-actions .complete span{font-size:6px;opacity:.72}.chat-share{width:100%;display:flex;justify-content:space-between;margin-top:7px;border:1px solid rgba(136,64,91,.1);border-radius:12px;background:#fff;color:#7a455a;padding:9px 10px;font-size:7.5px;text-align:left}.chat-share span{color:#b28a99;font-size:6.5px}.event-backdrop{align-items:center;padding:18px}.event-sheet{position:relative;overflow:hidden;width:100%;padding:22px 18px 17px;border-radius:26px;background:linear-gradient(145deg,#7c3151,#a94c70 56%,#c66c86);color:#fff;text-align:center;box-shadow:0 25px 70px rgba(80,27,48,.3)}.event-glow{position:absolute;width:160px;height:160px;right:-70px;top:-80px;border-radius:50%;background:rgba(255,255,255,.13)}.event-sheet>small{position:relative;font-size:5.8px;letter-spacing:.18em;color:#edc4d2}.event-emoji{position:relative;margin:12px auto 5px;width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);font-size:27px;animation:eventFloat 2.2s ease-in-out infinite}@keyframes eventFloat{50%{transform:translateY(-4px) rotate(2deg)}}.event-sheet h2{position:relative;margin:6px 0;font:500 24px Georgia,"Songti SC",serif}.event-sheet>p{position:relative;margin:0 auto;max-width:260px;color:#f4dfe6;font-size:8px;line-height:1.6}.event-reward{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:13px 0}.event-reward span{padding:8px;border-radius:12px;background:rgba(255,255,255,.1);font-size:6.5px}.event-reward b{display:block;margin-top:2px;font-size:9px}.event-sheet>button{position:relative;width:100%;border:0;border-radius:13px;background:#fff;color:#843657;padding:10px;font-size:8px;font-weight:900}.event-sheet>button span{margin-left:5px}
.toast{position:fixed;z-index:90;left:50%;bottom:30px;transform:translateX(-50%);max-width:290px;padding:9px 13px;border-radius:999px;background:rgba(63,29,42,.94);box-shadow:0 8px 30px rgba(63,29,42,.2);color:#fff;font-size:8px;text-align:center}.toast-enter-active,.toast-leave-active,.card-pop-enter-active,.card-pop-leave-active{transition:.22s ease}.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,8px)}.card-pop-enter-from,.card-pop-leave-to{opacity:0}.card-pop-enter-from>section,.card-pop-leave-to>section{transform:translateY(16px) scale(.97)}.card-pop-enter-active>section,.card-pop-leave-active>section{transition:.24s cubic-bezier(.2,.8,.2,1)}
@media (max-width:370px){.love-game-shell{padding-left:11px;padding-right:11px}.hero-card h1{font-size:27px}.board-grid{grid-template-rows:repeat(6,49px)}.board-cell{border-radius:12px}.challenge-text{font-size:16px}.player-card{grid-template-columns:34px 1fr;padding:7px}.user-avatar{width:34px;height:34px}.challenge-sheet{padding-left:11px;padding-right:11px}}
@media (prefers-reduced-motion:reduce){.loading-heart,.event-emoji,.dice-button.rolling span,.token.moving,.board-cell.landing:after{animation:none!important}.card-pop-enter-active>section,.card-pop-leave-active>section{transition:none}}
</style>
