<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import CoupleBoardPixelSprite from '../components/couple-board/CoupleBoardPixelSprite.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import { getOrCreateSingleConversation } from '../services/characterService'
import { generateCoupleBoardMemoryPrompt } from '../services/coupleBoardMemoryPromptService'
import {
  COUPLE_BOARD_PROMPTS,
  archiveCoupleBoardGame,
  attachCoupleBoardGeneratedPrompt,
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
  type CoupleBoardSettings,
  type CoupleBoardVisualMode
} from '../services/coupleBoardGameService'
import {
  COUPLE_BOARD_MAP_STOPS,
  coupleBoardZoneLabel,
  getCoupleBoardMapStop
} from '../services/coupleBoardMapService'
import {
  appendCoupleBoardInteractionMessage,
  generateCoupleBoardPartnerReply,
  getOrCreateCoupleBoardInteraction,
  loadCoupleBoardInteractionLedger,
  markCoupleBoardInteractionMemories,
  setCoupleBoardInteractionStatus,
  upsertCoupleBoardInteraction,
  type CoupleBoardInteraction
} from '../services/coupleBoardInteractionService'
import { syncCoupleBoardInteractionMemory } from '../services/coupleBoardMemoryBridge'
import type { Character, Conversation } from '../types/domain'

const router = useRouter()
const worldId = ref('world-default')
const characters = ref<Character[]>([])
const selectedCharacterId = ref('')
const intensity = ref<CoupleBoardIntensity>(2)
const mode = ref<CoupleBoardMode>('chat')
const visualMode = ref<CoupleBoardVisualMode>('pixel')
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
const visualPositions = ref<Record<CoupleBoardPlayerId, number>>({ user: 0, partner: 0 })
const notice = ref('')
const interaction = ref<CoupleBoardInteraction>()
const interactionText = ref('')
const interactionBusy = ref(false)
const interactionBooting = ref(false)
const memorySyncing = ref(false)
const interactionError = ref('')
let diceTimer: number | undefined
let noticeTimer: number | undefined
let partnerRollTimer: number | undefined
let movementNonce = 0

const INTENSITIES: Array<{ value: CoupleBoardIntensity; title: string; subtitle: string; badge?: string }> = [
  { value: 1, title: '纯爱', subtitle: '日常甜和轻轻靠近' },
  { value: 2, title: '暧昧', subtitle: '多一点心跳和撩拨' },
  { value: 3, title: '亲密', subtitle: '拥抱、亲吻和真实偏好' },
  { value: 4, title: '成人', subtitle: '欲望、性爱和成人话题', badge: '18+' },
  { value: 5, title: '私房', subtitle: '床上默契 · 性偏好 · 情趣', badge: '18+' }
]

const selectedCharacter = computed(() => characters.value.find(row => row.id === selectedCharacterId.value))
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
const partnerKnownMinor = computed(() => typeof selectedCharacter.value?.age === 'number' && selectedCharacter.value.age < 18)
const diceGlyph = computed(() => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.max(1, Math.min(6, diceFace.value)) - 1])
const lastLog = computed(() => game.value?.history.at(-1))
const highlights = computed(() => game.value?.status === 'finished' ? buildCoupleBoardHighlights(game.value) : [])
const customAvailableCount = computed(() => customPrompts.value.filter(prompt => prompt.intensity <= intensity.value && prompt.modes.includes(mode.value) && (!prompt.adultOnly || intensity.value >= 4)).length)
const builtinAvailableCount = computed(() => {
  const disabled = new Set(disabledBuiltinPromptIds.value)
  return COUPLE_BOARD_PROMPTS.filter(prompt => !disabled.has(prompt.id) && prompt.intensity <= intensity.value && prompt.modes.includes(mode.value) && (!prompt.adultOnly || intensity.value >= 4)).length
})
const pendingSourceLabel = computed(() => pendingPrompt.value?.source === 'memory-ai' ? 'OUR MEMORY' : pendingPrompt.value?.source === 'custom' ? 'YOUR DECK' : 'BUILT-IN')
const activeVisualMode = computed<CoupleBoardVisualMode>(() => game.value?.settings.visualMode || visualMode.value || 'romantic')
const pathPoints = computed(() => COUPLE_BOARD_MAP_STOPS.map(stop => `${stop.x},${stop.y}`).join(' '))
const currentLocation = computed(() => {
  if (!game.value) return COUPLE_BOARD_MAP_STOPS[0]
  if (game.value.pending) return getCoupleBoardMapStop(game.value.pending.cellIndex)
  if (game.value.pendingEvent) return getCoupleBoardMapStop(game.value.pendingEvent.cellIndex)
  const position = lastLog.value?.to ?? game.value.players[game.value.currentPlayer].position
  return getCoupleBoardMapStop(position)
})
const turnHint = computed(() => {
  if (!game.value) return ''
  if (game.value.pending) return `${pendingActorName.value} 在「${currentLocation.value.name}」停下来聊一会儿`
  if (game.value.pendingEvent) return `${pendingActorName.value} 在「${currentLocation.value.name}」遇到一张事件卡`
  if (game.value.status === 'finished') return `${winnerName.value} 抵达心跳终点`
  if (game.value.currentPlayer === 'partner') return `${game.value.settings.characterName} 正在准备自己掷骰子`
  return `第 ${game.value.turn} 回合 · 轮到我`
})
const interactionHasBothSides = computed(() => Boolean(interaction.value?.messages.some(row => row.speaker === 'user') && interaction.value?.messages.some(row => row.speaker === 'partner')))
const interactionCanSend = computed(() => Boolean(interactionText.value.trim()) && !interactionBusy.value && !memorySyncing.value)
const partnerAutoTurn = computed(() => game.value?.status === 'playing' && game.value.currentPlayer === 'partner' && !game.value.pending && !game.value.pendingEvent)

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 3600)
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
  selectedCharacterId.value = characterId
  window.requestAnimationFrame(() => {
    const row = characterRow.value
    if (!row) return
    const selected = Array.from(row.querySelectorAll<HTMLElement>('[data-character-id]')).find(element => element.dataset.characterId === characterId)
    try { selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) } catch {
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
    adultConfirmed: adultConfirmed.value,
    visualMode: visualMode.value
  }
}

function chooseIntensity(value: CoupleBoardIntensity) {
  intensity.value = value
  if (value < 4) adultConfirmed.value = false
}

function syncVisualPositions(source?: CoupleBoardGame) {
  const target = source || game.value
  if (!target) return
  visualPositions.value = { user: target.players.user.position, partner: target.players.partner.position }
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
    await getOrCreateSingleConversation(character)
    const next = createCoupleBoardGame(settings, new Date(), customPrompts.value, {
      customEventCards: customEventCards.value,
      disabledBuiltinPromptIds: disabledBuiltinPromptIds.value,
      disabledBuiltinEventCardIds: disabledBuiltinEventCardIds.value
    })
    await saveCoupleBoardGame(worldId.value, next)
    game.value = next
    savedGame.value = next
    syncVisualPositions(next)
    interaction.value = undefined
    screen.value = 'game'
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '开局失败，请再试一次。')
  } finally {
    startLaunching.value = false
  }
}

