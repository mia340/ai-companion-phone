<script setup lang="ts">
import type { CSSProperties } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import type {
  Character,
  CharacterRelationship,
  ChatSettings,
  ConversationState
} from '../../types/domain'

defineProps<{
  title: string
  character?: Character
  conversationState?: ConversationState
  relationship?: CharacterRelationship
  chatSettings?: ChatSettings
  isLoading: boolean
  panelStyle?: CSSProperties
}>()
const emit = defineEmits<{
  dragStart: [event: PointerEvent]
  dragMove: [event: PointerEvent]
  dragEnd: []
  refresh: []
  close: []
}>()
</script>

<template>
  <section class="bottom-panel" :style="panelStyle">
    <div class="panel-handle"
      @pointerdown="emit('dragStart', $event)"
      @pointermove="emit('dragMove', $event)"
      @pointerup="emit('dragEnd')"
      @pointercancel="emit('dragEnd')"></div>
    <div class="panel-title-row">
      <div><small>此刻的 {{ title }}</small><h2>心里的小角落</h2></div>
      <button type="button" @click="emit('close')">×</button>
    </div>
    <template v-if="chatSettings?.innerThoughtVisibility !== 'off'">
      <div class="thought-person">
        <CharacterAvatar v-if="character" :avatar="character.avatar" :name="character.name" :size="62" />
        <div><strong>{{ conversationState?.innerMood || character?.mood }}</strong><p>{{ conversationState?.innerActivity || character?.activity }}</p></div>
      </div>
      <blockquote>“{{ conversationState?.innerThought || '正在想着你刚才说的话。' }}”</blockquote>
      <div v-if="relationship" class="relationship-glance">
        <span>你们的关系</span><strong>{{ relationship.stage }}</strong><small>{{ relationship.emotionReason }}</small>
      </div>
      <button class="panel-primary" type="button" :disabled="isLoading" @click="emit('refresh')">
        {{ isLoading ? '正在感受此刻…' : '看看现在有没有变化' }}
      </button>
    </template>
    <div v-else class="panel-empty">心理活动目前已关闭，可在聊天设置中重新开启。</div>
  </section>
</template>

<style scoped>
.bottom-panel{width:100%;max-height:88%;overflow-y:auto;padding:8px 18px max(24px,env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:#fffafb;box-shadow:0 -18px 50px rgba(70,42,55,.18);transition:transform .24s cubic-bezier(.22,.8,.24,1);will-change:transform}.panel-handle{position:relative;width:84px;height:17px;margin:-3px auto 15px;background:transparent;touch-action:none;cursor:grab}.panel-handle:after{content:'';position:absolute;top:5px;left:50%;width:42px;height:5px;transform:translateX(-50%);border-radius:999px;background:#dccbd2}.panel-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.panel-title-row h2{margin:2px 0 16px}.panel-title-row small{color:#a17c8d}.panel-title-row>button{width:36px;height:36px;border:0;border-radius:50%;background:#f3e9ed;color:#765864;font-size:22px}.thought-person{display:flex;align-items:center;gap:14px;padding:13px;border-radius:20px;background:linear-gradient(135deg,#fff,#ffeaf3)}.thought-person p{margin:5px 0 0;color:#927483}blockquote{margin:18px 0;padding:18px;border:0;border-radius:19px;background:#f5edf1;color:#654b57;line-height:1.85}.relationship-glance{display:grid;grid-template-columns:1fr auto;gap:4px 10px;margin-bottom:16px;padding:13px 14px;border-radius:16px;background:#fff;color:#876b77}.relationship-glance strong{color:#c05f89}.relationship-glance small{grid-column:1/-1}.panel-primary{width:100%;padding:12px 14px;border:0;border-radius:15px;background:#d96b99;color:#fff;font-weight:700}.panel-primary:disabled{opacity:.55}.panel-empty{padding:28px 8px;color:#9a7d8a;font-size:12px;line-height:1.65;text-align:center}
</style>
