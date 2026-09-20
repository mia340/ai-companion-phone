<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import {
  MusicAiUnconfiguredError,
  musicCompanionGreeting,
  musicCompanionReply,
  neteaseOpenUrl,
  parseMusicLink,
  songDisplayLabel
} from '../services/musicCompanionService'
import type { ParsedMusicLink } from '../services/musicCompanionService'
import type { Character } from '../types/domain'

/**
 * 🎵 音乐 —— 边播边聊。
 * 网易云已把免登录站内播放焊死（外链 iframe 半下线 / 直链 404），所以这里不嵌播放器：
 * 贴网易云分享/链接/纯 id 只用于认歌 → 「去网易云听」跳到真实播放页；挑一位好友，
 * TA 用人设口吻陪你聊这首歌。
 */

type Phase = 'setup' | 'play'
type Line = { from: 'companion' | 'me' | 'sys'; text: string }

interface SavedMusicSession {
  version: 1
  characterId: string
  song: ParsedMusicLink
  lines: Line[]
}

const SESSION_KEY = 'music.listen.session'

const phase = ref<Phase>('setup')
const rawLink = ref('')
const candidates = ref<Character[]>([])
const characterId = ref('')
const activeCharacter = ref<Character | null>(null)
const song = ref<ParsedMusicLink | null>(null)
const lines = ref<Line[]>([])
const composer = ref('')
const busy = ref(false)
const unconfigured = ref(false)
const notice = ref('')
const isLoading = ref(true)
const scrollAnchor = ref<HTMLElement | null>(null)

let noticeTimer: number | undefined
const laterTimers = new Set<number>()

/** 设置页实时预览：输入里能不能解析出这首歌。 */
const parsed = computed(() => parseMusicLink(rawLink.value))
const parsedLabel = computed(() =>
  parsed.value ? songDisplayLabel(parsed.value) : ''
)

const openUrl = computed(() =>
  song.value ? neteaseOpenUrl(song.value.id) : ''
)
const songLabel = computed(() =>
  song.value ? songDisplayLabel(song.value) : ''
)

/** 喂给聊歌 API 的对话史：好友=assistant、我=user；sys 提示行不进历史。 */
const historyTurns = computed(() =>
  lines.value
    .filter(line => line.from === 'companion' || line.from === 'me')
    .map(line => ({
      role: (line.from === 'me' ? 'user' : 'assistant') as 'user' | 'assistant',
      text: line.text
    }))
)

function hasVoice(character: Character): boolean {
  return Boolean(
    character.persona?.trim() ||
      character.identity?.trim() ||
      character.speakingStyle?.trim()
  )
}

const companionChips = computed(() =>
  candidates.value.map(character => ({
    id: character.id,
    name: character.name,
    avatar: character.avatar || '🙂'
  }))
)

const canStart = computed(
  () => Boolean(parsed.value) && Boolean(characterId.value) && candidates.value.length > 0
)

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
  if (noticeTimer) window.clearTimeout(noticeTimer)
}

async function scrollToBottom() {
  await nextTick()
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

function saveSession() {
  if (!activeCharacter.value || !song.value) return
  const session: SavedMusicSession = {
    version: 1,
    characterId: activeCharacter.value.id,
    song: song.value,
    lines: lines.value
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // 隐私模式写不进就算了
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // 忽略
  }
}

async function loadCandidates() {
  const worldId = await getActiveWorldId()
  const characters = await db.characters.where('worldId').equals(worldId).toArray()
  candidates.value = characters.length ? characters : await db.characters.toArray()
  if (candidates.value.length) {
    const preferred = candidates.value.find(hasVoice) ?? candidates.value[0]
    characterId.value = preferred.id
  }
}

async function restoreSession() {
  let saved: SavedMusicSession | null = null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) saved = JSON.parse(raw) as SavedMusicSession
  } catch {
    saved = null
  }
  if (!saved || !saved.song?.id || saved.version !== 1) return

  const character = candidates.value.find(item => item.id === saved.characterId)
  if (!character) return

  activeCharacter.value = character
  characterId.value = character.id
  song.value = saved.song
  lines.value = saved.lines ?? []
  phase.value = 'play'
}

function startListening() {
  const parsedSong = parsed.value
  const character = candidates.value.find(item => item.id === characterId.value)
  if (!parsedSong) {
    showNotice('先贴一首网易云歌的链接/分享/纯 id。')
    return
  }
  if (!character) {
    showNotice('先挑一位陪你听歌的好友。')
    return
  }

  activeCharacter.value = character
  song.value = parsedSong
  lines.value = []
  unconfigured.value = false
  phase.value = 'play'
  saveSession()
  void scrollToBottom()
  later(() => {
    void greeting()
  }, 700)
}

