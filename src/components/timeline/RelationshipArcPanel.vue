<script setup lang="ts">
import { computed } from 'vue'
import CharacterAvatar from '../CharacterAvatar.vue'
import type { Character } from '../../types/domain'
import {
  relationshipArcNodeKindLabel,
  type RelationshipArc,
  type RelationshipArcNode
} from '../../services/relationshipArcService'
import type { SharedTimelineAcceptedRelationshipArcSummary } from '../../services/sharedTimelineService'
import type { RelationshipArcInsight } from '../../services/relationshipArcInsightService'

const props = defineProps<{
  arcs: RelationshipArc[]
  selectedCharacterId: string
  characters: Character[]
  acceptedSummary?: SharedTimelineAcceptedRelationshipArcSummary
  insightDraft?: RelationshipArcInsight
  insightBusy: boolean
  insightMessage: string
}>()

const emit = defineEmits<{
  'select-character': [characterId: string]
  'open-event': [eventId: string]
  'generate-insight': []
  'accept-insight': []
  'bring-chat': []
}>()

const selectedArc = computed(() => props.arcs.find(arc => arc.characterId === props.selectedCharacterId))
const characterMap = computed(() => new Map(props.characters.map(character => [character.id, character])))
const acceptedTurningPoints = computed(() => new Set(props.acceptedSummary?.turningPointNodeIds || []))
const draftTurningPoints = computed(() => new Map((props.insightDraft?.turningPoints || []).map(point => [point.nodeId, point.reason])))

function characterFor(arc: RelationshipArc) {
  return characterMap.value.get(arc.characterId)
}

function dateText(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
    : '时间未知'
}

function nodeBadge(node: RelationshipArcNode) {
  return relationshipArcNodeKindLabel(node.kind)
}
</script>

