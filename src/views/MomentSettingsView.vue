<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import { getReplyHeat, REPLY_HEAT_OPTIONS, setReplyHeat } from '../services/momentSocialSettings'
import type { MomentReplyHeat } from '../services/momentSocialSettings'
import { isAutoMomentsEnabled, setAutoMomentsEnabled } from '../services/momentAutoActivityService'
import { defaultCharacterSocialProfile, SOCIAL_LEVEL_LABELS } from '../services/socialPresenceService'
import type { Character, CharacterSocialProfile } from '../types/domain'
import '../styles/momentsPages.css'

const router = useRouter()
const characters = ref<Character[]>([])
const profiles = ref<Record<string, CharacterSocialProfile>>({})
const heat = ref<MomentReplyHeat>(getReplyHeat())
const autoOn = ref(isAutoMomentsEnabled())
const error = ref('')
let subscription: { unsubscribe(): void } | undefined
function toggleAuto() {
  autoOn.value = !autoOn.value
  setAutoMomentsEnabled(autoOn.value)
}
function chooseHeat(next: MomentReplyHeat) {
  heat.value = next
  setReplyHeat(next)
}
function profile(character: Character) {
  return profiles.value[character.id] ?? defaultCharacterSocialProfile(character)
}
onMounted(async () => {
  try {
    const worldId = await getActiveWorldId()
    subscription = liveQuery(async () => ({
      people: await db.characters.where('worldId').equals(worldId).toArray(),
      settings: await db.socialProfiles.where('worldId').equals(worldId).toArray()
    })).subscribe(({ people, settings }) => {
      characters.value = people
      profiles.value = Object.fromEntries(settings.map(item => [item.characterId, item]))
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载朋友圈设置失败。'
  }
})
onUnmounted(() => subscription?.unsubscribe())
</script>

<template>
  <PhoneFrame>
    <template #header>
      <div class="mp-header"><button aria-label="返回朋友圈" type="button" @click="router.push('/app/朋友圈')">‹</button><strong>朋友圈设置</strong><span></span></div>
    </template>
    <section class="mp-page">
      <p v-if="error" class="mp-toast" role="alert">{{ error }}</p>
      <h2 class="mp-section-title">互动设置</h2>
      <div class="mp-card">
        <div class="mp-row">
          <span class="mp-copy"><b>好友自主动态</b><small>App 运行时，允许好友偶尔自己发朋友圈</small></span>
          <button type="button" class="mp-switch" :class="{ on: autoOn }" :aria-pressed="autoOn" aria-label="好友自主动态" @click="toggleAuto"><span></span></button>
        </div>
      </div>
      <h2 class="mp-section-title">整体互动热度</h2>
      <div class="mp-segment">
        <button v-for="option in REPLY_HEAT_OPTIONS" :key="option.key" type="button" :class="{ active: heat === option.key }" :aria-pressed="heat === option.key" @click="chooseHeat(option.key)">{{ option.emoji }} {{ option.label }}</button>
      </div>
      <p class="mp-tip">角色会结合近期聊天、共享记忆、动态内容以及自己的冷却时间决定是否互动，不会人人都来回复。</p>
      <h2 class="mp-section-title">好友社交权限</h2>
      <div class="mp-card">
        <button v-for="character in characters" :key="character.id" class="mp-row" type="button" @click="router.push(`/app/朋友圈/settings/character/${encodeURIComponent(character.id)}`)">
          <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="43" />
          <span class="mp-copy"><b>{{ character.name }}</b><small>{{ SOCIAL_LEVEL_LABELS[profile(character).interactionLevel].label }} · {{ profile(character).canViewMoments ? '可看朋友圈' : '不可见朋友圈' }}</small></span>
          <span class="mp-arrow">›</span>
        </button>
        <div v-if="!characters.length" class="mp-empty">还没有角色，可先到通讯录添加。</div>
      </div>
    </section>
  </PhoneFrame>
</template>
