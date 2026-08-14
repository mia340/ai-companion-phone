<script setup lang="ts">
import type { CSSProperties } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import { renderRoleplayText } from '../../services/textMacroService'
import type {
  Character,
  ChatSettings,
  ConversationState
} from '../../types/domain'

const props = defineProps<{
  title: string
  character?: Character
  conversationState?: ConversationState
  chatSettings?: ChatSettings
  userName?: string
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

const displayText = (value?: string) => renderRoleplayText(value, props.userName, props.character?.name) || ''
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
      <div v-if="conversationState?.innerMood || character?.mood || conversationState?.innerActivity || character?.activity" class="thought-person">
        <CharacterAvatar v-if="character" :avatar="character.avatar" :name="character.name" :size="62" />
        <div><strong v-if="conversationState?.innerMood || character?.mood">{{ displayText(conversationState?.innerMood || character?.mood) }}</strong><p v-if="conversationState?.innerActivity || character?.activity">{{ displayText(conversationState?.innerActivity || character?.activity) }}</p></div>
      </div>
      <div v-if="conversationState?.location || conversationState?.presence || conversationState?.relationshipNote || conversationState?.timePeriod || conversationState?.energy" class="status-chips"><span v-if="conversationState?.presence">{{ conversationState.presence==='together'?'◉ 在你身边':'◌ 远程联系' }}</span><span v-if="conversationState?.location">📍 {{ displayText(conversationState.location) }}</span><span v-if="conversationState?.timePeriod">◷ {{ displayText(conversationState.timePeriod) }}</span><span v-if="conversationState?.energy">⚡ {{ conversationState.energy }}</span><span v-if="conversationState?.relationshipNote">♡ {{ displayText(conversationState.relationshipNote) }}</span></div>
      <blockquote v-if="conversationState?.innerThought">“{{ displayText(conversationState.innerThought) }}”</blockquote>
      <blockquote v-else class="empty-thought">原卡或当前剧情没有提供可显示的内心状态。</blockquote>
      <div v-if="conversationState?.unresolvedTopics?.length || conversationState?.pendingEvents?.length || conversationState?.shortTermGoals?.length" class="state-lists">
        <p v-if="conversationState?.unresolvedTopics?.length"><b>还想继续聊</b><span v-for="item in conversationState.unresolvedTopics" :key="item">{{ displayText(item) }}</span></p>
        <p v-if="conversationState?.pendingEvents?.length"><b>等待中的事</b><span v-for="item in conversationState.pendingEvents" :key="item">{{ displayText(item) }}</span></p>
        <p v-if="conversationState?.shortTermGoals?.length"><b>眼前目标</b><span v-for="item in conversationState.shortTermGoals" :key="item">{{ displayText(item) }}</span></p>
        <p v-if="conversationState?.lastCompletedEvent"><b>刚刚完成</b><span>{{ displayText(conversationState.lastCompletedEvent) }}</span></p>
      </div>
      <button class="panel-primary" type="button" :disabled="isLoading" @click="emit('refresh')">
        {{ isLoading ? '正在感受此刻…' : '看看现在有没有变化' }}
      </button>
    </template>
    <div v-else class="panel-empty">心理活动目前已关闭，可在聊天设置中重新开启。</div>
  </section>
</template>

<style scoped>
.bottom-panel{width:100%;max-height:88%;overflow-y:auto;padding:8px 18px max(24px,env(safe-area-inset-bottom));border-radius:26px 26px 0 0;background:#fffafb;box-shadow:0 -18px 50px rgba(70,42,55,.18);transition:transform .24s cubic-bezier(.22,.8,.24,1);will-change:transform}.panel-handle{position:relative;width:84px;height:17px;margin:-3px auto 15px;background:transparent;touch-action:none;cursor:grab}.panel-handle:after{content:'';position:absolute;top:5px;left:50%;width:42px;height:5px;transform:translateX(-50%);border-radius:999px;background:#dccbd2}.panel-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.panel-title-row h2{margin:2px 0 16px}.panel-title-row small{color:#a17c8d}.panel-title-row>button{width:36px;height:36px;border:0;border-radius:50%;background:#f3e9ed;color:#765864;font-size:22px}.thought-person{display:flex;align-items:center;gap:14px;padding:13px;border-radius:20px;background:linear-gradient(135deg,#fff,#ffeaf3)}.thought-person p{margin:5px 0 0;color:#927483}blockquote{margin:18px 0;padding:18px;border:0;border-radius:19px;background:#f5edf1;color:#654b57;line-height:1.85}.panel-primary{width:100%;padding:12px 14px;border:0;border-radius:15px;background:#d96b99;color:#fff;font-weight:700}.panel-primary:disabled{opacity:.55}.panel-empty{padding:28px 8px;color:#9a7d8a;font-size:12px;line-height:1.65;text-align:center}
.status-chips{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0 0}.status-chips span{border-radius:999px;background:#f3e8ed;color:#8b6576;padding:7px 10px;font-size:11px}
.empty-thought{font-style:normal;color:#a28793}.state-lists{display:grid;gap:8px;margin:0 0 14px}.state-lists p{display:grid;gap:5px;margin:0;padding:11px 12px;border-radius:14px;background:#f8f1f4}.state-lists b{color:#9a6079;font-size:11px}.state-lists span{color:#765b67;font-size:12px}
</style>