<template>
  <section class="arc-panel">
    <header class="arc-intro">
      <div>
        <small>Relationship Arc</small>
        <h3>关系脉络</h3>
        <p>只把真实事件、明确关系状态和约定串起来；Runtime 不从普通文案猜冲突、和解或感情程度。</p>
      </div>
      <button v-if="selectedCharacterId" type="button" @click="emit('select-character', '')">换角色</button>
    </header>

    <div v-if="!selectedCharacterId" class="arc-overview">
      <button v-for="arc in arcs" :key="arc.fingerprint" type="button" class="arc-person-card" @click="emit('select-character', arc.characterId)">
        <CharacterAvatar
          v-if="characterFor(arc)"
          :avatar="characterFor(arc)?.avatar || '🙂'"
          :name="characterFor(arc)?.name || arc.characterName || '角色'"
          :size="42"
        />
        <div>
          <b>{{ characterFor(arc)?.name || arc.characterName || '角色' }}</b>
          <span>{{ arc.nodes.length }} 个节点 · {{ arc.relationshipChangeCount }} 次明确关系变化 · {{ arc.promiseCount }} 个约定</span>
          <small v-if="arc.currentRelationship">当前最近关系记录：{{ arc.currentRelationship }}</small>
          <small v-else>还没有明确 relationship state 记录</small>
        </div>
        <i>›</i>
      </button>
      <div v-if="!arcs.length" class="arc-empty">还没有足够的真实事件构成关系脉络。</div>
    </div>

    <template v-else-if="selectedArc">
      <section class="arc-summary-card">
        <div class="arc-person-line">
          <CharacterAvatar
            v-if="characterFor(selectedArc)"
            :avatar="characterFor(selectedArc)?.avatar || '🙂'"
            :name="characterFor(selectedArc)?.name || selectedArc.characterName || '角色'"
            :size="44"
          />
          <div>
            <b>{{ characterFor(selectedArc)?.name || selectedArc.characterName || '角色' }}</b>
            <small>{{ dateText(selectedArc.nodes[0].startedAt) }} → {{ dateText(selectedArc.nodes[selectedArc.nodes.length - 1].endedAt) }}</small>
          </div>
        </div>
        <div class="arc-stats">
          <span><b>{{ selectedArc.nodes.length }}</b>节点</span>
          <span><b>{{ selectedArc.promiseCount }}</b>约定</span>
          <span><b>{{ selectedArc.relationshipChangeCount }}</b>关系变化</span>
          <span><b>{{ selectedArc.starredCount }}</b>收藏</span>
        </div>
        <p v-if="selectedArc.currentRelationship" class="arc-current">最近明确关系记录：<b>{{ selectedArc.currentRelationship }}</b></p>
        <p v-else class="arc-current muted">没有明确 relationship state 时，不会从聊天语气推断“当前关系”。</p>
        <div class="arc-summary-actions">
          <button type="button" :disabled="insightBusy" @click="emit('generate-insight')">{{ insightBusy ? '整理中…' : 'AI 整理关系脉络' }}</button>
          <button type="button" @click="emit('bring-chat')">带回聊天草稿</button>
        </div>
      </section>

      <section v-if="acceptedSummary" class="arc-accepted-card">
        <small>✓ 我确认过的关系脉络摘要</small>
        <p>{{ acceptedSummary.summary }}</p>
        <span>绑定 {{ acceptedSummary.nodeIds.length }} 个节点 / {{ acceptedSummary.evidenceIds.length }} 条 evidence；脉络变化后自动失效。</span>
      </section>

      <section v-if="insightMessage || insightDraft" class="arc-ai-card">
        <p v-if="insightMessage">{{ insightMessage }}</p>
        <template v-if="insightDraft && insightDraft.arcFingerprint === selectedArc.fingerprint">
          <b>AI 候选摘要</b>
          <p>{{ insightDraft.summary }}</p>
          <div v-if="insightDraft.turningPoints.length" class="arc-turning-draft">
            <span v-for="point in insightDraft.turningPoints" :key="point.nodeId">{{ point.reason }}</span>
          </div>
          <button type="button" @click="emit('accept-insight')">采用这份摘要</button>
        </template>
      </section>

      <section class="arc-phases">
        <article v-for="phase in selectedArc.phases" :key="phase.id" class="arc-phase">
          <header>
            <div><b>{{ phase.label }}</b><small>{{ dateText(phase.startedAt) }} — {{ dateText(phase.endedAt) }}</small></div>
            <span>{{ phase.nodes.length }} 节点</span>
          </header>
          <div class="arc-node-list">
            <button v-for="node in phase.nodes" :key="node.id" type="button" class="arc-node" @click="emit('open-event', node.eventId)">
              <span class="arc-node-dot" :class="`kind-${node.kind}`"></span>
              <div>
                <div class="arc-node-title"><em>{{ nodeBadge(node) }}</em><b>{{ node.title }}</b><i v-if="acceptedTurningPoints.has(node.id) || draftTurningPoints.has(node.id)">转折</i></div>
                <small>{{ dateText(node.startedAt) }} · {{ node.evidenceIds.length }} 条 evidence</small>
                <p>{{ node.summary }}</p>
                <blockquote v-if="node.relationshipAfter">{{ node.relationshipBefore ? `${node.relationshipBefore} → ` : '' }}{{ node.relationshipAfter }}</blockquote>
                <span v-if="draftTurningPoints.get(node.id)" class="turning-reason">AI 候选理由：{{ draftTurningPoints.get(node.id) }}</span>
              </div>
              <strong>›</strong>
            </button>
          </div>
        </article>
      </section>

      <p class="arc-proof-note">关系脉络是 Runtime 的证据投影，不是“关系评分”。AI 只能解释已给出的节点，并且必须回传完整 node/evidence provenance；只有你确认后的摘要才会保存。</p>
    </template>

    <div v-else class="arc-empty">这个角色当前没有可显示的关系脉络。</div>
  </section>
</template>

