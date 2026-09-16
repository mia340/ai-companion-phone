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
  generateCharacterPost
} from '../services/momentGenerationService'
import {
  MOMENT_MAX_COMMENT_LENGTH,
  MOMENT_MAX_CONTENT_LENGTH,
  MOMENT_MAX_IMAGES,
  addMomentComment,
  createCharacterMoment,
  createUserMoment,
  deleteMomentPost,
  getActiveWorldId,
  loadMomentFeed,
  resolveSelfDisplay,
  toggleMomentLike
} from '../services/momentService'
import {
  isAutoMomentsEnabled,
  setAutoMomentsEnabled
} from '../services/momentAutoActivityService'
import {
  REPLY_HEAT_OPTIONS,
  getReplyHeat,
  setReplyHeat
} from '../services/momentSocialSettings'
import type { MomentReplyHeat } from '../services/momentSocialSettings'
import {
  scheduleCharacterReplyToUserComment,
  scheduleSocialForCharacterPost,
  scheduleSocialForUserPost
} from '../services/socialRuntimeService'
import {
  SOCIAL_LEVEL_LABELS,
  defaultCharacterSocialProfile,
  saveCharacterSocialProfile
} from '../services/socialPresenceService'
import {
  markAllSocialNotificationsRead,
  markSocialNotificationRead
} from '../services/socialNotificationService'

import type { MomentCommentItem, MomentFeedItem } from '../services/momentService'
import type {
  Character,
  CharacterSocialProfile,
  MomentComment,
  MomentPostImage,
  SocialInteractionLevel,
  SocialNotification
} from '../types/domain'

type ComposerMode = 'none' | 'mine' | 'character'

const feedItems = ref<MomentFeedItem[]>([])
const worldCharacters = ref<Character[]>([])
const selfDisplay = ref({ name: '我', avatar: '🙂' })
const activeWorldId = ref('world-default')
const router = useRouter()

const socialProfiles = ref<Record<string, CharacterSocialProfile>>({})
const socialNotifications = ref<SocialNotification[]>([])
const showCreateMenu = ref(false)
const showSocialSettings = ref(false)
const showNotifications = ref(false)
const selectedSocialCharacterId = ref('')

const unreadSocialCount = computed(() => socialNotifications.value.filter(item => !item.read).length)
const socialLevelLabels = SOCIAL_LEVEL_LABELS
const socialLevelOptions: SocialInteractionLevel[] = ['quiet', 'normal', 'active']
const selectedSocialCharacter = computed(() =>
  worldCharacters.value.find(character => character.id === selectedSocialCharacterId.value)
)
const selectedSocialProfile = computed(() => {
  const character = selectedSocialCharacter.value
  if (!character) return undefined
  return socialProfiles.value[character.id] ?? defaultCharacterSocialProfile(character)
})

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
  showCreateMenu.value = false
  composerMode.value = 'mine'
  aiHint.value = ''
  showSettingsHint.value = false
}

function openCharacterComposer() {
  showCreateMenu.value = false
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

function socialProfileFor(character: Character): CharacterSocialProfile {
  return socialProfiles.value[character.id] ?? defaultCharacterSocialProfile(character)
}

async function updateSocialProfile(
  character: Character,
  patch: Partial<Pick<CharacterSocialProfile,
    'canViewMoments' | 'canLikeMoments' | 'canCommentMoments' | 'canReplyToComments' | 'canPostMoments' | 'interactionLevel'>>
) {
  try {
    await saveCharacterSocialProfile(character, patch)
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '社交设置保存失败。', 'error')
  }
}

function openSocialCharacter(character: Character) {
  selectedSocialCharacterId.value = character.id
}

function closeSocialCharacter() {
  selectedSocialCharacterId.value = ''
}

async function openNotificationCenter() {
  showCreateMenu.value = false
  showSocialSettings.value = false
  showNotifications.value = true
  if (unreadSocialCount.value) {
    await markAllSocialNotificationsRead(activeWorldId.value).catch(() => 0)
  }
}

