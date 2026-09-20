<script setup lang="ts">
import { liveQuery } from 'dexie'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { USER_PROFILE_ID, getOrCreateUserProfile } from '../services/userProfile'
import type { UserProfile } from '../types/domain'

const router = useRouter()
const profile = ref<UserProfile | null>(null)
const loading = ref(true)
let subscription: { unsubscribe: () => void } | undefined

onMounted(async () => {
  try {
    await getOrCreateUserProfile()
    subscription = liveQuery(() => db.userProfiles.get(USER_PROFILE_ID)).subscribe({
      next: value => { profile.value = value ?? null; loading.value = false },
      error: error => { console.error('知间资料读取失败：', error); loading.value = false }
    })
  } catch (error) {
    console.error('知间资料读取失败：', error)
    loading.value = false
  }
})
onUnmounted(() => subscription?.unsubscribe())
</script>

<template>
  <PhoneFrame title="我">
    <section class="me-page">
      <button class="profile-row" type="button" @click="router.push('/profile')">
        <CharacterAvatar :avatar="profile?.avatar || '🧑'" :name="profile?.name || '我'" :size="66" />
        <span class="profile-copy">
          <strong>{{ loading ? '读取资料中…' : profile?.name || '我' }}</strong>
          <small class="signature">{{ profile?.signature || '点击添加个性签名' }}</small>
          <small class="profile-help">编辑头像、昵称和个性签名</small>
        </span>
        <span class="chevron" aria-hidden="true">›</span>
      </button>

      <div class="me-group">
        <button class="me-row" type="button" @click="router.push('/companion/space-settings')">
          <span class="row-symbol space" aria-hidden="true">✤</span>
          <span>空间设置</span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      </div>

      <div class="me-group">
        <button class="me-row" type="button" @click="router.push('/companion/wallet')">
          <span class="row-symbol wallet" aria-hidden="true">▣</span>
          <span>钱包</span>
          <span class="row-note">筹备中</span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      </div>

      <div class="me-group">
        <button class="me-row" type="button" @click="router.push('/settings')">
          <span class="row-symbol settings" aria-hidden="true">⚙</span>
          <span>设置</span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      </div>
      <p class="me-tip">知间中的公开签名与角色 Persona 分开保存，不会自动进入 AI 聊天设定。</p>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.me-page{min-height:100%;background:#f5f7f9;color:#263747;padding:20px 0 34px}
.profile-row{width:100%;display:flex;align-items:center;gap:14px;text-align:left;background:#fff;border:0;padding:26px 19px 27px;cursor:pointer}
.profile-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}.profile-copy strong{font-size:20px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.signature{font-size:13px;color:#687d8d;overflow-wrap:anywhere}.profile-help{font-size:11px;color:#9aa8b2}
.chevron{margin-left:auto;color:#abb6be;font-size:23px;font-weight:300;flex-shrink:0}.me-group{margin-top:14px;background:#fff}.me-row{width:100%;display:flex;align-items:center;gap:13px;padding:14px 19px;min-height:54px;background:#fff;border:0;text-align:left;color:#263747;font-size:16px;cursor:pointer}.row-symbol{display:grid;place-items:center;width:25px;height:25px;font-size:23px}.space{color:#16bb75}.wallet{color:#d3a049}.settings{color:#7894b0}.row-note{font-size:12px;color:#91a0ac;margin-left:auto}.me-tip{padding:10px 20px;color:#98a5ad;font-size:11px;line-height:1.65}
</style>
