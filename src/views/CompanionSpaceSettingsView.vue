<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { getActiveWorldId } from '../services/momentService'
import { isAutoMomentsEnabled, setAutoMomentsEnabled } from '../services/momentAutoActivityService'
import {
  loadCompanionSpaceSettings,
  setCompanionSpaceVisibility,
  type CompanionSpaceVisibility
} from '../services/companionSpaceSettings'

const router = useRouter()
const worldId = ref('world-default')
const autoOn = ref(isAutoMomentsEnabled())
const visibility = ref<CompanionSpaceVisibility>('public')
const saving = ref(false)
const error = ref('')

const visibilityOptions: Array<{ key: CompanionSpaceVisibility; label: string; icon: string }> = [
  { key: 'public', label: '公开', icon: '◉' },
  { key: 'friends', label: '好友', icon: '♟' },
  { key: 'private', label: '仅自己', icon: '▣' }
]

function toggleAuto() {
  autoOn.value = !autoOn.value
  setAutoMomentsEnabled(autoOn.value)
}

async function chooseVisibility(next: CompanionSpaceVisibility) {
  if (saving.value || visibility.value === next) return
  saving.value = true
  error.value = ''
  try {
    visibility.value = (await setCompanionSpaceVisibility(worldId.value, next)).visibility
  } catch (e) {
    error.value = e instanceof Error ? e.message : '空间设置保存失败。'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    worldId.value = await getActiveWorldId()
    const settings = await loadCompanionSpaceSettings(worldId.value)
    visibility.value = settings.visibility
  } catch (e) {
    error.value = e instanceof Error ? e.message : '空间设置读取失败。'
  }
})
</script>

<template>
  <PhoneFrame title="空间设置">
    <section class="space-page">
      <p v-if="error" class="space-error" role="alert">{{ error }}</p>

      <div class="space-card">
        <div class="space-row auto-row">
          <span class="space-copy">
            <b>好友自主动态</b>
            <small>App 运行时，允许好友偶尔自己发动态</small>
          </span>
          <button
            type="button"
            class="space-switch"
            :class="{ on: autoOn }"
            :aria-pressed="autoOn"
            aria-label="好友自主动态"
            @click="toggleAuto"
          ><span></span></button>
        </div>
      </div>

      <p class="space-label">动态可见范围</p>
      <div class="visibility-grid" aria-label="动态可见范围">
        <button
          v-for="option in visibilityOptions"
          :key="option.key"
          type="button"
          :disabled="saving"
          :class="{ active: visibility === option.key }"
          :aria-pressed="visibility === option.key"
          @click="chooseVisibility(option.key)"
        >
          <span aria-hidden="true">{{ option.icon }}</span>
          <b>{{ option.label }}</b>
        </button>
      </div>
      <p class="space-hint">公开与好友目前都只作用于本地「知间」联系人，不会把动态发布到互联网；“仅自己”会停止好友对你新动态的自动互动。</p>

      <div class="space-card links-card">
        <button class="space-link" type="button" @click="router.push('/companion/space-settings/people?mode=allowed')">
          <span class="link-icon">◉</span>
          <span>谁可以看我的动态</span>
          <span class="chevron">›</span>
        </button>
        <button class="space-link" type="button" @click="router.push('/companion/space-settings/people?mode=hidden')">
          <span class="link-icon">♙</span>
          <span>不让他看</span>
          <span class="chevron">›</span>
        </button>
        <button class="space-link" type="button" @click="router.push('/companion/space-settings/people?mode=blacklist')">
          <span class="link-icon">⊘</span>
          <span>黑名单</span>
          <span class="chevron">›</span>
        </button>
      </div>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.space-page{min-height:100%;padding:18px 14px 36px;background:linear-gradient(180deg,#f6fafc,#f3f7f9);color:#263b4d}.space-error{margin:0 0 12px;padding:11px 13px;border-radius:12px;background:#fff0f1;color:#b65563;font-size:12px;line-height:1.5}.space-card{overflow:hidden;border-radius:14px;background:#fff;border:1px solid rgba(48,78,103,.06);box-shadow:0 5px 18px rgba(69,100,125,.04)}.space-row{min-height:70px;padding:13px 15px;display:flex;align-items:center;gap:14px}.space-copy{min-width:0;flex:1;display:grid;gap:5px}.space-copy b{font-size:16px;font-weight:650}.space-copy small{color:#899aa7;font-size:11px;line-height:1.45}.space-switch{position:relative;flex:0 0 auto;width:48px;height:28px;padding:0;border:0;border-radius:999px;background:#c9d3da;cursor:pointer}.space-switch span{position:absolute;left:2px;top:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(45,67,85,.18);transition:transform .18s ease}.space-switch.on{background:#13b96f}.space-switch.on span{transform:translateX(20px)}.space-label{margin:18px 2px 8px;color:#8495a2;font-size:12px}.visibility-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.visibility-grid button{min-height:60px;padding:8px;border:1px solid rgba(67,93,114,.08);border-radius:13px;background:#fff;color:#52697b;display:flex;align-items:center;justify-content:center;gap:7px;cursor:pointer}.visibility-grid button span{font-size:18px}.visibility-grid button b{font-size:13px;font-weight:600}.visibility-grid button.active{border-color:#17b86f;background:#effaf5;color:#15945d;box-shadow:0 0 0 1px rgba(23,184,111,.08) inset}.visibility-grid button:disabled{opacity:.65}.space-hint{margin:8px 3px 17px;color:#9aa8b2;font-size:10.5px;line-height:1.55}.links-card{margin-top:4px}.space-link{position:relative;width:100%;min-height:54px;padding:12px 14px;border:0;background:#fff;display:flex;align-items:center;gap:11px;color:#2e4355;text-align:left;font-size:15px;cursor:pointer}.space-link:not(:last-child)::after{content:'';position:absolute;left:49px;right:0;bottom:0;height:1px;background:rgba(48,78,103,.07)}.space-link:active{background:#f0f5f7}.link-icon{width:24px;text-align:center;color:#667f93;font-size:19px}.chevron{margin-left:auto;color:#abb7c0;font-size:24px;font-weight:300}
</style>
