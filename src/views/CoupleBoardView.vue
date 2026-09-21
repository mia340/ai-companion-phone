<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import {
  COUPLE_BOARD_CELLS,
  buildCoupleBoardChatShare,
  clearCoupleBoardGame,
  createCoupleBoardGame,
  getCoupleBoardPrompt,
  loadCoupleBoardGame,
  mergeCoupleBoardShareIntoDraft,
  renderCoupleBoardPrompt,
  replaceCoupleBoardPrompt,
  resolveCoupleBoardChallenge,
  rollCoupleBoard,
  saveCoupleBoardGame,
  validateCoupleBoardAdultMode,
  type CoupleBoardGame,
  type CoupleBoardIntensity,
  type CoupleBoardMode,
  type CoupleBoardPlayerId,
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
const screen = ref<'setup' | 'game'>('setup')
const loading = ref(true)
const diceRolling = ref(false)
const diceFace = ref(1)
const notice = ref('')
let diceTimer: number | undefined
let noticeTimer: number | undefined

const INTENSITIES: Array<{ value: CoupleBoardIntensity; title: string; subtitle: string; badge?: string }> = [
  { value: 1, title: '纯爱', subtitle: '甜甜地了解彼此' },
  { value: 2, title: '暧昧', subtitle: '多一点心跳和靠近' },
  { value: 3, title: '亲密', subtitle: '边界、偏好与亲密感' },
  { value: 4, title: '成人', subtitle: '成年人限定 · 同意优先', badge: '18+' }
]

const selectedCharacter = computed(() => characters.value.find(row => row.id === selectedCharacterId.value))
const currentPlayer = computed(() => game.value ? game.value.players[game.value.currentPlayer] : undefined)
const pendingPrompt = computed(() => game.value?.pending ? getCoupleBoardPrompt(game.value.pending.promptId) : undefined)
const pendingText = computed(() => {
  if (!game.value?.pending || !pendingPrompt.value) return ''
  const actor = game.value.players[game.value.pending.actor]
  const counterpart = game.value.pending.actor === 'partner' ? '我' : game.value.settings.characterName
  return renderCoupleBoardPrompt(pendingPrompt.value, actor.name, counterpart)
})
const pendingActorName = computed(() => game.value?.pending ? game.value.players[game.value.pending.actor].name : '')
const winnerName = computed(() => game.value?.winner ? game.value.players[game.value.winner].name : '')
const selectedModeLabel = computed(() => mode.value === 'chat' ? '聊天互动' : '面对面')
const selectedIntensity = computed(() => INTENSITIES.find(row => row.value === intensity.value)!)
const partnerKnownMinor = computed(() => {
  const age = selectedCharacter.value?.age
  return typeof age === 'number' && age < 18
})
const diceGlyph = computed(() => ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][Math.max(1, Math.min(6, diceFace.value)) - 1])
const lastLog = computed(() => game.value?.history.at(-1))
const turnHint = computed(() => {
  if (!game.value) return ''
  if (game.value.pending) return `轮到 ${pendingActorName.value} 完成这一格`
  if (game.value.status === 'finished') return `${winnerName.value} 抵达终点`
  return `第 ${game.value.turn} 回合 · ${currentPlayer.value?.name || ''} 掷骰子`
})

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2800)
}

function boardCellStyle(index: number) {
  const cols = 5
  const rowFromBottom = Math.floor(index / cols)
  const offset = index % cols
  const col = rowFromBottom % 2 === 0 ? offset + 1 : cols - offset
  return {
    gridColumn: col,
    gridRow: 6 - rowFromBottom
  }
}

function playerOnCell(player: CoupleBoardPlayerId, index: number) {
  return game.value?.players[player].position === index
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
  const character = selectedCharacter.value
  if (!character) {
    showNotice('先选择一位搭档。')
    return
  }
  const settings = buildSettings(character)
  const adultError = validateCoupleBoardAdultMode(settings)
  if (adultError) {
    showNotice(adultError)
    return
  }
  const next = createCoupleBoardGame(settings)
  game.value = next
  savedGame.value = next
  screen.value = 'game'
  await saveCoupleBoardGame(worldId.value, next)
}

function resumeGame() {
  if (!savedGame.value) return
  game.value = structuredClone(savedGame.value)
  selectedCharacterId.value = savedGame.value.settings.characterId
  intensity.value = savedGame.value.settings.intensity
  mode.value = savedGame.value.settings.mode
  adultConfirmed.value = savedGame.value.settings.adultConfirmed
  screen.value = 'game'
}

async function persist(next: CoupleBoardGame) {
  game.value = next
  savedGame.value = next
  await saveCoupleBoardGame(worldId.value, next)
}