async function resumeGame() {
  if (!savedGame.value) return
  try {
    const next = cloneCoupleBoardGame(savedGame.value)
    game.value = next
    selectedCharacterId.value = next.settings.characterId
    intensity.value = next.settings.intensity
    mode.value = next.settings.mode
    visualMode.value = next.settings.visualMode || 'romantic'
    adultConfirmed.value = next.settings.adultConfirmed
    syncVisualPositions(next)
    screen.value = 'game'
    await restoreInteraction()
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

function wait(ms: number) {
  return new Promise<void>(resolve => { diceTimer = window.setTimeout(resolve, ms) })
}

async function animateWalk(actor: CoupleBoardPlayerId, from: number, to: number) {
  movementNonce += 1
  const nonce = movementNonce
  movingPlayer.value = actor
  visualPositions.value = { ...visualPositions.value, [actor]: from }
  const direction = to >= from ? 1 : -1
  let cursor = from
  while (cursor !== to && nonce === movementNonce) {
    cursor += direction
    visualPositions.value = { ...visualPositions.value, [actor]: cursor }
    await wait(150)
  }
  if (nonce === movementNonce) movingPlayer.value = undefined
}

async function rollDice(autoPartner = false) {
  if (!game.value || game.value.pending || game.value.pendingEvent || game.value.status !== 'playing' || diceRolling.value || diceResolving.value) return
  if (game.value.currentPlayer === 'partner' && !autoPartner) return
  const actor = game.value.currentPlayer
  const from = game.value.players[actor].position
  diceRolling.value = true
  diceResolving.value = true
  try {
    for (let tick = 0; tick < 8; tick += 1) {
      diceFace.value = 1 + Math.floor(Math.random() * 6)
      await wait(58)
    }
    const finalDice = 1 + Math.floor(Math.random() * 6)
    diceFace.value = finalDice
    diceRolling.value = false
    const source = game.value
    if (!source) return
    const next = rollCoupleBoard(source, finalDice, Math.random())
    await persist(next)
    await animateWalk(actor, from, next.players[actor].position)
    if ('vibrate' in navigator) navigator.vibrate?.(35)
    await ensureInteractionForPending()
    schedulePartnerAutoRoll()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '掷骰子失败，请再试一次。')
  } finally {
    diceRolling.value = false
    diceResolving.value = false
  }
}

function schedulePartnerAutoRoll() {
  if (partnerRollTimer) window.clearTimeout(partnerRollTimer)
  if (screen.value !== 'game' || !partnerAutoTurn.value || diceRolling.value || diceResolving.value) return
  partnerRollTimer = window.setTimeout(() => { void rollDice(true) }, 850)
}

function eventEffectSummary(card: CoupleBoardEventCard) {
  const parts: string[] = []
  if (card.heartDeltaActor) parts.push(`当前玩家 ${card.heartDeltaActor > 0 ? '+' : ''}${card.heartDeltaActor} ♥`)
  if (card.heartDeltaOther) parts.push(`对方 ${card.heartDeltaOther > 0 ? '+' : ''}${card.heartDeltaOther} ♥`)
  if (card.swapPositions) parts.push('交换位置')
  if (card.extraTurn) parts.push('当前玩家再掷一次')
  return parts.join(' · ') || '这一张只留下一点氛围'
}

async function acceptEventCard() {
  if (!game.value?.pendingEvent || !pendingEventCard.value) return
  const summary = eventEffectSummary(pendingEventCard.value)
  const next = resolveCoupleBoardEvent(game.value)
  await persist(next)
  syncVisualPositions(next)
  showNotice(`事件卡生效 · ${summary}`)
  if ('vibrate' in navigator) navigator.vibrate?.([18, 24, 18])
  schedulePartnerAutoRoll()
}

async function currentConversation(character = selectedCharacter.value): Promise<Conversation | undefined> {
  if (!character) return undefined
  return getOrCreateSingleConversation(character)
}

async function restoreInteraction() {
  if (!game.value?.pending) {
    interaction.value = undefined
    return
  }
  const ledger = await loadCoupleBoardInteractionLedger(worldId.value, game.value.id)
  const found = [...ledger.interactions].reverse().find(row => row.promptId === game.value?.pending?.promptId && row.status !== 'closed' && row.status !== 'skipped')
  interaction.value = found
  if (!found) await ensureInteractionForPending()
}

async function ensureInteractionForPending() {
  if (!game.value?.pending || !pendingPrompt.value || !selectedCharacter.value || interactionBooting.value) return
  if (interaction.value?.promptId === pendingPrompt.value.id && interaction.value.status !== 'closed' && interaction.value.status !== 'skipped') return
  interactionBooting.value = true
  interactionError.value = ''
  try {
    const conversation = await currentConversation()
    if (!conversation) throw new Error('无法建立这位角色的单聊上下文。')
    const next = await getOrCreateCoupleBoardInteraction({
      worldId: worldId.value,
      game: cloneCoupleBoardGame(game.value),
      prompt: pendingPrompt.value,
      questionText: pendingText.value,
      conversationId: conversation.id
    })
    interaction.value = next
    if (next.actor === 'partner' && next.messages.length === 0) {
      await generatePartnerLine('answer')
    }
  } catch (error) {
    interactionError.value = error instanceof Error ? error.message : '互动上下文建立失败。'
  } finally {
    interactionBooting.value = false
  }
}

async function generatePartnerLine(intent: 'answer' | 'react' | 'continue') {
  if (!game.value?.pending || !pendingPrompt.value || !interaction.value || !selectedCharacter.value || interactionBusy.value) return
  const conversation = await currentConversation()
  if (!conversation) return
  const gameSnapshot = cloneCoupleBoardGame(game.value)
  const interactionSnapshot = interaction.value
  const promptId = pendingPrompt.value.id
  interactionBusy.value = true
  interactionError.value = ''
  try {
    const result = await generateCoupleBoardPartnerReply({
      worldId: worldId.value,
      conversationId: conversation.id,
      game: gameSnapshot,
      prompt: pendingPrompt.value,
      interaction: interactionSnapshot,
      character: selectedCharacter.value,
      intent
    })
    if (!game.value?.pending || game.value.pending.promptId !== promptId || interaction.value?.id !== interactionSnapshot.id) return
    let next = appendCoupleBoardInteractionMessage(interaction.value, 'partner', result.reply, { evidenceIds: result.memoryEvidenceIds })
    if (result.endInteraction) next = setCoupleBoardInteractionStatus(next, 'closing')
    interaction.value = next
    await upsertCoupleBoardInteraction(worldId.value, next)
  } catch (error) {
    interactionError.value = error instanceof Error ? error.message : '角色回应失败，请再试一次。'
  } finally {
    interactionBusy.value = false
  }
}

async function submitInteractionMessage() {
  const text = interactionText.value.trim()
  if (!text || !interaction.value || interactionBusy.value) return
  let next = appendCoupleBoardInteractionMessage(interaction.value, 'user', text)
  next = setCoupleBoardInteractionStatus(next, 'active')
  interaction.value = next
  interactionText.value = ''
  await upsertCoupleBoardInteraction(worldId.value, next)
  const partnerAlreadySpoke = next.messages.some(row => row.speaker === 'partner')
  await generatePartnerLine(partnerAlreadySpoke ? 'continue' : 'react')
}

async function continueInteraction() {
  if (!interaction.value) return
  const next = setCoupleBoardInteractionStatus(interaction.value, 'active')
  interaction.value = next
  await upsertCoupleBoardInteraction(worldId.value, next)
}

async function closeInteraction() {
  if (!game.value?.pending || !interaction.value || !selectedCharacter.value || memorySyncing.value) return
  if (!interactionHasBothSides.value) return showNotice('这道题还没形成双方互动，先让彼此都回应一下。')
  memorySyncing.value = true
  try {
    const conversation = await currentConversation()
    if (!conversation) throw new Error('无法找到这位角色的长期记忆上下文。')
    let nextInteraction = setCoupleBoardInteractionStatus(interaction.value, 'closed')
    const synced = await syncCoupleBoardInteractionMemory({
      conversationId: conversation.id,
      interaction: nextInteraction,
      character: selectedCharacter.value
    })
    const ids = [synced.eventMemoryId, ...synced.semanticMemoryIds].filter((id): id is string => Boolean(id))
    nextInteraction = markCoupleBoardInteractionMemories(nextInteraction, ids)
    interaction.value = nextInteraction
    await upsertCoupleBoardInteraction(worldId.value, nextInteraction)
    const nextGame = resolveCoupleBoardChallenge(game.value, 'completed')
    await persist(nextGame)
    syncVisualPositions(nextGame)
    interaction.value = undefined
    const memoryMessage = ids.length ? `这段互动已进入长期记忆 · ${ids.length} 条` : '互动完成。'
    showNotice(synced.semanticSkippedReason ? `${memoryMessage}；${synced.semanticSkippedReason}` : memoryMessage)
    schedulePartnerAutoRoll()
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '结束互动失败，请再试一次。')
  } finally {
    memorySyncing.value = false
  }
}

async function skipChallenge() {
  if (!game.value?.pending) return
  if (interaction.value) {
    const nextInteraction = setCoupleBoardInteractionStatus(interaction.value, 'skipped')
    interaction.value = nextInteraction
    await upsertCoupleBoardInteraction(worldId.value, nextInteraction)
  }
  const next = resolveCoupleBoardChallenge(game.value, 'skipped')
  await persist(next)
  syncVisualPositions(next)
  interaction.value = undefined
  showNotice('已跳过。任何题目都不需要勉强。')
  schedulePartnerAutoRoll()
}

async function replaceChallenge() {
  if (!game.value?.pending) return
  if (interaction.value) await upsertCoupleBoardInteraction(worldId.value, setCoupleBoardInteractionStatus(interaction.value, 'skipped'))
  const next = replaceCoupleBoardPrompt(game.value, Math.random())
  await persist(next)
  interaction.value = undefined
  showNotice('换了一题，不扣分。')
  await ensureInteractionForPending()
}

