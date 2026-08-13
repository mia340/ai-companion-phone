<script setup lang="ts">
import type { CSSProperties } from 'vue'

import type {
  CharacterMemory,
  ChatSettings,
  ConversationState,
  UserPersona
} from '../../types/domain'
import type { ModelSettings } from '../../types/modelSettings'

export type ChatSettingsTab = 'chat' | 'roleplay' | 'memory' | 'advanced'

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
  personas: UserPersona[]
  greetings: string[]
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
  openPersonas: []
  openLorebook: []
  openCharacterCard: []
  openPromptDebug: []
  openMemoryManager: []
  useGreeting: [greeting: string]
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
      <button :class="{ active: tab === 'roleplay' }" type="button" @click="emit('update:tab', 'roleplay')">角色扮演</button>
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

      <label v-if="chatSettings.naturalDelay" class="setting-control">
        <span><b>消息发送节奏</b><small>根据角色回复速度和消息长度决定气泡间隔</small></span>
        <select v-model="chatSettings.messagePacing" @change="emit('persist')"><option value="off">无额外间隔</option><option value="quick">偏快</option><option value="natural">自然</option><option value="slow">偏慢</option></select>
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

      <template v-if="chatSettings.proactiveEnabled">
        <label class="setting-control">
          <span><b>主动频率</b><small>会同时参考角色主动程度和关系阶段</small></span>
          <select v-model="chatSettings.proactiveFrequency" @change="emit('persist')">
            <option value="low">低</option>
            <option value="natural">自然</option>
            <option value="high">较高</option>
          </select>
        </label>

        <label class="setting-control">
          <span><b>最短联系间隔</b><small>即使有未完成话题也不会低于此间隔</small></span>
          <select v-model.number="chatSettings.proactiveIntervalHours" @change="emit('persist')">
            <option :value="6">6 小时</option>
            <option :value="12">12 小时</option>
            <option :value="24">1 天</option>
            <option :value="72">3 天</option>
          </select>
        </label>

        <label class="setting-switch">
          <span><b>安静时段</b><small>在设定时段内不生成主动消息</small></span>
          <input v-model="chatSettings.proactiveQuietHoursEnabled" type="checkbox" @change="emit('persist')" />
        </label>

        <div v-if="chatSettings.proactiveQuietHoursEnabled" class="quiet-hours-row">
          <label><span>开始</span><input v-model="chatSettings.proactiveQuietStart" type="time" @change="emit('persist')" /></label>
          <label><span>结束</span><input v-model="chatSettings.proactiveQuietEnd" type="time" @change="emit('persist')" /></label>
        </div>

        <fieldset class="source-options">
          <legend>允许的主动消息来源</legend>
          <label><input v-model="chatSettings.proactiveAllowedSources" type="checkbox" value="continue-topic" @change="emit('persist')" />延续话题</label>
          <label><input v-model="chatSettings.proactiveAllowedSources" type="checkbox" value="promise-reminder" @change="emit('persist')" />履行承诺</label>
          <label><input v-model="chatSettings.proactiveAllowedSources" type="checkbox" value="daily-share" @change="emit('persist')" />分享日常</label>
          <label><input v-model="chatSettings.proactiveAllowedSources" type="checkbox" value="care" @change="emit('persist')" />关心状态</label>
          <label><input v-model="chatSettings.proactiveAllowedSources" type="checkbox" value="story-event" @change="emit('persist')" />剧情事件</label>
        </fieldset>
      </template>

      <button class="danger-row" type="button" @click="emit('clearConversation')">清空聊天记录</button>
    </div>

    <div v-else-if="tab === 'roleplay' && chatSettings" class="settings-content roleplay-content">
      <label class="setting-control">
        <span><b>聊天模式</b><small>决定动作描写、剧情连续性和日常聊天比例</small></span>
        <select v-model="chatSettings.roleplayMode" @change="emit('persist')">
          <option value="daily">日常陪伴</option>
          <option value="immersive">沉浸剧情</option>
          <option value="deep">深度角色扮演</option>
        </select>
      </label>

      <label class="setting-control">
        <span><b>当前相处状态</b><small>用于场景与记忆判断；社区 UI 的排版与标签不会被这里改写</small></span>
        <select v-model="chatSettings.presenceMode" @change="emit('persist')">
          <option value="auto">自动 · 当前 {{ conversationState?.presence === 'together' ? '在身边' : '远程' }}</option>
          <option value="together">在身边 / 同一现场</option>
          <option value="remote">不在身边 / 手机联系</option>
        </select>
      </label>

      <label class="setting-control">
        <span><b>普通聊天动作</b><small>仅在角色没有社区 UI / 固定输出协议时生效</small></span>
        <select v-model="chatSettings.actionVisibility" @change="emit('persist')">
          <option value="always">始终显示</option>
          <option value="together">只在身边显示</option>
          <option value="off">关闭动作描写</option>
        </select>
      </label>

      <label class="setting-control">
        <span><b>我的 Persona</b><small>角色在本次聊天中认识的“你”</small></span>
        <select v-model="chatSettings.personaId" @change="emit('persist')">
          <option value="">使用默认人设</option>
          <option v-for="persona in personas" :key="persona.id" :value="persona.id">
            {{ persona.name }}{{ persona.isDefault ? ' · 默认' : '' }}{{ persona.personaScope === 'character' ? ` · ${persona.boundCharacterName || '角色专属'}` : '' }}
          </option>
        </select>
      </label>

      <label class="setting-switch">
        <span><b>启用世界书</b><small>按关键词注入人物、地点和世界设定</small></span>
        <input v-model="chatSettings.lorebookEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-switch">
        <span><b>候选回复滑动</b><small>“换一个回复”会保留旧版本，可左右切换</small></span>
        <input v-model="chatSettings.swipeRepliesEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <label class="setting-switch">
        <span><b>小手机互动协议</b><small>普通角色使用；检测到社区 UI 时会自动让位，不覆盖原 JSON 格式</small></span>
        <input v-model="chatSettings.actionProtocolEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <div v-if="greetings.length" class="greeting-picker">
        <b>角色开场白</b>
        <small>可以把任一开场作为角色的新消息插入聊天</small>
        <button v-for="(greeting, index) in greetings" :key="`${index}-${greeting.slice(0, 12)}`" type="button" @click="emit('useGreeting', greeting)">
          <span>{{ index === 0 ? '默认' : `备用 ${index}` }}</span>
          {{ greeting }}
        </button>
      </div>

      <div class="roleplay-links">
        <button type="button" @click="emit('openCharacterCard')">编辑当前角色卡 V2</button>
        <button type="button" @click="emit('openPersonas')">管理用户 Persona</button>
        <button type="button" @click="emit('openLorebook')">管理世界书 Lorebook</button>
      </div>
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

      <button class="debug-button" type="button" @click="emit('openMemoryManager')">打开完整记忆管理</button>
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

      <label v-if="chatSettings" class="setting-switch">
        <span><b>保存 Prompt 调试记录</b><small>只保存在当前浏览器，最多保留最近 20 次，不随备份导出</small></span>
        <input v-model="chatSettings.promptDebugEnabled" type="checkbox" @change="emit('persist')" />
      </label>

      <div v-if="conversationState?.lastProviderNotice" class="technical-note">
        {{ conversationState.lastProviderNotice }}
      </div>

      <div v-if="conversationState?.lastTechnicalError" class="technical-error">
        <b>最近一次错误</b>
        <p>{{ conversationState.lastTechnicalError }}</p>
      </div>
      <p v-else class="technical-ok">最近没有接口错误。</p>

      <button class="debug-button" type="button" @click="emit('openPromptDebug')">查看本轮 Prompt、世界书与记忆命中</button>
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
  grid-template-columns: repeat(4, 1fr);
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

