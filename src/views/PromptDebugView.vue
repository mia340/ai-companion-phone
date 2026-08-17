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
          <summary>触发的世界书</summary>
          <article v-for="entry in selected.activatedLorebook" :key="entry.id" class="memory-row"><b>{{ entry.title }}</b><small>{{ entry.reason || '关键词或常驻规则触发' }}</small></article>
          <p v-if="!selected.activatedLorebook.length" class="empty">本轮没有触发世界书。</p>
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
.debug-page{min-height:100%;padding:14px 14px 36px;background:#f7f0f3;color:#5d4350}.notice{position:sticky;top:6px;z-index:3;margin:0 0 10px;padding:9px 12px;border-radius:12px;background:#744f60;color:#fff;text-align:center}.intro-card,.debug-section,.trace-picker{margin-bottom:11px;border:1px solid rgba(92,58,73,.08);border-radius:18px;background:#fff;padding:14px}.intro-card p{margin:7px 0 0;color:#917482;font-size:12px;line-height:1.6}.trace-picker{display:flex;align-items:center;justify-content:space-between;gap:12px}.trace-picker select{min-width:0;max-width:70%;border:1px solid #eadce2;border-radius:11px;background:#fff;padding:9px}.summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:11px}.summary-grid article{display:grid;gap:3px;border-radius:14px;background:#fff;padding:12px}.summary-grid small{color:#a17f8e}.summary-grid b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.debug-section summary{cursor:pointer;font-weight:800}.debug-section>button{float:right;margin-top:-25px;border:0;border-radius:10px;background:#f2e5eb;color:#9b5a75;padding:6px 10px}.debug-section pre{overflow:auto;max-height:420px;margin:12px 0 0;border-radius:12px;background:#2b2327;color:#f6eaf0;padding:12px;font:11px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}.memory-row,.prompt-message,.budget-row{margin-top:9px;border-radius:12px;background:#f8f0f3;padding:10px}.memory-row{display:grid;gap:4px}.memory-row small{color:#a27a8c}.memory-row p{margin:0;line-height:1.55}.prompt-message pre{max-height:220px;margin-top:7px}.presence-resolution{display:grid;gap:4px;margin-top:10px;border-radius:12px;background:#edf7f1;color:#476b57;padding:10px}.presence-resolution.conflict{background:#fff1e7;color:#925d2f}.presence-resolution span,.presence-resolution small{line-height:1.5}.warnings{display:grid;gap:6px;margin-top:10px;border-radius:12px;background:#fff1e7;color:#925d2f;padding:10px}.warnings span:before,.rule-list span:before{content:'· ';font-weight:900}.ok{color:#4f8065}.score-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:12px}.score-grid article{display:flex;align-items:center;justify-content:space-between;border-radius:12px;background:#f8f0f3;padding:10px}.score-grid span{font-size:11px;color:#8e707c}.score-grid b{color:#bc6288}.score-note{display:block;margin-top:9px;color:#9b7e8a}.budget-row>div:first-child{display:flex;justify-content:space-between;gap:10px}.budget-row small{color:#987985}.budget-track{height:8px;margin-top:7px;overflow:hidden;border-radius:999px;background:#eadde2}.budget-track i{display:block;height:100%;border-radius:inherit;background:#c76a91}.budget-track i.over{background:#d88455}.rule-list{display:grid;gap:6px;margin-top:10px}.rule-list span{color:#785d69;font-size:12px}.empty,.empty-page{color:#9a7d8a;text-align:center;line-height:1.6}.empty-page{padding:70px 20px}.clear-button{width:100%;border:0;border-radius:14px;background:#fff0f2;color:#b24d67;padding:12px;font-weight:800}
</style>
