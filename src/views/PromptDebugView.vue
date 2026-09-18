<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import {
  buildPromptDebugReport,
  clearPromptDebugTraces,
  listPromptDebugTraces
} from '../services/promptDebugService'
import type { PromptDebugTrace } from '../types/domain'

const route = useRoute()
const conversationId = computed(() => String(route.params.id || ''))
const traces = ref<PromptDebugTrace[]>([])
const selectedId = ref('')
const notice = ref('')
const selected = computed(() => traces.value.find(item => item.id === selectedId.value) || traces.value[0])
const contextSources = computed(() => {
  const trace = selected.value
  if (!trace) return []
  return [
    { label: 'Character Card', count: trace.characterCardRuntime ? 1 : 0, note: trace.characterCardRuntime?.sourceLabel || '未记录' },
    { label: 'Persona', count: trace.personaName ? 1 : 0, note: trace.personaName || '未绑定' },
    { label: 'Memory', count: trace.memoryHits.length, note: trace.memoryHits.length ? '按检索分数注入' : '本轮未命中' },
    { label: 'WorldBook', count: trace.activatedLorebook.length, note: trace.lorebookEngine ? `${trace.lorebookEngine.evaluatedEntries} 条参与评估` : '旧记录' },
    { label: 'Recent Messages', count: trace.recentMessages.length, note: '冻结后的最近聊天上下文' },
    { label: 'Regex', count: trace.regexPipeline?.activeScripts || 0, note: trace.regexPipeline ? '按 storage / prompt / display 分阶段' : '未记录' },
    { label: 'Agent / Interaction', count: trace.protocolEnabled ? 1 : 0, note: trace.actionSummary || '无动作摘要' }
  ]
})

async function load() {
  traces.value = await listPromptDebugTraces(conversationId.value)
  if (!selectedId.value || !traces.value.some(item => item.id === selectedId.value)) selectedId.value = traces.value[0]?.id || ''
}
async function copy(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  notice.value = `${label}已复制。`
  window.setTimeout(() => { if (notice.value) notice.value = '' }, 2200)
}
async function clearAll() {
  if (!window.confirm('清除当前聊天的全部 Prompt 调试记录吗？')) return
  await clearPromptDebugTraces(conversationId.value)
  await load()
}
function formatTime(value: string) { return new Date(value).toLocaleString('zh-CN', { hour12: false }) }
function scoreTone(value?: number) { return value === undefined ? '—' : `${value}/100` }

onMounted(load)
watch(conversationId, load)
</script>

