<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { updateCharacterAndConversation } from '../services/characterService'
import {
  parseExampleDialogues,
  serializeExampleDialogues
} from '../services/characterCardService'
import {
  parseEmbeddedUserPersonaTemplate,
  exportCharacterAsSillyTavernV2,
  extractEmbeddedUserTemplate,
  parseCharacterCardFile
} from '../services/characterCardImportService'
import { savePersona } from '../services/personaService'
import { getChatSettings, saveChatSettings } from '../services/chatSettings'
import type {
  Character,
  EmojiFrequency,
  InitiativeLevel,
  NarrationStyle,
  QuestionFrequency
} from '../types/domain'

const route = useRoute()
const router = useRouter()
const characterId = computed(() => String(route.params.id || ''))
const character = ref<Character>()
const isLoading = ref(true)
const isSaving = ref(false)
const message = ref('')
const cardFileInput = ref<HTMLInputElement>()

const form = reactive({
  appearance: '',
  values: '',
  habits: '',
  weaknesses: '',
  secrets: '',
  boundaries: '',
  scenario: '',
  firstMessage: '',
  alternateGreetingsText: '',
  exampleDialoguesText: '',
  creatorNotes: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  initiative: 'natural' as InitiativeLevel,
  narrationStyle: 'light' as NarrationStyle,
  emojiFrequency: 'low' as EmojiFrequency,
  questionFrequency: 'natural' as QuestionFrequency,
  tagsText: '',
  creator: '',
  resourceVersion: '',
  sourceUrl: '',
  license: '',
  allowDerivative: false
})

const embeddedUserPreview = computed(() => {
  if (!character.value) return undefined
  const raw = character.value.embeddedUserTemplate || extractEmbeddedUserTemplate(character.value.persona || '')
  return parseEmbeddedUserPersonaTemplate(raw, character.value.name)
})

const embeddedPersonaMessage = ref('')

const completeness = computed(() => {
  const values = [
    character.value?.persona,
    character.value?.speakingStyle,
    character.value?.background,
    form.appearance,
    form.values,
    form.habits,
    form.scenario,
    form.firstMessage,
    form.exampleDialoguesText
  ]
  return Math.round(values.filter(value => value?.trim()).length / values.length * 100)
})

function parseList(value: string) {
  return Array.from(new Set(value.split(/[,，、\n]+/).map(item => item.trim()).filter(Boolean)))
}

async function load() {
  isLoading.value = true
  try {
    const row = await db.characters.get(characterId.value)
    if (!row) throw new Error('没有找到这个角色。')
    character.value = row
    form.appearance = row.appearance || ''
    form.values = row.values || ''
    form.habits = row.habits || ''
    form.weaknesses = row.weaknesses || ''
    form.secrets = row.secrets || ''
    form.boundaries = row.boundaries || ''
    form.scenario = row.scenario || ''
    form.firstMessage = row.firstMessage || ''
    form.alternateGreetingsText = (row.alternateGreetings || []).join('\n\n---\n\n')
    form.exampleDialoguesText = serializeExampleDialogues(row.exampleDialogues)
    form.creatorNotes = row.creatorNotes || ''
    form.systemPrompt = row.systemPrompt || ''
    form.postHistoryInstructions = row.postHistoryInstructions || ''
    form.initiative = row.initiative || 'natural'
    form.narrationStyle = row.narrationStyle || 'light'
    form.emojiFrequency = row.emojiFrequency || 'low'
    form.questionFrequency = row.questionFrequency || 'natural'
    form.tagsText = (row.tags || []).join('、')
    form.creator = row.creator || ''
    form.resourceVersion = row.resourceVersion || ''
    form.sourceUrl = row.sourceUrl || ''
    form.license = row.license || ''
    form.allowDerivative = row.allowDerivative ?? false
  } catch (error) {
    message.value = error instanceof Error ? error.message : '角色卡读取失败。'
  } finally {
    isLoading.value = false
  }
}