.greeting-picker{display:grid;gap:7px;padding:12px;border-radius:15px;background:#f8edf1}.greeting-picker small{color:#9a7b88}.greeting-picker button{max-height:76px;overflow:hidden;border:0;border-radius:11px;background:#fff;padding:9px;text-align:left;color:#725461;line-height:1.45}.greeting-picker button span{display:block;color:#c05e86;font-size:10px;font-weight:800}
.roleplay-links{display:grid;gap:8px}.roleplay-links button{padding:11px;border:0;border-radius:13px;background:#f5e8ee;color:#a05d79;font-weight:700}

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
.debug-button{width:100%;margin:0 0 9px;padding:12px 14px;border:0;border-radius:15px;background:#f2e6ec;color:#955a74;font-weight:800}

.quiet-hours-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}.quiet-hours-row label{display:grid;gap:5px;padding:10px;border-radius:13px;background:#f8eff3;color:#8c6d79;font-size:11px}.quiet-hours-row input{width:100%;min-width:0;border:0;background:transparent;color:#654c57}.source-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:12px;border:1px solid #eedfe5;border-radius:15px}.source-options legend{padding:0 5px;color:#8e6d7b;font-size:11px}.source-options label{display:flex;align-items:center;gap:6px;color:#755866;font-size:12px}.source-options input{accent-color:#d96b99}
</style>
