<script setup lang="ts">
import type { CSSProperties } from 'vue'

import type {
  CharacterMemory,
  ChatSettings,
  ConversationState
} from '../../types/domain'
import type { ModelSettings } from '../../types/modelSettings'

export type ChatSettingsTab = 'chat' | 'memory' | 'advanced'

defineProps<{
  title: string
  tab: ChatSettingsTab
  chatSettings?: ChatSettings
  memories: CharacterMemory[]
  newMemoryText: string
  memoryCategoryNames: Record<CharacterMemory['category'], string>
  speechPlaybackAvailable: boolean
  speechVoices: SpeechSynthesisVoice[]
  providerLabel: string
  visionCapabilityLabel: string
  modelSettings?: ModelSettings
  conversationState?: ConversationState
  panelStyle?: CSSProperties
}>()

const emit = defineEmits<{
  'update:tab': [tab: ChatSettingsTab]
  'update:newMemoryText': [value: string]
  dragStart: [event: PointerEvent]
  dragMove: [event: PointerEvent]
  dragEnd: []
  close: []
  persist: []
  previewVoice: []
  addMemory: []
  deleteMemory: [id: string]
  clearMemories: []
  clearConversation: []
  openModelSettings: []
}>()
</script>

<template>
  <section class="bottom-panel settings-panel" :style="panelStyle">
    <div
      class="panel-handle"
      @pointerdown="emit('dragStart', $event)"
      @pointermove="emit('dragMove', $event)"
      @pointerup="emit('dragEnd')"
      @pointercancel="emit('dragEnd')"
    ></div>

    <div class="panel-title-row">
      <div>
        <small>{{ title }}</small>
        <h2>聊天设置</h2>
      </div>
      <button type="button" @click="emit('close')">×</button>
    </div>

    <nav class="settings-tabs">
      <button :class="{ active: tab === 'chat' }" type="button" @click="emit('update:tab', 'chat')">聊天</button>
      <button :class="{ active: tab === 'memory' }" type="button" @click="emit('update:tab', 'memory')">记忆</button>
      <button :class="{ active: tab === 'advanced' }" type="button" @click="emit('update:tab', 'advanced')">高级</button>
    </nav>

    <div v-if="tab === 'chat' && chatSettings" class="settings-content">
      <label class="setting-control">
        <span><b>回复长度</b><small>控制日常聊天的消息长度</small></span>
        <select v-model="chatSettings.replyLength" @change="emit('persist')">
          <option value="short">简短</option>
          <option value="natural">自然</option>
          <option value="long">较完整</option>
        </select>
      </label>

      <label class="setting-switch">
        <span><b>连续多条消息</b><small>回复可以自然拆成多个气泡</small></span>
        <input v-model="chatSettings.multiBubble" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-switch">
        <span><b>边想边回复</b><small>让文字在生成过程中逐步出现</small></span>
        <input v-model="chatSettings.streamResponse" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-switch">
        <span><b>显示正在输入</b><small>等待第一段回复时显示输入动画</small></span>
        <input v-model="chatSettings.showTyping" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-switch">
        <span><b>自然发送间隔</b><small>连续气泡之间保留短暂停顿</small></span>
        <input v-model="chatSettings.naturalDelay" type="checkbox" @change="emit('persist')" />
      </label>

      <template v-if="speechPlaybackAvailable">
        <label class="setting-switch">
          <span><b>自动朗读回复</b><small>收到新回复后自动播放角色声音</small></span>
          <input v-model="chatSettings.autoReadAloud" type="checkbox" @change="emit('persist')" />
        </label>

        <label class="setting-control">
          <span><b>角色声音</b><small>每个聊天角色会独立保存</small></span>
          <select v-model="chatSettings.voiceName" @change="emit('persist')">
            <option value="">自动选择</option>
            <option
              v-for="voice in speechVoices"
              :key="`${voice.name}-${voice.lang}`"
              :value="voice.name"
            >
              {{ voice.name }} · {{ voice.lang }}
            </option>
          </select>
        </label>

        <label class="setting-control voice-rate-control">
          <span><b>角色语速</b><small>当前 {{ chatSettings.voiceRate.toFixed(2) }} 倍，情绪会做轻微调整</small></span>
          <input
            v-model.number="chatSettings.voiceRate"
            type="range"
            min="0.7"
            max="1.4"
            step="0.05"
            @change="emit('persist')"
          />
        </label>

        <button class="voice-preview-button" type="button" @click="emit('previewVoice')">
          试听当前角色声音
        </button>
      </template>

      <label class="setting-control">
        <span><b>心理活动</b><small>点击聊天顶部头像后可查看</small></span>
        <select v-model="chatSettings.innerThoughtVisibility" @change="emit('persist')">
          <option value="off">关闭</option>
          <option value="simple">简单状态</option>
          <option value="thoughts">心情与想法</option>
          <option value="detailed">详细内心独白</option>
        </select>
      </label>

      <label class="setting-switch">
        <span><b>主动来找你</b><small>久未聊天时，打开应用可能收到一条自然问候</small></span>
        <input v-model="chatSettings.proactiveEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <label v-if="chatSettings.proactiveEnabled" class="setting-control">
        <span><b>多久后会想起你</b><small>至少间隔一段时间，不会频繁打扰</small></span>
        <select v-model.number="chatSettings.proactiveIntervalHours" @change="emit('persist')">
          <option :value="6">6 小时</option>
          <option :value="12">12 小时</option>
          <option :value="24">1 天</option>
          <option :value="72">3 天</option>
        </select>
      </label>

      <button class="danger-row" type="button" @click="emit('clearConversation')">清空聊天记录</button>
    </div>

    <div v-else-if="tab === 'memory' && chatSettings" class="settings-content">
      <label class="setting-switch">
        <span><b>允许记住聊天</b><small>关闭后不再自动提取新记忆</small></span>
        <input v-model="chatSettings.memoryEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-control">
        <span><b>记忆强度</b><small>决定哪些信息会被保存</small></span>
        <select v-model="chatSettings.memoryStrength" @change="emit('persist')">
          <option value="light">轻度</option>
          <option value="standard">标准</option>
          <option value="deep">深度</option>
        </select>
      </label>

      <label class="setting-control">
        <span><b>最近聊天范围</b><small>每次回复携带的最近消息数</small></span>
        <input v-model.number="chatSettings.recentMessageLimit" type="number" min="6" max="60" @change="emit('persist')" />
      </label>

      <form class="memory-add" @submit.prevent="emit('addMemory')">
        <input
          :value="newMemoryText"
          placeholder="手动添加一条记忆"
          @input="emit('update:newMemoryText', ($event.target as HTMLInputElement).value)"
        />
        <button type="submit">添加</button>
      </form>

      <div v-if="memories.length" class="memory-list">
        <article v-for="memory in memories" :key="memory.id">
          <small>{{ memoryCategoryNames[memory.category] }} · 重要度 {{ memory.importance }}</small>
          <p>{{ memory.content }}</p>
          <button type="button" @click="emit('deleteMemory', memory.id)">删除</button>
        </article>
      </div>
      <p v-else class="panel-empty">还没有保存任何重要记忆。</p>

      <button class="danger-row" type="button" @click="emit('clearMemories')">清除全部记忆</button>
    </div>

    <div v-else class="settings-content advanced-content">
      <div class="advanced-card">
        <small>当前服务</small>
        <strong>{{ providerLabel }}</strong>
        <span>{{ modelSettings?.model || '未设置模型' }}</span>
        <span class="vision-capability">图片理解：{{ visionCapabilityLabel }}</span>
      </div>

      <label v-if="chatSettings" class="setting-switch">
        <span><b>接口失败时使用本地回复</b><small>聊天页不会显示技术名称</small></span>
        <input v-model="chatSettings.autoFallback" type="checkbox" @change="emit('persist')" />
      </label>

      <div v-if="conversationState?.lastProviderNotice" class="technical-note">
        {{ conversationState.lastProviderNotice }}
      </div>

      <div v-if="conversationState?.lastTechnicalError" class="technical-error">
        <b>最近一次错误</b>
        <p>{{ conversationState.lastTechnicalError }}</p>
      </div>
      <p v-else class="technical-ok">最近没有接口错误。</p>

      <button class="panel-primary" type="button" @click="emit('openModelSettings')">打开 API 与模型设置</button>
    </div>
  </section>
