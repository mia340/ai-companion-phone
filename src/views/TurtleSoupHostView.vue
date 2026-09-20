<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import {
  TurtleSoupUnconfiguredError,
  askGuesserGuess,
  askGuesserQuestion,
  rateSoupGame,
  soupHostFromCharacter
} from '../services/turtleSoupService'
import type { SoupHistoryTurn, TurtleSoupHost } from '../services/turtleSoupService'
import type { Character } from '../types/domain'

/**
 * 🎙️ 我当主持人 —— 反过来的海龟汤：
 * 我自己写「汤面 / 汤底」，从好友里挑一位（或 🐢）来猜。
 * 好友只见汤面、轮流问封闭问题，我用 是/不是/无关 作答（我是裁判）；
 * 随时可以「让 TA 猜一次」→ TA 交出推测，我裁 破案 / 没猜中。
 * 好友的 prompt 全程不掺我的汤底。
 */

type Phase = 'setup' | 'play' | 'end'
type HostLine = {
  from: 'me' | 'friend' | 'sys'
  text: string
  /** friend 一行是“提问”还是“交卷推测”，只影响计数。 */
  kind?: 'question' | 'guess'
}

const HOST_TURTLE_ID = '__turtle__'
const HOST_STATS_KEY = 'soupHost.stats'
const QUICK_ANSWERS = ['是', '不是', '无关', '我不能直说']

const phase = ref<Phase>('setup')
const titleDraft = ref('')
const situationDraft = ref('')
const solutionDraft = ref('')

const candidates = ref<Character[]>([])
const selectedGuesserId = ref<string>(HOST_TURTLE_ID)
const gameGuesser = ref<TurtleSoupHost | null>(null)

const turns = ref<HostLine[]>([])
const busy = ref(false)
const awaiting = ref(false)
const awaitingJudge = ref(false)
const unconfigured = ref(false)
const notice = ref('')
const startedAt = ref(0)
const endedSolved = ref(false)
const ratingText = ref('')
const stats = ref({ hosted: 0, brokenByFriend: 0, defended: 0 })
const scrollAnchor = ref<HTMLElement | null>(null)

let noticeTimer: number | undefined
const laterTimers = new Set<number>()

/** 我当主持人时没有现成叙述人设，给猜测方一段“主持人问话规则”的兜底。 */
function makeDefaultGuesser(): TurtleSoupHost {
  return {
    name: '老乌龟',
    kind: 'turtle',
    avatar: '🐢',
    persona: '一只好奇心重、有点倔的老乌龟，遇到怪事非要靠提问把它想明白。',
    speakingStyle: '慢悠悠的，爱用“嗯——”开头，想到哪问到哪。',
    relationship: '和你很熟，你答漏嘴时它会嘿嘿一乐。'
  }
}

function hasVoice(character: Character): boolean {
  return Boolean(
    character.persona?.trim() ||
      character.identity?.trim() ||
      character.speakingStyle?.trim()
  )
}

const guesserChips = computed(() => {
  const chips: Array<{ id: string; name: string; avatar: string }> = [
    { id: HOST_TURTLE_ID, name: '老乌龟', avatar: '🐢' }
  ]
  for (const character of candidates.value) {
    chips.push({
      id: character.id,
      name: character.name,
      avatar: character.avatar || '🙂'
    })
  }
  return chips
})

const friendQuestionCount = computed(
  () => turns.value.filter(line => line.from === 'friend' && line.kind === 'question').length
)

/** 供好友（猜测方）读取的问答史：好友=assistant、我=user；sys 提示行不入史。 */
const historyTurns = computed<SoupHistoryTurn[]>(() =>
  turns.value
    .filter(line => line.from === 'me' || line.from === 'friend')
    .map(line => ({
      role: line.from === 'me' ? 'user' : 'assistant',
      text: line.text
    }))
)

function resolveGuesser(): TurtleSoupHost {
  if (selectedGuesserId.value === HOST_TURTLE_ID) return makeDefaultGuesser()
  const character = candidates.value.find(item => item.id === selectedGuesserId.value)
  return character ? soupHostFromCharacter(character) : makeDefaultGuesser()
}

function showNotice(message: string) {
  notice.value = message
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    notice.value = ''
  }, 3400)
}

