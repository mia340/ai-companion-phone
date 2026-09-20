<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { getActiveWorldId } from '../services/momentService'
import {
  defaultCharacterSocialProfile,
  saveCharacterSocialProfile
} from '../services/socialPresenceService'
import {
  loadCompanionSpaceSettings,
  setCharacterSpaceBlacklisted
} from '../services/companionSpaceSettings'
import type { Character, CharacterSocialProfile } from '../types/domain'

const route = useRoute()
const characters = ref<Character[]>([])
const profiles = ref<Record<string, CharacterSocialProfile>>({})
const blacklistedIds = ref<string[]>([])
const loading = ref(true)
const busyId = ref('')
const error = ref('')
const worldId = ref('world-default')

const mode = computed(() => {
  const raw = String(route.query.mode || 'allowed')
  return raw === 'hidden' || raw === 'blacklist' ? raw : 'allowed'
})
const title = computed(() => mode.value === 'blacklist' ? '黑名单' : mode.value === 'hidden' ? '不让他看' : '谁可以看我的动态')
const helper = computed(() => {
  if (mode.value === 'blacklist') return '加入黑名单后，TA 不会参与朋友圈查看、点赞、评论、接话或自主动态；聊天与角色资料不会删除。'
  if (mode.value === 'hidden') return '打开开关表示“不让 TA 看”。这个设置只影响朋友圈可见与自动互动。'
  return '打开开关表示允许 TA 看到你的动态。角色自己的互动强度仍可在朋友圈设置中单独调整。'
})

function profileFor(character: Character) {
  return profiles.value[character.id] ?? defaultCharacterSocialProfile(character)
}
function switchOn(character: Character) {
  if (mode.value === 'blacklist') return blacklistedIds.value.includes(character.id)
  const canView = profileFor(character).canViewMoments
  return mode.value === 'hidden' ? !canView : canView
}

async function toggle(character: Character) {
  if (busyId.value) return
  busyId.value = character.id
  error.value = ''
  try {
    if (mode.value === 'blacklist') {
      const next = !blacklistedIds.value.includes(character.id)
      const settings = await setCharacterSpaceBlacklisted(worldId.value, character.id, next)
      blacklistedIds.value = settings.blacklistCharacterIds
    } else {
      const nextCanView = mode.value === 'hidden' ? switchOn(character) : !switchOn(character)
      const saved = await saveCharacterSocialProfile(character, { canViewMoments: nextCanView })
      profiles.value = { ...profiles.value, [character.id]: saved }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败。'
  } finally {
    busyId.value = ''
  }
}

onMounted(async () => {
  try {
    worldId.value = await getActiveWorldId()
    const [people, socialRows, settings] = await Promise.all([
      db.characters.where('worldId').equals(worldId.value).toArray(),
      db.socialProfiles.where('worldId').equals(worldId.value).toArray(),
      loadCompanionSpaceSettings(worldId.value)
    ])
    characters.value = people.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    profiles.value = Object.fromEntries(socialRows.map(row => [row.characterId, row]))
    blacklistedIds.value = settings.blacklistCharacterIds
  } catch (e) {
    error.value = e instanceof Error ? e.message : '好友列表加载失败。'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <PhoneFrame :title="title">
    <section class="people-page">
      <p class="people-help">{{ helper }}</p>
      <p v-if="error" class="people-error" role="alert">{{ error }}</p>
      <p v-if="loading" class="people-state">正在读取联系人…</p>
      <div v-else-if="characters.length" class="people-card">
        <button
          v-for="character in characters"
          :key="character.id"
          class="people-row"
          type="button"
          :disabled="Boolean(busyId)"
          @click="toggle(character)"
        >
          <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="44" />
          <span class="people-copy">
            <b>{{ character.name }}</b>
            <small v-if="mode === 'blacklist'">{{ switchOn(character) ? '已加入黑名单' : '正常社交' }}</small>
            <small v-else>{{ profileFor(character).canViewMoments ? '可以看你的动态' : '看不到你的动态' }}</small>
          </span>
          <span class="mini-switch" :class="{ on: switchOn(character) }" aria-hidden="true"><i></i></span>
        </button>
      </div>
      <div v-else class="people-empty">还没有联系人。</div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.people-page{min-height:100%;padding:12px 0 34px;background:#f5f8fa;color:#2a4052}.people-help{margin:0;padding:4px 16px 12px;color:#8b9aa5;font-size:11px;line-height:1.6}.people-error,.people-state{margin:0 14px 12px;padding:11px;border-radius:12px;text-align:center;font-size:12px}.people-error{background:#fff0f1;color:#b65563}.people-state{background:#fff;color:#8193a1}.people-card{background:#fff;border-top:1px solid rgba(48,78,103,.06);border-bottom:1px solid rgba(48,78,103,.06)}.people-row{position:relative;width:100%;min-height:64px;padding:9px 15px;display:flex;align-items:center;gap:11px;border:0;background:#fff;color:inherit;text-align:left;cursor:pointer}.people-row:not(:last-child)::after{content:'';position:absolute;left:70px;right:0;bottom:0;height:1px;background:rgba(48,78,103,.07)}.people-row:active{background:#f0f5f7}.people-row:disabled{opacity:.72}.people-copy{min-width:0;flex:1;display:grid;gap:3px}.people-copy b{font-size:15px;font-weight:620}.people-copy small{color:#91a0ab;font-size:11px}.mini-switch{position:relative;width:42px;height:24px;border-radius:99px;background:#cbd5dc;transition:background .15s}.mini-switch i{position:absolute;width:20px;height:20px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(40,62,80,.2);transition:transform .15s}.mini-switch.on{background:#14b96f}.mini-switch.on i{transform:translateX(18px)}.people-empty{padding:70px 20px;text-align:center;color:#91a0ab;font-size:13px}
</style>