async function generateMemoryChallenge() {
  if (!game.value?.pending || !selectedCharacter.value || memoryGenerating.value) return
  const sourceGame = cloneCoupleBoardGame(game.value)
  const challengeFingerprint = coupleBoardChallengeFingerprint(sourceGame)
  memoryGenerating.value = true
  try {
    const conversation = await currentConversation()
    if (!conversation) return showNotice('还没有可用的单聊记忆上下文。')
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
    if (interaction.value) await upsertCoupleBoardInteraction(worldId.value, setCoupleBoardInteractionStatus(interaction.value, 'skipped'))
    await persist(attachCoupleBoardGeneratedPrompt(game.value, result.prompt))
    interaction.value = undefined
    await ensureInteractionForPending()
    showNotice(`已用 ${result.evidence.length} 条真实记忆出题 · ${result.model}`)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '回忆出题失败，请再试一次。')
  } finally {
    memoryGenerating.value = false
  }
}

async function retryPartnerReply() {
  if (!interaction.value) return
  const partnerSpoke = interaction.value.messages.some(row => row.speaker === 'partner')
  await generatePartnerLine(!partnerSpoke && interaction.value.actor === 'partner' ? 'answer' : partnerSpoke ? 'continue' : 'react')
}

async function bringChallengeToChat() {
  if (!game.value?.pending) return
  const conversation = await currentConversation()
  if (!conversation) return showNotice('无法建立单聊。')
  const share = buildCoupleBoardChatShare(game.value, conversation.id)
  if (!share) return
  const key = `ai-companion-draft:${share.conversationId}`
  localStorage.setItem(key, mergeCoupleBoardShareIntoDraft(localStorage.getItem(key) || '', share))
  await router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
}

async function bringResultToChat() {
  if (!game.value || game.value.status !== 'finished') return
  const conversation = await currentConversation()
  if (!conversation) return showNotice('无法建立单聊。')
  const share = buildCoupleBoardResultChatShare(game.value, conversation.id)
  if (!share) return
  const key = `ai-companion-draft:${share.conversationId}`
  localStorage.setItem(key, mergeCoupleBoardResultShareIntoDraft(localStorage.getItem(key) || '', share))
  await router.push(`/chat/${encodeURIComponent(share.conversationId)}`)
}

async function abandonGame() {
  if (game.value?.status === 'playing' && !window.confirm('结束这一局并回到设置？当前棋盘进度会被清空，已经进入长期记忆的互动不会被删除。')) return
  await clearCoupleBoardGame(worldId.value)
  game.value = undefined
  savedGame.value = undefined
  interaction.value = undefined
  screen.value = 'setup'
}

function goSetupKeepingGame() {
  screen.value = 'setup'
}

async function rematch() {
  if (!game.value) return
  const next = createCoupleBoardGame({ ...game.value.settings, visualMode: activeVisualMode.value }, new Date(), customPrompts.value, {
    customEventCards: customEventCards.value,
    disabledBuiltinPromptIds: disabledBuiltinPromptIds.value,
    disabledBuiltinEventCardIds: disabledBuiltinEventCardIds.value
  })
  await persist(next)
  syncVisualPositions(next)
  interaction.value = undefined
  screen.value = 'game'
}

function stopStyle(index: number) {
  const stop = getCoupleBoardMapStop(index)
  return { left: `${stop.x}%`, top: `${stop.y}%` }
}

function spriteStyle(player: CoupleBoardPlayerId) {
  const stop = getCoupleBoardMapStop(visualPositions.value[player])
  const offset = player === 'partner' ? 1.7 : -1.7
  return { left: `${stop.x + offset}%`, top: `${stop.y}%` }
}

function lastEventLabel() {
  const log = lastLog.value
  if (!log || !game.value) return '今晚不赶终点，走到哪里就在哪里多聊一会。'
  const actor = game.value.players[log.actor].name
  const stop = getCoupleBoardMapStop(log.to)
  if (game.value.status === 'finished' && game.value.winner === log.actor) return `${actor} 走到了「${stop.name}」，这一局的路走完了。`
  if (log.eventCardId) return `${actor} 在「${stop.name}」抽到「${getCoupleBoardGameEventCard(game.value, log.eventCardId)?.title || '心跳事件'}」。`
  return `${actor} 掷出 ${log.dice}，走到「${stop.name}」。${stop.hint}`
}

watch(() => game.value?.pending?.promptId, () => { void ensureInteractionForPending() })
watch(() => [screen.value, game.value?.currentPlayer, game.value?.pending?.promptId, game.value?.pendingEvent?.eventCardId, game.value?.status, diceRolling.value, diceResolving.value], () => schedulePartnerAutoRoll())

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
    if (stored) {
      visualMode.value = stored.settings.visualMode || 'romantic'
      syncVisualPositions(stored)
    }
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
  movementNonce += 1
  if (diceTimer) window.clearTimeout(diceTimer)
  if (noticeTimer) window.clearTimeout(noticeTimer)
  if (partnerRollTimer) window.clearTimeout(partnerRollTimer)
})
</script>