function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    laterTimers.delete(id)
    fn()
  }, ms)
  laterTimers.add(id)
}

function clearTimers() {
  laterTimers.forEach(id => window.clearTimeout(id))
  laterTimers.clear()
}

function loadStats() {
  try {
    const saved = localStorage.getItem(HOST_STATS_KEY)
    if (saved) {
      stats.value = { hosted: 0, brokenByFriend: 0, defended: 0, ...JSON.parse(saved) }
    }
  } catch {
    stats.value = { hosted: 0, brokenByFriend: 0, defended: 0 }
  }
}

function saveStats() {
  try {
    localStorage.setItem(HOST_STATS_KEY, JSON.stringify(stats.value))
  } catch {
    // 写不进就算了（隐私模式等）
  }
}

async function scrollToBottom() {
  await nextTick()
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

async function loadCandidates() {
  const worldId = await getActiveWorldId()
  const characters = await db.characters.where('worldId').equals(worldId).toArray()
  const list = characters.length ? characters : await db.characters.toArray()
  candidates.value = list
  if (list.length) {
    const preferred = list.find(hasVoice) ?? list[0]
    selectedGuesserId.value = preferred.id
  }
}

function backToSetup() {
  clearTimers()
  unconfigured.value = false
  phase.value = 'setup'
  turns.value = []
  gameGuesser.value = null
  endedSolved.value = false
}

function startHosting() {
  const situation = situationDraft.value.trim()
  const solution = solutionDraft.value.trim()
  const guesser = resolveGuesser()

  if (situation.length < 8) {
    showNotice('汤面再写具体点——TA 只能靠这段去猜。')
    return
  }
  if (solution.length < 4) {
    showNotice('写下完整真相（汤底），你才知道该判对还是判错。')
    return
  }

  gameGuesser.value = guesser
  unconfigured.value = false
  turns.value = [
    {
      from: 'sys',
      text: `你把这件事讲给了${guesser.name}听：\n\n${situation}\n\n真相（${titleDraft.value.trim() || '这锅汤'}）只有你知道，TA 得靠提问套出来。`
    },
    {
      from: 'sys',
      text: 'TA 会一个一个地用「是不是 / 不是」的问题来探你。你用下方快答或自己打句答复；随时可以点「让 TA 猜一次」，看 TA 拼出多少。'
    }
  ]
  phase.value = 'play'
  awaiting.value = false
  busy.value = false
  awaitingJudge.value = false
  startedAt.value = Date.now()
  stats.value.hosted += 1
  saveStats()
  void scrollToBottom()
  later(() => {
    void askFriendNext()
  }, 900)
}

async function askFriendNext() {
  if (busy.value || awaitingJudge.value || awaiting.value || phase.value !== 'play') return
  if (!gameGuesser.value) return
  busy.value = true
  try {
    const reply = await askGuesserQuestion(
      gameGuesser.value,
      situationDraft.value.trim(),
      historyTurns.value
    )
    if (phase.value !== 'play') return
    const text = reply || '……那、那个，那个人是不是你认识的？'
    turns.value.push({ from: 'friend', text, kind: 'question' })
    awaiting.value = true
  } catch (error) {
    if (error instanceof TurtleSoupUnconfiguredError) {
      unconfigured.value = true
      turns.value.push({ from: 'sys', text: '（好友说不上话了——TA 的 AI 还没配置好。）' })
    } else {
      turns.value.push({ from: 'sys', text: '（好友打了个喷嚏走神了，点「再想想」让它继续。）' })
    }
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

function submitAnswer(text: string) {
  const answer = text.trim()
  if (!answer || busy.value || !awaiting.value || awaitingJudge.value || phase.value !== 'play') {
    return
  }
  awaiting.value = false
  turns.value.push({ from: 'me', text: answer })
  void scrollToBottom().then(() => {
    later(() => {
      void askFriendNext()
    }, 700)
  })
}

async function askFriendGuess() {
  if (busy.value || awaitingJudge.value || phase.value !== 'play') return
  if (!gameGuesser.value) return
  busy.value = true
  awaiting.value = false
  try {
    const reply = await askGuesserGuess(
      gameGuesser.value,
      situationDraft.value.trim(),
      historyTurns.value
    )
    if (phase.value !== 'play') return
    if (reply.trim()) {
      turns.value.push({ from: 'friend', text: reply, kind: 'guess' })
      awaitingJudge.value = true
    } else {
      turns.value.push({
        from: 'sys',
        text: `（${gameGuesser.value.name}支支吾吾半天没敢说。）`
      })
      later(() => {
        void askFriendNext()
      }, 800)
    }
  } catch (error) {
    if (error instanceof TurtleSoupUnconfiguredError) {
      unconfigured.value = true
      turns.value.push({ from: 'sys', text: '（好友猜不动了——TA 的 AI 还没配置好。）' })
    } else {
      turns.value.push({ from: 'sys', text: '（好友这一猜噎住了，再试一次？）' })
      awaiting.value = true
    }
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

function judgeFriend(solved: boolean) {
  if (!awaitingJudge.value || phase.value !== 'play') return
  awaitingJudge.value = false
  if (solved) {
    endGame(true)
  } else {
    turns.value.push({ from: 'me', text: '不对哦，再想想。' })
    void scrollToBottom().then(() => {
      later(() => {
        void askFriendNext()
      }, 800)
    })
  }
}

function revealAndEnd() {
  if (busy.value || phase.value !== 'play') return
  awaiting.value = false
  awaitingJudge.value = false
  endGame(false)
}

function endGame(friendSolved: boolean) {
  if (!gameGuesser.value) return
  clearTimers()
  phase.value = 'end'
  endedSolved.value = friendSolved
  const questions = friendQuestionCount.value
  const seconds = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
  if (friendSolved) {
    const rating = rateSoupGame(questions, seconds)
    ratingText.value = `${rating.tag} · ${gameGuesser.value.name} 用了 ${questions} 问就把你的汤底套走了`
    stats.value.brokenByFriend += 1
  } else {
    ratingText.value = '🍽️ 没人破案——这锅汤底你守住了。'
    stats.value.defended += 1
  }
  saveStats()
}

onMounted(() => {
  void loadCandidates()
})

onUnmounted(() => {
  clearTimers()
  if (noticeTimer) window.clearTimeout(noticeTimer)
})

loadStats()
</script>

<template>
  <PhoneFrame
    title="我当主持人"
    show-back
  >
    <section class="host-page">
      <div class="host-stats">
        <span>出题 {{ stats.hosted }} 锅</span>
        <span>被破 {{ stats.brokenByFriend }} 锅</span>
        <span>守住 {{ stats.defended }} 锅</span>
      </div>

      <!-- ============ 出题页 ============ -->
      <template v-if="phase === 'setup'">
        <div class="soup-card intro">
          <div class="soup-emoji">🎙️</div>
          <h2>我当主持人</h2>
          <p class="intro-text">
            反过来玩：你写一桩<span class="hl">怪事（汤面）</span>和它背后的<span class="hl">真相（汤底）</span>，
            挑一位好友（或 🐢）来猜。TA 只能看到汤面、一个个地套你话；你答
            <b>是 / 不是 / 无关</b>，最后裁 TA 有没有破案。
          </p>

          <p class="label-title">汤面 —— 讲给好友听的那段怪事</p>
          <textarea
            v-model="situationDraft"
            class="field-input big"
            :maxlength="300"
            rows="4"
            placeholder="例：半夜 12 点，我家的猫突然对着门口一直哈气，可门外什么人都没有…"
          ></textarea>

          <p class="label-title">汤底 —— 完整真相（只有你知道，别给 TA 看见）</p>
          <textarea
            v-model="solutionDraft"
            class="field-input big"
            :maxlength="300"
            rows="3"
            placeholder="例：门口台阶上有只流浪猫被车撞过，我家的猫闻到了同类的血腥气才炸毛。"
          ></textarea>

          <input
            v-model="titleDraft"
            class="field-input"
            :maxlength="20"
            placeholder="给这锅起个名（可选）"
          />

          <p class="label-title">挑谁来猜：</p>
          <div class="host-row">
            <button
              v-for="chip in guesserChips"
              :key="chip.id"
              class="host-chip"
              :class="{ selected: selectedGuesserId === chip.id }"
              type="button"
              @click="selectedGuesserId = chip.id"
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

          <button
            class="start-btn"
            type="button"
            @click="startHosting"
          >
            端给 TA 猜 🍲
          </button>

          <p v-if="unconfigured" class="ai-notice">
            让好友动脑需要 AI，但「API 与模型」还没配置好。

            <button
              class="link-btn"
              type="button"
              @click="$router.push('/settings/models')"
            >
              去配置 →
            </button>
          </p>

          <button
            class="back-link"
            type="button"
            @click="$router.push('/app/海龟汤')"
          >
            ← 回「我来猜」玩法
          </button>
        </div>
      </template>

      <!-- ============ 对局页 ============ -->
      <template v-else-if="phase === 'play'">
        <div class="scenario-card">
          <p class="scenario-title">📋 汤面（你讲给{{ gameGuesser?.name }}的）</p>
          <p class="scenario-body">{{ situationDraft }}</p>
          <details class="secret-box">
            <summary>汤底 · 只有你看</summary>
            <p>{{ solutionDraft }}</p>
          </details>
        </div>

        <div class="qna-area">
          <div
            v-for="(line, index) in turns"
            :key="index"
            class="line"
            :class="line.from"
          >
            <template v-if="line.from === 'friend'">
              <span class="avatar friend-avatar">
                <CharacterAvatar
                  :avatar="gameGuesser?.avatar"
                  :name="gameGuesser?.name"
                  :size="26"
                />
              </span>
              <div class="talk-copy" :class="{ guess: line.kind === 'guess' }">
                <b class="line-name">{{ gameGuesser?.name }}</b>
                <div class="talk-text">
                  <template v-if="line.kind === 'guess'">
                    <span class="guess-tag">交卷 · </span>{{ line.text }}
                  </template>
                  <template v-else>{{ line.text }}</template>
                </div>
              </div>
            </template>
            <template v-else-if="line.from === 'me'">
              <div class="talk-copy talk-copy--mine">
                <b class="line-name">我</b>
                <div class="talk-text">{{ line.text }}</div>
              </div>
              <span class="avatar me-avatar">🎙️</span>
            </template>
            <div v-else class="sys-note">{{ line.text }}</div>
          </div>

          <div v-if="busy" class="line">
            <span class="avatar friend-avatar">
              <CharacterAvatar
                :avatar="gameGuesser?.avatar"
                :name="gameGuesser?.name"
                :size="26"
              />
            </span>
            <div class="talk-copy thinking">
              <b class="line-name">{{ gameGuesser?.name }}</b>
              <div class="talk-text">正在琢磨…</div>
            </div>
          </div>

          <div ref="scrollAnchor"></div>
        </div>

        <div class="composer-area">
          <!-- 好友交卷了：等你裁定 -->
          <div v-if="awaitingJudge" class="judge-bar">
            <p class="judge-tip">TA 的推测你看在眼里——破案还是差口气？</p>
            <div class="judge-actions">
              <button
                class="mini-btn primary"
                type="button"
                @click="judgeFriend(true)"
              >
                🎉 破案了
              </button>
              <button
                class="mini-btn"
                type="button"
                @click="judgeFriend(false)"
              >
                没猜中
              </button>
            </div>
          </div>

          <!-- 等 TA 发问：我作答 -->
          <div v-else-if="awaiting && !busy" class="answer-box">
            <div class="quick-row">
              <button
                v-for="answer in QUICK_ANSWERS"
                :key="answer"
                class="chip-btn"
                type="button"
                @click="submitAnswer(answer)"
              >
                {{ answer }}
              </button>
            </div>
          </div>

          <div v-else-if="busy" class="wait-tip">
            {{ gameGuesser?.name }} 想问题中，你先别抢答…
          </div>

          <div v-else class="wait-tip">
            {{ gameGuesser?.name }} 卡住了？点下面让它接着想。
          </div>

          <div class="tool-row">
            <button
              class="tool-btn"
              type="button"
              :disabled="busy || awaitingJudge || awaiting"
              @click="askFriendGuess"
            >
              🎯 让 TA 猜一次
            </button>
            <button
              class="tool-btn"
              type="button"
              :disabled="busy || awaitingJudge || awaiting"
              @click="askFriendNext"
            >
              🔁 让它再想想
            </button>
            <button
              class="tool-btn ghost"
              type="button"
              :disabled="busy || awaitingJudge"
              @click="revealAndEnd"
            >
              🍽️ 揭晓汤底
            </button>
          </div>
        </div>
      </template>

      <!-- ============ 结算页 ============ -->
      <template v-else>
        <div class="soup-card result">
          <div class="result-emoji">{{ endedSolved ? '😵' : '🛡️' }}</div>
          <h2>{{ endedSolved ? 'TA 把你的汤底套走了！' : '汤底守住啦' }}</h2>
          <p class="rating-text">{{ ratingText }}</p>

          <div class="solution-box">
            <p class="solution-title">🍲 {{ titleDraft || '这锅汤' }}</p>
            <p class="solution-body">{{ solutionDraft }}</p>
          </div>

          <div class="result-actions">
            <button
              class="start-btn"
              type="button"
              @click="backToSetup"
            >
              再出一锅 🍲
            </button>
            <button
              class="mini-btn"
              type="button"
              @click="$router.push('/app/海龟汤')"
            >
              去当玩家猜
            </button>
          </div>
        </div>
      </template>

      <Transition name="fade">
        <div v-if="notice" class="notice-toast">
          {{ notice }}
        </div>
      </Transition>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.host-page{
  --blue:#5f9fd2;--blue-deep:#3f7fab;--ink:#223747;--muted:#82919d;--line:#e8eef2;
  min-height:100%;display:flex;flex-direction:column;padding:10px 14px 16px;gap:10px;background:linear-gradient(180deg,#f8fbfd 0%,#f3f8fb 100%);color:var(--ink)
}
.host-stats{display:flex;gap:6px;flex-wrap:wrap;padding:0 1px;color:#8d99a3;font-size:10.5px}.host-stats span{padding:5px 8px;border-radius:999px;background:rgba(255,255,255,.82);border:1px solid rgba(53,84,107,.07)}
.soup-card{margin-top:6px;padding:21px 17px;border:1px solid rgba(55,89,114,.08);border-radius:22px;background:#fff;text-align:center;box-shadow:0 10px 30px rgba(47,79,103,.07)}.intro{margin-top:12px}.soup-emoji{width:72px;height:72px;display:grid;place-items:center;margin:0 auto 8px;border-radius:24px;background:linear-gradient(145deg,#edf6fc,#e8f0f8);font-size:34px}.soup-card h2{margin:5px 0 8px;color:#203646;font-size:20px;letter-spacing:-.02em}.intro-text{margin:0 auto 16px;max-width:320px;color:#627788;font-size:13px;line-height:1.75}.intro-text .hl,.intro-text b{color:#477fa7;font-weight:700}
.label-title{margin:12px 0 7px;text-align:left;color:#6d8190;font-size:12px;font-weight:700}.field-input{width:100%;box-sizing:border-box;margin:0 0 9px;padding:10px 12px;border:1px solid #e1e8ed;border-radius:13px;outline:none;background:#f9fbfc;color:#273c4c;font-size:13.5px;line-height:1.6;resize:none}.field-input:focus{border-color:#a8cbe5;background:#fff;box-shadow:0 0 0 3px rgba(95,159,210,.10)}.field-input.big{line-height:1.65}
.host-row{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 8px;scrollbar-width:none}.host-row::-webkit-scrollbar{display:none}.host-chip{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:62px;padding:8px 7px;border:1px solid #e5ebef;border-radius:15px;background:#fff;cursor:pointer}.host-chip.selected{border-color:#a8cce7;background:#f1f7fb;box-shadow:0 4px 13px rgba(66,111,144,.08)}.host-name{max-width:70px;overflow:hidden;color:#5f7383;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
.start-btn{margin-top:12px;min-width:150px;padding:11px 18px;border:0;border-radius:14px;background:#5f9fd2;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 18px rgba(78,137,181,.18);cursor:pointer}.ai-notice{margin:12px 0 0;color:#748795;font-size:12px;line-height:1.6}.link-btn{display:inline;border:0;background:none;padding:0;color:#4b87b2;font-weight:700;cursor:pointer}.back-link{display:block;margin:14px auto 0;border:0;background:none;color:#8293a0;font-size:12px;cursor:pointer}

.scenario-card{flex:0 0 auto;padding:12px 13px;border:1px solid #e5ebef;border-radius:15px;background:#fff}.scenario-title{margin:0 0 5px;color:#52728a;font-size:11.5px;font-weight:700}.scenario-body{margin:0;color:#2e414f;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word}.secret-box{margin-top:8px}.secret-box summary{cursor:pointer;color:#7890a2;font-size:11px}.secret-box p{margin:6px 0 0;padding:9px 10px;border-radius:10px;background:#f7f9fb;color:#415563;font-size:12.5px;line-height:1.6}
.qna-area{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;padding:4px 1px 10px}.line{display:flex;align-items:flex-start;gap:9px;padding:11px 2px;border-bottom:1px solid rgba(50,78,99,.055)}.line.me{justify-content:flex-end}.avatar{flex:0 0 auto;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;overflow:hidden}.me-avatar{background:#eaf2f7;font-size:14px}.talk-copy{min-width:0;max-width:82%;display:grid;gap:3px}.talk-copy--mine{text-align:right}.line-name{color:#58718a;font-size:10.5px;font-weight:700}.talk-copy--mine .line-name{color:#7092aa}.talk-text{color:#263a49;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}.talk-copy--mine .talk-text{color:#42657f}.talk-copy.guess .talk-text{color:#47677d}.thinking .talk-text{color:#8b99a4;font-style:italic}.guess-tag{color:#4c82a9;font-size:10.5px;font-weight:700}.sys-note{align-self:center;margin:8px auto;padding:0 12px;color:#8f9da7;font-size:11px;line-height:1.6;text-align:center}

.composer-area{flex:0 0 auto;display:flex;flex-direction:column;gap:8px;margin:0 -14px -16px;padding:9px 12px max(12px,env(safe-area-inset-bottom));border:0;border-top:1px solid rgba(52,82,104,.08);border-radius:0;background:rgba(250,253,255,.97);box-shadow:0 -8px 22px rgba(45,77,101,.035);backdrop-filter:blur(20px) saturate(150%)}.answer-box,.judge-bar{display:grid;gap:7px}.quick-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.chip-btn{padding:8px 5px;border:1px solid #e0e7ec;border-radius:10px;background:#f7fafc;color:#53758d;font-size:11.5px;font-weight:700;cursor:pointer}.wait-tip,.judge-tip{margin:0;color:#8695a0;font-size:11.5px;text-align:center}.judge-actions{display:flex;gap:7px;justify-content:center}.tool-row{display:flex;gap:6px}.tool-btn{flex:1;min-width:0;padding:8px 5px;border:0;border-radius:10px;background:#f3f6f8;color:#637888;font-size:11.5px;cursor:pointer}.tool-btn.ghost{background:transparent;color:#8b99a4}.tool-btn:disabled{opacity:.42}.mini-btn{padding:8px 10px;border:1px solid #e2e8ed;border-radius:11px;background:#fff;color:#657887;font-size:12px;cursor:pointer}.mini-btn.primary{border-color:transparent;background:#5f9fd2;color:#fff;font-weight:700}
.result{margin-top:16px}.result-emoji{font-size:44px}.rating-text{color:#6f8392;font-size:12.5px}.solution-box{margin:14px auto 16px;max-width:310px;padding:14px;border:1px solid #e8edf1;border-radius:15px;background:#f8fafb;text-align:left}.solution-title{margin:0 0 6px;color:#53738c;font-size:12.5px;font-weight:700}.solution-body{margin:0;color:#2f414e;font-size:13.5px;line-height:1.75;white-space:pre-wrap;word-break:break-word}.result-actions{display:flex;gap:8px;justify-content:center;align-items:center}
.notice-toast{position:fixed;z-index:30;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(340px,86vw);padding:9px 14px;border-radius:12px;background:rgba(34,49,62,.92);color:#fff;font-size:12px;text-align:center;box-shadow:0 8px 22px rgba(25,45,63,.18)}.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}.fade-enter-from,.fade-leave-to{opacity:0}
@media(max-width:390px){.quick-row{grid-template-columns:repeat(2,1fr)}}
</style>
