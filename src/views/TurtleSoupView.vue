<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref
} from 'vue'

import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import {
  TurtleSoupUnconfiguredError,
  askHostForClue,
  askHostQuestion,
  generateScenario,
  inspectQuestion,
  judgeSoupGuess,
  makeDefaultTurtleHost,
  rateSoupGame,
  soupHostFromCharacter
} from '../services/turtleSoupService'
import type {
  SoupDifficulty,
  SoupHistoryTurn,
  TurtleSoupHost,
  TurtleSoupScenario
} from '../services/turtleSoupService'
import type { Character } from '../types/domain'

type Phase = 'start' | 'play' | 'end'
type SoupLine = {
  from: 'me' | 'host' | 'sys'
  text: string
}

const DIFFICULTIES: Array<{ key: SoupDifficulty; desc: string }> = [
  { key: '简单', desc: '温和反转' },
  { key: '标准', desc: '正常谜底' },
  { key: '烧脑', desc: '藏得很深' }
]

const STATS_KEY = 'soup.stats'
const HOST_TURTLE_ID = '__turtle__'

const phase = ref<Phase>('start')
const difficulty = ref<SoupDifficulty>('标准')
const scenario = ref<TurtleSoupScenario | null>(null)
const turns = ref<SoupLine[]>([])
const draft = ref('')
const guessDraft = ref('')
const guessOpen = ref(false)
const clueShown = ref(false)
const busy = ref(false)
const loading = ref(false)
const endedSolved = ref(false)
const ratingText = ref('')
const notice = ref('')
const unconfigured = ref(false)
const startedAt = ref(0)
const stats = ref({ plays: 0, solved: 0, best: 0 })
const scrollAnchor = ref<HTMLElement | null>(null)

// —— 主持人：默认 🐢，也可选世界里的好友 ——
const hostCandidates = ref<Character[]>([])
const selectedHostId = ref<string>(HOST_TURTLE_ID)
const gameHost = ref<TurtleSoupHost>(makeDefaultTurtleHost())

let noticeTimer: number | undefined

const questionCount = computed(
  () => turns.value.filter(line => line.from === 'me').length
)
const historyTurns = computed<SoupHistoryTurn[]>(() =>
  turns.value
    .filter(line => line.from === 'me' || line.from === 'host')
    .map(line => ({
      role: line.from === 'me' ? 'user' : 'assistant',
      text: line.text
    }))
)

const hostChips = computed(() => {
  const chips: Array<{ id: string; name: string; avatar: string }> = [
    { id: HOST_TURTLE_ID, name: '普通主持人', avatar: '🐢' }
  ]
  for (const character of hostCandidates.value) {
    chips.push({
      id: character.id,
      name: character.name,
      avatar: character.avatar || '🙂'
    })
  }
  return chips
})

function hasVoice(character: Character): boolean {
  return Boolean(
    character.persona?.trim() ||
      character.identity?.trim() ||
      character.speakingStyle?.trim()
  )
}

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, 3200)
}

function loadStats() {
  try {
    const saved = localStorage.getItem(STATS_KEY)
    if (saved) stats.value = { plays: 0, solved: 0, best: 0, ...JSON.parse(saved) }
  } catch {
    stats.value = { plays: 0, solved: 0, best: 0 }
  }
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats.value))
  } catch {
    // 隐私模式等场景写不进就算了
  }
}

function resolveGameHost(): TurtleSoupHost {
  if (selectedHostId.value === HOST_TURTLE_ID) return makeDefaultTurtleHost()
  const character = hostCandidates.value.find(item => item.id === selectedHostId.value)
  return character ? soupHostFromCharacter(character) : makeDefaultTurtleHost()
}

