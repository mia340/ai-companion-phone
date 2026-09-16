<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import { markAllSocialNotificationsRead, markSocialNotificationRead } from '../services/socialNotificationService'
import type { Character, SocialNotification } from '../types/domain'
import '../styles/momentsPages.css'

const router = useRouter()
const notifications = ref<SocialNotification[]>([])
const characters = ref<Record<string, Character>>({})
const error = ref('')
let subscription: { unsubscribe(): void } | undefined

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function openItem(item: SocialNotification) {
  try {
    await markSocialNotificationRead(item.id)
    await router.push({ path: '/app/朋友圈', query: { moment: item.momentId } })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '暂时无法打开这条动态。'
  }
}

onMounted(async () => {
  try {
    const worldId = await getActiveWorldId()
    subscription = liveQuery(async () => ({
      rows: await db.socialNotifications.where('worldId').equals(worldId).toArray(),
      people: await db.characters.toArray()
    })).subscribe(({ rows, people }) => {
      notifications.value = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
      characters.value = Object.fromEntries(people.map(person => [person.id, person]))
    })
    await markAllSocialNotificationsRead(worldId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取互动消息失败。'
  }
})
onUnmounted(() => subscription?.unsubscribe())
</script>

<template>
  <PhoneFrame>
    <template #header>
      <div class="mp-header"><button aria-label="返回朋友圈" type="button" @click="router.push('/app/朋友圈')">‹</button><strong>新互动</strong><span></span></div>
    </template>
    <section class="mp-page">
      <p v-if="error" class="mp-toast" role="alert">{{ error }}</p>
      <div v-if="notifications.length" class="mp-card">
        <button v-for="item in notifications" :key="item.id" class="mp-row mp-notification" type="button" @click="openItem(item)">
          <CharacterAvatar :avatar="characters[item.actorCharacterId]?.avatar || '🙂'" :name="characters[item.actorCharacterId]?.name || '好友'" :size="44" />
          <span class="mp-copy">
            <b>{{ characters[item.actorCharacterId]?.name || '好友' }}</b>
            <small>{{ item.type === 'moment-reply' ? '回复了你的评论' : '评论了你的朋友圈' }} · {{ formatTime(item.createdAt) }}</small>
            <span>{{ item.preview }}</span>
          </span>
          <i v-if="!item.read" class="mp-dot"></i>
        </button>
      </div>
      <div v-else class="mp-empty">暂无互动消息<br />好友评论或回复后会显示在这里。</div>
    </section>
  </PhoneFrame>
</template>
