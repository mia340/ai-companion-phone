<script setup lang="ts">
import { liveQuery } from 'dexie'
import {
  computed,
  onMounted,
  onUnmounted,
  ref
} from 'vue'

import CharacterAvatar from '../components/CharacterAvatar.vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { listCharacterSharedMemories } from '../services/memoryService'
import { useRouter } from 'vue-router'
import { findSingleConversation } from '../services/characterService'
import { prepareChatImage } from '../services/imageService'
import {
  MomentAiUnconfiguredError,
  generateCharacterComment,
  generateCharacterPost,
  generateCharacterReactionToUserPost
} from '../services/momentGenerationService'
import {
  MOMENT_MAX_COMMENT_LENGTH,
  MOMENT_MAX_CONTENT_LENGTH,
  MOMENT_MAX_IMAGES,
  addMomentComment,
  addMomentExternalLike,
  createCharacterMoment,
  createUserMoment,
  deleteMomentPost,
  getActiveWorldId,
  loadMomentFeed,
  resolveSelfDisplay,
  toggleMomentLike
} from '../services/momentService'
import {
  REPLY_HEAT_OPTIONS,
  getReplyHeat,
  isAutoMomentsEnabled,
  pickUserPostReactionAuthors,
  planReplyCount,
  setAutoMomentsEnabled,
  setReplyHeat
} from '../services/momentAutoActivityService'
import type { MomentReplyHeat } from '../services/momentAutoActivityService'

import type { MomentCommentItem, MomentFeedItem } from '../services/momentService'
import type { Character, MomentComment, MomentPost, MomentPostImage } from '../types/domain'

type ComposerMode = 'none' | 'mine' | 'character'

const feedItems = ref<MomentFeedItem[]>([])
const worldCharacters = ref<Character[]>([])
const selfDisplay = ref({ name: '我', avatar: '🙂' })
const activeWorldId = ref('world-default')
const router = useRouter()

let subscription: { unsubscribe: () => void } | undefined

// 顶部发布工具栏 / 状态
const composerMode = ref<ComposerMode>('none')
const myDraft = ref('')
const myImages = ref<MomentPostImage[]>([])
const preparingMomentImage = ref(false)
const selectedCharacterId = ref('')
const publishing = ref(false)
const aiHint = ref('')
const showSettingsHint = ref(false)

// 角色“偶尔自己发朋友圈”的开关（驱动在 main 里全局跑，这里只是给个控制）
const autoMomentsOn = ref(isAutoMomentsEnabled())
const showMomentControls = ref(false)

function toggleAutoMoments() {
  autoMomentsOn.value = !autoMomentsOn.value
  setAutoMomentsEnabled(autoMomentsOn.value)
  showNotice(
    autoMomentsOn.value
      ? '已开启：好友会偶尔自己发朋友圈。'
      : '已暂停：好友暂时不会自己发朋友圈了。',
    autoMomentsOn.value ? 'ok' : 'warn'
  )
}

// 我发动态后，好友来评论的“热度”（可前端调档，存 localStorage）
const replyHeat = ref<MomentReplyHeat>(getReplyHeat())
const replyHeatOptions = REPLY_HEAT_OPTIONS

function pickReplyHeat(key: MomentReplyHeat) {
  if (replyHeat.value === key) return
  replyHeat.value = key
  setReplyHeat(key)
  const option = REPLY_HEAT_OPTIONS.find(item => item.key === key)
  showNotice(
    option
      ? `${option.emoji} 已设为「${option.label}」：${option.desc}。`
      : '已更新回复热度。',
    'ok'
  )
}

// 点赞忙碌集合（乐观防抖）
const likingIds = ref<Set<string>>(new Set())

// 评论相关：每条动态只开一个输入框，草稿按 momentId 存
const openCommentId = ref<string | null>(null)
const commentDrafts = ref<Record<string, string>>({})
const replyTarget = ref<{
  momentId: string
  commentId: string
  authorType: 'character' | 'user'
  authorId: string
  authorName: string
  content: string
} | null>(null)
const replyingMomentId = ref<string | null>(null)
const replyingCharacterName = ref('')
const replyingCharacterAvatar = ref('🙂')

const noticeText = ref('')
const noticeKind = ref<'ok' | 'warn' | 'error'>('ok')
let noticeTimer: number | undefined

const characterOptions = computed(() => worldCharacters.value)

const MAX = {
  content: MOMENT_MAX_CONTENT_LENGTH,
  comment: MOMENT_MAX_COMMENT_LENGTH
}

function showNotice(message: string, kind: 'ok' | 'warn' | 'error' = 'ok') {
  noticeText.value = message
  noticeKind.value = kind
  if (noticeTimer) window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => {
    noticeText.value = ''
  }, 3400)
}

function isOwnPost(item: MomentFeedItem) {
  return item.post.authorType === 'user'
}