<template>
  <PhoneFrame title="Prompt 调试器" show-back>
    <main class="debug-page">
      <p v-if="notice" class="notice">{{ notice }}</p>
      <section class="intro-card">
        <b>本地调试记录</b>
        <p>检查角色卡、Persona、世界书、记忆、字符预算、互动动作和最终展示回复。记录不会随数据备份导出。</p>
      </section>

      <template v-if="selected">
        <label class="trace-picker"><span>选择请求</span><select v-model="selectedId"><option v-for="trace in traces" :key="trace.id" :value="trace.id">{{ formatTime(trace.createdAt) }} · {{ trace.model }}</option></select></label>

        <section class="summary-grid">
          <article><small>自然度</small><b>{{ scoreTone(selected.naturalnessScore?.total) }}</b></article>
          <article><small>角色模式</small><b>{{ selected.roleplayMode }}</b></article>
          <article><small>Persona</small><b>{{ selected.personaName }}</b></article>
          <article><small>上下文字符</small><b>{{ selected.estimatedCharacters }}</b></article>
          <article><small>世界书</small><b>{{ selected.activatedLorebook.length }} 条</b></article>
          <article><small>记忆命中</small><b>{{ selected.memoryHits.length }} 条</b></article>
          <article><small>Generation</small><b>{{ selected.generationId ? selected.generationId.slice(0, 8) : '旧记录' }}</b></article>
          <article><small>Context 冻结</small><b>{{ selected.contextCreatedAt ? formatTime(selected.contextCreatedAt) : '旧记录' }}</b></article>
        </section>

        <details open class="debug-section">
          <summary>本轮诊断</summary>
          <button type="button" @click="copy(buildPromptDebugReport(selected),'调试报告')">复制完整报告</button>
          <p><b>互动动作：</b>{{ selected.actionSummary || '尚未收到完整回复' }}</p>
          <div v-if="selected.presenceResolution" :class="['presence-resolution', { conflict: selected.presenceResolution.conflict }]">
            <b>场景判定：{{ selected.presenceResolution.resolvedPresence === 'together' ? '在一起 / 同场景' : selected.presenceResolution.resolvedPresence === 'remote' ? '远程' : '未确定' }}</b>
            <span>{{ selected.presenceResolution.reason }}</span>
            <small v-if="selected.presenceResolution.reportedPresence">模型报告：{{ selected.presenceResolution.reportedPresence === 'together' ? '同场景' : '远程' }}</small>
            <small v-if="selected.presenceResolution.uiSurroundings">角色卡周围：{{ selected.presenceResolution.uiSurroundings }}</small>
          </div>
          <p v-if="selected.generationId"><b>Generation ID：</b><code>{{ selected.generationId }}</code></p>
          <p v-if="selected.sourceMessageId"><b>触发消息：</b><code>{{ selected.sourceMessageId }}</code></p>
          <p><b>图片：</b>{{ selected.imageCount }} 张</p>
          <p><b>互动协议：</b>{{ selected.protocolEnabled ? '已启用' : '未启用' }}</p>
          <div v-if="selected.naturalnessWarnings?.length" class="warnings"><b>自然度提醒</b><span v-for="warning in selected.naturalnessWarnings" :key="warning">{{ warning }}</span></div>
          <p v-else class="ok">没有命中已知 AI 腔规则。</p>
        </details>

        <details v-if="selected.naturalnessScore" open class="debug-section">
          <summary>角色自然度评分</summary>
          <div class="score-grid">
            <article><span>角色一致性</span><b>{{ selected.naturalnessScore.roleConsistency }}</b></article>
            <article><span>去 AI 腔</span><b>{{ selected.naturalnessScore.aiToneRisk }}</b></article>
            <article><span>避免重复</span><b>{{ selected.naturalnessScore.repetitionRisk }}</b></article>
            <article><span>提问平衡</span><b>{{ selected.naturalnessScore.questionBalance }}</b></article>
            <article><span>长度适配</span><b>{{ selected.naturalnessScore.lengthFit }}</b></article>
            <article><span>关系回应</span><b>{{ selected.naturalnessScore.relationshipResponse }}</b></article>
            <article><span>回应重点</span><b>{{ selected.naturalnessScore.userFocus }}</b></article>
            <article><span>图片使用</span><b>{{ selected.naturalnessScore.imageUse }}</b></article>
          </div>
          <small class="score-note">这是规则诊断分数，只用于开发排查，不代表对角色或用户的评价。</small>
        </details>

        <details open class="debug-section">
          <summary>API 响应诊断</summary>
          <template v-if="selected.apiResponseDiagnostics">
            <p><b>HTTP：</b>{{ selected.apiResponseDiagnostics.httpStatus ?? '未提供' }} · <b>finish_reason：</b>{{ selected.apiResponseDiagnostics.finishReason || '未提供' }}</p>
            <p><b>结构化拒绝标记：</b>{{ selected.apiResponseDiagnostics.structuredRefusal ? '有' : '未见' }} · <b>文本疑似自述拒绝：</b>{{ selected.apiResponseDiagnostics.textRefusal ? '是' : '未见' }}</p>
            <p class="ok">仅做诊断，不改变模型回复。无法仅凭文本区分底层模型与中转服务；不记录 API Key 或原始响应头。</p>
          </template>
          <p v-else class="empty">旧请求未采集响应诊断。</p>
        </details>

        <details open class="debug-section">
          <summary>字符预算与截断</summary>
          <p v-if="selected.tokenUsage?.totalTokens" class="ok">API 实际 Token：输入 {{ selected.tokenUsage.promptTokens || 0 }} · 输出 {{ selected.tokenUsage.completionTokens || 0 }} · 合计 {{ selected.tokenUsage.totalTokens }}<template v-if="selected.tokenUsage.successfulCalls && selected.tokenUsage.successfulCalls > 1"> · {{ selected.tokenUsage.successfulCalls }} 次成功调用累计</template></p>
          <article v-for="section in selected.promptSections || []" :key="section.key" class="budget-row">
            <div><b>{{ section.label }}</b><small>{{ section.characters }}{{ section.budget ? ` / 建议 ${section.budget}` : '' }}</small></div>
            <div class="budget-track"><i :style="{ width: `${Math.min(100, section.budget ? section.characters / section.budget * 100 : 25)}%` }" :class="{ over: section.truncated }"></i></div>
          </article>
          <div v-if="selected.truncations?.length" class="warnings"><b>可能被弱化或截断</b><span v-for="item in selected.truncations" :key="item">{{ item }}</span></div>
          <p v-else class="ok">没有发现明确的字符预算风险。</p>
        </details>

        <details open class="debug-section">
          <summary>本轮生效的规则</summary>
          <div v-if="selected.ruleInfluences?.length" class="rule-list"><span v-for="rule in selected.ruleInfluences" :key="rule">{{ rule }}</span></div>
          <p v-else class="empty">没有记录规则影响。</p>
        </details>

        <details open class="debug-section">
          <summary>Context Inspector</summary>
          <p class="ok">展示这一轮实际进入 Generation Context 的来源，不根据设置页“猜测已启用”。</p>
          <article v-for="source in contextSources" :key="source.label" class="context-source-row">
            <div><b>{{ source.label }}</b><small>{{ source.note }}</small></div>
            <strong>{{ source.count }}</strong>
          </article>
          <p v-if="selected.contextCreatedAt"><b>冻结时间：</b>{{ formatTime(selected.contextCreatedAt) }}</p>
          <p v-if="selected.generationId"><b>Generation：</b><code>{{ selected.generationId }}</code></p>
        </details>

        <details v-if="selected.characterCardRuntime" open class="debug-section">
          <summary>Character Card Runtime</summary>
          <div class="score-grid">
            <article><span>规格</span><b>{{ selected.characterCardRuntime.family }}</b></article>
            <article><span>system_prompt</span><b>{{ selected.characterCardRuntime.systemPromptMode }}</b></article>
            <article><span>post-history</span><b>{{ selected.characterCardRuntime.postHistoryMode || '旧记录未记录' }}</b></article>
            <article><span>开场池</span><b>{{ selected.characterCardRuntime.greetingCount }}</b></article>
            <article><span>creator_notes</span><b>0 Token</b></article>
          </div>
          <p><b><span v-pre>{{char}}</span> 宏：</b>{{ selected.characterCardRuntime.macroCharacterName }}</p>
          <p><b>来源：</b>{{ selected.characterCardRuntime.sourceLabel }}</p>
          <div v-if="selected.characterCardRuntime.notes.length" class="rule-list"><span v-for="note in selected.characterCardRuntime.notes" :key="note">{{ note }}</span></div>
        </details>

        <details open class="debug-section">
          <summary>WorldBook Activation Inspector</summary>
          <article v-for="entry in selected.activatedLorebook" :key="entry.id" class="memory-row"><b>{{ entry.title }}</b><small>{{ entry.reason || '关键词或常驻规则触发' }}</small></article>
          <p v-if="!selected.activatedLorebook.length" class="empty">本轮没有触发世界书。</p>
          <div v-if="selected.resourceRouting?.length" class="activation-routing">
            <b>资源路由</b>
            <span v-for="entry in selected.resourceRouting" :key="`${entry.status}:${entry.id}`">{{ entry.title }} · {{ entry.status }} · {{ entry.reason }}</span>
          </div>
          <div v-if="selected.lorebookEngine" class="activation-routing">
            <b>阻止 / 淘汰</b>
            <span v-if="selected.lorebookEngine.cooldownBlocked.length">Cooldown：{{ selected.lorebookEngine.cooldownBlocked.join('、') }}</span>
            <span v-if="selected.lorebookEngine.delayBlocked.length">Delay：{{ selected.lorebookEngine.delayBlocked.join('、') }}</span>
            <span v-if="selected.lorebookEngine.groupDropped.length">Group：{{ selected.lorebookEngine.groupDropped.join('；') }}</span>
            <span v-if="selected.lorebookEngine.droppedByBudget">Token Budget：淘汰 {{ selected.lorebookEngine.droppedByBudget }} 条</span>
          </div>
          <div v-if="selected.lorebookEngine?.decisions?.length" class="decision-list">
            <b>逐条判定</b>
            <article v-for="decision in selected.lorebookEngine.decisions" :key="decision.id" :class="['decision-row', `status-${decision.status}`]">
              <div><strong>{{ decision.title }}</strong><small>{{ decision.reason }}</small></div>
              <em>{{ decision.status === 'focused' ? 'Focus' : decision.status === 'activated' ? '激活' : decision.status === 'deferred' ? '延后' : '未触发' }}</em>
            </article>
          </div>
        </details>

        <details v-if="selected.lorebookEngine" open class="debug-section">
          <summary>WorldBook Engine V2</summary>
          <div class="score-grid">
            <article><span>评估条目</span><b>{{ selected.lorebookEngine.evaluatedEntries }}</b></article>
            <article><span>初始激活</span><b>{{ selected.lorebookEngine.initialActivated }}</b></article>
            <article><span>递归激活</span><b>{{ selected.lorebookEngine.recursiveActivated }}</b></article>
            <article><span>递归层数</span><b>{{ selected.lorebookEngine.recursionSteps }}</b></article>
            <article><span>估算 Token</span><b>{{ selected.lorebookEngine.estimatedUsedTokens }}</b></article>
            <article><span>预算淘汰</span><b>{{ selected.lorebookEngine.droppedByBudget }}</b></article>
          </div>
          <p v-if="selected.lorebookEngine.estimatedBudgetTokens"><b>显式预算合计：</b>{{ selected.lorebookEngine.estimatedBudgetTokens }} Token</p>
          <p v-else class="ok">当前绑定世界书没有设置硬 Token 预算；不会为了应用默认值擅自删作者条目。</p>
          <div class="rule-list">
            <span v-if="selected.lorebookEngine.stickyActive.length">Sticky：{{ selected.lorebookEngine.stickyActive.join('、') }}</span>
            <span v-if="selected.lorebookEngine.cooldownBlocked.length">Cooldown：{{ selected.lorebookEngine.cooldownBlocked.join('、') }}</span>
            <span v-if="selected.lorebookEngine.delayBlocked.length">Delay：{{ selected.lorebookEngine.delayBlocked.join('、') }}</span>
            <span v-if="selected.lorebookEngine.groupDropped.length">Group：{{ selected.lorebookEngine.groupDropped.join('；') }}</span>
            <span v-if="selected.lorebookEngine.depthInjections.length">@D：{{ selected.lorebookEngine.depthInjections.map(item => `${item.title}@${item.depth}/${item.role}`).join('、') }}</span>
          </div>
        </details>

        <details v-if="selected.resourceRouting?.length" open class="debug-section">
          <summary>资源调度与节省</summary>
          <p v-if="selected.estimatedSavedCharacters" class="ok">本轮资源调度预计少注入 {{ selected.estimatedSavedCharacters }} 字符。</p>
          <article v-for="entry in selected.resourceRouting" :key="`${entry.status}:${entry.id}`" class="memory-row">
            <b>{{ entry.title }}</b>
            <small>{{ entry.status === 'focused' ? '本轮 Focus' : entry.status === 'deferred' ? '按需休眠' : '已注入' }} · {{ entry.characters }} 字符</small>
            <small>{{ entry.reason }}</small>
          </article>
        </details>

        <details open class="debug-section">
          <summary>命中的记忆</summary>
          <article v-for="memory in selected.memoryHits" :key="memory.id" class="memory-row"><small>{{ memory.layer || '未分类' }} · 重要度 {{ memory.importance }}<template v-if="memory.score !== undefined"> · 分数 {{ memory.score }}</template></small><p>{{ memory.content }}</p><small v-if="memory.reason">{{ memory.reason }}</small></article>
          <p v-if="!selected.memoryHits.length" class="empty">本轮没有注入长期记忆。</p>
        </details>

        <details class="debug-section"><summary>最终 System Prompt</summary><button type="button" @click="copy(selected.systemPrompt,'System Prompt')">复制</button><pre>{{ selected.systemPrompt }}</pre></details>
        <details class="debug-section"><summary>最近聊天上下文</summary><article v-for="(message,index) in selected.recentMessages" :key="index" class="prompt-message"><b>{{ message.role }}</b><pre>{{ message.content }}</pre></article></details>
        <details v-if="selected.rawOutput" class="debug-section"><summary>模型原始输出</summary><button type="button" @click="copy(selected.rawOutput || '','原始输出')">复制</button><pre>{{ selected.rawOutput }}</pre></details>
        <details v-if="selected.visibleOutput" class="debug-section"><summary>用户实际看到的回复</summary><pre>{{ selected.visibleOutput }}</pre></details>
        <button class="clear-button" type="button" @click="clearAll">清除调试记录</button>
      </template>
      <p v-else class="empty-page">还没有调试记录。回到聊天发送一条消息后再查看。</p>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.debug-page{min-height:100%;padding:14px 14px 36px;background:#f2f8fc;color:#40566a}.notice{position:sticky;top:6px;z-index:3;margin:0 0 10px;padding:9px 12px;border-radius:12px;background:#5f8fb1;color:#fff;text-align:center}.intro-card,.debug-section,.trace-picker{margin-bottom:11px;border:1px solid rgba(84,132,166,.12);border-radius:18px;background:#fff;padding:14px}.intro-card p{margin:7px 0 0;color:#6f8798;font-size:12px;line-height:1.6}.trace-picker{display:flex;align-items:center;justify-content:space-between;gap:12px}.trace-picker select{min-width:0;max-width:70%;border:1px solid #d7e5f0;border-radius:11px;background:#fff;padding:9px}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:11px}.summary-grid article{display:grid;gap:3px;border-radius:14px;background:#fff;padding:12px}.summary-grid small{color:#7890a2}.summary-grid b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.debug-section summary{cursor:pointer;font-weight:800}.debug-section>button{float:right;margin-top:-25px;border:0;border-radius:10px;background:#eaf4fb;color:#4f7f9f;padding:6px 10px}.debug-section pre{overflow:auto;max-height:420px;margin:12px 0 0;border-radius:12px;background:#213544;color:#edf7fd;padding:12px;font:11px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}.memory-row,.prompt-message,.budget-row{margin-top:9px;border-radius:12px;background:#f2f8fc;padding:10px}.memory-row{display:grid;gap:4px}.memory-row small{color:#7890a2}.memory-row p{margin:0;line-height:1.55}.prompt-message pre{max-height:220px;margin-top:7px}.presence-resolution{display:grid;gap:4px;margin-top:10px;border-radius:12px;background:#edf7f1;color:#476b57;padding:10px}.presence-resolution.conflict{background:#fff1e7;color:#925d2f}.presence-resolution span,.presence-resolution small{line-height:1.5}.warnings{display:grid;gap:6px;margin-top:10px;border-radius:12px;background:#fff1e7;color:#925d2f;padding:10px}.warnings span:before,.rule-list span:before{content:'· ';font-weight:900}.ok{color:#4f8065}.score-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:12px}.score-grid article{display:flex;align-items:center;justify-content:space-between;border-radius:12px;background:#f2f8fc;padding:10px}.score-grid span{font-size:11px;color:#8e707c}.score-grid b{color:#5f8fb1}.score-note{display:block;margin-top:9px;color:#7890a2}.budget-row>div:first-child{display:flex;justify-content:space-between;gap:10px}.budget-row small{color:#7890a2}.budget-track{height:8px;margin-top:7px;overflow:hidden;border-radius:999px;background:#dcecf6}.budget-track i{display:block;height:100%;border-radius:inherit;background:#6ea5c7}.budget-track i.over{background:#d88455}.rule-list{display:grid;gap:6px;margin-top:10px}.rule-list span{color:#5d7485;font-size:12px}.empty,.empty-page{color:#7890a2;text-align:center;line-height:1.6}.empty-page{padding:70px 20px}.clear-button{width:100%;border:0;border-radius:14px;background:#eef7fc;color:#4f7f9f;padding:12px;font-weight:800}

.context-source-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;border-radius:12px;background:#f2f8fc;padding:10px}.context-source-row>div{display:grid;gap:3px}.context-source-row small{color:#7890a2;font-size:10px}.context-source-row strong{min-width:30px;text-align:center;color:#5f8fb1;font-size:18px}.activation-routing{display:grid;gap:5px;margin-top:10px;border-radius:12px;background:#f6f2fb;padding:10px;color:#675d79}.activation-routing span{font-size:11px;line-height:1.45}.activation-routing span:before{content:'· ';font-weight:900}.decision-list{display:grid;gap:7px;margin-top:10px}.decision-row{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-radius:11px;background:#f4f7fa;padding:9px 10px}.decision-row>div{display:grid;gap:3px;min-width:0}.decision-row strong{font-size:11px}.decision-row small{color:#7d8f9d;font-size:9px;line-height:1.45}.decision-row em{flex:0 0 auto;border-radius:999px;background:#e7edf2;padding:4px 7px;color:#617482;font-size:8px;font-style:normal}.decision-row.status-activated em,.decision-row.status-focused em{background:#dff2e9;color:#1a805c}.decision-row.status-deferred em{background:#fff0df;color:#9b6a34}
</style>