<style scoped>
.arc-panel{display:grid;gap:12px}.arc-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:13px 14px;border-radius:18px;background:linear-gradient(145deg,#f5efec,#eef3f5)}.arc-intro small{color:#a47f74;font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.arc-intro h3{margin:3px 0 4px;color:#465d69;font-size:18px}.arc-intro p{margin:0;max-width:330px;color:#7e8b92;font-size:9px;line-height:1.55}.arc-intro>button{border:0;border-radius:9px;background:#fff;color:#7b716f;font-size:8px;padding:7px 9px}.arc-overview{display:grid;gap:8px}.arc-person-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;width:100%;padding:11px;border:1px solid rgba(64,84,96,.07);border-radius:15px;background:#fff;text-align:left}.arc-person-card>div{min-width:0;display:grid;gap:3px}.arc-person-card b{color:#465d69;font-size:11px}.arc-person-card span{color:#758891;font-size:8px}.arc-person-card small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#9a8983;font-size:8px}.arc-person-card i{color:#b28e83;font-size:20px;font-style:normal}.arc-empty{padding:28px 14px;border-radius:16px;background:#f3f5f6;color:#87949b;font-size:9px;text-align:center}.arc-summary-card{display:grid;gap:10px;padding:13px;border:1px solid rgba(70,86,97,.07);border-radius:18px;background:#fff}.arc-person-line{display:flex;align-items:center;gap:9px}.arc-person-line>div{display:grid;gap:2px}.arc-person-line b{color:#415966;font-size:13px}.arc-person-line small{color:#9aa5ab;font-size:8px}.arc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.arc-stats span{display:grid;gap:1px;padding:7px 5px;border-radius:10px;background:#f4f6f7;color:#87949b;font-size:7px;text-align:center}.arc-stats b{color:#586f7c;font-size:11px}.arc-current{margin:0;padding:8px 9px;border-radius:10px;background:#f7f0ed;color:#806f69;font-size:9px;line-height:1.45}.arc-current.muted{background:#f4f5f5;color:#89959b}.arc-summary-actions{display:flex;gap:6px}.arc-summary-actions button{flex:1;border:0;border-radius:9px;background:#a77b70;color:#fff;font-size:8px;padding:8px}.arc-summary-actions button:last-child{background:#e9eff2;color:#607885}.arc-summary-actions button:disabled{opacity:.5}.arc-accepted-card,.arc-ai-card{display:grid;gap:6px;padding:11px 12px;border-radius:14px;background:#f2f6f3;border:1px solid rgba(87,122,101,.08)}.arc-accepted-card small{color:#66816f;font-size:8px;font-weight:700}.arc-accepted-card p,.arc-ai-card p{margin:0;color:#536b61;font-size:9px;line-height:1.6}.arc-accepted-card span{color:#8b9a91;font-size:7px}.arc-ai-card{background:#fff8f4;border-color:rgba(163,116,100,.09)}.arc-ai-card>b{color:#80665e;font-size:9px}.arc-ai-card>button{justify-self:start;border:0;border-radius:8px;background:#a77b70;color:#fff;font-size:8px;padding:7px 10px}.arc-turning-draft{display:flex;flex-wrap:wrap;gap:4px}.arc-turning-draft span{padding:4px 6px;border-radius:8px;background:#fff;color:#8c726a;font-size:7px}.arc-phases{display:grid;gap:13px}.arc-phase{display:grid;gap:7px}.arc-phase>header{display:flex;align-items:end;justify-content:space-between;padding:0 3px}.arc-phase>header>div{display:grid;gap:2px}.arc-phase>header b{color:#506875;font-size:11px}.arc-phase>header small,.arc-phase>header>span{color:#9aa5ab;font-size:7px}.arc-node-list{position:relative;display:grid;gap:7px;padding-left:16px}.arc-node-list::before{content:'';position:absolute;left:5px;top:15px;bottom:15px;width:1px;background:#ddd4d0}.arc-node{position:relative;display:grid;grid-template-columns:1fr auto;gap:8px;width:100%;padding:10px 10px 9px;border:1px solid rgba(67,85,96,.07);border-radius:13px;background:#fff;text-align:left}.arc-node-dot{position:absolute;left:-15px;top:18px;width:9px;height:9px;border:2px solid #f6f4f2;border-radius:50%;background:#9ab0ba}.arc-node-dot.kind-relationship-change{background:#a97b70}.arc-node-dot.kind-promise{background:#b89255}.arc-node-dot.kind-goal{background:#728f86}.arc-node-dot.kind-story{background:#877ba0}.arc-node>div{min-width:0;display:grid;gap:4px}.arc-node-title{display:flex;align-items:center;gap:5px;min-width:0}.arc-node-title em{padding:3px 5px;border-radius:999px;background:#eef2f3;color:#728690;font-size:7px;font-style:normal;white-space:nowrap}.arc-node-title b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4d6470;font-size:10px}.arc-node-title i{padding:2px 4px;border-radius:6px;background:#f3e7e2;color:#9d7064;font-size:6px;font-style:normal}.arc-node small{color:#9ca7ac;font-size:7px}.arc-node p{margin:0;color:#667983;font-size:8px;line-height:1.5}.arc-node blockquote{margin:1px 0 0;padding:5px 7px;border-left:2px solid #c89a8d;background:#faf4f2;color:#806d67;font-size:8px}.arc-node>strong{align-self:center;color:#abb5ba;font-size:16px}.turning-reason{color:#9a766b;font-size:7px}.arc-proof-note{margin:2px 4px 0;color:#9ba5aa;font-size:8px;line-height:1.6}
</style>