async function save() {
  if (!character.value || isSaving.value) return
  isSaving.value = true
  message.value = ''
  try {
    const alternateGreetings = form.alternateGreetingsText
      .split(/\n\s*---+\s*\n|\n{3,}/)
      .map(item => item.trim())
      .filter(Boolean)

    await updateCharacterAndConversation(character.value.id, {
      appearance: form.appearance.trim() || undefined,
      values: form.values.trim() || undefined,
      habits: form.habits.trim() || undefined,
      weaknesses: form.weaknesses.trim() || undefined,
      secrets: form.secrets.trim() || undefined,
      boundaries: form.boundaries.trim() || undefined,
      scenario: form.scenario.trim() || undefined,
      firstMessage: form.firstMessage.trim() || undefined,
      alternateGreetings,
      exampleDialogues: parseExampleDialogues(form.exampleDialoguesText),
      creatorNotes: form.creatorNotes.trim() || undefined,
      systemPrompt: form.systemPrompt.trim() || undefined,
      postHistoryInstructions: form.postHistoryInstructions.trim() || undefined,
      initiative: form.initiative,
      narrationStyle: form.narrationStyle,
      emojiFrequency: form.emojiFrequency,
      questionFrequency: form.questionFrequency,
      tags: parseList(form.tagsText),
      creator: form.creator.trim() || undefined,
      resourceVersion: form.resourceVersion.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      license: form.license.trim() || undefined,
      allowDerivative: form.allowDerivative,
      importFormat: character.value.importFormat || 'native',
      cardVersion: 2
    })

    character.value = await db.characters.get(character.value.id)
    message.value = '沉浸角色卡已经保存。'
  } catch (error) {
    message.value = error instanceof Error ? error.message : '保存失败。'
  } finally {
    isSaving.value = false
  }
}

async function importCard(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !character.value) return
  try {
    const imported = await parseCharacterCardFile(file)
    const lorebookHint = imported.lorebookEntries.length
      ? `，并导入 ${imported.lorebookEntries.length} 条内嵌角色世界书`
      : ''
    if (!window.confirm(`识别为 ${imported.format}。导入会覆盖当前角色卡中同名字段${lorebookHint}，但保留聊天记录。继续吗？`)) return
    await updateCharacterAndConversation(character.value.id, imported.patch)

    if (imported.lorebookEntries.length) {
      const existing = await db.lorebookEntries.where('characterId').equals(character.value.id).toArray()
      const signatures = new Set(existing.map(item => `${item.title}\n${item.content}`))
      const now = new Date().toISOString()
      const additions = imported.lorebookEntries
        .filter(item => !signatures.has(`${item.title}\n${item.content}`))
        .map((item, index) => ({
          id: crypto.randomUUID(),
          worldId: character.value!.worldId,
          characterId: character.value!.id,
          title: item.title,
          keywords: item.keywords,
          content: item.content,
          enabled: item.enabled,
          constant: item.constant,
          caseSensitive: item.caseSensitive,
          priority: item.priority || (100 - index),
          createdAt: now,
          updatedAt: now
        }))
      if (additions.length) await db.lorebookEntries.bulkAdd(additions)
    }

    await load()
    message.value = [`已导入 ${file.name}。`, ...imported.notes].join(' ')
  } catch (error) {
    message.value = error instanceof Error ? error.message : '角色卡导入失败。'
  }
}

async function createOrUpdateEmbeddedPersona() {
  if (!character.value || !embeddedUserPreview.value) return
  embeddedPersonaMessage.value = ''
  try {
    const preview = embeddedUserPreview.value
    const existing = character.value.embeddedUserPersonaId
      ? await db.personas.get(character.value.embeddedUserPersonaId)
      : undefined
    const persona = await savePersona({
      ...preview.patch,
      id: existing?.id,
      name: existing?.name || preview.patch.name || `${character.value.name} · 原卡用户`,
      avatar: existing?.avatar || preview.patch.avatar || '🧑',
      personaScope: 'character',
      boundCharacterId: character.value.id,
      boundCharacterName: character.value.name,
      sourceUserTemplate: preview.rawTemplate,
      isCardTemplate: true,
      isDefault: false
    })

    await db.characters.update(character.value.id, {
      embeddedUserTemplate: preview.rawTemplate,
      embeddedUserPersonaId: persona.id,
      updatedAt: new Date().toISOString()
    })

    const conversations = await db.conversations
      .filter(item => item.type === 'single' && item.memberIds.includes(character.value!.id))
      .toArray()
    for (const conversation of conversations) {
      const settings = await getChatSettings(conversation.id)
      await saveChatSettings({ ...settings, personaId: persona.id })
    }

    await load()
    embeddedPersonaMessage.value = `已创建并绑定“${persona.name}”。`
  } catch (error) {
    embeddedPersonaMessage.value = error instanceof Error ? error.message : '创建角色专属 Persona 失败。'
  }
}

onMounted(load)