async function scrollToBottom() {
  await nextTick()
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

async function loadHostCandidates() {
  const worldId = await getActiveWorldId()
  const characters = await db.characters.where('worldId').equals(worldId).toArray()
  const candidates = characters.length ? characters : await db.characters.toArray()
  hostCandidates.value = candidates
  if (candidates.length) {
    const preferred = candidates.find(hasVoice) ?? candidates[0]
    selectedHostId.value = preferred.id
  }
}

async function startNewGame() {
  if (loading.value) return
  loading.value = true
  unconfigured.value = false
  turns.value = []
  scenario.value = null
  clueShown.value = false
  guessOpen.value = false
  endedSolved.value = false
  phase.value = 'start'
  const host = resolveGameHost()
  gameHost.value = host
  try {
    const soup = await generateScenario(host, difficulty.value)
    scenario.value = soup
    phase.value = 'play'
    startedAt.value = Date.now()
    turns.value = [
      { from: 'host', text: `🍲 ${host.name} 讲了一个怪事：\n\n${soup.situation}` },
      {
        from: 'sys',
        text: `随便问 TA 什么都行（是不是 / 为什么 / 细节…）。TA 会用人设口吻回你，线索就藏在话里。问够了点「猜汤底」交卷。`
      }
    ]
    stats.value.plays += 1
    saveStats()
  } catch (error) {
    if (error instanceof TurtleSoupUnconfiguredError) {
      unconfigured.value = true
    } else {
      showNotice(error instanceof Error ? error.message : '出题失败，请重试。')
    }
  } finally {
    loading.value = false
  }
}

async function sendQuestion() {
  if (busy.value || phase.value !== 'play' || !scenario.value) return
  const check = inspectQuestion(draft.value)
  if (!check.ok) {
    showNotice(check.reason ?? '这个问题不太好说出口。')
    return
  }

  draft.value = ''
  const question = check.question
  // history 只能包含“上一轮以前”的内容。先取快照再把当前问题放进 UI，
  // 否则 service 会在 history 里看到一次、currentQuestion 又追加一次。
  const history = historyTurns.value
  turns.value.push({ from: 'me', text: question })
  busy.value = true
  await scrollToBottom()
  try {
    const reply = await askHostQuestion(
      scenario.value,
      gameHost.value,
      history,
      question
    )
    turns.value.push({
      from: 'host',
      text: reply || `（${gameHost.value.name}笑了笑，没接话。）`
    })
  } catch (error) {
    if (!(error instanceof TurtleSoupUnconfiguredError)) {
      turns.value.push({ from: 'sys', text: '（主持人走神了，你再问一遍试试。）' })
    } else {
      turns.value.push({ from: 'sys', text: '（主持人的 AI 没配置好，回不上了。）' })
    }
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

async function revealClue() {
  if (busy.value || phase.value !== 'play' || !scenario.value || clueShown.value) return
  busy.value = true
  try {
    const line = await askHostForClue(scenario.value, gameHost.value)
    clueShown.value = true
    turns.value.push({
      from: 'host',
      text: line || `（${gameHost.value.name}眯起眼：这句提示你可得自己品。）`
    })
  } catch (error) {
    if (error instanceof TurtleSoupUnconfiguredError) {
      turns.value.push({ from: 'sys', text: '（主持人的 AI 没配置好，给不了提示。）' })
    } else {
      turns.value.push({ from: 'sys', text: '（主持人把提示咽回去了，再试一次？）' })
    }
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

function toggleGuessBox() {
  if (!scenario.value || busy.value) return
  guessOpen.value = !guessOpen.value
  if (!guessOpen.value) guessDraft.value = ''
}

async function submitGuess() {
  if (busy.value || !scenario.value) return
  const guess = guessDraft.value.trim()
  if (!guess) {
    showNotice('先写下你对整件事的推测。')
    return
  }
  busy.value = true
  try {
    const solved = await judgeSoupGuess(scenario.value, guess)
    if (solved) {
      endGame(true, turns.value.filter(t => t.from === 'me').length)
    } else {
      guessDraft.value = ''
      guessOpen.value = false
      turns.value.push({
        from: 'sys',
        text: '裁判摇摇头：不对，还有些地方没对上。再挖挖细节。'
      })
      await scrollToBottom()
    }
  } catch {
    showNotice('裁判没听清你的推测，再交一次。')
  } finally {
    busy.value = false
  }
}

function giveUp() {
  if (busy.value) return
  endGame(false, questionCount.value)
}

function endGame(solved: boolean, questions: number) {
  if (!scenario.value) return
  phase.value = 'end'
  endedSolved.value = solved
  if (solved) {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
    ratingText.value = `${rateSoupGame(questions, seconds).tag} · 用了 ${questions} 问 · ${seconds} 秒`
    stats.value.solved += 1
    if (!stats.value.best || questions < stats.value.best) {
      stats.value.best = questions
    }
    saveStats()
  } else {
    ratingText.value = '这一锅看答案啦 🍽️ 下锅一定自己破！'
  }
}

onMounted(() => {
  void loadHostCandidates()
})

onUnmounted(() => {
  if (noticeTimer) window.clearTimeout(noticeTimer)
})

loadStats()
</script>

<template>
  <PhoneFrame
    title="海龟汤"
    show-back
  >
    <section class="soup-page">
      <div class="soup-stats">
        <span>已开 {{ stats.plays }} 锅</span>
        <span>破案 {{ stats.solved }} 锅</span>
        <span v-if="stats.best">最快 {{ stats.best }} 问破案</span>
        <span v-else>快破一锅看看 🐢</span>
      </div>

      <!-- ============ 开局页 ============ -->
      <template v-if="phase === 'start'">
        <div class="soup-card intro">
          <div class="soup-emoji">🍲</div>
          <h2>海龟汤</h2>
          <p class="intro-text">
            一位朋友给你端来一锅怪事。你随便问，TA
            用人设口吻跟你聊，线索就藏在话里；拼出真相就去「猜汤底」交卷。
          </p>

          <button
            class="mode-link"
            type="button"
            @click="$router.push('/app/海龟汤/主持')"
          >
            🎙️ 想反过来？你出题，让好友来猜 →
          </button>

          <p class="label-title">先选一位来主持：</p>
          <div class="host-row">
            <button
              v-for="chip in hostChips"
              :key="chip.id"
              class="host-chip"
              :class="{ selected: selectedHostId === chip.id }"
              type="button"
              @click="selectedHostId = chip.id"
            >
              <span class="host-avatar">
                <CharacterAvatar
                  :avatar="chip.avatar"
                  :name="chip.name"
                  :size="34"
                />
              </span>
              <span class="host-name">{{ chip.name }}</span>
            </button>
          </div>

          <div class="diff-row">
            <button
              v-for="item in DIFFICULTIES"
              :key="item.key"
              class="mini-btn diff-btn"
              :class="{ primary: difficulty === item.key }"
              type="button"
              @click="difficulty = item.key"
            >
              {{ item.key }}
              <small>{{ item.desc }}</small>
            </button>
          </div>

          <button
            class="start-btn"
            type="button"
            :disabled="loading"
            @click="startNewGame"
          >
            {{ loading ? '正在备汤…' : '开一锅 🍲' }}
          </button>

          <p v-if="unconfigured" class="ai-notice">
            开锅需要 AI 现编题目，但「API 与模型」还没配置好。

            <button
              class="link-btn"
              type="button"
              @click="$router.push('/settings/models')"
            >
              去配置 →
            </button>
          </p>
        </div>
      </template>

      <!-- ============ 对局页 ============ -->
      <template v-else-if="phase === 'play'">
        <div class="qna-area">
          <div
            v-for="(line, index) in turns"
            :key="index"
            class="line"
            :class="line.from"
          >
            <template v-if="line.from === 'host'">
              <span class="avatar host-avatar">
                <CharacterAvatar
                  :avatar="gameHost.avatar"
                  :name="gameHost.name"
                  :size="26"
                />
              </span>
              <div class="talk-copy">
                <b class="line-name">{{ gameHost.name }}</b>
                <div class="talk-text">{{ line.text }}</div>
              </div>
            </template>
            <template v-else-if="line.from === 'me'">
              <div class="talk-copy talk-copy--mine">
                <b class="line-name">我</b>
                <div class="talk-text">{{ line.text }}</div>
              </div>
              <span class="avatar me-avatar">🙂</span>
            </template>
            <div v-else class="sys-note">{{ line.text }}</div>
          </div>

          <div v-if="busy" class="line">
            <span class="avatar host-avatar">
              <CharacterAvatar
                :avatar="gameHost.avatar"
                :name="gameHost.name"
                :size="26"
              />
            </span>
            <div class="talk-copy thinking">
              <b class="line-name">{{ gameHost.name }}</b>
              <div class="talk-text">在琢磨…</div>
            </div>
          </div>

          <div ref="scrollAnchor"></div>
        </div>

        <div class="composer-area">
          <div v-if="guessOpen" class="guess-composer">
            <textarea
              v-model="guessDraft"
              class="guess-input"
              :maxlength="200"
              rows="3"
              placeholder="把整件事从头到尾讲一遍，作为你的汤底推测…"
            ></textarea>
            <div class="guess-actions">
              <button
                class="mini-btn"
                type="button"
                @click="toggleGuessBox"
              >
                收起
              </button>
              <button
                class="mini-btn primary"
                type="button"
                :disabled="busy"
                @click="submitGuess"
              >
                {{ busy ? '裁判判断中…' : '交卷' }}
              </button>
            </div>
          </div>

          <div v-else class="ask-composer">
            <textarea
              v-model="draft"
              class="ask-input"
              :maxlength="120"
              rows="1"
              :placeholder="`问 ${gameHost.name}：是不是 / 为什么…（第 ${questionCount + 1} 问）`"
              @keydown.enter.exact.prevent="sendQuestion"
            ></textarea>
            <button
              class="mini-btn primary send-btn"
              type="button"
              :disabled="busy"
              @click="sendQuestion"
            >
              问
            </button>
          </div>

          <div class="tool-row">
            <button
              class="tool-btn"
              type="button"
              :disabled="busy || clueShown"
              @click="revealClue"
            >
              💡 {{ clueShown ? '线索已给' : '套个提示' }}
            </button>
            <button
              class="tool-btn"
              type="button"
              :disabled="busy"
              @click="toggleGuessBox"
            >
              🍽️ 猜汤底
            </button>
            <button
              class="tool-btn ghost"
              type="button"
              :disabled="busy"
              @click="giveUp"
            >
              看答案
            </button>
          </div>
        </div>
      </template>

      <!-- ============ 结算页 ============ -->
      <template v-else>
        <div class="soup-card result">
          <div class="result-emoji">{{ endedSolved ? '🎉' : '🍽️' }}</div>
          <h2>{{ endedSolved ? '破案了！' : '汤底揭晓' }}</h2>
          <p class="rating-text">{{ ratingText }}</p>

          <div class="solution-box">
            <p class="solution-title">🍲 {{ scenario?.title }}</p>
            <p class="solution-body">{{ scenario?.solution }}</p>
          </div>

          <div class="result-actions">
            <button
              class="start-btn"
              type="button"
              @click="startNewGame"
            >
              再来一锅 🍲
            </button>
            <button
              class="mini-btn"
              type="button"
              @click="$router.push('/home')"
            >
              回桌面
            </button>
          </div>
        </div>
      </template>

      <!-- 顶部小提示 -->
      <Transition name="fade">
        <div v-if="notice" class="notice-toast">
          {{ notice }}
        </div>
      </Transition>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.soup-page{
  --blue:#5f9fd2;--blue-deep:#3f7fab;--ink:#223747;--muted:#82919d;--line:#e8eef2;
  min-height:100%;display:flex;flex-direction:column;padding:10px 14px 16px;gap:10px;background:linear-gradient(180deg,#f8fbfd 0%,#f3f8fb 100%);color:var(--ink)
}
.soup-stats{display:flex;gap:6px;flex-wrap:wrap;padding:0 1px;color:#8d99a3;font-size:10.5px}.soup-stats span{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.82);border:1px solid rgba(53,84,107,.07)}
.soup-card{margin-top:6px;padding:21px 17px;border:1px solid rgba(55,89,114,.08);border-radius:22px;background:#fff;text-align:center;box-shadow:0 10px 30px rgba(47,79,103,.07)}
.intro{margin-top:12px}.soup-emoji{width:72px;height:72px;display:grid;place-items:center;margin:0 auto 8px;border-radius:24px;background:linear-gradient(145deg,#edf6fc,#e5f2ed);font-size:36px}.soup-card h2{margin:5px 0 8px;color:#203646;font-size:20px;letter-spacing:-.02em}.intro-text{margin:0 auto 16px;max-width:320px;color:#627788;font-size:13px;line-height:1.75}.mode-link{display:block;width:100%;margin:0 0 16px;padding:10px 12px;border:1px solid #e3eaf0;border-radius:12px;background:#f7fafc;color:#527691;font-size:12px;font-weight:650;cursor:pointer}.label-title{margin:12px 0 7px;text-align:left;color:#6d8190;font-size:12px;font-weight:700}
.host-row{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 8px;scrollbar-width:none}.host-row::-webkit-scrollbar{display:none}.host-chip{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:62px;padding:8px 7px;border:1px solid #e5ebef;border-radius:15px;background:#fff;cursor:pointer}.host-chip.selected{border-color:#a8cce7;background:#f1f7fb;box-shadow:0 4px 13px rgba(66,111,144,.08)}.host-name{max-width:70px;overflow:hidden;color:#5f7383;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}.diff-row{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:4px 0 2px}.mini-btn{padding:8px 10px;border:1px solid #e2e8ed;border-radius:11px;background:#fff;color:#657887;font-size:12px;cursor:pointer}.diff-btn{display:grid;gap:2px}.diff-btn small{color:#9aa5ae;font-size:9.5px;font-weight:400}.mini-btn.primary,.diff-btn.primary{border-color:transparent;background:#eaf3fa;color:#3e7daa;font-weight:700}.start-btn{margin-top:14px;min-width:150px;padding:11px 18px;border:0;border-radius:14px;background:#5f9fd2;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 18px rgba(78,137,181,.18);cursor:pointer}.start-btn:disabled{opacity:.45}.ai-notice{margin:12px 0 0;color:#748795;font-size:12px;line-height:1.6}.link-btn{display:inline;border:0;background:none;padding:0;color:#4b87b2;font-weight:700;cursor:pointer}

.qna-area{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:4px 1px 10px}.line{display:flex;align-items:flex-start;gap:9px;padding:11px 2px;border-bottom:1px solid rgba(50,78,99,.055)}.line.me{justify-content:flex-end}.avatar{flex:0 0 auto;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;overflow:hidden}.me-avatar{background:#eaf2f7;font-size:14px}.talk-copy{min-width:0;max-width:82%;display:grid;gap:3px}.talk-copy--mine{text-align:right}.line-name{color:#58718a;font-size:10.5px;font-weight:700}.talk-copy--mine .line-name{color:#7092aa}.talk-text{color:#263a49;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}.talk-copy--mine .talk-text{color:#42657f}.thinking .talk-text{color:#8b99a4;font-style:italic}.sys-note{align-self:center;margin:8px auto;padding:0 12px;color:#8f9da7;font-size:11px;line-height:1.6;text-align:center}

.composer-area{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;margin:0 -14px -16px;padding:9px 12px max(12px,env(safe-area-inset-bottom));border:0;border-top:1px solid rgba(52,82,104,.08);border-radius:0;background:rgba(250,253,255,.97);box-shadow:0 -8px 22px rgba(45,77,101,.035);backdrop-filter:blur(20px) saturate(150%)}.ask-composer{display:grid;grid-template-columns:minmax(0,1fr) 56px;align-items:end;gap:7px}.ask-input,.guess-input{box-sizing:border-box;width:100%;min-width:0;min-height:44px;max-height:150px;padding:10px 12px;border:1px solid #e3ebf1;border-radius:15px;outline:none;background:#fff;color:#293d4d;font-size:13.5px;line-height:1.5;resize:vertical}.ask-input:focus,.guess-input:focus{border-color:#a8cbe5;box-shadow:0 0 0 3px rgba(95,159,210,.09)}.send-btn{min-width:56px;height:42px;padding:0 12px;border-radius:13px}.guess-composer{display:grid;gap:7px}.guess-actions{display:flex;justify-content:flex-end;gap:7px}.tool-row{display:flex;gap:6px}.tool-btn{flex:1;min-width:0;padding:8px 5px;border:0;border-radius:10px;background:#eef4f8;color:#637888;font-size:11.5px;cursor:pointer}.tool-btn.ghost{background:transparent;color:#8b99a4}.tool-btn:disabled{opacity:.42}

.result{margin-top:16px}.result-emoji{font-size:44px}.rating-text{color:#6f8392;font-size:12.5px}.solution-box{margin:14px auto 16px;max-width:310px;padding:14px;border:1px solid #e8edf1;border-radius:15px;background:#f8fafb;text-align:left}.solution-title{margin:0 0 6px;color:#53738c;font-size:12.5px;font-weight:700}.solution-body{margin:0;color:#2f414e;font-size:13.5px;line-height:1.75;white-space:pre-wrap;word-break:break-word}.result-actions{display:flex;gap:8px;justify-content:center;align-items:center}
.notice-toast{position:fixed;z-index:30;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(340px,86vw);padding:9px 14px;border-radius:12px;background:rgba(34,49,62,.92);color:#fff;font-size:12px;text-align:center;box-shadow:0 8px 22px rgba(25,45,63,.18)}.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}.fade-enter-from,.fade-leave-to{opacity:0}
</style>