function openSelfComposer() {
  composerMode.value = 'mine'
  aiHint.value = ''
  showSettingsHint.value = false
}

function openCharacterComposer() {
  composerMode.value = 'character'
  aiHint.value = ''
  showSettingsHint.value = false
  if (!selectedCharacterId.value && worldCharacters.value.length) {
    selectedCharacterId.value = worldCharacters.value[0].id
  }
}

function cancelComposer() {
  composerMode.value = 'none'
  myDraft.value = ''
  myImages.value = []
  aiHint.value = ''
  showSettingsHint.value = false
}

function myRemaining() {
  return MAX.content - myDraft.value.length
}

async function handleMomentImages(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length || preparingMomentImage.value) return

  const remaining = Math.max(0, MOMENT_MAX_IMAGES - myImages.value.length)
  if (!remaining) {
    showNotice(`一条朋友圈最多放 ${MOMENT_MAX_IMAGES} 张图。`, 'warn')
    return
  }

  preparingMomentImage.value = true
  try {
    for (const file of files.slice(0, remaining)) {
      try {
        const prepared = await prepareChatImage(file, { allowOriginalFallback: true })
        myImages.value.push({
          dataUrl: prepared.dataUrl,
          name: prepared.name,
          width: prepared.width,
          height: prepared.height,
          bytes: prepared.bytes
        })
      } catch (error) {
        showNotice(error instanceof Error ? error.message : '这张图片处理失败。', 'error')
      }
    }
    if (files.length > remaining) {
      showNotice(`已保留前 ${remaining} 张；一条朋友圈最多 ${MOMENT_MAX_IMAGES} 张。`, 'warn')
    }
  } finally {
    preparingMomentImage.value = false
  }
}

function removeMomentImage(index: number) {
  myImages.value.splice(index, 1)
}

async function publishMyMoment() {
  if (publishing.value) return
  const content = myDraft.value.trim()
  if (!content && !myImages.value.length) {
    showNotice('写点内容，或者选几张照片再发布吧。', 'warn')
    return
  }

  publishing.value = true
  try {
    const post = await createUserMoment({ worldId: activeWorldId.value, content, images: myImages.value })
    myDraft.value = ''
    myImages.value = []
    composerMode.value = 'none'
    showNotice('发布成功，好友们会看到的。', 'ok')
    scheduleReactionsTo(post)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '发布失败。', 'error')
  } finally {
    publishing.value = false
  }
}

// —— 我发动态后，好友可能“路过评论” ——
// 与“好友自主发动态”开关独立；离开本页时清掉所有已排的定时器。
const reactionTimers = new Set<number>()

/** 随热度档位决定这次有没有人来、来几位（0 = 冷场）。 */
function rollReactionAuthors(): Character[] {
  if (!worldCharacters.value.length) return []
  const count = planReplyCount(replyHeat.value, worldCharacters.value.length)
  if (!count) return []
  return pickUserPostReactionAuthors(worldCharacters.value, count) as Character[]
}

function scheduleReactionsTo(post: MomentPost) {
  // ‘好友自主发动态’和‘好友回应我的动态’是两件事。
  // 用户主动发布后是否有人来互动，只由回复热度决定，不再被自主发动态开关误伤。
  const authors = rollReactionAuthors()
  if (!authors.length) return

  // 第一位约 2.5~6 秒后到；后续好友错峰出现，评论区更像真实多人互动。
  let delayMs = 2500 + Math.floor(Math.random() * 3500)
  for (const author of authors) {
    scheduleOneReaction(author, post, delayMs)
    delayMs += 4500 + Math.floor(Math.random() * 3500)
  }
}

function scheduleOneReaction(
  character: Character,
  post: MomentPost,
  delayMs: number
) {
  const timer = window.setTimeout(() => {
    reactionTimers.delete(timer)
    void runReaction(character, post)
  }, delayMs)
  reactionTimers.add(timer)
}

async function runReaction(character: Character, post: MomentPost) {
  try {
    const reply = await generateCharacterReactionToUserPost(
      character,
      selfDisplay.value.name,
      post.content || (post.images?.length ? '（发了一组图片，没有配文字。）' : '')
    )
    await addMomentExternalLike(post.id)
    await addMomentComment({
      momentId: post.id,
      worldId: post.worldId,
      authorType: 'character',
      authorId: character.id,
      content: reply.text,
      source: 'ai'
    })
    showNotice(`${character.name} 评论了你的动态。`, 'ok')
  } catch (error) {
    if (error instanceof MomentAiUnconfiguredError) {
      // 别让“好友想回但没配好 AI”变成无声失败——直接告诉用户去哪配。
      showNotice(
        `有人正想评论，但还没配好 AI。去「设置 → API 与模型」填好就能回你了。`,
        'warn'
      )
    } else {
      // 动态已被删、瞬时网络错也别打扰。
      console.warn(`${character.name} 路过评论失败：`, error)
    }
  }
}

