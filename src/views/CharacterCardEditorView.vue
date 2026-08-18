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
import { replaceCharacterCardResources } from '../services/characterCardResourceService'
import { getChatSettings, saveChatSettings } from '../services/chatSettings'
import { listResourceBindings } from '../services/resourceBindingService'
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
  initiative: '' as InitiativeLevel | '',
  narrationStyle: '' as NarrationStyle | '',
  emojiFrequency: '' as EmojiFrequency | '',
  questionFrequency: '' as QuestionFrequency | '',
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
const resourceStats = ref({ lorebookEntries: 0, regexScripts: 0, presets: 0 })

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

const isCommunityCard = computed(() => Boolean(
  character.value && (
    (character.value.importFormat && character.value.importFormat !== 'native') ||
    character.value.sourceSpec ||
    character.value.sourceSpecVersion ||
    character.value.rawCardExtensions
  )
))

const isResourceDrivenCard = computed(() => Boolean(
  isCommunityCard.value && (
    resourceStats.value.lorebookEntries > 0 ||
    resourceStats.value.regexScripts > 0 ||
    resourceStats.value.presets > 0 ||
    character.value?.depthPrompt?.prompt?.trim() ||
    character.value?.embeddedUserTemplate?.trim()
  )
))

const scorePercent = computed(() => isCommunityCard.value ? 100 : completeness.value)
const scoreLabel = computed(() => isCommunityCard.value ? '原卡已载入' : `完整度 ${completeness.value}%`)
const cardFormatLabel = computed(() => {
  const row = character.value
  if (!row) return '角色卡'
  if (row.sourceSpec) return `${row.sourceSpec}${row.sourceSpecVersion ? ` · ${row.sourceSpecVersion}` : ''}`
  if (row.cardVersion) return `角色卡 V${row.cardVersion}`
  return row.importFormat && row.importFormat !== 'native' ? `社区角色卡 · ${row.importFormat}` : '角色卡'
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
    const [allEntries, bindings] = await Promise.all([
      db.lorebookEntries.toArray(),
      listResourceBindings(row.id)
    ])
    const activeLorebookIds = new Set(bindings
      .filter(item => item.enabled && item.resourceType === 'lorebook')
      .map(item => item.resourceId))
    resourceStats.value = {
      lorebookEntries: allEntries.filter(item => Boolean(item.lorebookId && activeLorebookIds.has(item.lorebookId))).length,
      regexScripts: bindings.filter(item => item.enabled && item.resourceType === 'regex').length,
      presets: bindings.filter(item => item.enabled && item.resourceType === 'preset').length
    }
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
    form.initiative = row.initiative || ''
    form.narrationStyle = row.narrationStyle || ''
    form.emojiFrequency = row.emojiFrequency || ''
    form.questionFrequency = row.questionFrequency || ''
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
      initiative: form.initiative || undefined,
      narrationStyle: form.narrationStyle || undefined,
      emojiFrequency: form.emojiFrequency || undefined,
      questionFrequency: form.questionFrequency || undefined,
      tags: parseList(form.tagsText),
      creator: form.creator.trim() || undefined,
      resourceVersion: form.resourceVersion.trim() || undefined,
      sourceUrl: form.sourceUrl.trim() || undefined,
      license: form.license.trim() || undefined,
      allowDerivative: form.allowDerivative,
      importFormat: character.value.importFormat || 'native',
      cardVersion: character.value.cardVersion
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
    const resourceHint = [
      imported.lorebookEntries.length ? `世界书 ${imported.lorebookEntries.length} 条` : '',
      imported.regexScripts.length ? `Regex ${imported.regexScripts.length} 个` : ''
    ].filter(Boolean).join('、')
    const hint = resourceHint ? `；新卡资源会进入共享资源库并绑定当前角色（${resourceHint}），旧卡资源会保留在资源库但解除当前角色绑定` : ''
    if (!window.confirm(`识别为 ${imported.format}。导入会覆盖当前角色卡中同名字段${hint}，但保留聊天记录和用户手工创建的共享资源。继续吗？`)) return

    const current = character.value
    await updateCharacterAndConversation(current.id, imported.patch)
    await replaceCharacterCardResources({
      characterId: current.id,
      worldId: current.worldId,
      characterName: imported.patch.name?.trim() || current.name,
      fileName: file.name,
      imported
    })

    // 角色卡内嵌 {{user}} 也跟随“换卡”同步，避免旧卡 Persona 继续污染新卡。
    const previousEmbeddedPersona = current.embeddedUserPersonaId
      ? await db.personas.get(current.embeddedUserPersonaId)
      : undefined
    const singleConversations = await db.conversations
      .filter(item => item.type === 'single' && item.memberIds.includes(current.id))
      .toArray()
    if (imported.embeddedUser) {
      const preview = imported.embeddedUser
      const syncedPersona = await savePersona({
        ...preview.patch,
        id: previousEmbeddedPersona?.isCardTemplate ? previousEmbeddedPersona.id : undefined,
        name: preview.patch.name || previousEmbeddedPersona?.name || `${imported.patch.name?.trim() || current.name} · 原卡用户`,
        avatar: preview.patch.avatar || previousEmbeddedPersona?.avatar || '🧑',
        personaScope: 'character',
        boundCharacterId: current.id,
        boundCharacterName: imported.patch.name?.trim() || current.name,
        sourceUserTemplate: preview.rawTemplate,
        isCardTemplate: true,
        isDefault: false
      })
      await db.characters.update(current.id, {
        embeddedUserTemplate: preview.rawTemplate,
        embeddedUserPersonaId: syncedPersona.id,
        updatedAt: new Date().toISOString()
      })
      for (const conversation of singleConversations) {
        const settings = await getChatSettings(conversation.id)
        if (!settings.personaId || settings.personaId === previousEmbeddedPersona?.id) {
          await saveChatSettings({ ...settings, personaId: syncedPersona.id })
        }
      }
    } else if (previousEmbeddedPersona?.isCardTemplate) {
      await db.characters.update(current.id, {
        embeddedUserTemplate: undefined,
        embeddedUserPersonaId: undefined,
        updatedAt: new Date().toISOString()
      })
      for (const conversation of singleConversations) {
        const settings = await getChatSettings(conversation.id)
        if (settings.personaId === previousEmbeddedPersona.id) {
          await saveChatSettings({ ...settings, personaId: undefined })
        }
      }
      await db.personas.delete(previousEmbeddedPersona.id)
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

async function exportCard() {
  if (!character.value) return
  const row = character.value
  // 导出时只带回“这张原角色卡自身携带”的资源。
  // 用户后来从共享资源库绑定过来的其它世界书 / Regex 不属于原卡，不能被误打包进去。
  const lorebooks = (await db.lorebooks.toArray())
    .filter(item => item.sourceFormat === 'character-card' && (item.sourceCharacterId === row.id || item.characterId === row.id))
  const lorebook = lorebooks[0]
  const lorebookEntries = lorebook
    ? await db.lorebookEntries.where('lorebookId').equals(lorebook.id).toArray()
    : []
  const regexScripts = (await db.regexScripts.toArray())
    .filter(item => item.sourceFormat === 'character-card' && (item.sourceCharacterId === row.id || item.characterId === row.id))
  const blob = new Blob([
    exportCharacterAsSillyTavernV2(row, { lorebook, lorebookEntries, regexScripts })
  ], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${row.name || 'character'}_SillyTavern_V2.json`
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
          <div><b>{{ cardFormatLabel }}</b><span>{{ scoreLabel }}</span></div>
          <p v-if="isResourceDrivenCard">这是一张资源型 / 多角色社区卡：基础角色字段可以为空，原卡设定主要由世界书、Regex、Depth Prompt 等资源驱动，聊天时仍会正常加载。</p>
          <p v-else>基础性格仍在“编辑角色”中管理；这里负责场景、示例对话、行为习惯和沉浸表达。</p>
          <div v-if="isResourceDrivenCard" class="resource-score-tags">
            <span>世界书 {{ resourceStats.lorebookEntries }}</span>
            <span v-if="resourceStats.regexScripts">Regex {{ resourceStats.regexScripts }}</span>
            <span v-if="resourceStats.presets">Preset {{ resourceStats.presets }}</span>
            <span v-if="character.depthPrompt?.prompt">Depth Prompt</span>
          </div>
          <div class="score-track"><i :style="{ width: `${scorePercent}%` }"></i></div>
        </section>

        <section class="import-card">
          <div><b>社区角色卡兼容</b><small>支持 V2 / V3 / 常见社区 JSON 与带 metadata 的 PNG；未知扩展会保留原始数据</small></div>
          <input ref="cardFileInput" type="file" accept="application/json,image/png,.json,.png" @change="importCard" />
          <div class="import-actions"><button type="button" @click="cardFileInput?.click()">导入角色卡文件</button><button type="button" @click="exportCard">导出为 V2 JSON</button></div>
          <p>PNG 会读取角色卡 metadata，并把卡面作为头像保存；不执行其中的第三方脚本，原始社区扩展会继续归档保留。</p>
        </section>

        <section v-if="isCommunityCard" class="import-card token-note">
          <b>原卡阅读与本地索引：0 Token</b>
          <p>查看/拆分只是把 JSON 变成可读页面，不会调用 AI。聊天时默认只注入作者原始字段，不会把本地拆分结果再重复发送。</p>
          <button type="button" @click="router.push(`/characters/${character.id}`)">打开原卡阅读器</button>
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
          <details class="form-section advanced" :open="!isCommunityCard || Boolean(form.appearance || form.values || form.habits || form.weaknesses || form.secrets || form.boundaries)">
            <summary>{{ isCommunityCard ? '本地人格补充（可选）' : '人格细节' }}</summary>
            <p v-if="isCommunityCard" class="enhancement-note">这些不是社区角色卡必须字段，也不会因为为空而影响原卡。默认“原卡优先”时不会把这些派生补充与原文重复注入 Prompt。</p>
            <label>外貌与给人的感觉<textarea v-model="form.appearance" rows="4" placeholder="只在你确实想本地补充时填写" /></label>
            <label>价值观与底线<textarea v-model="form.values" rows="4" placeholder="只在你确实想本地补充时填写" /></label>
            <label>习惯与小动作<textarea v-model="form.habits" rows="4" placeholder="只在你确实想本地补充时填写" /></label>
            <label>弱点与不擅长<textarea v-model="form.weaknesses" rows="3" placeholder="只在你确实想本地补充时填写" /></label>
            <label>不会轻易说出的秘密<textarea v-model="form.secrets" rows="3" placeholder="只在你确实想本地补充时填写" /></label>
            <label>角色边界<textarea v-model="form.boundaries" rows="3" placeholder="只在你确实想本地补充时填写" /></label>
            <label>标签<input v-model="form.tagsText" placeholder="原卡已有标签或你自己的本地标签" /></label>
          </details>

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

          <details class="form-section advanced">
            <summary>小手机表达增强（可选）</summary>
            <p class="enhancement-note">这些字段不属于原角色卡。社区卡默认“原卡优先”时不会覆盖作者设定；只有你在聊天设置中明确启用“小手机增强”后才参与运行。</p>
            <div class="two-fields">
              <label>主动程度<select v-model="form.initiative"><option value="">跟随原卡 / 不覆盖</option><option value="low">偏被动</option><option value="natural">自然</option><option value="high">主动推动</option></select></label>
              <label>动作描写<select v-model="form.narrationStyle"><option value="">跟随原卡 / 不覆盖</option><option value="none">关闭</option><option value="light">少量</option><option value="immersive">沉浸</option></select></label>
              <label>表情频率<select v-model="form.emojiFrequency"><option value="">跟随原卡 / 不覆盖</option><option value="none">不用</option><option value="low">很少</option><option value="natural">自然</option><option value="high">较多</option></select></label>
              <label>提问频率<select v-model="form.questionFrequency"><option value="">跟随原卡 / 不覆盖</option><option value="low">很少</option><option value="natural">自然</option><option value="high">主动追问</option></select></label>
            </div>
          </details>

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
            <button type="button" @click="router.push({ path: '/world', query: { character: character.id, tab: 'lorebooks' } })">管理共享世界书</button>
          </div>

          <p v-if="message" class="message">{{ message }}</p>
          <button class="save-button" type="submit" :disabled="isSaving">{{ isSaving ? '正在保存…' : '保存角色卡' }}</button>
        </form>
      </template>
      <p v-else class="state error">{{ message || '角色不存在。' }}</p>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.card-page{min-height:100%;padding:14px 14px 34px;background:#f2f8fc;color:#40566a}.score-card,.form-section,.import-card{border:1px solid rgba(106,67,84,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.score-card{padding:16px}.import-card{margin-top:12px;padding:14px;display:grid;gap:9px}.import-card>div:first-child{display:flex;flex-direction:column;gap:3px}.import-card small,.import-card p{color:#927381;font-size:11px;line-height:1.55}.import-card input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}.import-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.import-actions button{border:0;border-radius:12px;background:#eaf3fa;color:#668eae;padding:10px;font-weight:800}.check-row{display:flex!important;align-items:center}.check-row input{position:static!important;width:18px!important;height:18px;opacity:1!important;accent-color:#79add8}.score-card>div{display:flex;justify-content:space-between;align-items:center}.score-card span{color:#6d9fc8;font-weight:700}.score-card p,.example-section p,.enhancement-note{color:#927381;line-height:1.6;font-size:12px}.score-track{height:7px!important;overflow:hidden;border-radius:999px;background:#e3eef6}.score-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#9fc9ec,#6e9fc8)}.card-form{display:grid;gap:12px;margin-top:12px}.form-section{display:grid;gap:12px;padding:16px}.form-section h2{margin:0;font-size:17px}.form-section label{display:grid;gap:6px;font-size:13px;font-weight:700}.form-section input,.form-section textarea,.form-section select{box-sizing:border-box;width:100%;border:1px solid #d7e5f0;border-radius:12px;background:#fbfdff;padding:10px 12px;color:#40566a;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.advanced summary{cursor:pointer;font-weight:800}.advanced[open] summary{margin-bottom:6px}.linked-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.linked-actions button{border:0;border-radius:13px;background:#fff;color:#a45f7b;padding:11px;font-weight:700}.message{margin:0;padding:10px 12px;border-radius:12px;background:#f5faff;color:#b65178}.save-button{border:0;border-radius:15px;background:#79add8;color:#fff;padding:13px;font-weight:800}.save-button:disabled{opacity:.6}.state{text-align:center;color:#927381}.error{color:#b74c63}code{border-radius:5px;background:#eaf3fa;padding:1px 4px}@media(max-width:390px){.two-fields,.linked-actions{grid-template-columns:1fr}}

.embedded-user-section { display:grid; gap:10px; padding:14px; border-radius:16px; background:rgba(255,248,251,.9); border:1px solid rgba(121,173,216,.18); }
.embedded-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
.embedded-head > div { display:grid; gap:4px; }
.embedded-head small { color:#73889c; line-height:1.45; }
.embedded-head > span { padding:4px 8px; border-radius:999px; background:rgba(121,173,216,.12); color:#628fb4; font-size:11px; font-weight:800; }
.embedded-user-section summary { cursor:pointer; color:#628fb4; font-weight:800; }
.embedded-user-section pre { white-space:pre-wrap; word-break:break-word; max-height:260px; overflow:auto; padding:10px; border-radius:12px; background:rgba(255,255,255,.72); font:inherit; font-size:12px; line-height:1.55; }
.embedded-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
@media (max-width:390px){ .embedded-actions{grid-template-columns:1fr;} }

.resource-score-tags{display:flex!important;justify-content:flex-start!important;gap:7px;flex-wrap:wrap;margin:2px 0 4px}.resource-score-tags span{padding:4px 8px;border-radius:999px;background:#eef7fd;color:#a85d7a;font-size:11px;font-weight:800}


.token-note button{border:0;border-radius:12px;background:#eaf3fa;color:#668eae;padding:10px;font-weight:800}.token-note b{color:#6d4d5a}

</style>
