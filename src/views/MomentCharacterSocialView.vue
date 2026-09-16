<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { defaultCharacterSocialProfile, saveCharacterSocialProfile, SOCIAL_LEVEL_LABELS } from '../services/socialPresenceService'
import type { Character, CharacterSocialProfile, SocialInteractionLevel } from '../types/domain'
import '../styles/momentsPages.css'

const router = useRouter()
const route = useRoute()
const characterId = computed(() => String(route.params.id || ''))
const character = ref<Character>()
const profile = ref<CharacterSocialProfile>()
const saving = ref(false)
const error = ref('')
const levels: SocialInteractionLevel[] = ['quiet', 'normal', 'active']
const permissions = [
  { key: 'canViewMoments', label: '可以看朋友圈', desc: '关闭后不会自动参与朋友圈' },
  { key: 'canLikeMoments', label: '可以点赞', desc: '路过时可以点赞' },
  { key: 'canCommentMoments', label: '可以评论', desc: '允许对动态生成评论' },
  { key: 'canReplyToComments', label: '可以接话', desc: '允许回复你或其他角色' },
  { key: 'canPostMoments', label: '可以主动发动态', desc: '仅控制后台自主发动态' }
] as const
let subscription: { unsubscribe(): void } | undefined

async function update(patch: Partial<Pick<CharacterSocialProfile, typeof permissions[number]['key'] | 'interactionLevel'>>) {
  if (!character.value || saving.value) return
  saving.value = true
  error.value = ''
  try { await saveCharacterSocialProfile(character.value, patch) }
  catch (e) { error.value = e instanceof Error ? e.message : '保存失败，请重试。' }
  finally { saving.value = false }
}

function togglePermission(key: typeof permissions[number]['key']) {
  if (!profile.value) return
  const patch = { [key]: !profile.value[key] } as Partial<Pick<CharacterSocialProfile, typeof permissions[number]['key']>>
  void update(patch)
}

onMounted(() => {
  subscription = liveQuery(async () => ({
    person: await db.characters.get(characterId.value),
    settings: await db.socialProfiles.get(characterId.value)
  })).subscribe(({ person, settings }) => {
    character.value = person
    profile.value = person ? settings ?? defaultCharacterSocialProfile(person) : undefined
  })
})
onUnmounted(() => subscription?.unsubscribe())
</script>

<template>
  <PhoneFrame>
    <template #header>
      <div class="mp-header"><button aria-label="返回好友社交权限" type="button" @click="router.push('/app/朋友圈/settings')">‹</button><strong>好友社交权限</strong><span></span></div>
    </template>
    <section class="mp-page">
      <p v-if="error" class="mp-toast" role="alert">{{ error }}</p>
      <template v-if="character && profile">
        <div class="mp-person"><CharacterAvatar :avatar="character.avatar" :name="character.name" :size="54" /><span><b>{{ character.name }}</b><small>只影响自动社交，不限制你手动让 TA 发动态。</small></span></div>
        <h2 class="mp-section-title">朋友圈权限</h2>
        <div class="mp-card">
          <div v-for="permission in permissions" :key="permission.key" class="mp-row">
            <span class="mp-copy"><b>{{ permission.label }}</b><small>{{ permission.desc }}</small></span>
            <button class="mp-switch" :class="{ on: profile[permission.key] }" :aria-label="permission.label" :aria-pressed="profile[permission.key]" type="button" :disabled="saving" @click="togglePermission(permission.key)"><span></span></button>
          </div>
        </div>
        <h2 class="mp-section-title">互动频率</h2>
        <div class="mp-segment mp-level">
          <button v-for="level in levels" :key="level" type="button" :class="{ active: profile.interactionLevel === level }" :aria-pressed="profile.interactionLevel === level" :disabled="saving" @click="update({ interactionLevel: level })"><b>{{ SOCIAL_LEVEL_LABELS[level].label }}</b><small>{{ SOCIAL_LEVEL_LABELS[level].desc }}</small></button>
        </div>
      </template>
      <p v-else class="mp-empty">找不到这位好友，可能已经删除。</p>
    </section>
  </PhoneFrame>
</template>