function formatNowLabel(): string {
  const now = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const hour = now.getHours()
  const part = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 14 ? '中午' : hour < 18 ? '下午' : '晚上'
  return `${weekdays[now.getDay()]}${part} ${now.getHours()} 点多`
}

async function resolvePublishCharacter(): Promise<Character | undefined> {
  const id = selectedCharacterId.value
  if (!id) return undefined
  if (id !== '__random__') {
    return worldCharacters.value.find(character => character.id === id)
  }
  if (!worldCharacters.value.length) return undefined
  return worldCharacters.value[Math.floor(Math.random() * worldCharacters.value.length)]
}

async function publishCharacterMoment() {
  if (publishing.value) return

  const character = await resolvePublishCharacter()
  if (!character) {
    showNotice('请先选一位角色，或用「随便抽一位」。', 'warn')
    return
  }

  publishing.value = true
  aiHint.value = ''
  showSettingsHint.value = false

  try {
    const sharedMemories = await listCharacterSharedMemories(character.id)
    const generated = await generateCharacterPost(character, {
      contextLabel: formatNowLabel(),
      memoryHints: sharedMemories.map(memory => memory.content)
    })

    // 如果 TA 已经和你有单聊，把动态和那份聊天绑定，方便看完直接去聊。
    const conversation = await findSingleConversation(character.id, character.worldId)

    await createCharacterMoment({
      characterId: character.id,
      worldId: activeWorldId.value,
      content: generated.text,
      source: 'ai',
      aiModel: generated.model,
      conversationId: conversation?.id
    })

    composerMode.value = 'none'
    showNotice(`${character.name} 发了一条新动态。`, 'ok')
  } catch (error) {
    if (error instanceof MomentAiUnconfiguredError) {
      aiHint.value = error.message
      showSettingsHint.value = true
    } else {
      showNotice(error instanceof Error ? error.message : '生成失败，请重试。', 'error')
    }
  } finally {
    publishing.value = false
  }
}

async function onToggleLike(item: MomentFeedItem) {
  if (likingIds.value.has(item.post.id)) return
  likingIds.value = new Set(likingIds.value).add(item.post.id)

  try {
    await toggleMomentLike(item.post.id)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '操作失败。', 'error')
  } finally {
    const next = new Set(likingIds.value)
    next.delete(item.post.id)
    likingIds.value = next
  }
}

function toggleCommentBox(item: MomentFeedItem) {
  if (openCommentId.value === item.post.id) {
    openCommentId.value = null
    replyTarget.value = null
    return
  }
  openCommentId.value = item.post.id
  replyTarget.value = null
}

function beginCommentReply(item: MomentFeedItem, entry: MomentCommentItem) {
  // 当前只有一个真实用户身份；点自己的评论不进入“回复自己”。
  if (entry.author.type === 'user') return
  openCommentId.value = item.post.id
  replyTarget.value = {
    momentId: item.post.id,
    commentId: entry.comment.id,
    authorType: entry.author.type,
    authorId: entry.author.id,
    authorName: entry.author.name,
    content: entry.comment.content
  }
}

function cancelCommentReply() {
  replyTarget.value = null
}

function commentPlaceholder(item: MomentFeedItem) {
  const target = replyTarget.value
  return target?.momentId === item.post.id
    ? `回复 ${target.authorName}…`
    : `评论 ${item.author.name}…`
}

function commentDraftOf(item: MomentFeedItem) {
  return commentDrafts.value[item.post.id] ?? ''
}

function setCommentDraft(item: MomentFeedItem, value: string) {
  commentDrafts.value = { ...commentDrafts.value, [item.post.id]: value }
}