async function greeting() {
  const character = activeCharacter.value
  const label = songLabel.value
  if (!character || !song.value || busy.value) return
  busy.value = true
  try {
    const text = await musicCompanionGreeting(character, label)
    if (phase.value !== 'play') return
    if (text.trim()) {
      lines.value.push({ from: 'companion', text })
      saveSession()
    }
  } catch (error) {
    handleTalkError(error)
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

function handleTalkError(error: unknown) {
  const companion = activeCharacter.value?.name ?? 'TA'
  if (error instanceof MusicAiUnconfiguredError) {
    unconfigured.value = true
    lines.value.push({
      from: 'sys',
      text: `（${companion}说不出话——TA 的 AI 还没配置好。）`
    })
    return
  }
  lines.value.push({
    from: 'sys',
    text: `（${companion}走神了，没接上话。再问一句试试？）`
  })
}

async function sendTalk() {
  const text = composer.value.trim()
  const character = activeCharacter.value
  const label = songLabel.value
  const history = historyTurns.value
  if (!text || busy.value || !character || !song.value) return
  composer.value = ''
  lines.value.push({ from: 'me', text })
  saveSession()
  void scrollToBottom()
  busy.value = true
  try {
    const reply = await musicCompanionReply(character, label, history, text)
    if (phase.value !== 'play') return
    if (reply.trim()) {
      lines.value.push({ from: 'companion', text: reply })
      saveSession()
    }
  } catch (error) {
    handleTalkError(error)
  } finally {
    busy.value = false
    await scrollToBottom()
  }
}

function changeSong() {
  clearTimers()
  lines.value = []
  unconfigured.value = false
  busy.value = false
  activeCharacter.value = null
  song.value = null
  phase.value = 'setup'
  saveSession()
  clearSession()
  void scrollToBottom()
}

onMounted(async () => {
  try {
    await loadCandidates()
    await restoreSession()
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  clearTimers()
})
</script>

<template>
  <PhoneFrame
    title="一起听"
    show-back
  >
    <section class="music-page">
      <!-- ============ 选歌 ============ -->
      <template v-if="phase === 'setup'">
        <div class="music-card intro">
          <div class="music-emoji">🎧</div>
          <h2>一起听歌</h2>
          <p class="intro-text">
            把一首网易云的<span class="hl">链接 / 分享文案 / 歌曲 id</span>贴进来，
            挑一位好友：点「去网易云听」跳到网易云播放（需登录），TA 用人设口吻陪你聊这首歌。
          </p>

          <p class="label-title">
            网易云歌曲（分享文本 / 链接 / 纯数字 id，<span class="hint">贴你能正常播放的歌，部分版权歌跳过去也放不了</span>）
          </p>
          <textarea
            v-model="rawLink"
            class="field-input"
            :maxlength="400"
            rows="3"
            placeholder="例：分享Vasen的单曲《起风了》: https://music.163.com/song?id=1363948882"
          ></textarea>

          <div class="sample-row">
            <span
              v-if="parsed"
              class="parsed-tag"
            >
              ✓ {{ parsedLabel }}
            </span>
            <span
              v-else-if="rawLink.trim()"
              class="parsed-tag bad"
            >
              没识别出歌曲，检查是不是网易云的单曲链接/纯 id
            </span>
          </div>

          <template v-if="companionChips.length">
            <p class="label-title">挑谁陪你听：</p>
            <div class="chip-row">
              <button
                v-for="chip in companionChips"
                :key="chip.id"
                class="chip"
                :class="{ selected: characterId === chip.id }"
                type="button"
                @click="characterId = chip.id"
              >
                <span class="chip-avatar">
                  <CharacterAvatar
                    :avatar="chip.avatar"
                    :name="chip.name"
                    :size="34"
                  />
                </span>
                <span class="chip-name">{{ chip.name }}</span>
              </button>
            </div>
          </template>
          <p
            v-else
            class="ai-notice"
          >
            世界里还没有好友——先去「通讯录」建一个角色，才能陪你听歌。
          </p>

          <button
            class="start-btn"
            type="button"
            :disabled="!canStart"
            @click="startListening"
          >
            ▶ 开始一起听
          </button>

          <p
            v-if="unconfigured"
            class="ai-notice"
          >
            让好友开口需要 AI，但「API 与模型」还没配好。

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

      <!-- ============ 播放 + 聊歌 ============ -->
      <template v-else>
        <div class="now-playing">
          <div class="song-head">
            <span class="song-dot">🎵</span>
            <div class="song-meta">
              <b>{{ songLabel }}</b>
              <small>{{ activeCharacter?.name }} 陪你一起听</small>
            </div>
            <button
              class="mini-btn"
              type="button"
              @click="changeSong"
            >
              换一首
            </button>
          </div>

          <div class="embed-wrap">
            <a
              class="open-btn"
              :href="openUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="open-ic">▶</span>
              <span class="open-tx">
                去网易云听
                <small>这首歌在网易云播放，需登录你自己的账号</small>
              </span>
              <span class="open-arrow">↗</span>
            </a>
            <p class="embed-tip">
              网易云已停掉网页外链播放（贴进来也点不响），所以这里直接跳真实播放页。手机没装 App 会先出网页版。
            </p>
          </div>
        </div>

        <div class="chat-area">
          <div
            v-for="(line, index) in lines"
            :key="index"
            class="line"
            :class="line.from"
          >
            <template v-if="line.from === 'companion'">
              <span class="avatar">
                <CharacterAvatar
                  :avatar="activeCharacter?.avatar"
                  :name="activeCharacter?.name"
                  :size="26"
                />
              </span>
              <div class="talk-copy">
                <b class="line-name">{{ activeCharacter?.name }}</b>
                <div class="talk-text">{{ line.text }}</div>
              </div>
            </template>
            <template v-else-if="line.from === 'me'">
              <div class="talk-copy talk-copy--mine">
                <b class="line-name">我</b>
                <div class="talk-text">{{ line.text }}</div>
              </div>
              <span class="avatar me-avatar">🎧</span>
            </template>
            <div
              v-else
              class="sys-note"
            >
              {{ line.text }}
            </div>
          </div>

          <div
            v-if="busy"
            class="line"
          >
            <span class="avatar">
              <CharacterAvatar
                :avatar="activeCharacter?.avatar"
                :name="activeCharacter?.name"
                :size="26"
              />
            </span>
            <div class="talk-copy thinking">
              <b class="line-name">{{ activeCharacter?.name }}</b>
              <div class="talk-text">正跟着节奏想…</div>
            </div>
          </div>

          <div ref="scrollAnchor"></div>
        </div>

        <div class="composer">
          <textarea
            v-model="composer"
            class="composer-input"
            rows="2"
            :maxlength="200"
            placeholder="跟 TA 聊聊这首歌…"
            @keydown.enter.exact.prevent="sendTalk"
          ></textarea>
          <button
            class="send-btn"
            type="button"
            :disabled="busy || !composer.trim()"
            @click="sendTalk"
          >
            发送
          </button>
        </div>

        <p
          v-if="unconfigured"
          class="ai-notice floating"
        >
          AI 还没配好，好友开不了口。

          <button
            class="link-btn"
            type="button"
            @click="$router.push('/settings/models')"
          >
            去配置 →
          </button>
        </p>
      </template>

      <div
        v-if="isLoading"
        class="loading-mask"
      >
        加载中…
      </div>

      <Transition name="fade">
        <div
          v-if="notice"
          class="notice-toast"
        >
          {{ notice }}
        </div>
      </Transition>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.music-page{
  --blue:#5f9fd2;--blue-deep:#3f7fab;--ink:#223747;--muted:#81909c;--line:#e8eef2;--soft:#f4f8fb;
  min-height:100%;display:flex;flex-direction:column;padding:12px 14px 18px;gap:10px;background:linear-gradient(180deg,#f8fbfd 0%,#f3f8fb 100%);color:var(--ink)
}
.music-card{margin-top:8px;padding:22px 18px;border:1px solid rgba(58,91,116,.08);border-radius:22px;background:#fff;text-align:center;box-shadow:0 10px 30px rgba(47,79,103,.07)}
.music-emoji{width:72px;height:72px;display:grid;place-items:center;margin:0 auto 8px;border-radius:24px;background:linear-gradient(145deg,#edf6fc,#dcecf8);font-size:36px;box-shadow:inset 0 1px 0 #fff}
.music-card h2{margin:5px 0 8px;color:#203646;font-size:20px;letter-spacing:-.02em}.intro-text{margin:0 auto 18px;max-width:320px;color:#627788;font-size:13px;line-height:1.75}.intro-text .hl{color:var(--blue-deep);font-weight:700}
.label-title{margin:14px 0 7px;text-align:left;color:#6d8190;font-size:12px;font-weight:700}.label-title .hint{font-weight:400;color:#a1adb6}
.field-input{width:100%;box-sizing:border-box;margin:0;border:1px solid #e1e8ed;border-radius:13px;background:#f9fbfc;padding:10px 12px;outline:none;color:#273c4c;font-size:13.5px;line-height:1.55;resize:none;transition:border-color .16s ease,box-shadow .16s ease}.field-input:focus{border-color:#a8cbe5;background:#fff;box-shadow:0 0 0 3px rgba(95,159,210,.10)}
.sample-row{display:flex;align-items:center;min-height:30px;margin:3px 0 7px;text-align:left}.parsed-tag{padding:5px 8px;border-radius:8px;background:#eef7f2;color:#478365;font-size:11px}.parsed-tag.bad{background:#fff3f3;color:#b86a70}
.chip-row{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 8px;scrollbar-width:none}.chip-row::-webkit-scrollbar{display:none}.chip{flex:0 0 auto;min-width:64px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 7px;border:1px solid #e5ebef;border-radius:15px;background:#fff;color:#5f7383;cursor:pointer}.chip.selected{border-color:#a8cce7;background:#f1f7fb;box-shadow:0 4px 13px rgba(66,111,144,.08)}.chip-name{max-width:72px;overflow:hidden;font-size:10.5px;text-overflow:ellipsis;white-space:nowrap}
.start-btn{margin-top:14px;min-width:160px;padding:11px 18px;border:0;border-radius:14px;background:#5f9fd2;color:#fff;font-size:14px;font-weight:700;box-shadow:0 8px 18px rgba(78,137,181,.18);cursor:pointer}.start-btn:disabled{opacity:.45}.ai-notice{margin:12px 0 0;color:#748795;font-size:12px;line-height:1.6}.link-btn{display:inline;border:0;background:none;padding:0;color:#4b87b2;font-weight:700;cursor:pointer}

.now-playing{flex:0 0 auto;padding:14px;border:1px solid rgba(55,89,114,.08);border-radius:19px;background:#fff;box-shadow:0 7px 22px rgba(45,77,102,.06)}.song-head{display:flex;align-items:center;gap:10px}.song-dot{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:13px;background:#edf5fb;font-size:20px}.song-meta{min-width:0;flex:1;display:grid;gap:3px;text-align:left}.song-meta b{overflow:hidden;color:#263b4b;font-size:13.5px;text-overflow:ellipsis;white-space:nowrap}.song-meta small{color:#8b99a4;font-size:10.5px}.mini-btn{padding:7px 10px;border:1px solid #e4eaee;border-radius:10px;background:#fff;color:#657887;font-size:11.5px;cursor:pointer}
.embed-wrap{margin-top:11px}.open-btn{display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:13px;background:#f4f8fb;color:#355f7e;text-decoration:none}.open-ic{width:31px;height:31px;display:grid;place-items:center;border-radius:50%;background:#5f9fd2;color:#fff;font-size:12px}.open-tx{min-width:0;flex:1;display:grid;gap:2px;text-align:left;font-size:12px;font-weight:700}.open-tx small{color:#8798a5;font-size:9.5px;font-weight:400}.open-arrow{color:#7d92a2}.embed-tip{margin:7px 2px 0;color:#99a5ae;font-size:9.5px;line-height:1.5;text-align:left}

.chat-area{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:0;padding:8px 2px 12px}.line{display:flex;align-items:flex-start;gap:9px;padding:11px 2px;border-bottom:1px solid rgba(50,78,99,.055)}.line.me{justify-content:flex-end}.avatar{flex:0 0 auto;width:28px;height:28px;display:grid;place-items:center;border-radius:50%;overflow:hidden}.me-avatar{background:#eaf2f7;font-size:14px}.talk-copy{min-width:0;max-width:82%;display:grid;gap:3px}.talk-copy--mine{text-align:right}.line-name{color:#58718a;font-size:10.5px;font-weight:700}.talk-copy--mine .line-name{color:#7092aa}.talk-text{color:#263a49;font-size:14px;line-height:1.68;white-space:pre-wrap;word-break:break-word}.talk-copy--mine .talk-text{color:#42657f}.thinking .talk-text{color:#8b99a4;font-style:italic}.sys-note{align-self:center;margin:8px auto;padding:0 12px;color:#98a4ad;font-size:11px;line-height:1.55;text-align:center}

.composer{flex:0 0 auto;display:flex;align-items:flex-end;gap:7px;padding:9px;border:1px solid rgba(52,82,104,.08);border-radius:17px;background:rgba(255,255,255,.94);box-shadow:0 7px 20px rgba(45,77,101,.06);backdrop-filter:blur(12px)}.composer-input{min-height:40px;max-height:90px;flex:1;padding:9px 11px;border:0;outline:none;background:transparent;color:#293d4d;font-size:13.5px;line-height:1.5;resize:none}.send-btn{min-width:54px;height:38px;border:0;border-radius:13px;background:#5f9fd2;color:#fff;font-size:12px;font-weight:700;cursor:pointer}.send-btn:disabled{opacity:.42}.ai-notice.floating{margin:0;text-align:center}.loading-mask{position:absolute;inset:0;display:grid;place-items:center;background:rgba(248,251,253,.78);color:#6f8190;font-size:13px;backdrop-filter:blur(8px)}
.notice-toast{position:fixed;z-index:30;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(340px,86vw);padding:9px 14px;border-radius:12px;background:rgba(34,49,62,.92);color:#fff;font-size:12px;text-align:center;box-shadow:0 8px 22px rgba(25,45,63,.18)}.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}.fade-enter-from,.fade-leave-to{opacity:0}
</style>