</template>

<style scoped>
.bottom-panel {
  width: 100%;
  max-height: 88%;
  overflow-y: auto;
  padding: 8px 18px 24px;
  border-radius: 26px 26px 0 0;
  background: #fffafb;
  box-shadow: 0 -18px 50px rgba(70,42,55,.18);
  transition: transform .24s cubic-bezier(.22, .8, .24, 1);
  will-change: transform;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.panel-handle {
  position: relative;
  width: 84px;
  height: 17px;
  margin: -3px auto 15px;
  background: transparent;
  touch-action: none;
  cursor: grab;
}

.panel-handle::after {
  content: '';
  position: absolute;
  top: 5px;
  left: 50%;
  width: 42px;
  height: 5px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #dccbd2;
}

.panel-handle:active { cursor: grabbing; }

.panel-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title-row h2 { margin: 2px 0 16px; }
.panel-title-row small { color: #a17c8d; }
.panel-title-row > button {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: #f3e9ed;
  color: #765864;
  font-size: 22px;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 5px;
  border-radius: 15px;
  background: #f2e9ed;
}

.settings-tabs button {
  padding: 9px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: #8d707c;
}

.settings-tabs button.active {
  background: #fff;
  color: #5e414d;
  box-shadow: 0 3px 10px rgba(75,45,58,.07);
}

.settings-content { padding: 12px 0 4px; }

.setting-control,
.setting-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 3px;
  border-bottom: 1px solid rgba(80,50,62,.07);
}

.setting-control > span,
.setting-switch > span {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.setting-control small,
.setting-switch small {
  color: #9d7f8c;
  font-size: 11px;
}

.setting-control select,
.setting-control input {
  width: 112px;
  padding: 8px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 10px;
  background: #fff;
}

.setting-switch > input {
  width: 20px;
  height: 20px;
  accent-color: #d96b99;
}

.memory-add {
  display: grid;
  grid-template-columns: 1fr 58px;
  gap: 7px;
  margin: 14px 0;
}

.memory-add input,
.memory-add button {
  padding: 10px;
  border: 1px solid rgba(80,50,62,.1);
  border-radius: 12px;
}

.memory-add button {
  border: 0;
  background: #d96b99;
  color: #fff;
}

.memory-list article {
  position: relative;
  margin: 9px 0;
  padding: 12px 48px 12px 13px;
  border-radius: 14px;
  background: #f5edf1;
}

.memory-list article small { color: #a57a8e; }
.memory-list article p { margin: 5px 0 0; line-height: 1.55; }
.memory-list article button {
  position: absolute;
  top: 12px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #b26178;
}

.danger-row {
  width: 100%;
  margin-top: 13px;
  padding: 12px;
  border: 0;
  border-radius: 13px;
  background: #fff0f2;
  color: #b34f69;
}

.advanced-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 15px;
  border-radius: 16px;
  background: #f5edf1;
}

.advanced-card small,
.advanced-card span { color: #927684; }

.technical-note,
.technical-error,
.technical-ok {
  margin: 12px 0;
  padding: 12px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 1.6;
}

.technical-note { background: #fff5e7; color: #8c6a37; }
.technical-error { background: #fff0f2; color: #9f4d63; }
.technical-error p { margin: 5px 0 0; }
.technical-ok { background: #edf8f1; color: #547663; }

.panel-primary {
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: 15px;
  background: #d96b99;
  color: #fff;
  font-weight: 700;
}

.panel-empty {
  padding: 28px 8px;
  color: #9a7d8a;
  text-align: center;
  font-size: 12px;
  line-height: 1.65;
}

.voice-preview-button {
  width: 100%;
  margin: 10px 0 3px;
  padding: 11px 14px;
  border: 0;
  border-radius: 13px;
  background: #f3e8ed;
  color: #7d5668;
  font-weight: 700;
}

.vision-capability {
  margin-top: 3px;
}
</style>