function exportCard() {
  if (!character.value) return
  const blob = new Blob([exportCharacterAsSillyTavernV2(character.value)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${character.value.name || 'character'}_SillyTavern_V2.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

</script>

<template>
  <PhoneFrame :title="character ? `${character.name} · 角色卡` : '沉浸角色卡'" show-back>
    <main class="card-page">
      <p v-if="isLoading" class="state">正在读取角色卡……</p>
      <template v-else-if="character">
        <section class="score-card">
          <div><b>角色卡 V2</b><span>完整度 {{ completeness }}%</span></div>
          <p>基础性格仍在“编辑角色”中管理；这里负责场景、示例对话、行为习惯和沉浸表达。</p>
          <div class="score-track"><i :style="{ width: `${completeness}%` }"></i></div>
        </section>

        <section class="import-card">
          <div><b>酒馆角色卡兼容</b><small>支持 SillyTavern V2 / V3 JSON 与旧版 JSON</small></div>
          <input ref="cardFileInput" type="file" accept="application/json,.json" @change="importCard" />
          <div class="import-actions"><button type="button" @click="cardFileInput?.click()">导入角色卡 JSON</button><button type="button" @click="exportCard">导出为 V2 JSON</button></div>
          <p>PNG 角色卡中嵌入数据的读取暂未开放；请先在酒馆中导出 JSON。</p>
        </section>

        <section v-if="embeddedUserPreview" class="embedded-user-section">
          <div class="embedded-head">
            <div>
              <b>角色卡自带 <span v-pre>{{user}}</span></b>
              <small>这是角色作者预设的“你”。可以查看原文，也可以生成角色专属 Persona。</small>
            </div>
            <span>USER</span>
          </div>
          <details>
            <summary>查看完整用户模板</summary>
            <pre>{{ embeddedUserPreview.rawTemplate }}</pre>
          </details>
          <div class="embedded-actions">
            <button type="button" @click="createOrUpdateEmbeddedPersona">
              {{ character.embeddedUserPersonaId ? '更新并重新绑定 Persona' : '创建并绑定角色专属 Persona' }}
            </button>
            <button type="button" @click="router.push('/settings/personas')">打开 Persona 管理</button>
          </div>
          <p v-if="embeddedPersonaMessage">{{ embeddedPersonaMessage }}</p>
        </section>

        <form class="card-form" @submit.prevent="save">
          <section class="form-section">
            <h2>人格细节</h2>
            <label>外貌与给人的感觉<textarea v-model="form.appearance" rows="4" placeholder="外貌、穿着、气质，以及角色如何看待自己的外表" /></label>
            <label>价值观与底线<textarea v-model="form.values" rows="4" placeholder="最在意什么，会为什么坚持或妥协" /></label>
            <label>习惯与小动作<textarea v-model="form.habits" rows="4" placeholder="口头习惯、沉默方式、紧张或亲密时的小动作" /></label>
            <label>弱点与不擅长<textarea v-model="form.weaknesses" rows="3" placeholder="不擅长表达、害怕失去、容易嘴硬……" /></label>
            <label>不会轻易说出的秘密<textarea v-model="form.secrets" rows="3" placeholder="角色知道但不应随便主动暴露的信息" /></label>
            <label>角色边界<textarea v-model="form.boundaries" rows="3" placeholder="角色不会做什么、不会接受什么" /></label>
            <label>标签<input v-model="form.tagsText" placeholder="慢热、年上、校园、治愈" /></label>
          </section>

          <section class="form-section">
            <h2>场景与开场</h2>
            <label>当前场景<textarea v-model="form.scenario" rows="5" placeholder="时间、地点、双方处境、故事起点。日常聊天也可以写当前生活状态。" /></label>
            <label>默认开场白<textarea v-model="form.firstMessage" rows="5" placeholder="角色第一次出现时真正会说的话" /></label>
            <label>备用开场白<textarea v-model="form.alternateGreetingsText" rows="8" placeholder="每段开场之间用 --- 分隔" /></label>
          </section>

          <section class="form-section example-section">
            <h2>示例对话</h2>
            <p>这是最能决定“活人感”的部分。写角色真正会怎样接话，而不是只写“温柔、傲娇”。每组用 <code>---</code> 分隔。</p>
            <textarea v-model="form.exampleDialoguesText" rows="14" placeholder="用户：你怎么还没睡？&#10;角色：刚写完一页。你呢，又在逞强？&#10;&#10;---&#10;&#10;用户：我今天有点想你。&#10;角色：……那你现在见到我了。别再皱眉。" />
          </section>

          <section class="form-section">
            <h2>表达方式</h2>
            <div class="two-fields">
              <label>主动程度<select v-model="form.initiative"><option value="low">偏被动</option><option value="natural">自然</option><option value="high">主动推动</option></select></label>
              <label>动作描写<select v-model="form.narrationStyle"><option value="none">关闭</option><option value="light">少量</option><option value="immersive">沉浸</option></select></label>
              <label>表情频率<select v-model="form.emojiFrequency"><option value="none">不用</option><option value="low">很少</option><option value="natural">自然</option><option value="high">较多</option></select></label>
              <label>提问频率<select v-model="form.questionFrequency"><option value="low">很少</option><option value="natural">自然</option><option value="high">主动追问</option></select></label>
            </div>
          </section>

          <section class="form-section">
            <h2>资源与社区信息</h2>
            <div class="two-fields"><label>作者<input v-model="form.creator" placeholder="角色卡作者或社群昵称" /></label><label>资源版本<input v-model="form.resourceVersion" placeholder="例如 1.2.0" /></label></div>
            <label>来源链接<input v-model="form.sourceUrl" placeholder="原发布页、DC 帖子或仓库地址" /></label>
            <label>许可说明<input v-model="form.license" placeholder="例如 CC BY-SA 4.0、禁止转载、仅自用" /></label>
            <label class="check-row"><input v-model="form.allowDerivative" type="checkbox" />允许二次修改或衍生创作</label>
          </section>

          <details class="form-section advanced">
            <summary>高级角色卡规则</summary>
            <label>角色专属补充规则<textarea v-model="form.systemPrompt" rows="5" placeholder="只写这个角色特有的规则，不要重复基础人设" /></label>
            <label>回复前最终提醒<textarea v-model="form.postHistoryInstructions" rows="4" placeholder="例如：这一轮更克制，不要直接承认吃醋" /></label>
            <label>创作者备注<textarea v-model="form.creatorNotes" rows="4" placeholder="给自己看的制作说明，也会以低优先级辅助角色理解" /></label>
          </details>

          <div class="linked-actions">
            <button type="button" @click="router.push(`/characters/${character.id}/edit`)">编辑基础资料</button>
            <button type="button" @click="router.push(`/settings/lorebook?character=${character.id}`)">编辑角色世界书</button>
          </div>

          <p v-if="message" class="message">{{ message }}</p>
          <button class="save-button" type="submit" :disabled="isSaving">{{ isSaving ? '正在保存…' : '保存角色卡 V2' }}</button>
        </form>
      </template>
      <p v-else class="state error">{{ message || '角色不存在。' }}</p>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.card-page{min-height:100%;padding:14px 14px 34px;background:#f7f0f3;color:#5d4350}.score-card,.form-section,.import-card{border:1px solid rgba(106,67,84,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.score-card{padding:16px}.import-card{margin-top:12px;padding:14px;display:grid;gap:9px}.import-card>div:first-child{display:flex;flex-direction:column;gap:3px}.import-card small,.import-card p{color:#927381;font-size:11px;line-height:1.55}.import-card input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}.import-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.import-actions button{border:0;border-radius:12px;background:#f4e8ed;color:#9e5b77;padding:10px;font-weight:800}.check-row{display:flex!important;align-items:center}.check-row input{position:static!important;width:18px!important;height:18px;opacity:1!important;accent-color:#d96f9b}.score-card>div{display:flex;justify-content:space-between;align-items:center}.score-card span{color:#c35f88;font-weight:700}.score-card p,.example-section p{color:#927381;line-height:1.6;font-size:12px}.score-track{height:7px!important;overflow:hidden;border-radius:999px;background:#f1e3e9}.score-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e889b0,#cb5f8d)}.card-form{display:grid;gap:12px;margin-top:12px}.form-section{display:grid;gap:12px;padding:16px}.form-section h2{margin:0;font-size:17px}.form-section label{display:grid;gap:6px;font-size:13px;font-weight:700}.form-section input,.form-section textarea,.form-section select{box-sizing:border-box;width:100%;border:1px solid #eadce2;border-radius:12px;background:#fffbfc;padding:10px 12px;color:#593f4b;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.advanced summary{cursor:pointer;font-weight:800}.advanced[open] summary{margin-bottom:6px}.linked-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.linked-actions button{border:0;border-radius:13px;background:#fff;color:#a45f7b;padding:11px;font-weight:700}.message{margin:0;padding:10px 12px;border-radius:12px;background:#fff5f8;color:#b65178}.save-button{border:0;border-radius:15px;background:#d96f9b;color:#fff;padding:13px;font-weight:800}.save-button:disabled{opacity:.6}.state{text-align:center;color:#927381}.error{color:#b74c63}code{border-radius:5px;background:#f4e8ed;padding:1px 4px}@media(max-width:390px){.two-fields,.linked-actions{grid-template-columns:1fr}}

.embedded-user-section { display:grid; gap:10px; padding:14px; border-radius:16px; background:rgba(255,248,251,.9); border:1px solid rgba(217,111,155,.18); }
.embedded-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
.embedded-head > div { display:grid; gap:4px; }
.embedded-head small { color:#9b7183; line-height:1.45; }
.embedded-head > span { padding:4px 8px; border-radius:999px; background:rgba(217,111,155,.12); color:#b8567f; font-size:11px; font-weight:800; }
.embedded-user-section summary { cursor:pointer; color:#b8567f; font-weight:800; }
.embedded-user-section pre { white-space:pre-wrap; word-break:break-word; max-height:260px; overflow:auto; padding:10px; border-radius:12px; background:rgba(255,255,255,.72); font:inherit; font-size:12px; line-height:1.55; }
.embedded-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
@media (max-width:390px){ .embedded-actions{grid-template-columns:1fr;} }
</style>