async function jumpToNotification(notification: SocialNotification) {
  await markSocialNotificationRead(notification.id).catch(() => undefined)
  showNotifications.value = false
  window.setTimeout(() => {
    document.querySelector(`[data-moment-id="${notification.momentId}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }, 80)
}

function notificationActor(notification: SocialNotification) {
  return worldCharacters.value.find(character => character.id === notification.actorCharacterId)
}

function notificationLabel(notification: SocialNotification) {
  return notification.type === 'moment-reply' ? '回复了你的评论' : '评论了你的朋友圈'
}

function openSocialSettingsSheet() {
  showCreateMenu.value = false
  showNotifications.value = false
  selectedSocialCharacterId.value = ''
  showSocialSettings.value = true
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
    try {
      await scheduleSocialForUserPost(post, worldCharacters.value, replyHeat.value)
      showNotice('发布成功。即使离开朋友圈，好友互动也会继续排队。', 'ok')
    } catch (queueError) {
      console.warn('朋友圈已发布，但 Social Runtime 排队失败：', queueError)
      showNotice('动态已发布，但这次后台好友互动没有成功排队。', 'warn')
    }
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '发布失败。', 'error')
  } finally {
    publishing.value = false
  }
}

// 好友评论 / 角色互评由全局 Social Runtime 持久队列处理；离开本页不会取消。

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

    const post = await createCharacterMoment({
      characterId: character.id,
      worldId: activeWorldId.value,
      content: generated.text,
      source: 'ai',
      aiModel: generated.model,
      conversationId: conversation?.id
    })
    try {
      await scheduleSocialForCharacterPost(post, worldCharacters.value)
    } catch (queueError) {
      console.warn('角色动态已发布，但 Social Runtime 排队失败：', queueError)
    }

    composerMode.value = 'none'
    showNotice(`${character.name} 发了一条新动态，其他好友可能会来串门。`, 'ok')
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

  try {
    const scheduled = await scheduleCharacterReplyToUserComment({
      post: item.post,
      userComment: sentComment,
      characterId: character.id,
      threadDepth: target ? 1 : 0
    })
    showNotice(
      scheduled
        ? `已发送，${character.name} 会继续接你的评论。`
        : `已发送；${character.name} 的自动回复已在社交设置里关闭。`,
      scheduled ? 'ok' : 'warn'
    )
  } catch (error) {
    showNotice(error instanceof Error ? error.message : '回复已发送，但后台接话排队失败。', 'warn')
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
    const [feed, characters, self, profiles, notifications] = await Promise.all([
      loadMomentFeed(worldId),
      db.characters.where('worldId').equals(worldId).toArray(),
      resolveSelfDisplay(),
      db.socialProfiles.where('worldId').equals(worldId).toArray(),
      db.socialNotifications.where('worldId').equals(worldId).reverse().sortBy('createdAt')
    ])

    // 极老数据可能没有 worldId；没有该世界角色时退回全局角色，保证入口可用。
    const fallbackCharacters = characters.length
      ? characters
      : await db.characters.toArray()

    return { worldId, feed, characters: fallbackCharacters, self, profiles, notifications }
  }).subscribe(rows => {
    activeWorldId.value = rows.worldId
    feedItems.value = rows.feed
    worldCharacters.value = rows.characters
    selfDisplay.value = rows.self
    socialProfiles.value = Object.fromEntries(rows.profiles.map(profile => [profile.characterId, profile]))
    socialNotifications.value = [...rows.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  })
})

onUnmounted(() => {
  subscription?.unsubscribe()
  if (noticeTimer) window.clearTimeout(noticeTimer)
})
</script>

<template>
  <PhoneFrame>
    <template #header>
      <div class="wechat-header">
        <button class="wechat-back" type="button" aria-label="返回" @click="router.back()">‹</button>
        <strong>朋友圈</strong>
        <div class="wechat-header-actions">
          <button class="header-icon-btn notification-button" type="button" aria-label="新互动" @click="openNotificationCenter">
            <svg class="bell-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 9.7a5.2 5.2 0 0 1 10.4 0c0 5 1.7 5.7 2.2 6.5H4.6c.5-.8 2.2-1.5 2.2-6.5Z"/><path d="M10 18.2a2.2 2.2 0 0 0 4 0"/></svg>
            <em v-if="unreadSocialCount">{{ unreadSocialCount > 99 ? '99+' : unreadSocialCount }}</em>
          </button>
          <button class="header-icon-btn" type="button" aria-label="发布" @click="showCreateMenu = !showCreateMenu">＋</button>
          <button class="header-icon-btn more" type="button" aria-label="朋友圈设置" @click="openSocialSettingsSheet">•••</button>
        </div>
      </div>
    </template>

    <section class="moments-page">
      <Transition name="controls-fold">
        <div v-if="showCreateMenu" class="create-popover">
          <button type="button" @click="openSelfComposer">
            <span class="create-popover-icon">✎</span>
            <span><b>发朋友圈</b><small>文字、照片，使用当前 Persona</small></span>
          </button>
          <button type="button" @click="openCharacterComposer">
            <span class="create-popover-icon">✦</span>
            <span><b>让好友发一条</b><small>按角色人设与记忆生成</small></span>
          </button>
        </div>
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
          :data-moment-id="item.post.id"
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
            v-if="item.comments.length"
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

      <!-- 新互动：只保存未读状态，正文事实仍来自朋友圈评论。 -->
      <Transition name="fade">
        <div v-if="showNotifications" class="sheet-backdrop" @click.self="showNotifications = false">
          <section class="wechat-sheet notification-sheet">
            <header class="sheet-head">
              <div>
                <b>新互动</b>
                <small>{{ socialNotifications.length ? '最近的朋友圈评论与回复' : '暂时没有新互动' }}</small>
              </div>
              <button type="button" @click="showNotifications = false">完成</button>
            </header>

            <div v-if="socialNotifications.length" class="notification-list">
              <button
                v-for="notification in socialNotifications.slice(0, 40)"
                :key="notification.id"
                class="notification-row"
                type="button"
                @click="jumpToNotification(notification)"
              >
                <CharacterAvatar
                  :avatar="notificationActor(notification)?.avatar || '🙂'"
                  :name="notificationActor(notification)?.name || '好友'"
                  :size="42"
                />
                <span class="notification-copy">
                  <b>{{ notificationActor(notification)?.name || '好友' }}</b>
                  <small>{{ notificationLabel(notification) }} · {{ formatTime(notification.createdAt) }}</small>
                  <span>{{ notification.preview }}</span>
                </span>
                <i v-if="!notification.read"></i>
              </button>
            </div>
            <div v-else class="sheet-empty">还没有新的评论或回复。</div>
          </section>
        </div>
      </Transition>

      <!-- Social Runtime V2：全局节奏 + 每位好友权限，采用微信式底部设置面板。 -->
      <Transition name="fade">
        <div v-if="showSocialSettings" class="sheet-backdrop" @click.self="showSocialSettings = false">
          <section class="wechat-sheet social-settings-sheet">
            <template v-if="!selectedSocialCharacter">
              <header class="sheet-head">
                <div>
                  <b>朋友圈设置</b>
                  <small>控制整体节奏，以及每位好友是否会看、评、回、发</small>
                </div>
                <button type="button" @click="showSocialSettings = false">完成</button>
              </header>

              <div class="sheet-section">
                <div class="settings-line">
                  <span><b>好友自主动态</b><small>App 前台运行时，允许角色偶尔自己发朋友圈</small></span>
                  <button class="native-switch" :class="{ on: autoMomentsOn }" type="button" :aria-pressed="autoMomentsOn" @click="toggleAutoMoments"><span></span></button>
                </div>
                <div class="settings-block">
                  <span class="settings-title"><b>整体互动热度</b><small>决定这一条朋友圈大概会有多少人参与</small></span>
                  <div class="heat-options heat-options--sheet">
                    <button v-for="option in replyHeatOptions" :key="option.key" class="heat-chip" :class="{ active: replyHeat === option.key }" type="button" @click="pickReplyHeat(option.key)">{{ option.emoji }} {{ option.label }}</button>
                  </div>
                </div>
              </div>

              <p class="social-decision-note">谁会出现，不再随机平均分配：Social Runtime 会综合最近聊天、共享记忆、这条内容的相关性，以及角色自己的互动冷却。</p>

              <div class="sheet-section friend-social-section">
                <div class="section-caption">好友社交权限</div>
                <button v-for="character in worldCharacters" :key="character.id" class="friend-social-row" type="button" @click="openSocialCharacter(character)">
                  <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="42" />
                  <span>
                    <b>{{ character.name }}</b>
                    <small>{{ socialLevelLabels[socialProfileFor(character).interactionLevel].label }} · {{ socialProfileFor(character).canViewMoments ? '可看朋友圈' : '不可见朋友圈' }}</small>
                  </span>
                  <em>›</em>
                </button>
                <div v-if="!worldCharacters.length" class="sheet-empty compact">还没有角色。</div>
              </div>
            </template>

            <template v-else-if="selectedSocialCharacter && selectedSocialProfile">
              <header class="sheet-head detail-head">
                <button class="sheet-back" type="button" @click="closeSocialCharacter">‹</button>
                <div>
                  <b>{{ selectedSocialCharacter.name }}</b>
                  <small>朋友圈社交权限</small>
                </div>
                <span></span>
              </header>

              <div class="friend-profile-hero">
                <CharacterAvatar :avatar="selectedSocialCharacter.avatar" :name="selectedSocialCharacter.name" :size="54" />
                <div><b>{{ selectedSocialCharacter.name }}</b><small>这些开关只影响自动社交，不限制你手动让 TA 发动态。</small></div>
              </div>

              <div class="sheet-section permission-list">
                <div class="settings-line"><span><b>可以看朋友圈</b><small>关闭后 TA 不会自动参与朋友圈</small></span><button class="native-switch" :class="{ on: selectedSocialProfile.canViewMoments }" type="button" @click="updateSocialProfile(selectedSocialCharacter, { canViewMoments: !selectedSocialProfile.canViewMoments })"><span></span></button></div>
                <div class="settings-line"><span><b>可以点赞</b><small>路过时可能只点个赞，不一定评论</small></span><button class="native-switch" :class="{ on: selectedSocialProfile.canLikeMoments }" type="button" @click="updateSocialProfile(selectedSocialCharacter, { canLikeMoments: !selectedSocialProfile.canLikeMoments })"><span></span></button></div>
                <div class="settings-line"><span><b>可以评论</b><small>允许 TA 对动态生成评论</small></span><button class="native-switch" :class="{ on: selectedSocialProfile.canCommentMoments }" type="button" @click="updateSocialProfile(selectedSocialCharacter, { canCommentMoments: !selectedSocialProfile.canCommentMoments })"><span></span></button></div>
                <div class="settings-line"><span><b>可以接话</b><small>允许回复你或其他角色的评论</small></span><button class="native-switch" :class="{ on: selectedSocialProfile.canReplyToComments }" type="button" @click="updateSocialProfile(selectedSocialCharacter, { canReplyToComments: !selectedSocialProfile.canReplyToComments })"><span></span></button></div>
                <div class="settings-line"><span><b>可以主动发动态</b><small>仅影响“好友自主动态”后台行为</small></span><button class="native-switch" :class="{ on: selectedSocialProfile.canPostMoments }" type="button" @click="updateSocialProfile(selectedSocialCharacter, { canPostMoments: !selectedSocialProfile.canPostMoments })"><span></span></button></div>
              </div>

              <div class="sheet-section">
                <div class="section-caption">互动频率</div>
                <div class="level-segment">
                  <button v-for="level in socialLevelOptions" :key="level" type="button" :class="{ active: selectedSocialProfile.interactionLevel === level }" @click="updateSocialProfile(selectedSocialCharacter, { interactionLevel: level })">
                    <b>{{ socialLevelLabels[level].label }}</b><small>{{ socialLevelLabels[level].desc }}</small>
                  </button>
                </div>
              </div>
            </template>
          </section>
        </div>
      </Transition>

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
  --mom-primary:#07c160;
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
.native-switch{position:relative;width:44px;height:26px;flex:0 0 auto;padding:0;border:0;border-radius:999px;background:#d8dee3;cursor:pointer;transition:background .18s ease}.native-switch span{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(35,50,62,.20);transition:transform .18s ease}.native-switch.on{background:#07c160}.native-switch.on span{transform:translateX(18px)}
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
.mini-btn.primary{border-color:transparent;background:#07c160;color:#fff;font-weight:700}
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


:deep(.app-header--custom){
  display:block;
  padding:0;
  background:rgba(255,255,255,.96);
  border-bottom:1px solid #ededed;
}
.wechat-header{height:52px;display:grid;grid-template-columns:52px 1fr auto;align-items:center;padding:0 10px 0 4px;background:#fff}
.wechat-header>strong{text-align:center;color:#161616;font-size:16px;font-weight:650;letter-spacing:.01em}
.wechat-back,.header-icon-btn{border:0;background:transparent;color:#111;cursor:pointer}
.wechat-back{width:44px;height:44px;font-size:31px;font-weight:300;line-height:1}
.wechat-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:1px}
.header-icon-btn{position:relative;width:38px;height:38px;padding:0;border-radius:9px;font-size:24px;line-height:38px;text-align:center}
.header-icon-btn.more{font-size:14px;letter-spacing:1px}.header-icon-btn:active{background:#f3f3f3}
.bell-glyph{width:20px;height:20px;display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.notification-button em{position:absolute;right:0;top:1px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:#fa5151;color:#fff;font-size:9px;font-style:normal;line-height:17px}

.create-popover{margin:10px 0 2px;padding:4px;border:1px solid #ececec;border-radius:13px;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08)}
.create-popover button{width:100%;display:flex;align-items:center;gap:12px;padding:12px;border:0;border-bottom:1px solid #f1f1f1;background:transparent;text-align:left;color:#202020;cursor:pointer}.create-popover button:last-child{border-bottom:0}.create-popover button:active{background:#f7f7f7;border-radius:9px}
.create-popover-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:#f4f5f6;color:#333;font-size:18px}.create-popover button>span:last-child{display:grid;gap:2px}.create-popover b{font-size:13px}.create-popover small{color:#999;font-size:11px}

.moments-page{--mom-blue:#576b95;--mom-line:#ededed;--mom-soft:#f7f7f7;padding:0 16px 44px;color:#191919}
.moment-card{padding:18px 0 17px;border-bottom-color:#ededed}.moment-head{align-items:flex-start}.moment-who b{color:#576b95;font-size:14.5px}.moment-who small{color:#b0b0b0;font-size:10.5px}.moment-text{color:#1c1c1c;font-size:15px;line-height:1.62}.moment-actions{justify-content:flex-end}.action-btn{padding:5px 8px;border-radius:5px;color:#576b95;background:#f7f7f7}.action-btn:hover{background:#f0f0f0}.action-btn.liked{color:#fa5151}.chat-btn{color:#576b95;background:transparent}.comment-area{margin-top:7px;padding:7px 9px;background:#f5f5f5;border-radius:3px}.comment-body b,.reply-label strong{color:#576b95}.comment-body span,.reply-label{color:#222}.comment-composer{border-top-color:#ededed}.comment-input{border-color:#e8e8e8;background:#f7f7f7;border-radius:8px}.comment-input:focus{border-color:#d7d7d7;box-shadow:none}.send-btn{background:#07c160!important;border-radius:6px}.photo-picker{border-color:#e6e6e6;color:#576b95}.photo-picker span{color:#07c160}.composer-card{border-bottom-color:#ededed}.composer-input,.composer-select{border-color:#e8e8e8;background:#f7f7f7;border-radius:8px}.composer-input:focus,.composer-select:focus{border-color:#d7d7d7;box-shadow:none}.mini-btn{border-radius:7px}.heat-chip{border-radius:7px}.heat-chip.active{background:#e8f7ef;color:#079d50}.native-switch{width:46px;height:28px}.native-switch span{top:3px;left:3px;width:22px;height:22px}.native-switch.on span{transform:translateX(18px)}

.sheet-backdrop{position:fixed;z-index:80;inset:0;background:rgba(0,0,0,.28);display:flex;align-items:flex-end;justify-content:center;padding-bottom:max(0px,env(safe-area-inset-bottom))}
.wechat-sheet{width:min(430px,100vw);max-height:min(76vh,650px);overflow:hidden;border-radius:18px 18px 0 0;background:#f5f5f5;box-shadow:0 -10px 40px rgba(0,0,0,.16);display:flex;flex-direction:column}
.sheet-head{flex:0 0 auto;min-height:58px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border-bottom:1px solid #ececec;background:#fff}.sheet-head>div{min-width:0;display:grid;gap:2px}.sheet-head b{color:#111;font-size:15px}.sheet-head small{color:#999;font-size:10.5px}.sheet-head>button:not(.sheet-back){border:0;background:transparent;color:#07c160;font-size:13px;font-weight:650;cursor:pointer}.sheet-back{width:34px;height:34px;border:0;background:transparent;color:#111;font-size:29px;line-height:1}.detail-head{display:grid;grid-template-columns:38px 1fr 38px;text-align:center}.detail-head>div{justify-items:center}
.sheet-section{margin-top:10px;background:#fff}.section-caption{padding:9px 16px 6px;color:#999;font-size:11px;background:#f5f5f5}.settings-line{min-height:58px;display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid #efefef}.settings-line:last-child{border-bottom:0}.settings-line>span{min-width:0;display:grid;gap:2px;flex:1}.settings-line b,.settings-title b{color:#1b1b1b;font-size:13px}.settings-line small,.settings-title small{color:#999;font-size:10.5px;line-height:1.4}.settings-block{padding:12px 16px}.settings-title{display:grid;gap:2px;margin-bottom:10px}.heat-options--sheet{grid-template-columns:repeat(4,1fr)}
.social-decision-note{margin:10px 16px 0;color:#999;font-size:10.5px;line-height:1.55}
.friend-social-section{overflow:auto}.friend-social-row{width:100%;display:flex;align-items:center;gap:11px;padding:10px 16px;border:0;border-bottom:1px solid #efefef;background:#fff;text-align:left;cursor:pointer}.friend-social-row>span{min-width:0;flex:1;display:grid;gap:3px}.friend-social-row b{color:#1b1b1b;font-size:13px}.friend-social-row small{color:#999;font-size:10.5px}.friend-social-row em{color:#c2c2c2;font-style:normal;font-size:24px;font-weight:300}.friend-profile-hero{display:flex;align-items:center;gap:12px;padding:16px;background:#fff}.friend-profile-hero>div{display:grid;gap:4px}.friend-profile-hero b{font-size:15px;color:#111}.friend-profile-hero small{color:#999;font-size:10.5px;line-height:1.45}.permission-list{margin-top:10px;overflow:auto}
.level-segment{display:grid;gap:0}.level-segment button{display:grid;gap:3px;padding:12px 16px;border:0;border-bottom:1px solid #efefef;background:#fff;text-align:left;cursor:pointer}.level-segment button:last-child{border-bottom:0}.level-segment b{font-size:13px;color:#222}.level-segment small{font-size:10.5px;color:#999}.level-segment button.active{position:relative;background:#fbfffc}.level-segment button.active::after{content:'✓';position:absolute;right:17px;top:50%;transform:translateY(-50%);color:#07c160;font-weight:800}
.notification-list{overflow:auto;background:#fff}.notification-row{position:relative;width:100%;display:flex;align-items:flex-start;gap:11px;padding:12px 16px;border:0;border-bottom:1px solid #efefef;background:#fff;text-align:left;cursor:pointer}.notification-copy{min-width:0;flex:1;display:grid;gap:2px}.notification-copy b{font-size:13px;color:#222}.notification-copy small{font-size:10.5px;color:#999}.notification-copy>span{margin-top:2px;color:#555;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.notification-row i{position:absolute;right:14px;top:16px;width:7px;height:7px;border-radius:50%;background:#fa5151}.sheet-empty{padding:34px 20px;text-align:center;color:#aaa;font-size:12px}.sheet-empty.compact{padding:20px}

@media(max-width:390px){
  .moments-toolbar{grid-template-columns:1fr 1fr 40px}
  .composer-image-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
}
</style>