async function submitComment(item: MomentFeedItem) {
  if (replyingMomentId.value === item.post.id) return

  const content = commentDraftOf(item).trim()
  if (!content) {
    showNotice('评论内容不能为空。', 'warn')
    return
  }

  const target = replyTarget.value?.momentId === item.post.id
    ? { ...replyTarget.value }
    : null

  let sentComment: MomentComment | undefined
  try {
    sentComment = await addMomentComment({
      momentId: item.post.id,
      worldId: item.post.worldId,
      authorType: 'user',
      authorId: 'user',
      replyToCommentId: target?.commentId,
      content,
      source: 'manual'
    })
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '评论失败。', 'error')
    return
  }

  setCommentDraft(item, '')
  openCommentId.value = null
  replyTarget.value = null

  // 回复某位角色的评论时，由被回复的角色继续接话；
  // 普通评论角色动态时，则由动态作者回复。
  if (!sentComment) return

  const responderId = target?.authorType === 'character'
    ? target.authorId
    : item.post.authorType === 'character'
      ? item.post.authorId
      : undefined

  if (!responderId || responderId === 'user') {
    showNotice(target ? `已回复 ${target.authorName}。` : '评论已发送。', 'ok')
    return
  }

  const character = await db.characters.get(responderId)
  if (!character) return

  replyingMomentId.value = item.post.id
  replyingCharacterName.value = character.name
  replyingCharacterAvatar.value = character.avatar || '🙂'
  try {
    const reply = await generateCharacterComment(
      character,
      item.post.content || (item.post.images?.length ? '（这是一条图片动态。）' : ''),
      selfDisplay.value.name,
      content,
      {
        memoryHints: (await listCharacterSharedMemories(character.id)).map(memory => memory.content),
        replyToComment: target?.authorId === character.id ? target.content : undefined
      }
    )
    await addMomentComment({
      momentId: item.post.id,
      worldId: item.post.worldId,
      authorType: 'character',
      authorId: character.id,
      replyToCommentId: sentComment.id,
      content: reply.text,
      source: 'ai'
    })
    showNotice(`${character.name} 回了你。`, 'ok')
  } catch (error) {
    if (error instanceof MomentAiUnconfiguredError) {
      showNotice(`已发送。${character.name} 本来想回你，但还没配好 AI（见设置）。`, 'warn')
    } else {
      showNotice(error instanceof Error ? error.message : '回评失败。', 'error')
    }
  } finally {
    replyingMomentId.value = null
    replyingCharacterName.value = ''
    replyingCharacterAvatar.value = '🙂'
  }
}

async function removeMyPost(item: MomentFeedItem) {
  try {
    await deleteMomentPost(item.post.id)
    showNotice('已删除这条动态。', 'ok')
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '删除失败。', 'error')
  }
}