<template>
  <PhoneFrame>
    <main class="love-game-shell" :class="[`visual-${activeVisualMode}`, { 'is-game': screen === 'game' }]">
      <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div>
      <header class="topbar">
        <button class="round-btn" aria-label="返回" @click="screen === 'game' ? goSetupKeepingGame() : router.push('/home')">‹</button>
        <div class="brand-lockup"><small>COUPLE BOARD · V2.0 ALPHA</small><b>心跳飞行棋</b></div>
        <button class="round-btn ghost" aria-label="回到主屏幕" @click="router.push('/home')">⌂</button>
      </header>

      <section v-if="loading" class="loading-card"><span class="loading-heart">♥</span><p>正在把今晚的路线铺好…</p></section>

      <template v-else-if="screen === 'setup'">
        <section class="hero-card">
          <div class="hero-orbit"><div class="hero-dice">♥<span>⚄</span></div></div>
          <div><span class="eyebrow">MEMORY · ROLEPLAY · DATE ROUTE</span><h1>不是赶终点，<br><em>是一起走一段。</em></h1><p>角色会带着自己的人设、长期记忆和你们的时光来玩。题目只是开场，真正重要的是后面的互动。</p></div>
          <div class="hero-tags"><span>角色不重置</span><span>互动写入长期记忆</span><span>像素小人上地图</span></div>
        </section>

        <section v-if="savedGame?.status === 'playing'" class="resume-card">
          <div class="resume-avatars"><span>我</span><span class="heart-link">♥</span><CharacterAvatar :avatar="characters.find(row => row.id === savedGame?.settings.characterId)?.avatar || savedGame?.settings.characterAvatar" :name="savedGame?.settings.characterName" :size="36" /></div>
          <div><small>上一局还停在路上</small><b>和 {{ savedGame.settings.characterName }} · 第 {{ savedGame.turn }} 回合</b></div>
          <button @click="resumeGame">继续</button>
        </section>

        <section class="setup-section">
          <header class="partner-picker-head"><span>01</span><div><b>选你的搭档</b><small>{{ characters.length > 3 ? `${characters.length} 位可选 · 左右滑动查看更多` : '角色会带着原人设和已有记忆进游戏' }}</small></div><nav v-if="characters.length > 3" class="character-nav"><button type="button" @click="scrollCharacterRow('prev')">‹</button><button type="button" @click="scrollCharacterRow('next')">›</button></nav></header>
          <div v-if="characters.length" ref="characterRow" class="character-row" @wheel="wheelCharacterRow">
            <button v-for="character in characters" :key="character.id" type="button" class="character-chip" :data-character-id="character.id" :aria-pressed="selectedCharacterId === character.id" :class="{ selected: selectedCharacterId === character.id }" @click="chooseCharacter(character.id)">
              <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="42" /><span><b>{{ character.name }}</b><small>{{ character.age ? `${character.age} 岁` : '年龄未设置' }}</small></span><i>✓</i>
            </button>
          </div>
          <button v-else class="empty-button" @click="router.push('/characters/new')">还没有角色 · 去创建一个搭档</button>
        </section>

        <section class="setup-section">
          <header><span>02</span><div><b>怎么玩</b><small>聊天互动或面对面；角色回应都会读取长期上下文</small></div></header>
          <div class="mode-grid"><button :class="{ selected: mode === 'chat' }" @click="mode = 'chat'"><i>💌</i><b>聊天互动</b><small>适合远程玩，也能继续带回知间</small></button><button :class="{ selected: mode === 'reality' }" @click="mode = 'reality'"><i>🥂</i><b>面对面</b><small>身体互动更多；现实动作仍由双方自己决定</small></button></div>
        </section>

        <section class="setup-section intensity-section">
          <header><span>03</span><div><b>心跳浓度</b><small>角色不会因为强度变成人设外的另一个人</small></div></header>
          <div class="intensity-grid"><button v-for="level in INTENSITIES" :key="level.value" :class="{ selected: intensity === level.value, adult: level.value >= 4 }" @click="chooseIntensity(level.value)"><span class="level-number">0{{ level.value }}</span><span><b>{{ level.title }}</b><small>{{ level.subtitle }}</small></span><em v-if="level.badge">{{ level.badge }}</em></button></div>
          <label v-if="intensity >= 4" class="adult-confirm" :class="{ blocked: partnerKnownMinor }"><input v-model="adultConfirmed" type="checkbox" :disabled="partnerKnownMinor"><span class="checkmark">✓</span><span><b>{{ partnerKnownMinor ? '该角色年龄明确小于 18 岁，无法开启成人/私房模式' : '确认双方均为成年人，并同意成人/私房题目' }}</b><small>任何现实身体互动都可以拒绝、停下或换题。</small></span></label>
        </section>

        <section class="setup-section">
          <header><span>04</span><div><b>地图风格</b><small>底层是同一局，换风格不会改变进度和记忆</small></div></header>
          <div class="visual-grid"><button :class="{ selected: visualMode === 'pixel' }" @click="visualMode = 'pixel'"><span class="pixel-preview"><i></i><i></i><i></i></span><b>像素约会</b><small>两个小人在路线图上真的一格格走</small></button><button :class="{ selected: visualMode === 'romantic' }" @click="visualMode = 'romantic'"><span class="romantic-preview">♡</span><b>浪漫地图</b><small>更柔和的约会路线和地点卡</small></button></div>
        </section>

        <section class="setup-section deck-section">
          <header><span>05</span><div><b>情侣内容中心</b><small>题库、事件卡和对局回忆都在这里</small></div></header>
          <button class="deck-card" @click="router.push('/app/心跳飞行棋/library')"><span class="deck-icon">✦</span><span><b>{{ COUPLE_BOARD_PROMPTS.length - disabledBuiltinPromptIds.length }} 道内置题 · {{ customPrompts.length }} 道专属题</b><small>当前设置可抽 {{ builtinAvailableCount + customAvailableCount }} 道 · {{ customEventCards.length }} 张专属事件 · {{ archiveCount }} 局回忆</small></span><i>›</i></button>
        </section>

        <section class="memory-principle"><span>🧠</span><p><b>这局会记得，也会被记住。</b><small>角色回应优先使用角色卡 + 长期 Memory + Shared Timeline。完成后的真实互动会写回长期记忆；假设题不会被偷偷改成现实事实。</small></p></section>
        <section class="ready-card"><div><small>READY TO PLAY</small><b>{{ selectedCharacter?.name || '选择搭档' }} · {{ selectedModeLabel }} · {{ selectedIntensity.title }} · {{ visualMode === 'pixel' ? '像素约会' : '浪漫地图' }}</b></div><button :disabled="!selectedCharacter || startLaunching" @click="startGame"><span>{{ startLaunching ? '正在建立记忆上下文…' : '开始这一局' }}</span><i>→</i></button></section>
      </template>

      <template v-else-if="game">
        <section class="game-head">
          <div class="player-card" :class="{ active: game.currentPlayer === 'user' && !game.pending && !game.pendingEvent }"><div class="avatar user-avatar">我</div><div><small>YOU</small><b>我</b><span>♥ {{ game.players.user.hearts }}</span></div><em>{{ getCoupleBoardMapStop(game.players.user.position).name }}</em></div>
          <div class="versus"><span>♥</span><small>TURN {{ game.turn }}</small></div>
          <div class="player-card partner" :class="{ active: game.currentPlayer === 'partner' && !game.pending && !game.pendingEvent }"><CharacterAvatar :avatar="selectedCharacter?.avatar || game.settings.characterAvatar" :name="selectedCharacter?.name || game.settings.characterName" :size="42" /><div><small>PARTNER</small><b>{{ game.players.partner.name }}</b><span>♥ {{ game.players.partner.hearts }}</span></div><em>{{ getCoupleBoardMapStop(game.players.partner.position).name }}</em></div>
        </section>

        <section class="board-card" :class="`map-${activeVisualMode}`">
          <div class="board-topline"><div><small>{{ turnHint }}</small><b>{{ lastEventLabel() }}</b></div><span>{{ coupleBoardZoneLabel(currentLocation.zone) }}</span></div>
          <div class="date-map">
            <div class="map-sky"><i>✦</i><i>·</i><i>✧</i></div>
            <div class="map-landmark landmark-home">🏠</div><div class="map-landmark landmark-park">🌳</div><div class="map-landmark landmark-city">🏙️</div><div class="map-landmark landmark-moon">☾</div>
            <svg class="route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline :points="pathPoints" /></svg>
            <div v-for="stop in COUPLE_BOARD_MAP_STOPS" :key="stop.index" class="map-stop" :class="[`zone-${stop.zone}`, { hot: currentLocation.index === stop.index }]" :style="stopStyle(stop.index)" :title="`${stop.index} · ${stop.name}`"><span>{{ stop.scenery }}</span><small v-if="stop.index % 3 === 0 || stop.index >= 27">{{ stop.name }}</small></div>
            <CoupleBoardPixelSprite v-if="activeVisualMode === 'pixel'" class="map-sprite" :style="spriteStyle('user')" name="我" variant="user" :moving="movingPlayer === 'user'" :active="game.currentPlayer === 'user'" />
            <CoupleBoardPixelSprite v-if="activeVisualMode === 'pixel'" class="map-sprite" :style="spriteStyle('partner')" :name="game.settings.characterName" :avatar="selectedCharacter?.avatar || game.settings.characterAvatar" variant="partner" :moving="movingPlayer === 'partner'" :active="game.currentPlayer === 'partner'" />
            <div v-if="activeVisualMode === 'romantic'" class="romantic-token token-me" :style="spriteStyle('user')">我</div><div v-if="activeVisualMode === 'romantic'" class="romantic-token token-partner" :style="spriteStyle('partner')">♥</div>
            <div class="location-card"><small>NOW · {{ currentLocation.index.toString().padStart(2, '0') }}</small><b>{{ currentLocation.scenery }} {{ currentLocation.name }}</b><span>{{ currentLocation.hint }}</span></div>
          </div>
        </section>

        <section v-if="game.status === 'playing' && !game.pending && !game.pendingEvent" class="dice-dock" :class="{ partner: partnerAutoTurn }"><div><small>{{ diceResolving ? 'MOVING...' : partnerAutoTurn ? 'PARTNER TURN' : 'YOUR TURN' }}</small><b>{{ diceResolving ? `${game.players[game.currentPlayer].name} 正在沿路线走…` : partnerAutoTurn ? `${game.settings.characterName} 会自己掷骰子` : '你来掷这一轮，TA会接着自己玩' }}</b></div><button class="dice-button" :class="{ rolling: diceRolling }" :disabled="partnerAutoTurn || diceRolling || diceResolving" @click="rollDice(false)"><span>{{ diceGlyph }}</span><small>{{ partnerAutoTurn ? 'TA' : diceRolling ? '...' : '掷' }}</small></button></section>

        <section v-else-if="game.status === 'finished'" class="finish-card"><small>HEARTBEAT HIGHLIGHTS</small><h2>{{ winnerName }} 走到了终点 ♡</h2><p>棋局结束了，但这局里真正说出口的事已经可以继续留在你们的长期记忆里。</p><div class="highlight-stack"><article v-for="item in highlights" :key="item.id" class="highlight-card"><span>{{ item.emoji }}</span><div><small>{{ item.eyebrow }}</small><b>{{ item.title }}</b><p>{{ item.detail }}</p></div></article></div><div class="finish-actions"><button @click="rematch">再走一晚</button><button v-if="game.settings.mode === 'chat'" class="secondary" @click="bringResultToChat">💌 分享结算</button><button class="secondary" @click="abandonGame">回到设置</button></div></section>

        <transition name="card-pop">
          <div v-if="game.pending && pendingPrompt" class="challenge-backdrop">
            <section class="challenge-sheet">
              <div class="sheet-handle"></div>
              <header><span :class="pendingPrompt.type">{{ pendingPrompt.type === 'truth' ? 'TRUTH' : 'DARE' }}</span><div><small>{{ pendingSourceLabel }} · {{ currentLocation.name }}</small><b>{{ pendingActorName }} 先开始，但这题属于你们两个</b></div><em>♥ +2</em></header>
              <p class="challenge-text">{{ pendingText }}</p>
              <div v-if="pendingPrompt.source === 'memory-ai'" class="memory-proof"><span>🕰️</span><p><b>来自真实共同回忆</b><small>只允许引用已存在的 Memory / 时光 evidence id；不存在的共同经历不会拿来“补剧情”。</small></p></div>

              <div class="interaction-stage">
                <div class="interaction-head"><span>LIVE INTERACTION</span><small>不赶回合 · 双方都回应后再决定什么时候结束</small></div>
                <div v-if="interactionBooting" class="interaction-loading">正在让 {{ game.settings.characterName }} 带着人设和记忆进入这一题…</div>
                <div v-else class="dialogue-stack">
                  <article v-for="message in interaction?.messages || []" :key="message.id" class="dialogue-line" :class="message.speaker"><div class="dialogue-avatar">{{ message.speaker === 'user' ? '我' : message.speaker === 'partner' ? (game.settings.characterAvatar || '♥') : '·' }}</div><p><b>{{ message.speaker === 'user' ? '我' : message.speaker === 'partner' ? game.settings.characterName : '游戏' }}</b><span>{{ message.text }}</span><small v-if="message.memoryEvidenceIds?.length">🧠 用到 {{ message.memoryEvidenceIds.length }} 条真实记忆证据</small></p></article>
                  <div v-if="interactionBusy" class="typing-line"><i></i><i></i><i></i><span>{{ game.settings.characterName }} 正在按自己的方式回应…</span></div>
                  <div v-if="interactionError" class="interaction-error"><span>{{ interactionError }}</span><button @click="retryPartnerReply">重试回应</button></div>
                </div>

                <div v-if="interaction?.status === 'closing'" class="closing-note"><span>♡</span><p><b>{{ game.settings.characterName }} 觉得这一小段已经自然收住了。</b><small>你可以顺着结束，也可以继续聊。角色不会因为“游戏流程”强行催你。</small></p><button @click="continueInteraction">我还想继续</button></div>

                <div class="interaction-compose"><textarea v-model="interactionText" :disabled="interactionBusy || memorySyncing" :placeholder="game.pending.actor === 'user' && !(interaction?.messages?.some(row => row.speaker === 'user')) ? '把你的回答、动作或真实反应写下来…' : `回应 ${game.settings.characterName}，或者顺着这个话题继续…`" @keydown.ctrl.enter.prevent="submitInteractionMessage"></textarea><button :disabled="!interactionCanSend" @click="submitInteractionMessage">发送</button></div>
                <div class="interaction-actions"><button class="finish-interaction" :disabled="!interactionHasBothSides || interactionBusy || memorySyncing" @click="closeInteraction">{{ memorySyncing ? '正在写入长期记忆…' : interaction?.status === 'closing' ? '顺着TA结束 · 继续走' : '这段聊够了 · 继续走' }}</button><button @click="replaceChallenge">换一题</button><button @click="skipChallenge">跳过</button></div>
                <small class="memory-footnote">完成互动后，会保存“这次真实对话发生过”这一条共享记忆，并尝试提炼稳定偏好；假设/幻想不会被当成现实事实。</small>
              </div>

              <button class="memory-generate" :disabled="memoryGenerating || interactionBusy" @click="generateMemoryChallenge"><span>✦</span><p><b>{{ memoryGenerating ? '正在翻找共同证据…' : '换成一题真正和你们过去有关的题' }}</b><small>只从已存 Memory + Shared Timeline 取证，不凭空编共同经历</small></p><i>›</i></button>
              <button v-if="game.settings.mode === 'chat'" class="chat-share" @click="bringChallengeToChat">💌 带到知间继续聊 <span>不会自动发送 →</span></button>
            </section>
          </div>
        </transition>

        <transition name="card-pop"><div v-if="game.pendingEvent && pendingEventCard" class="challenge-backdrop event-backdrop"><section class="event-sheet"><div class="event-glow"></div><small>COUPLE EVENT · {{ currentLocation.name }}</small><div class="event-emoji">{{ pendingEventCard.emoji }}</div><h2>{{ pendingEventCard.title }}</h2><p>{{ pendingEventCard.text }}</p><div class="event-reward"><span v-if="pendingEventCard.heartDeltaActor">{{ pendingActorName }} <b>{{ pendingEventCard.heartDeltaActor > 0 ? '+' : '' }}{{ pendingEventCard.heartDeltaActor }} ♥</b></span><span v-if="pendingEventCard.heartDeltaOther">{{ game.players[game.pendingEvent.actor === 'user' ? 'partner' : 'user'].name }} <b>{{ pendingEventCard.heartDeltaOther > 0 ? '+' : '' }}{{ pendingEventCard.heartDeltaOther }} ♥</b></span><span v-if="pendingEventCard.swapPositions">🔁 <b>交换位置</b></span><span v-if="pendingEventCard.extraTurn">🎲 <b>再掷一次</b></span></div><button @click="acceptEventCard">让这一刻发生 <span>→</span></button></section></div></transition>
      </template>

      <transition name="toast"><div v-if="notice" class="toast">{{ notice }}</div></transition>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.love-game-shell{--wine:#67243f;--rose:#c35e82;--blush:#f6d6df;--cream:#fff9f5;--ink:#492937;--muted:#9a7885;position:relative;min-height:100%;height:100%;overflow:auto;background:radial-gradient(110% 56% at 10% -8%,rgba(255,218,229,.94),transparent 62%),radial-gradient(80% 45% at 100% 8%,rgba(221,211,248,.72),transparent 65%),linear-gradient(180deg,#fffaf8,#fff7f8 48%,#f9eef2);color:var(--ink);padding:9px 14px 28px;scrollbar-width:none}.love-game-shell::-webkit-scrollbar{display:none}.ambient{position:absolute;border-radius:50%;pointer-events:none;filter:blur(8px)}.ambient-a{width:180px;height:180px;right:-100px;top:100px;background:rgba(205,105,143,.08)}.ambient-b{width:150px;height:150px;left:-90px;top:520px;background:rgba(116,86,173,.07)}.topbar{position:relative;z-index:30;display:grid;grid-template-columns:36px 1fr 36px;align-items:center;min-height:50px}.round-btn{width:31px;height:31px;border:1px solid rgba(112,55,77,.08);border-radius:50%;background:rgba(255,255,255,.72);box-shadow:0 8px 20px rgba(89,42,60,.06);color:#6f3e52;font-size:19px}.round-btn.ghost{font-size:13px}.brand-lockup{text-align:center;display:grid;gap:1px}.brand-lockup small{font-size:5.5px;letter-spacing:.19em;color:#bd859a}.brand-lockup b{font:600 11px Georgia,"Songti SC",serif}.loading-card{margin:35vh auto 0;display:grid;place-items:center;gap:8px}.loading-heart{font-size:26px;color:#c05f82;animation:pulse 1s ease-in-out infinite}.loading-card p{margin:0;color:#9d7887;font-size:11px}@keyframes pulse{50%{transform:scale(1.18);opacity:.65}}
.hero-card{position:relative;overflow:hidden;padding:24px 20px 17px;margin-top:7px;border:1px solid rgba(126,58,83,.08);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(255,243,247,.82));box-shadow:0 24px 58px rgba(99,43,65,.11)}.hero-card>div:not(.hero-orbit){position:relative;z-index:2}.eyebrow{font-size:6px;letter-spacing:.23em;color:#bd7891}.hero-card h1{margin:7px 0 8px;font:500 30px/1.13 Georgia,"Songti SC",serif;letter-spacing:-.04em}.hero-card h1 em{color:#a34469;font-style:italic}.hero-card p{max-width:250px;margin:0;color:#906f7d;font-size:8px;line-height:1.65}.hero-orbit{position:absolute!important;right:-24px;top:-20px;width:142px;height:142px;border:1px solid rgba(174,88,119,.1);border-radius:50%}.hero-orbit:after{content:"";position:absolute;inset:24px;border:1px dashed rgba(174,88,119,.13);border-radius:50%}.hero-dice{position:absolute;right:38px;top:52px;width:54px;height:54px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(145deg,#8c385b,#c55f82);color:#fff;box-shadow:0 14px 30px rgba(128,50,80,.25);font-size:9px;transform:rotate(9deg)}.hero-dice span{font-size:25px;line-height:.8}.hero-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:15px}.hero-tags span{padding:4px 7px;border-radius:999px;background:#f5e8ed;color:#99687a;font-size:6px}
.resume-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;margin-top:10px;padding:10px;border-radius:18px;background:linear-gradient(135deg,#6e2c49,#954361);color:#fff;box-shadow:0 13px 30px rgba(89,36,57,.16)}.resume-avatars{display:flex;align-items:center}.resume-avatars>span:first-child{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#f5dbe4;color:#71314c;font-size:8px;font-weight:800}.heart-link{margin:0 -2px;color:#f3b5ca;font-size:8px}.resume-card>div:nth-child(2){display:grid}.resume-card small{font-size:6px;color:#e2b7c6}.resume-card b{font-size:8px;margin-top:2px}.resume-card button{border:0;border-radius:11px;background:#fff;color:#7d3152;padding:8px 10px;font-size:8px;font-weight:900}
.setup-section{position:relative;margin-top:19px}.setup-section>header,.partner-picker-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.setup-section>header>span,.partner-picker-head>span{width:25px;height:25px;border-radius:9px;display:grid;place-items:center;background:#f1e1e7;color:#a25270;font:italic 9px Georgia,serif}.setup-section header>div{display:grid}.setup-section header b{font-size:10px}.setup-section header small{font-size:6px;color:#a27f8c;margin-top:1px}.partner-picker-head{justify-content:flex-start}.partner-picker-head>div{flex:1}.character-nav{display:flex;gap:4px}.character-nav button{width:24px;height:24px;border:1px solid rgba(116,61,82,.1);border-radius:50%;background:rgba(255,255,255,.82);color:#99516d;font-size:16px}.character-row{display:flex;gap:7px;overflow-x:auto;padding:2px 1px 7px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity}.character-row::-webkit-scrollbar{display:none}.character-chip{position:relative;flex:0 0 122px;min-width:122px;scroll-snap-align:start;display:grid;grid-template-columns:42px 1fr;align-items:center;gap:7px;padding:7px;border:1px solid rgba(116,61,82,.07);border-radius:17px;background:rgba(255,255,255,.7);text-align:left;color:inherit}.character-chip>span{display:grid;min-width:0}.character-chip b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.character-chip small{font-size:6px;color:#a0838e;margin-top:2px}.character-chip i{display:none;position:absolute;right:6px;top:6px;width:14px;height:14px;border-radius:50%;background:#9d4263;color:#fff;font-size:7px;font-style:normal;place-items:center}.character-chip.selected{border-color:#ce8da5;background:#fff;box-shadow:0 8px 22px rgba(140,61,92,.1)}.character-chip.selected i{display:grid}.empty-button{width:100%;border:1px dashed #d8b7c3;border-radius:16px;background:rgba(255,255,255,.6);padding:15px;color:#986b7c;font-size:8px}
.mode-grid,.visual-grid,.intensity-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.mode-grid button,.visual-grid button{display:grid;justify-items:start;gap:3px;padding:12px;border:1px solid rgba(118,63,83,.07);border-radius:18px;background:rgba(255,255,255,.68);color:inherit;text-align:left}.mode-grid button.selected,.visual-grid button.selected{border-color:#cf8da5;background:#fff;box-shadow:0 8px 24px rgba(140,61,92,.1)}.mode-grid i{font-size:17px;font-style:normal}.mode-grid b,.visual-grid b{font-size:9px}.mode-grid small,.visual-grid small{font-size:6.2px;color:#9d7d89;line-height:1.4}.pixel-preview{position:relative;width:42px;height:27px;border-radius:9px;background:#354451;box-shadow:inset 0 -8px #71865f;overflow:hidden}.pixel-preview i{position:absolute;bottom:5px;width:6px;height:10px;background:#e4afc2;box-shadow:0 -4px #5b3947}.pixel-preview i:nth-child(1){left:8px}.pixel-preview i:nth-child(2){left:18px;height:13px;background:#a84f72}.pixel-preview i:nth-child(3){right:5px;width:10px;height:5px;background:#d0bc75;box-shadow:none}.romantic-preview{width:42px;height:27px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(145deg,#f5dbe4,#e8ddf4);color:#9c4668;font-size:19px}
.intensity-grid button{position:relative;display:grid;grid-template-columns:29px 1fr;align-items:center;gap:6px;padding:10px;border:1px solid rgba(118,63,83,.07);border-radius:16px;background:rgba(255,255,255,.65);color:inherit;text-align:left}.intensity-grid button.selected{border-color:#ce8ca5;background:#fff7f9;box-shadow:0 8px 22px rgba(140,61,92,.08)}.intensity-grid button.adult{background:linear-gradient(145deg,rgba(88,36,58,.94),rgba(123,45,73,.91));color:#fff}.intensity-grid button.adult small{color:#eec8d5}.level-number{font:italic 15px Georgia,serif;color:#be7b95}.adult .level-number{color:#f1b6cb}.intensity-grid button>span:nth-child(2){display:grid}.intensity-grid b{font-size:9px}.intensity-grid small{font-size:6.3px;color:#a88995;margin-top:2px}.intensity-grid em{position:absolute;right:7px;top:6px;padding:2px 4px;border-radius:5px;background:#fff0f4;color:#923a5c;font-size:6px;font-style:normal;font-weight:900}.adult-confirm{display:grid;grid-template-columns:22px 1fr;gap:8px;margin-top:8px;padding:10px;border-radius:15px;background:rgba(101,43,66,.06);cursor:pointer}.adult-confirm input{display:none}.checkmark{width:20px;height:20px;border-radius:7px;border:1px solid #c99aae;background:#fff;display:grid;place-items:center;color:transparent;font-size:9px}.adult-confirm input:checked+.checkmark{background:#8f385c;color:#fff;border-color:#8f385c}.adult-confirm>span:last-child{display:grid}.adult-confirm b{font-size:8px}.adult-confirm small{font-size:6.5px;line-height:1.4;color:#9f7c89;margin-top:2px}.adult-confirm.blocked{opacity:.58;cursor:not-allowed}
.deck-card{width:100%;display:grid;grid-template-columns:38px 1fr 14px;align-items:center;gap:9px;padding:11px;border:1px solid rgba(118,63,83,.08);border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.86),rgba(250,239,244,.76));color:inherit;text-align:left}.deck-icon{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;background:#f1dfe6;color:#91405f;font-size:16px}.deck-card>span:nth-child(2){display:grid}.deck-card b{font-size:9px}.deck-card small{font-size:6.3px;line-height:1.4;color:#a17c8b;margin-top:2px}.deck-card i{font-size:16px;font-style:normal;color:#b08092}.memory-principle{display:grid;grid-template-columns:28px 1fr;gap:8px;margin-top:14px;padding:10px 11px;border:1px solid rgba(106,73,135,.08);border-radius:17px;background:linear-gradient(135deg,rgba(242,237,249,.86),rgba(255,245,248,.8))}.memory-principle>span{font-size:18px}.memory-principle p{display:grid;margin:0}.memory-principle b{font-size:8px}.memory-principle small{font-size:6.4px;line-height:1.5;color:#88778d;margin-top:2px}.ready-card{position:sticky;bottom:8px;z-index:20;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:18px;padding:12px 12px 12px 14px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:rgba(82,36,55,.94);backdrop-filter:blur(14px);box-shadow:0 20px 40px rgba(84,37,56,.25);color:#fff}.ready-card>div{display:grid}.ready-card small{font-size:6px;letter-spacing:.16em;color:#d9a8ba}.ready-card b{font-size:8px;margin-top:3px}.ready-card button{display:flex;align-items:center;gap:8px;border:0;border-radius:13px;background:#fff;color:#7c2e4f;padding:9px 10px;font-size:8px;font-weight:900}.ready-card button:disabled{opacity:.4}.ready-card button i{font-size:13px;font-style:normal}
.game-head{display:grid;grid-template-columns:1fr 28px 1fr;gap:5px;align-items:center;margin:2px 0 9px}.player-card{position:relative;display:grid;grid-template-columns:38px 1fr;align-items:center;gap:7px;padding:8px 8px 14px;border:1px solid rgba(112,55,77,.07);border-radius:17px;background:rgba(255,255,255,.72);transition:.25s}.player-card.active{border-color:#d18ea8;background:#fff;box-shadow:0 10px 26px rgba(145,61,93,.12);transform:translateY(-1px)}.user-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#efd2dc,#d5a4b7);color:#7f3b56;font-size:9px;font-weight:800}.player-card>div:nth-child(2){display:grid;min-width:0}.player-card small{font-size:5.5px;letter-spacing:.12em;color:#ba8a9c}.player-card b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-card span{font-size:7px;color:#b14f75;margin-top:1px}.player-card em{position:absolute;right:8px;bottom:5px;font-size:5.3px;color:#aa8c98;font-style:normal}.versus{text-align:center;display:grid;gap:1px}.versus span{color:#b34e75;font-size:12px}.versus small{font-size:5px;color:#b3909d}
.board-card{position:relative;padding:10px;border:1px solid rgba(112,55,77,.08);border-radius:25px;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(255,246,248,.75));box-shadow:0 18px 45px rgba(102,55,73,.1);overflow:hidden}.board-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:1px 2px 9px}.board-topline>div{display:grid}.board-topline small{font-size:6.4px;color:#af8193}.board-topline b{font-size:7.5px;margin-top:2px;max-width:220px;line-height:1.45}.board-topline>span{white-space:nowrap;padding:4px 6px;border-radius:999px;background:#f4e5ea;color:#9a5a73;font-size:5.8px}.date-map{position:relative;height:355px;overflow:hidden;border-radius:20px;background:linear-gradient(180deg,#f9e5ea 0 23%,#e8d8e0 23% 35%,#cad8bf 35% 74%,#b8c6a7 74% 100%);box-shadow:inset 0 0 0 1px rgba(95,56,72,.06)}.map-pixel .date-map{background:linear-gradient(180deg,#2f4054 0 24%,#46586a 24% 35%,#647a61 35% 76%,#4c674e 76% 100%);image-rendering:pixelated}.map-sky{position:absolute;inset:0 0 auto;height:31%;background:radial-gradient(circle at 76% 20%,rgba(255,243,198,.58),transparent 12%),linear-gradient(180deg,rgba(255,255,255,.04),transparent);color:#fff}.map-sky i{position:absolute;font-style:normal;font-size:7px;opacity:.6}.map-sky i:nth-child(1){left:18%;top:15%}.map-sky i:nth-child(2){left:47%;top:29%}.map-sky i:nth-child(3){right:14%;top:9%}.map-landmark{position:absolute;z-index:1;font-size:25px;filter:drop-shadow(0 4px 5px rgba(46,35,42,.18));opacity:.75}.landmark-home{left:3%;bottom:4%}.landmark-park{right:4%;bottom:28%}.landmark-city{right:2%;top:22%}.landmark-moon{right:15%;top:5%;font-size:27px;color:#fff}.route-svg{position:absolute;z-index:2;inset:0;width:100%;height:100%;overflow:visible}.route-svg polyline{fill:none;stroke:rgba(255,255,255,.86);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2.2 2}.map-pixel .route-svg polyline{stroke:#d9c985;stroke-width:2.4;stroke-dasharray:3 2}.map-stop{position:absolute;z-index:5;transform:translate(-50%,-50%);width:17px;height:17px;border:2px solid rgba(255,255,255,.9);border-radius:50%;display:grid;place-items:center;background:#ba6683;box-shadow:0 3px 8px rgba(70,34,49,.18);transition:.2s}.map-stop>span{font-size:8px;filter:saturate(.7)}.map-stop>small{position:absolute;left:50%;top:17px;transform:translateX(-50%);white-space:nowrap;padding:1px 3px;border-radius:4px;background:rgba(255,255,255,.78);color:#725362;font-size:4.8px}.map-pixel .map-stop{border-radius:2px;border:1px solid #f4e3b5;background:#95617b;box-shadow:2px 2px 0 rgba(27,36,39,.35)}.map-pixel .map-stop>small{border-radius:2px;background:#243544;color:#f6e7c2}.map-stop.hot{z-index:7;transform:translate(-50%,-50%) scale(1.35);box-shadow:0 0 0 5px rgba(255,255,255,.28),0 4px 12px rgba(94,39,62,.25)}.zone-night,.zone-private{background:#83506f}.zone-park{background:#779672}.zone-date{background:#d07a83}.map-sprite{position:absolute;z-index:12;transition:left .14s linear,top .14s linear}.romantic-token{position:absolute;z-index:12;width:25px;height:25px;display:grid;place-items:center;border:2px solid #fff;border-radius:50%;box-shadow:0 5px 12px rgba(75,36,52,.2);transform:translate(-50%,-80%);font-size:7px;font-weight:900;transition:left .14s linear,top .14s linear}.token-me{background:#f2cbd8;color:#733650}.token-partner{background:#7d3152;color:#fff}.location-card{position:absolute;z-index:15;left:10px;right:10px;bottom:9px;display:grid;padding:8px 10px;border:1px solid rgba(255,255,255,.52);border-radius:13px;background:rgba(255,250,250,.82);backdrop-filter:blur(8px);box-shadow:0 7px 22px rgba(66,37,48,.12)}.map-pixel .location-card{border-radius:4px;background:rgba(31,45,55,.9);border-color:rgba(246,224,180,.35);color:#f8e9cb;box-shadow:3px 3px 0 rgba(18,28,31,.38)}.location-card small{font-size:5.2px;letter-spacing:.15em;color:#b77891}.map-pixel .location-card small{color:#dbc784}.location-card b{font-size:9px;margin-top:1px}.location-card span{font-size:6px;color:#91717e;margin-top:2px}.map-pixel .location-card span{color:#cbbfa8}
.dice-dock{position:sticky;bottom:9px;z-index:18;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:9px;padding:10px 10px 10px 13px;border-radius:19px;background:rgba(75,31,49,.95);color:#fff;box-shadow:0 18px 42px rgba(75,31,49,.28);backdrop-filter:blur(12px)}.dice-dock.partner{background:linear-gradient(135deg,#43384f,#6b4057)}.dice-dock>div{display:grid}.dice-dock small{font-size:5.5px;letter-spacing:.15em;color:#dcb0c0}.dice-dock b{font-size:8px;margin-top:2px}.dice-button{width:53px;height:53px;border:0;border-radius:16px;background:linear-gradient(145deg,#fff,#f6dfe7);box-shadow:inset 0 1px #fff,0 8px 20px rgba(35,12,22,.22);color:#7f2e50;display:grid;place-items:center;align-content:center;perspective:200px}.map-pixel+.dice-dock .dice-button{border-radius:5px}.dice-button span{font-size:29px;line-height:.8;transform-origin:center}.dice-button small{font-size:6px;color:#9a5270;margin-top:3px}.dice-button:disabled{opacity:.62}.dice-button.rolling span{animation:diceFlip .22s linear 3}@keyframes diceFlip{50%{transform:rotateX(180deg) rotateZ(25deg) scale(.82)}}
.finish-card{margin-top:10px;padding:18px;border-radius:22px;background:linear-gradient(145deg,#6f2949,#9f4566 58%,#b95f7d);color:#fff;box-shadow:0 18px 40px rgba(96,37,62,.2)}.finish-card>small{font-size:6px;letter-spacing:.18em;color:#e6b5c7}.finish-card h2{margin:6px 0;font:500 22px Georgia,"Songti SC",serif}.finish-card>p{margin:0;color:#f1d9e2;font-size:8px;line-height:1.6}.highlight-stack{display:grid;gap:6px;margin-top:13px}.highlight-card{display:grid;grid-template-columns:27px 1fr;gap:7px;padding:9px;border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.09)}.highlight-card>span{font-size:18px}.highlight-card>div{display:grid}.highlight-card small{font-size:5.3px;letter-spacing:.14em;color:#e6b7c7}.highlight-card b{font-size:8px;margin-top:1px}.highlight-card p{margin:2px 0 0;color:#ecd5de;font-size:6.3px;line-height:1.45}.finish-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.finish-actions button{border:0;border-radius:11px;background:#fff;color:#7f3152;padding:8px 12px;font-size:8px;font-weight:800}.finish-actions button.secondary{background:rgba(255,255,255,.13);color:#fff}
.challenge-backdrop{position:absolute;z-index:50;inset:0;display:flex;align-items:flex-end;background:rgba(55,24,38,.25);backdrop-filter:blur(4px);padding:0 7px 7px}.challenge-sheet{width:100%;max-height:91%;overflow:auto;padding:8px 13px 14px;border:1px solid rgba(255,255,255,.72);border-radius:27px 27px 22px 22px;background:linear-gradient(160deg,rgba(255,255,255,.995),rgba(255,243,247,.985));box-shadow:0 -22px 65px rgba(72,30,47,.24);scrollbar-width:none}.challenge-sheet::-webkit-scrollbar{display:none}.sheet-handle{width:38px;height:4px;border-radius:999px;background:#e1cbd3;margin:0 auto 12px}.challenge-sheet>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.challenge-sheet>header>span{padding:7px 8px;border-radius:10px;font-size:6.5px;font-weight:900;letter-spacing:.1em}.challenge-sheet>header>span.truth{background:#eee7f6;color:#7e668f}.challenge-sheet>header>span.dare{background:#f8e0e8;color:#a44468}.challenge-sheet>header>div{display:grid}.challenge-sheet header small{font-size:5.6px;color:#b58c9b}.challenge-sheet header b{font-size:9px;margin-top:1px}.challenge-sheet header em{font-size:8px;font-style:normal;color:#b34870}.challenge-text{margin:14px 3px 10px;font:500 17px/1.55 Georgia,"Songti SC",serif;color:#512f3c}.memory-proof{display:flex;gap:8px;padding:8px 9px;border-radius:13px;background:linear-gradient(135deg,#f3eef8,#f9f0f3);margin-bottom:8px}.memory-proof>span{color:#b44d73}.memory-proof p{display:grid;margin:0}.memory-proof b{font-size:7.2px}.memory-proof small{font-size:6px;line-height:1.45;color:#9e7a87;margin-top:1px}
.interaction-stage{padding:10px;border:1px solid rgba(113,58,79,.08);border-radius:19px;background:rgba(255,255,255,.72);box-shadow:inset 0 1px rgba(255,255,255,.8)}.interaction-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.interaction-head span{font-size:5.6px;letter-spacing:.16em;color:#a24c6b;font-weight:900}.interaction-head small{font-size:5.6px;color:#a78a95;text-align:right}.interaction-loading{padding:18px 7px;color:#927280;font-size:7px;text-align:center}.dialogue-stack{display:grid;gap:6px;margin-top:8px;max-height:210px;overflow:auto;scrollbar-width:none}.dialogue-stack::-webkit-scrollbar{display:none}.dialogue-line{display:grid;grid-template-columns:25px 1fr;gap:6px;align-items:start}.dialogue-line.user{grid-template-columns:1fr 25px}.dialogue-line.user .dialogue-avatar{grid-column:2}.dialogue-line.user p{grid-column:1;grid-row:1;text-align:right;justify-self:end;background:#f5dde6}.dialogue-avatar{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;background:#eee4ed;color:#7e4860;font-size:7px;font-weight:900;overflow:hidden}.dialogue-line.partner .dialogue-avatar{background:#7c3554;color:#fff}.dialogue-line p{display:grid;margin:0;max-width:225px;padding:7px 8px;border-radius:12px;background:#f2eef5}.dialogue-line p b{font-size:6px;color:#9e627b}.dialogue-line p span{font-size:7.5px;line-height:1.55;color:#573642;margin-top:2px}.dialogue-line p small{font-size:5.3px;color:#8a7397;margin-top:3px}.typing-line{display:flex;align-items:center;gap:3px;padding:7px;color:#947683;font-size:6px}.typing-line i{width:4px;height:4px;border-radius:50%;background:#b66a86;animation:typing 1s ease-in-out infinite}.typing-line i:nth-child(2){animation-delay:.15s}.typing-line i:nth-child(3){animation-delay:.3s}.typing-line span{margin-left:4px}@keyframes typing{50%{transform:translateY(-3px);opacity:.45}}.interaction-error{display:flex;align-items:center;justify-content:space-between;gap:7px;padding:7px 8px;border-radius:10px;background:#fff0f1;color:#9a4a5f;font-size:6px}.interaction-error button{border:0;border-radius:8px;background:#8e405e;color:#fff;padding:5px 7px;font-size:6px}.closing-note{display:grid;grid-template-columns:20px 1fr auto;gap:6px;align-items:center;margin-top:8px;padding:8px;border-radius:12px;background:#f4edf7}.closing-note>span{color:#9f5a7e}.closing-note p{display:grid;margin:0}.closing-note b{font-size:6.5px}.closing-note small{font-size:5.5px;line-height:1.4;color:#937f99}.closing-note button{border:0;border-radius:8px;background:#fff;color:#784967;padding:6px;font-size:6px}.interaction-compose{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:8px}.interaction-compose textarea{min-height:54px;resize:none;border:1px solid rgba(114,57,78,.12);border-radius:12px;background:#fff;padding:8px;color:#533440;font:7.5px/1.5 inherit;outline:none}.interaction-compose textarea:focus{border-color:#cb8da5;box-shadow:0 0 0 3px rgba(199,119,148,.08)}.interaction-compose button{align-self:stretch;border:0;border-radius:11px;background:#803353;color:#fff;padding:0 10px;font-size:7px;font-weight:900}.interaction-compose button:disabled{opacity:.38}.interaction-actions{display:grid;grid-template-columns:1.5fr .7fr .7fr;gap:5px;margin-top:6px}.interaction-actions button{border:0;border-radius:10px;background:#f1e7eb;color:#85536a;padding:8px 5px;font-size:6.6px;font-weight:800}.interaction-actions .finish-interaction{background:linear-gradient(135deg,#7e3152,#b05072);color:#fff}.interaction-actions button:disabled{opacity:.4}.memory-footnote{display:block;margin-top:6px;color:#9d8490;font-size:5.5px;line-height:1.45}.memory-generate{width:100%;display:grid;grid-template-columns:22px 1fr 12px;align-items:center;gap:7px;margin-top:7px;border:1px solid rgba(139,69,96,.1);border-radius:13px;background:#fff;color:#775163;padding:8px 9px;text-align:left}.memory-generate>span{width:22px;height:22px;border-radius:8px;display:grid;place-items:center;background:#f1e7f5;color:#8a5b9e}.memory-generate p{display:grid;margin:0}.memory-generate b{font-size:7.1px}.memory-generate small{font-size:5.7px;color:#a38390;margin-top:1px}.memory-generate i{font-style:normal}.memory-generate:disabled{opacity:.55}.chat-share{width:100%;display:flex;justify-content:space-between;margin-top:7px;border:1px solid rgba(136,64,91,.1);border-radius:12px;background:#fff;color:#7a455a;padding:9px 10px;font-size:7.5px;text-align:left}.chat-share span{color:#b28a99;font-size:6.5px}
.event-backdrop{align-items:center;padding:18px}.event-sheet{position:relative;overflow:hidden;width:100%;padding:22px 18px 17px;border-radius:26px;background:linear-gradient(145deg,#7c3151,#a94c70 56%,#c66c86);color:#fff;text-align:center;box-shadow:0 25px 70px rgba(80,27,48,.3)}.event-glow{position:absolute;width:160px;height:160px;right:-70px;top:-80px;border-radius:50%;background:rgba(255,255,255,.13)}.event-sheet>small{position:relative;font-size:5.8px;letter-spacing:.18em;color:#edc4d2}.event-emoji{position:relative;margin:12px auto 5px;width:54px;height:54px;border-radius:18px;display:grid;place-items:center;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.18);font-size:27px;animation:eventFloat 2.2s ease-in-out infinite}@keyframes eventFloat{50%{transform:translateY(-4px) rotate(2deg)}}.event-sheet h2{position:relative;margin:6px 0;font:500 24px Georgia,"Songti SC",serif}.event-sheet>p{position:relative;margin:0 auto;max-width:260px;color:#f4dfe6;font-size:8px;line-height:1.6}.event-reward{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:13px 0}.event-reward span{padding:8px;border-radius:12px;background:rgba(255,255,255,.1);font-size:6.5px}.event-reward b{display:block;margin-top:2px;font-size:9px}.event-sheet>button{position:relative;width:100%;border:0;border-radius:13px;background:#fff;color:#843657;padding:10px;font-size:8px;font-weight:900}.event-sheet>button span{margin-left:5px}
.toast{position:fixed;z-index:90;left:50%;bottom:30px;transform:translateX(-50%);max-width:310px;padding:9px 13px;border-radius:999px;background:rgba(63,29,42,.95);box-shadow:0 8px 30px rgba(63,29,42,.2);color:#fff;font-size:8px;text-align:center}.toast-enter-active,.toast-leave-active,.card-pop-enter-active,.card-pop-leave-active{transition:.22s ease}.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,8px)}.card-pop-enter-from,.card-pop-leave-to{opacity:0}.card-pop-enter-from>section,.card-pop-leave-to>section{transform:translateY(16px) scale(.97)}.card-pop-enter-active>section,.card-pop-leave-active>section{transition:.24s cubic-bezier(.2,.8,.2,1)}
@media(max-width:370px){.love-game-shell{padding-left:10px;padding-right:10px}.hero-card h1{font-size:27px}.date-map{height:325px}.challenge-text{font-size:15px}.player-card{grid-template-columns:34px 1fr}.interaction-head{align-items:flex-start;flex-direction:column;gap:2px}.dialogue-line p{max-width:205px}}
@media(prefers-reduced-motion:reduce){.loading-heart,.event-emoji,.dice-button.rolling span,.typing-line i{animation:none!important}.map-sprite,.romantic-token{transition:none!important}.card-pop-enter-active>section,.card-pop-leave-active>section{transition:none}}
</style>