async function rollDice() {
  if (!game.value || game.value.pending || game.value.status !== 'playing' || diceRolling.value) return
  diceRolling.value = true
  let ticks = 0
  const spin = () => {
    diceFace.value = 1 + Math.floor(Math.random() * 6)
    ticks += 1
    if (ticks < 7) {
      diceTimer = window.setTimeout(spin, 65)
      return
    }
    const finalDice = 1 + Math.floor(Math.random() * 6)
    diceFace.value = finalDice
    const next = rollCoupleBoard(game.value!, finalDice, Math.random())
    void persist(next)
    diceRolling.value = false
    if ('vibrate' in navigator) navigator.vibrate?.(35)
  }
  spin()
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

function latestConversation(characterId: string, rows: Conversation[]) {
  return rows
    .filter(row => row.type === 'single' && row.memberIds.includes(characterId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
}

async function bringChallengeToChat() {
  if (!game.value?.pending) return
  const rows = await db.conversations.where('worldId').equals(worldId.value).toArray()
  const conversation = latestConversation(game.value.settings.characterId, rows)
  if (!conversation) {
    showNotice('还没有和这位搭档的单聊，先去知间聊几句吧。')
    return
  }
  const share = buildCoupleBoardChatShare(game.value, conversation.id)
  if (!share) return
  const key = `ai-companion-draft:${share.conversationId}`
  const existing = localStorage.getItem(key) || ''
  localStorage.setItem(key, mergeCoupleBoardShareIntoDraft(existing, share))
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
  const next = createCoupleBoardGame(game.value.settings)
  await persist(next)
  screen.value = 'game'
}

function lastEventLabel() {
  const log = lastLog.value
  if (!log || !game.value) return '骰子会决定下一次心跳落在哪里。'
  const actor = game.value.players[log.actor].name
  const cell = COUPLE_BOARD_CELLS[log.to]
  if (game.value.status === 'finished' && game.value.winner === log.actor) return `${actor} 抵达终点，拿到最后 3 点心动值。`
  if (cell.type === 'heart') return `${actor} 落在心动格，自动 +1。`
  if (cell.type === 'rest') return `${actor} 落在休息格，这一回合轻轻放过。`
  return `${actor} 掷出 ${log.dice}，来到「${cell.label}」。`
}

onMounted(async () => {
  loading.value = true
  try {
    worldId.value = await getActiveWorldId()
    const [characterRows, stored] = await Promise.all([
      db.characters.where('worldId').equals(worldId.value).toArray(),
      loadCoupleBoardGame(worldId.value)
    ])
    characters.value = characterRows.length ? characterRows : await db.characters.toArray()
    const firstAdult = characters.value.find(row => typeof row.age !== 'number' || row.age >= 18)
    selectedCharacterId.value = stored?.settings.characterId || firstAdult?.id || characters.value[0]?.id || ''
    savedGame.value = stored
    if (stored?.status === 'finished') game.value = stored
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (diceTimer) window.clearTimeout(diceTimer)
  if (noticeTimer) window.clearTimeout(noticeTimer)
})
</script>

<template>
  <PhoneFrame>
    <main class="love-game-shell" :class="{ 'is-game': screen === 'game' }">
      <div class="ambient ambient-a"></div>
      <div class="ambient ambient-b"></div>
      <div class="spark spark-1">✦</div>
      <div class="spark spark-2">♡</div>
      <div class="spark spark-3">✧</div>

      <header class="topbar">
        <button class="round-btn" aria-label="返回" @click="screen === 'game' ? goSetupKeepingGame() : router.push('/home')">‹</button>
        <div class="brand-lockup">
          <small>COUPLE BOARD</small>
          <b>心跳飞行棋</b>
        </div>
        <button class="round-btn ghost" aria-label="回到主屏幕" @click="router.push('/home')">⌂</button>
      </header>

      <section v-if="loading" class="loading-card">
        <span class="loading-heart">♥</span>
        <p>正在把棋盘铺好…</p>
      </section>

      <template v-else-if="screen === 'setup'">
        <section class="hero-card">
          <div class="hero-orbit">
            <div class="hero-dice">♥<span>⚄</span></div>
          </div>
          <div>
            <span class="eyebrow">TRUTH · DARE · LOVE</span>
            <h1>今晚，<br><em>让骰子替你开口。</em></h1>
            <p>你和一个角色，两枚棋子。真心话、大冒险、心动格和一点刚刚好的暧昧。</p>
          </div>
          <div class="hero-tags">
            <span>随时跳过</span><span>不自动发送</span><span>本地保存</span>
          </div>
        </section>

        <section v-if="savedGame?.status === 'playing'" class="resume-card">
          <div class="resume-avatars">
            <span>我</span>
            <span class="heart-link">♥</span>
            <CharacterAvatar :avatar="characters.find(row => row.id === savedGame?.settings.characterId)?.avatar || savedGame?.settings.characterAvatar" :name="savedGame?.settings.characterName" :size="36" />
          </div>
          <div>
            <small>上一局还没结束</small>
            <b>和 {{ savedGame.settings.characterName }} · 第 {{ savedGame.turn }} 回合</b>
          </div>
          <button @click="resumeGame">继续</button>
        </section>

        <section class="setup-section">
          <header><span>01</span><div><b>选你的搭档</b><small>这一局只属于你们两个</small></div></header>
          <div v-if="characters.length" class="character-row">
            <button
              v-for="character in characters"
              :key="character.id"
              class="character-chip"
              :class="{ selected: selectedCharacterId === character.id }"
              @click="selectedCharacterId = character.id"
            >
              <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="42" />
              <span><b>{{ character.name }}</b><small>{{ character.age ? `${character.age} 岁` : '年龄未设置' }}</small></span>
              <i>✓</i>
            </button>
          </div>
          <button v-else class="empty-button" @click="router.push('/characters/new')">还没有角色 · 去创建一个搭档</button>
        </section>

        <section class="setup-section">
          <header><span>02</span><div><b>怎么玩</b><small>聊天里玩，或者两个人面对面</small></div></header>
          <div class="mode-grid">
            <button :class="{ selected: mode === 'chat' }" @click="mode = 'chat'">
              <i>💌</i><b>聊天互动</b><small>题目可以一键带回知间聊天</small>
            </button>
            <button :class="{ selected: mode === 'reality' }" @click="mode = 'reality'">
              <i>🥂</i><b>面对面</b><small>加入拥抱、对视等现实互动</small>
            </button>
          </div>
        </section>

        <section class="setup-section intensity-section">
          <header><span>03</span><div><b>心跳浓度</b><small>高等级会混入低等级题目，不会突然跳档</small></div></header>
          <div class="intensity-grid">
            <button
              v-for="level in INTENSITIES"
              :key="level.value"
              :class="{ selected: intensity === level.value, adult: level.value === 4 }"
              @click="chooseIntensity(level.value)"
            >
              <span class="level-number">0{{ level.value }}</span>
              <span><b>{{ level.title }}</b><small>{{ level.subtitle }}</small></span>
              <em v-if="level.badge">{{ level.badge }}</em>
            </button>
          </div>
          <label v-if="intensity === 4" class="adult-confirm" :class="{ blocked: partnerKnownMinor }">
            <input v-model="adultConfirmed" type="checkbox" :disabled="partnerKnownMinor">
            <span class="checkmark">✓</span>
            <span>
              <b>{{ partnerKnownMinor ? '该角色年龄明确小于 18 岁，无法开启成人模式' : '确认双方均为成年人，并同意成人向题目' }}</b>
              <small>成人档仍以同意、边界和随时退出为前提，不会替任何一方默认同意。</small>
            </span>
          </label>
        </section>

        <section class="ready-card">
          <div>
            <small>READY TO PLAY</small>
            <b>{{ selectedCharacter?.name || '选择搭档' }} · {{ selectedModeLabel }} · {{ selectedIntensity.title }}</b>
          </div>
          <button :disabled="!selectedCharacter" @click="startGame"><span>开始这一局</span><i>→</i></button>
        </section>
      </template>

      <template v-else-if="game">
        <section class="game-head">
          <div class="player-card" :class="{ active: game.currentPlayer === 'user' && !game.pending }">
            <div class="avatar user-avatar">我</div>
            <div><small>YOU</small><b>我</b><span>♥ {{ game.players.user.hearts }}</span></div>
            <em>第 {{ game.players.user.position }} 格</em>
          </div>
          <div class="versus"><span>♥</span><small>TURN {{ game.turn }}</small></div>
          <div class="player-card partner" :class="{ active: game.currentPlayer === 'partner' && !game.pending }">
            <CharacterAvatar :avatar="selectedCharacter?.avatar || game.settings.characterAvatar" :name="selectedCharacter?.name || game.settings.characterName" :size="42" />
            <div><small>PARTNER</small><b>{{ game.players.partner.name }}</b><span>♥ {{ game.players.partner.hearts }}</span></div>
            <em>第 {{ game.players.partner.position }} 格</em>
          </div>
        </section>

        <section class="board-card">
          <div class="board-topline">
            <div><small>{{ turnHint }}</small><b>{{ lastEventLabel() }}</b></div>
            <span>{{ game.settings.mode === 'chat' ? '💌 聊天' : '🥂 面对面' }} · {{ INTENSITIES.find(row => row.value === game?.settings.intensity)?.title }}</span>
          </div>

          <div class="board-grid">
            <div class="board-ribbon ribbon-one"></div>
            <div class="board-ribbon ribbon-two"></div>
            <div
              v-for="cell in COUPLE_BOARD_CELLS"
              :key="cell.index"
              class="board-cell"
              :class="[`cell-${cell.type}`, { occupied: playerOnCell('user', cell.index) || playerOnCell('partner', cell.index) }]"
              :style="boardCellStyle(cell.index)"
            >
              <small>{{ cell.index === 0 ? 'S' : cell.index === 29 ? '♥' : cell.index }}</small>
              <span>{{ cell.emoji }}</span>
              <b>{{ cell.label }}</b>
              <div class="tokens">
                <i v-if="playerOnCell('user', cell.index)" class="token token-user">我</i>
                <i v-if="playerOnCell('partner', cell.index)" class="token token-partner">{{ game.settings.characterAvatar || '♥' }}</i>
              </div>
            </div>
          </div>
        </section>

        <section v-if="game.status === 'playing'" class="dice-dock">
          <div>
            <small>{{ game.pending ? 'CHALLENGE ACTIVE' : 'ROLL THE DICE' }}</small>
            <b>{{ game.pending ? `${pendingActorName} 的题目还没完成` : `轮到 ${currentPlayer?.name}` }}</b>
          </div>
          <button class="dice-button" :class="{ rolling: diceRolling }" :disabled="Boolean(game.pending) || diceRolling" @click="rollDice">
            <span>{{ diceGlyph }}</span><small>{{ diceRolling ? '...' : '掷' }}</small>
          </button>
        </section>

        <section v-else class="finish-card">
          <small>HEARTBEAT FINISH</small>
          <h2>{{ winnerName }} 先到终点 ♡</h2>
          <p>这局一共完成 {{ game.players.user.completed + game.players.partner.completed }} 个挑战，跳过 {{ game.players.user.skipped + game.players.partner.skipped }} 个。跳过不是失败，舒服地玩完才是。</p>
          <div><button @click="rematch">再来一局</button><button class="secondary" @click="abandonGame">回到设置</button></div>
        </section>

        <div v-if="game.pending && pendingPrompt" class="challenge-backdrop">
          <section class="challenge-sheet">
            <div class="sheet-handle"></div>
            <header>
              <span :class="pendingPrompt.type">{{ pendingPrompt.type === 'truth' ? 'TRUTH' : 'DARE' }}</span>
              <div><small>{{ pendingActorName }} · 第 {{ game.pending.cellIndex }} 格</small><b>{{ pendingPrompt.type === 'truth' ? '真心话' : '大冒险' }}</b></div>
              <em>♥ +2</em>
            </header>
            <p class="challenge-text">{{ pendingText }}</p>
            <div class="consent-note"><span>♡</span><p><b>舒服比输赢重要。</b><small>任何题目都能跳过或换题；现实动作必须由参与者自己同意。</small></p></div>
            <div class="challenge-actions">
              <button class="complete" @click="completeChallenge">完成了 <span>+2 ♥</span></button>
              <button @click="replaceChallenge">换一题</button>
              <button @click="skipChallenge">跳过</button>
            </div>
            <button class="chat-share" @click="bringChallengeToChat">💌 带到知间聊天里完成 <span>不会自动发送 →</span></button>
          </section>
        </div>
      </template>

      <transition name="toast"><div v-if="notice" class="toast">{{ notice }}</div></transition>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.love-game-shell{
  --wine:#6f2748;--rose:#c35e82;--blush:#f7d9df;--cream:#fff9f5;--ink:#4a2a38;--muted:#9f7c89;
  position:relative;min-height:100%;height:100%;overflow:auto;background:
    radial-gradient(120% 58% at 15% -5%,rgba(255,224,231,.92),transparent 62%),
    radial-gradient(85% 50% at 100% 5%,rgba(219,183,231,.52),transparent 58%),
    linear-gradient(180deg,#fffaf7 0%,#f9eef0 52%,#f7e8ec 100%);color:var(--ink);padding:0 16px 30px;font-family:Inter,"SF Pro Display","PingFang SC",sans-serif;
}
.love-game-shell.is-game{background:radial-gradient(100% 55% at 50% -10%,#eac5d7 0%,transparent 60%),linear-gradient(180deg,#fff8f6,#f7ecef 55%,#f4e5ea)}
.ambient{position:absolute;border-radius:999px;filter:blur(30px);pointer-events:none;opacity:.5}.ambient-a{width:150px;height:150px;background:#eac0d7;top:140px;right:-90px}.ambient-b{width:120px;height:120px;background:#ffe4cf;top:520px;left:-80px}.spark{position:absolute;color:rgba(137,63,93,.22);pointer-events:none}.spark-1{top:84px;right:35px;font-size:22px}.spark-2{top:265px;left:14px;font-size:16px}.spark-3{top:446px;right:24px;font-size:20px}
.topbar{position:sticky;top:0;z-index:30;display:grid;grid-template-columns:40px 1fr 40px;align-items:center;padding:13px 0 10px;background:linear-gradient(180deg,rgba(255,249,247,.92),rgba(255,249,247,.72),transparent);backdrop-filter:blur(12px)}.round-btn{width:36px;height:36px;border:1px solid rgba(105,54,74,.1);border-radius:50%;background:rgba(255,255,255,.72);box-shadow:0 8px 20px rgba(88,48,65,.08);color:#75445a;font-size:27px;line-height:1}.round-btn.ghost{font-size:17px}.brand-lockup{text-align:center;display:grid;gap:1px}.brand-lockup small{font-size:7px;letter-spacing:.24em;color:#ba8498}.brand-lockup b{font-size:13px;letter-spacing:.04em}
.loading-card{margin:35vh auto 0;display:grid;place-items:center;gap:8px}.loading-heart{font-size:26px;color:#c05f82;animation:pulse 1s ease-in-out infinite}.loading-card p{margin:0;color:#9d7887;font-size:11px}@keyframes pulse{50%{transform:scale(1.18);opacity:.65}}
.hero-card{position:relative;margin:6px 0 14px;padding:23px 20px 18px;overflow:hidden;border:1px solid rgba(117,56,80,.08);border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(255,244,245,.74));box-shadow:0 24px 60px rgba(104,56,76,.12)}.hero-card:after{content:"";position:absolute;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle,#edc3d0,transparent 67%);right:-65px;top:-55px;opacity:.65}.hero-card>div:not(.hero-orbit){position:relative;z-index:2}.eyebrow{font-size:7px;font-weight:800;letter-spacing:.22em;color:#b66b87}.hero-card h1{margin:9px 0 9px;font-family:Georgia,"Songti SC",serif;font-size:30px;line-height:1.06;font-weight:500;letter-spacing:-.05em}.hero-card h1 em{font-style:normal;color:#a74268}.hero-card p{max-width:245px;margin:0;color:#8d6e7b;font-size:10px;line-height:1.65}.hero-orbit{position:absolute;z-index:1;right:22px;top:26px;width:76px;height:76px;border:1px solid rgba(157,75,106,.16);border-radius:50%;display:grid;place-items:center;transform:rotate(9deg)}.hero-orbit:before,.hero-orbit:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(157,75,106,.11)}.hero-orbit:before{inset:8px}.hero-orbit:after{inset:-8px}.hero-dice{width:45px;height:45px;border-radius:15px;background:linear-gradient(145deg,#9a3e64,#d97f99);box-shadow:0 13px 28px rgba(142,55,89,.26),inset 0 1px rgba(255,255,255,.5);display:grid;place-items:center;color:#fff;font-size:12px;transform:rotate(-10deg)}.hero-dice span{position:absolute;font-size:24px;color:#fff}.hero-tags{display:flex;gap:5px;margin-top:15px}.hero-tags span{padding:5px 8px;border-radius:999px;background:#f7ecef;color:#98677a;font-size:7px;font-weight:700}
.resume-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;margin:12px 0;padding:11px 12px;border-radius:20px;background:linear-gradient(115deg,#6f2748,#9f4265);color:#fff;box-shadow:0 14px 32px rgba(108,39,72,.18)}.resume-avatars{display:flex;align-items:center}.resume-avatars>span:first-child{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fff1f4;color:#963e60;font-size:9px;font-weight:800}.heart-link{margin:0 -3px;color:#ffdae4;font-size:10px;z-index:2}.resume-card>div:nth-child(2){display:grid;gap:2px}.resume-card small{font-size:7px;opacity:.68}.resume-card b{font-size:10px}.resume-card button{border:0;border-radius:999px;background:#fff;color:#8b3458;padding:7px 11px;font-size:8px;font-weight:800}
.setup-section{margin:20px 0}.setup-section>header{display:flex;align-items:center;gap:9px;margin-bottom:9px}.setup-section>header>span{font:italic 14px Georgia,serif;color:#c68ca0}.setup-section>header>div{display:grid}.setup-section>header b{font-size:12px}.setup-section>header small{color:#a68894;font-size:7px;margin-top:1px}.character-row{display:flex;gap:8px;overflow-x:auto;padding:3px 1px 6px;scrollbar-width:none}.character-row::-webkit-scrollbar{display:none}.character-chip{position:relative;min-width:143px;display:grid;grid-template-columns:44px 1fr 16px;align-items:center;gap:8px;border:1px solid rgba(103,52,73,.08);border-radius:18px;background:rgba(255,255,255,.72);padding:9px;text-align:left;color:var(--ink);box-shadow:0 8px 22px rgba(101,60,76,.06)}.character-chip.selected{border-color:rgba(175,72,112,.3);background:#fff7f8;box-shadow:0 10px 25px rgba(147,62,94,.12)}.character-chip span{display:grid;min-width:0}.character-chip b{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.character-chip small{margin-top:2px;font-size:7px;color:#ad8b98}.character-chip i{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#eee0e5;color:transparent;font-size:8px;font-style:normal}.character-chip.selected i{background:#a84569;color:#fff}.empty-button{width:100%;border:1px dashed #d5aabc;border-radius:16px;background:#fff8fa;color:#9d5f79;padding:15px;font-size:9px}.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mode-grid button{display:grid;grid-template-columns:32px 1fr;grid-template-rows:auto auto;column-gap:7px;align-items:center;text-align:left;border:1px solid rgba(103,52,73,.08);border-radius:18px;background:rgba(255,255,255,.7);padding:11px;color:var(--ink)}.mode-grid button.selected{border-color:#d39aaf;background:linear-gradient(145deg,#fff,#fff3f6);box-shadow:0 10px 25px rgba(147,62,94,.1)}.mode-grid i{grid-row:1/3;width:32px;height:32px;border-radius:11px;background:#f6e8ed;display:grid;place-items:center;font-style:normal;font-size:16px}.mode-grid b{font-size:9px}.mode-grid small{font-size:6.5px;color:#a88794;line-height:1.3}
.intensity-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.intensity-grid button{position:relative;display:grid;grid-template-columns:27px 1fr;align-items:center;gap:7px;border:1px solid rgba(103,52,73,.07);border-radius:15px;background:rgba(255,255,255,.65);padding:10px 8px;text-align:left;color:var(--ink)}.intensity-grid button.selected{border-color:#cd8ca5;background:#fff7f9;box-shadow:0 8px 22px rgba(140,61,92,.08)}.intensity-grid button.adult{background:linear-gradient(145deg,rgba(88,36,58,.93),rgba(123,45,73,.9));color:#fff}.intensity-grid button.adult small{color:#eec8d5}.level-number{font:italic 15px Georgia,serif;color:#be7b95}.adult .level-number{color:#f1b6cb}.intensity-grid button>span:nth-child(2){display:grid}.intensity-grid b{font-size:9px}.intensity-grid small{font-size:6.3px;color:#a88995;margin-top:2px}.intensity-grid em{position:absolute;right:7px;top:6px;padding:2px 4px;border-radius:5px;background:#fff0f4;color:#923a5c;font-size:6px;font-style:normal;font-weight:900}.adult-confirm{display:grid;grid-template-columns:22px 1fr;gap:8px;margin-top:8px;padding:10px;border-radius:15px;background:rgba(101,43,66,.06);cursor:pointer}.adult-confirm input{display:none}.checkmark{width:20px;height:20px;border-radius:7px;border:1px solid #c99aae;background:#fff;display:grid;place-items:center;color:transparent;font-size:9px}.adult-confirm input:checked+.checkmark{background:#8f385c;color:#fff;border-color:#8f385c}.adult-confirm>span:last-child{display:grid}.adult-confirm b{font-size:8px}.adult-confirm small{font-size:6.5px;line-height:1.4;color:#9f7c89;margin-top:2px}.adult-confirm.blocked{opacity:.58;cursor:not-allowed}
.ready-card{position:sticky;bottom:8px;z-index:20;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:24px;padding:12px 12px 12px 14px;border:1px solid rgba(255,255,255,.7);border-radius:20px;background:rgba(82,36,55,.93);backdrop-filter:blur(14px);box-shadow:0 20px 40px rgba(84,37,56,.25);color:#fff}.ready-card>div{display:grid}.ready-card small{font-size:6px;letter-spacing:.16em;color:#d9a8ba}.ready-card b{font-size:9px;margin-top:3px}.ready-card button{display:flex;align-items:center;gap:8px;border:0;border-radius:13px;background:#fff;color:#7c2e4f;padding:9px 10px;font-size:8px;font-weight:900}.ready-card button:disabled{opacity:.4}.ready-card button i{font-size:13px;font-style:normal}
.game-head{display:grid;grid-template-columns:1fr 28px 1fr;gap:5px;align-items:center;margin:2px 0 10px}.player-card{position:relative;display:grid;grid-template-columns:38px 1fr;align-items:center;gap:7px;padding:8px;border:1px solid rgba(112,55,77,.07);border-radius:17px;background:rgba(255,255,255,.7);transition:.25s}.player-card.active{border-color:#d18ea8;background:#fff;box-shadow:0 10px 26px rgba(145,61,93,.12);transform:translateY(-1px)}.user-avatar{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#efd2dc,#d5a4b7);color:#7f3b56;font-size:9px;font-weight:800}.player-card>div:nth-child(2){display:grid;min-width:0}.player-card small{font-size:5.5px;letter-spacing:.12em;color:#ba8a9c}.player-card b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.player-card span{font-size:7px;color:#b14f75;margin-top:1px}.player-card em{position:absolute;right:7px;bottom:5px;font-size:5.5px;color:#b295a0;font-style:normal}.versus{text-align:center;display:grid;gap:1px}.versus span{color:#b34e75;font-size:12px}.versus small{font-size:5px;color:#b3909d}.board-card{position:relative;padding:11px;border:1px solid rgba(112,55,77,.07);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(255,246,248,.72));box-shadow:0 18px 45px rgba(102,55,73,.1);overflow:hidden}.board-topline{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:1px 2px 10px}.board-topline>div{display:grid}.board-topline small{font-size:6.5px;color:#af8193}.board-topline b{font-size:8px;margin-top:2px;max-width:215px}.board-topline>span{white-space:nowrap;padding:4px 6px;border-radius:999px;background:#f4e5ea;color:#9a5a73;font-size:5.8px}.board-grid{position:relative;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(6,54px);gap:4px}.board-ribbon{position:absolute;z-index:0;border:1px dashed rgba(177,91,122,.1);border-radius:999px;pointer-events:none}.ribbon-one{inset:18px 5px 98px}.ribbon-two{inset:105px 42px 12px}.board-cell{position:relative;z-index:1;min-width:0;display:grid;place-items:center;align-content:center;gap:0;border:1px solid rgba(118,63,83,.07);border-radius:14px;background:rgba(255,255,255,.78);box-shadow:0 4px 12px rgba(104,56,75,.04);transition:.25s}.board-cell>small{position:absolute;left:5px;top:4px;font-size:5px;color:#c0a1ad}.board-cell>span{font-size:14px;line-height:1}.board-cell>b{margin-top:2px;max-width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:5.5px;color:#8d6877}.cell-truth{background:linear-gradient(145deg,#fff,#f7f0fa)}.cell-dare{background:linear-gradient(145deg,#fff,#fff0f3)}.cell-heart{background:linear-gradient(145deg,#fff8fa,#f8dfe7)}.cell-surprise{background:linear-gradient(145deg,#fffdf7,#f9edd7)}.cell-boost{background:linear-gradient(145deg,#f8fbff,#e6edf9)}.cell-rewind{background:linear-gradient(145deg,#fbf7fb,#ece3ef)}.cell-start,.cell-finish{background:linear-gradient(145deg,#8b365a,#c36183);color:#fff}.cell-start>b,.cell-finish>b,.cell-start>small,.cell-finish>small{color:#fff}.board-cell.occupied{border-color:rgba(157,63,99,.28);box-shadow:0 7px 18px rgba(144,59,91,.13)}.tokens{position:absolute;right:3px;bottom:3px;display:flex}.token{width:17px;height:17px;margin-left:-3px;border:2px solid #fff;border-radius:50%;display:grid;place-items:center;box-shadow:0 3px 7px rgba(95,47,66,.18);font-size:5px;font-style:normal;font-weight:800;overflow:hidden}.token-user{background:#f8dce6;color:#833550}.token-partner{background:#873655;color:#fff;font-size:8px}
.dice-dock{position:sticky;bottom:9px;z-index:18;display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;margin-top:10px;padding:10px 10px 10px 13px;border-radius:19px;background:rgba(75,31,49,.94);color:#fff;box-shadow:0 18px 42px rgba(75,31,49,.28);backdrop-filter:blur(12px)}.dice-dock>div{display:grid}.dice-dock small{font-size:5.5px;letter-spacing:.15em;color:#dcb0c0}.dice-dock b{font-size:9px;margin-top:2px}.dice-button{width:53px;height:53px;border:0;border-radius:16px;background:linear-gradient(145deg,#fff,#f6dfe7);box-shadow:inset 0 1px #fff,0 8px 20px rgba(35,12,22,.22);color:#7f2e50;display:grid;place-items:center;align-content:center}.dice-button span{font-size:29px;line-height:.8}.dice-button small{font-size:6px;color:#9a5270;margin-top:3px}.dice-button:disabled{opacity:.48}.dice-button.rolling{animation:shake .13s linear infinite}@keyframes shake{25%{transform:rotate(5deg) translateY(-1px)}75%{transform:rotate(-5deg) translateY(1px)}}
.finish-card{margin-top:10px;padding:19px;border-radius:22px;background:linear-gradient(135deg,#7a2f50,#a5486a);color:#fff;box-shadow:0 18px 40px rgba(96,37,62,.2)}.finish-card>small{font-size:6px;letter-spacing:.18em;color:#e6b5c7}.finish-card h2{margin:6px 0;font:500 22px Georgia,"Songti SC",serif}.finish-card p{margin:0;color:#f1d9e2;font-size:8px;line-height:1.6}.finish-card>div{display:flex;gap:7px;margin-top:12px}.finish-card button{border:0;border-radius:11px;background:#fff;color:#7f3152;padding:8px 12px;font-size:8px;font-weight:800}.finish-card button.secondary{background:rgba(255,255,255,.13);color:#fff}
.challenge-backdrop{position:absolute;z-index:50;inset:0;display:flex;align-items:flex-end;background:rgba(67,27,44,.2);backdrop-filter:blur(3px);padding:0 8px 8px}.challenge-sheet{width:100%;padding:8px 14px 14px;border:1px solid rgba(255,255,255,.7);border-radius:27px 27px 22px 22px;background:linear-gradient(160deg,rgba(255,255,255,.98),rgba(255,244,247,.97));box-shadow:0 -22px 65px rgba(72,30,47,.22)}.sheet-handle{width:38px;height:4px;border-radius:999px;background:#e1cbd3;margin:0 auto 13px}.challenge-sheet>header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px}.challenge-sheet>header>span{padding:7px 8px;border-radius:10px;font-size:6.5px;font-weight:900;letter-spacing:.1em}.challenge-sheet>header>span.truth{background:#eee7f6;color:#7e668f}.challenge-sheet>header>span.dare{background:#f8e0e8;color:#a44468}.challenge-sheet>header>div{display:grid}.challenge-sheet header small{font-size:6px;color:#b58c9b}.challenge-sheet header b{font-size:11px}.challenge-sheet header em{font-size:8px;font-style:normal;color:#b34870}.challenge-text{margin:17px 3px 15px;font:500 18px/1.55 Georgia,"Songti SC",serif;color:#512f3c}.consent-note{display:flex;gap:8px;padding:9px 10px;border-radius:14px;background:#f7ecef}.consent-note>span{color:#b44d73}.consent-note p{display:grid;margin:0}.consent-note b{font-size:7.5px}.consent-note small{font-size:6.3px;line-height:1.45;color:#9e7a87;margin-top:1px}.challenge-actions{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:6px;margin-top:10px}.challenge-actions button{border:0;border-radius:12px;background:#f2e8eb;color:#875269;padding:10px 6px;font-size:8px;font-weight:800}.challenge-actions .complete{background:linear-gradient(135deg,#853555,#b64f73);color:#fff}.challenge-actions .complete span{font-size:6px;opacity:.72}.chat-share{width:100%;display:flex;justify-content:space-between;margin-top:7px;border:1px solid rgba(136,64,91,.1);border-radius:12px;background:#fff;color:#7a455a;padding:9px 10px;font-size:7.5px;text-align:left}.chat-share span{color:#b28a99;font-size:6.5px}.toast{position:fixed;z-index:80;left:50%;bottom:30px;transform:translateX(-50%);max-width:290px;padding:9px 13px;border-radius:999px;background:rgba(63,29,42,.92);box-shadow:0 8px 30px rgba(63,29,42,.2);color:#fff;font-size:8px;text-align:center}.toast-enter-active,.toast-leave-active{transition:.2s}.toast-enter-from,.toast-leave-to{opacity:0;transform:translate(-50%,8px)}
@media (max-width:370px){.love-game-shell{padding-left:11px;padding-right:11px}.hero-card h1{font-size:27px}.board-grid{grid-template-rows:repeat(6,49px)}.board-cell{border-radius:12px}.challenge-text{font-size:16px}.player-card{grid-template-columns:34px 1fr;padding:7px}.user-avatar{width:34px;height:34px}}
</style>