function goChat(item: MomentFeedItem) {
  if (item.post.conversationId) {
    router.push(`/chat/${item.post.conversationId}`)
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const diff = Date.now() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`

  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  })
}

onMounted(() => {
  subscription = liveQuery(async () => {
    const worldId = await getActiveWorldId()
    const [feed, characters, self] = await Promise.all([
      loadMomentFeed(worldId),
      db.characters.where('worldId').equals(worldId).toArray(),
      resolveSelfDisplay()
    ])

    // 极老数据可能没有 worldId；没有该世界角色时退回全局角色，保证入口可用。
    const fallbackCharacters = characters.length
      ? characters
      : await db.characters.toArray()

    return { worldId, feed, characters: fallbackCharacters, self }
  }).subscribe(rows => {
    activeWorldId.value = rows.worldId
    feedItems.value = rows.feed
    worldCharacters.value = rows.characters
    selfDisplay.value = rows.self
  })
})

onUnmounted(() => {
  subscription?.unsubscribe()
  if (noticeTimer) window.clearTimeout(noticeTimer)
  reactionTimers.forEach(timer => window.clearTimeout(timer))
  reactionTimers.clear()
})
</script>

<template>
  <PhoneFrame title="朋友圈" show-back>
    <section class="moments-page">
      <!-- 顶部工具栏（吸顶） -->
      <div class="moments-toolbar">
        <button
          class="tool-action"
          :class="{ active: composerMode === 'mine' }"
          type="button"
          @click="openSelfComposer"
        >
          <span class="tool-icon">＋</span>
          发布
        </button>

        <button
          class="tool-action"
          :class="{ active: composerMode === 'character' }"
          type="button"
          @click="openCharacterComposer"
        >
          <span class="tool-icon">✦</span>
          好友动态
        </button>

        <button
          class="tool-more"
          :class="{ active: showMomentControls }"
          type="button"
          aria-label="朋友圈设置"
          @click="showMomentControls = !showMomentControls"
        >
          •••
        </button>
      </div>

      <!-- 自主朋友圈 / 回复热度属于行为设置，默认收起，避免信息流顶部长期堆控件。 -->
      <Transition name="controls-fold">
        <section v-if="showMomentControls" class="moment-controls-card">
          <div class="control-row">
            <div>
              <b>好友自主动态</b>
              <small>开启后，在线时好友会偶尔自己发朋友圈</small>
            </div>
            <button
              class="native-switch"
              :class="{ on: autoMomentsOn }"
              type="button"
              :aria-pressed="autoMomentsOn"
              @click="toggleAutoMoments"
            >
              <span></span>
            </button>
          </div>

          <div class="heat-setting">
            <div class="heat-setting-head">
              <b>回复热度</b>
              <small>你发动态后，好友来评论的积极程度</small>
            </div>
            <div class="heat-options">
              <button
                v-for="option in replyHeatOptions"
                :key="option.key"
                class="heat-chip"
                :class="{ active: replyHeat === option.key }"
                type="button"
                :title="option.desc"
                @click="pickReplyHeat(option.key)"
              >
                {{ option.emoji }} {{ option.label }}
              </button>
            </div>
          </div>
        </section>
      </Transition>

      <!-- 我自己发 -->
      <section
        v-if="composerMode === 'mine'"
        class="composer-card"
      >
        <div class="composer-head">
          <CharacterAvatar
            :avatar="selfDisplay.avatar"
            :name="selfDisplay.name"
            :size="34"
          />

          <span>
            以 <b>{{ selfDisplay.name }}</b> 的身份发布
          </span>
        </div>

        <textarea
          v-model="myDraft"
          class="composer-input"
          :maxlength="MAX.content"
          rows="3"
          placeholder="此刻想分享点什么？"
        ></textarea>

        <div v-if="myImages.length" class="composer-image-grid">
          <figure v-for="(image, index) in myImages" :key="`${image.name || 'moment'}-${index}`">
            <img :src="image.dataUrl" :alt="image.name || `朋友圈图片 ${index + 1}`" />
            <button type="button" :aria-label="`移除第 ${index + 1} 张图片`" @click="removeMomentImage(index)">×</button>
          </figure>
        </div>

        <div class="composer-media-row">
          <label class="photo-picker" :class="{ disabled: preparingMomentImage || myImages.length >= MOMENT_MAX_IMAGES }">
            <input type="file" accept="image/*" multiple :disabled="preparingMomentImage || myImages.length >= MOMENT_MAX_IMAGES" @change="handleMomentImages" />
            <span>＋</span>
            {{ preparingMomentImage ? '处理中…' : myImages.length ? `${myImages.length}/${MOMENT_MAX_IMAGES} 张照片` : '添加照片' }}
          </label>
        </div>

        <div class="composer-foot">
          <small :class="{ over: myRemaining() < 0 }">
            还可输入 {{ Math.max(0, myRemaining()) }} 字
          </small>

          <button
            class="mini-btn"
            type="button"
            @click="cancelComposer"
          >
            取消
          </button>

          <button
            class="mini-btn primary"
            type="button"
            :disabled="publishing"
            @click="publishMyMoment"
          >
            {{ publishing ? '发布中…' : '发布' }}
          </button>
        </div>
      </section>

      <!-- 让角色发 -->
      <section
        v-else-if="composerMode === 'character'"
        class="composer-card"
      >
        <div class="composer-head">
          <span class="robot-mark">🤖</span>
          <span>让好友发一条朋友圈</span>
        </div>

        <template v-if="worldCharacters.length">
          <select
            v-model="selectedCharacterId"
            class="composer-select"
          >
            <option
              v-for="character in characterOptions"
              :key="character.id"
              :value="character.id"
            >
              {{ character.name }}
            </option>

            <option value="__random__">🎲 随便抽一位</option>
          </select>

          <div class="composer-foot">
            <small>AI 会按 TA 的人设与此刻状态来写</small>

            <button
              class="mini-btn"
              type="button"
              @click="cancelComposer"
            >
              取消
            </button>

            <button
              class="mini-btn primary"
              type="button"
              :disabled="publishing"
              @click="publishCharacterMoment"
            >
              {{ publishing ? 'TA 正在想…' : '让 TA 发一条' }}
            </button>
          </div>

          <p v-if="aiHint" class="ai-notice moments-hint">
            {{ aiHint }}

            <button
              v-if="showSettingsHint"
              class="link-btn"
              type="button"
              @click="$router.push('/settings/models')"
            >
              去「API 与模型」配置 →
            </button>
          </p>
        </template>

        <template v-else>
          <p class="ai-notice moments-hint">
            还没有可以发朋友圈的角色。先到「消息 → ＋」创建一个角色，再来叫 TA 发动态吧。
          </p>

          <div class="composer-foot">
            <button
              class="mini-btn"
              type="button"
              @click="cancelComposer"
            >
              关闭
            </button>

            <button
              class="mini-btn primary"
              type="button"
              @click="$router.push('/contacts')"
            >
              去通讯录 →
            </button>
          </div>
        </template>
      </section>

      <!-- 动态流 -->
      <div v-if="feedItems.length" class="moment-list">
        <article
          v-for="item in feedItems"
          :key="item.post.id"
          class="moment-card"
        >
          <header class="moment-head">
            <CharacterAvatar
              :avatar="item.author.avatar"
              :name="item.author.name"
              :size="42"
            />

            <div class="moment-who">
              <b>{{ item.author.name }}</b>

              <small>
                {{ formatTime(item.post.createdAt) }}

                <template v-if="item.post.source === 'ai' && item.post.aiModel">
                  · AI 生成
                </template>

                <template v-else-if="item.post.authorType === 'user'">
                  · 手动
                </template>
              </small>
            </div>

            <button
              v-if="isOwnPost(item)"
              class="delete-btn"
              type="button"
              aria-label="删除这条动态"
              @click="removeMyPost(item)"
            >
              ✕
            </button>
          </header>

          <p v-if="item.post.content" class="moment-text">{{ item.post.content }}</p>

          <div v-if="item.post.images?.length" :class="['moment-images', `moment-images--${Math.min(item.post.images.length, 4)}`]">
            <img
              v-for="(image, imageIndex) in item.post.images"
              :key="`${item.post.id}-image-${imageIndex}`"
              :src="image.dataUrl"
              :alt="image.name || `${item.author.name} 的朋友圈图片`"
              loading="lazy"
              decoding="async"
            />
          </div>

          <footer class="moment-actions">
            <button
              class="action-btn"
              :class="{ liked: item.post.likedByMe }"
              type="button"
              :disabled="likingIds.has(item.post.id)"
              @click="onToggleLike(item)"
            >
              {{ item.post.likedByMe ? '❤️' : '🤍' }}
              <span v-if="item.post.likeCount">{{ item.post.likeCount }}</span>
            </button>

            <button
              class="action-btn"
              type="button"
              @click="toggleCommentBox(item)"
            >
              💬
              <span v-if="item.comments.length">{{ item.comments.length }}</span>
            </button>

            <span class="action-spacer"></span>

            <button
              v-if="item.post.conversationId"
              class="action-btn chat-btn"
              type="button"
              @click="goChat(item)"
            >
              去聊聊 →
            </button>
          </footer>

          <!-- 评论 -->
          <div
            v-if="item.comments.length || replyingMomentId === item.post.id"
            class="comment-area"
          >
            <div
              v-for="entry in item.comments"
              :key="entry.comment.id"
              class="comment-row"
              :class="{ 'comment-row--replyable': entry.author.type === 'character' }"
              @click="beginCommentReply(item, entry)"
            >
              <CharacterAvatar
                :avatar="entry.author.avatar"
                :name="entry.author.name"
                :size="26"
              />

              <div class="comment-body">
                <b>{{ entry.author.name }}</b>
                <template v-if="entry.replyToAuthor">
                  <span class="reply-label">回复 <strong>{{ entry.replyToAuthor.name }}</strong>：</span>
                </template>
                <span>{{ entry.comment.content }}</span>
              </div>
            </div>

            <div
              v-if="replyingMomentId === item.post.id"
              class="reply-pending"
            >
              <CharacterAvatar
                :avatar="replyingCharacterAvatar"
                :name="replyingCharacterName"
                :size="26"
              />

              <span>{{ replyingCharacterName }} 正在回你…</span>
            </div>
          </div>

          <!-- 评论输入框 -->
          <div
            v-if="openCommentId === item.post.id"
            class="comment-composer"
          >
            <CharacterAvatar
              :avatar="selfDisplay.avatar"
              :name="selfDisplay.name"
              :size="26"
            />

            <div
              v-if="replyTarget?.momentId === item.post.id"
              class="comment-reply-target"
            >
              <span>回复 <b>{{ replyTarget.authorName }}</b></span>
              <button type="button" aria-label="取消回复" @click="cancelCommentReply">×</button>
            </div>

            <textarea
              class="comment-input"
              :maxlength="MAX.comment"
              rows="3"
              :placeholder="commentPlaceholder(item)"
              :value="commentDraftOf(item)"
              @input="setCommentDraft(item, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>

            <button
              class="mini-btn primary send-btn"
              type="button"
              :disabled="replyingMomentId === item.post.id"
              @click="submitComment(item)"
            >
              发送
            </button>
          </div>
        </article>
      </div>

      <!-- 空态 -->
      <div v-else class="empty-moments">
        <div class="empty-emoji">🪟</div>
        <p>
          朋友圈还空着。
          <br />
          点上面「🤖 叫角色发」，让好友们先发几条吧。
        </p>

        <button
          class="mini-btn primary"
          type="button"
          @click="openCharacterComposer"
        >
          叫角色发第一条 →
        </button>
      </div>

      <!-- 顶部操作提示条 -->
      <Transition name="fade">
        <div
          v-if="noticeText"
          class="notice-toast"
          :class="noticeKind"
        >
          {{ noticeText }}
        </div>
      </Transition>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.moments-page{
  --mom-blue:#576b95;
  --mom-primary:#5f9fd2;
  --mom-ink:#1f2d3d;
  --mom-muted:#8b98a5;
  --mom-line:#edf1f4;
  --mom-soft:#f6f8fa;
  min-height:100%;
  padding:0 16px 42px;
  background:#fff;
  color:var(--mom-ink);
}

.moments-toolbar{
  position:sticky;
  top:0;
  z-index:8;
  display:grid;
  grid-template-columns:1fr 1fr 42px;
  gap:8px;
  margin:0 -16px;
  padding:10px 16px 9px;
  border-bottom:1px solid rgba(30,54,76,.055);
  background:rgba(255,255,255,.95);
  backdrop-filter:blur(22px) saturate(155%);
}

.tool-action,.tool-more{
  min-height:40px;
  border:0;
  background:transparent;
  color:#536779;
  font-size:13px;
  font-weight:650;
  cursor:pointer;
  transition:background .16s ease,color .16s ease,transform .16s ease;
}
.tool-action{display:flex;align-items:center;justify-content:center;gap:5px;border-radius:12px}
.tool-icon{color:#568db7;font-size:18px;font-weight:500;line-height:1}
.tool-action.active{background:#eef5fb;color:#397dad}
.tool-action:active,.tool-more:active{transform:scale(.98)}
.tool-more{border-radius:50%;font-size:15px;letter-spacing:1px}.tool-more.active{background:#f1f4f6;color:#3f759c}

.moment-controls-card{
  margin:10px 0 3px;
  overflow:hidden;
  border:1px solid rgba(45,75,98,.075);
  border-radius:15px;
  background:#f8fafb;
}
.control-row{display:flex;align-items:center;gap:12px;padding:11px 12px;border-bottom:1px solid rgba(45,75,98,.06)}
.control-row>div,.heat-setting-head{min-width:0;display:grid;gap:2px;flex:1}.control-row b,.heat-setting-head b{color:#40586b;font-size:12px}.control-row small,.heat-setting-head small{color:#91a0ac;font-size:10.5px;line-height:1.45}
.native-switch{position:relative;width:44px;height:26px;flex:0 0 auto;padding:0;border:0;border-radius:999px;background:#d8dee3;cursor:pointer;transition:background .18s ease}.native-switch span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(35,50,62,.20);transition:transform .18s ease}.native-switch.on{background:#6fa9d3}.native-switch.on span{transform:translateX(18px)}
.heat-setting{padding:10px 12px 11px}.heat-setting-head{margin-bottom:8px}.heat-options{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.heat-chip{min-width:0;padding:7px 4px;border:0;border-radius:9px;background:#fff;color:#8796a2;font-size:11px;white-space:nowrap;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(48,79,104,.06)}.heat-chip.active{background:#eaf3fa;color:#3d7ca9;font-weight:700;box-shadow:none}
.controls-fold-enter-active,.controls-fold-leave-active{transition:opacity .16s ease,transform .16s ease}.controls-fold-enter-from,.controls-fold-leave-to{opacity:0;transform:translateY(-5px)}

.composer-card{
  margin:12px 0 4px;
  padding:15px 0 17px;
  border:0;
  border-bottom:1px solid var(--mom-line);
  background:#fff;
}
.composer-head{display:flex;align-items:center;gap:9px;margin-bottom:11px;color:#586a7a;font-size:13px}
.robot-mark{font-size:21px}
.composer-input,.comment-input,.composer-select{
  width:100%;box-sizing:border-box;border:1px solid #e4e9ee;background:#f9fbfc;border-radius:12px;
  padding:11px 12px;outline:none;color:#253746;font-size:14px;line-height:1.6;resize:vertical;
  transition:border-color .16s ease,box-shadow .16s ease,background .16s ease
}
.composer-input:focus,.comment-input:focus,.composer-select:focus{
  border-color:#a9cce7;background:#fff;box-shadow:0 0 0 3px rgba(95,159,210,.10)
}
.composer-select{resize:none}
.composer-media-row{display:flex;margin-top:9px}
.photo-picker{
  display:inline-flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #e1e8ee;border-radius:11px;
  background:#fff;color:#56728a;font-size:12px;font-weight:650;cursor:pointer
}
.photo-picker input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.photo-picker span{font-size:19px;line-height:1;color:#5c9dcc}
.photo-picker.disabled{opacity:.45;pointer-events:none}
.composer-image-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}
.composer-image-grid figure{position:relative;margin:0;aspect-ratio:1;overflow:hidden;border-radius:10px;background:#eef3f6}
.composer-image-grid img{width:100%;height:100%;display:block;object-fit:cover}
.composer-image-grid button{
  position:absolute;top:4px;right:4px;width:22px;height:22px;padding:0;border:0;border-radius:50%;
  background:rgba(25,39,52,.70);color:#fff;font-size:16px;line-height:20px;cursor:pointer
}
.composer-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:10px}
.composer-foot small{margin-right:auto;color:#97a3ad;font-size:11px}.composer-foot small.over{color:#d25f65}
.mini-btn{
  padding:8px 13px;border:1px solid #e2e8ed;border-radius:10px;background:#fff;color:#627484;font-size:13px;cursor:pointer
}
.mini-btn.primary{border-color:transparent;background:#5f9fd2;color:#fff;font-weight:700}
.mini-btn:disabled{opacity:.5}
.moments-hint{margin-top:12px}.link-btn{display:inline;border:0;background:none;padding:0;color:#4d8ebe;font-weight:700;cursor:pointer}

.moment-list{display:flex;flex-direction:column}
.moment-card{
  position:relative;padding:18px 0 16px;border:0;border-bottom:1px solid var(--mom-line);background:#fff
}
.moment-head{display:flex;align-items:center;gap:10px}
.moment-who{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.moment-who b{color:var(--mom-blue);font-size:14px;font-weight:700}
.moment-who small{color:#9aa5ae;font-size:10.5px}
.delete-btn{padding:7px;border:0;background:transparent;color:#b4bec6;font-size:15px;cursor:pointer}
.delete-btn:active{color:#d66b70}
.moment-text{margin:10px 0 8px;color:#23323e;font-size:15px;line-height:1.68;white-space:pre-wrap;word-break:break-word}

.moment-images{display:grid;gap:4px;margin:9px 0 8px;max-width:310px;overflow:hidden;border-radius:4px}
.moment-images img{display:block;width:100%;height:100%;min-height:0;object-fit:cover;background:#edf2f5}
.moment-images--1{grid-template-columns:minmax(0,230px)}
.moment-images--1 img{max-height:300px;aspect-ratio:auto}
.moment-images--2,.moment-images--4{grid-template-columns:repeat(2,minmax(0,1fr))}
.moment-images--3{grid-template-columns:repeat(2,minmax(0,1fr))}
.moment-images--3 img:first-child{grid-row:span 2}
.moment-images--2 img,.moment-images--3 img,.moment-images--4 img{aspect-ratio:1}

.moment-actions{display:flex;align-items:center;gap:2px;margin-top:4px}
.action-btn{
  display:inline-flex;align-items:center;gap:4px;padding:6px 8px;border:0;border-radius:8px;background:transparent;
  color:#7e8d99;font-size:12px;cursor:pointer
}
.action-btn:hover{background:#f5f7f9}.action-btn.liked{color:#d65b67}.action-spacer{flex:1}
.chat-btn{background:#f3f6f8;color:#576b95;font-weight:700}

.comment-area{margin-top:6px;padding:8px 10px;border:0;border-radius:4px;background:#f5f6f7;display:flex;flex-direction:column;gap:7px}
.comment-row,.reply-pending{display:flex;align-items:flex-start;gap:7px}.comment-row--replyable{cursor:pointer}.comment-row--replyable:active{opacity:.72}
.comment-body{min-width:0;flex:1;padding:0;background:transparent;border:0;border-radius:0;display:block;line-height:1.45}
.comment-body b{margin-right:5px;color:var(--mom-blue);font-size:12px}.comment-body>b::after{content:'：'}.reply-label{margin-right:3px;color:#536775;font-size:12px}.reply-label strong{color:var(--mom-blue);font-weight:650}
.comment-body span{color:#33424f;font-size:12.5px;word-break:break-word}
.reply-pending{align-items:center;color:#8c99a4;font-size:12px}
.comment-composer{display:grid;grid-template-columns:minmax(0,1fr) 66px;align-items:end;gap:8px;margin-top:9px;padding:10px 0 0;border-top:1px solid var(--mom-line)}.comment-reply-target{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;border-radius:9px;background:#eef4f8;color:#64798a;font-size:12px}.comment-reply-target b{color:var(--mom-blue)}.comment-reply-target button{width:24px;height:24px;border:0;border-radius:50%;background:transparent;color:#8293a0;font-size:18px;line-height:1}
.comment-composer :deep(.character-avatar){display:none}
.comment-input{min-width:0;width:100%;min-height:44px;max-height:150px;padding:10px 12px;font-size:13.5px;line-height:1.5;resize:vertical;background:#fff}.send-btn{width:66px;min-height:42px;align-self:end;border-radius:12px}

.empty-moments{padding:70px 20px 40px;text-align:center;color:#8c99a4}.empty-emoji{font-size:46px;opacity:.75}
.empty-moments p{margin:13px 0 18px;font-size:13px;line-height:1.8}
.ai-notice{color:#71808d;font-size:12px;line-height:1.6}
.notice-toast{
  position:fixed;z-index:30;left:50%;bottom:64px;transform:translateX(-50%);max-width:min(360px,86vw);
  padding:9px 14px;border-radius:12px;background:rgba(35,50,64,.92);color:#fff;font-size:12px;text-align:center;
  box-shadow:0 8px 24px rgba(25,45,63,.18);backdrop-filter:blur(12px)
}
.notice-toast.ok{background:rgba(55,120,88,.93)}.notice-toast.warn{background:rgba(172,125,55,.94)}.notice-toast.error{background:rgba(181,73,73,.94)}
.fade-enter-active,.fade-leave-active{transition:opacity .2s ease}.fade-enter-from,.fade-leave-to{opacity:0}

@media(max-width:390px){
  .moments-toolbar{grid-template-columns:1fr 1fr 40px}
  .composer-image-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}
</style>
