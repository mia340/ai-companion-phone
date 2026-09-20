<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from 'vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import {
  deletePersona,
  listPersonas,
  savePersona,
  setDefaultPersona
} from '../services/personaService'
import {
  exportPersonaJson,
  parsePersonaFile,
  type ImportedPersonaPreview
} from '../services/personaImportService'
import type { PersonaImportFormat, UserPersona } from '../types/domain'

const personas = ref<UserPersona[]>([])
const editingId = ref('')
const editingPersonaScope = ref<'global' | 'character'>('global')
const message = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const importPreview = shallowRef<ImportedPersonaPreview | null>(null)
const importFileName = ref('')
const preservedExtra = ref<Record<string, unknown> | undefined>()
const preservedImportFormat = ref<PersonaImportFormat | undefined>()
const preservedSourceFileName = ref('')

const form = reactive({
  name: '',
  avatar: '🧑',
  title: '',
  description: '',
  identity: '',
  age: '',
  gender: '',
  birthday: '',
  height: '',
  occupation: '',
  appearance: '',
  personality: '',
  publicPersona: '',
  privatePersona: '',
  strengths: '',
  weaknesses: '',
  interests: '',
  habits: '',
  lifestyle: '',
  background: '',
  relationshipNote: '',
  characterKnowledge: '',
  boundaries: '不要替我说话，不要擅自决定我的行为、想法或感受。',
  tags: '',
  creator: '',
  sourceUrl: '',
  isDefault: false
})

function resetForm() {
  editingId.value = ''
  editingPersonaScope.value = 'global'
  Object.assign(form, {
    name: '', avatar: '🧑', title: '', description: '', identity: '', age: '', gender: '', birthday: '', height: '', occupation: '',
    appearance: '', personality: '', publicPersona: '', privatePersona: '', strengths: '', weaknesses: '', interests: '', habits: '', lifestyle: '',
    background: '', relationshipNote: '', characterKnowledge: '', boundaries: '不要替我说话，不要擅自决定我的行为、想法或感受。',
    tags: '', creator: '', sourceUrl: '', isDefault: false
  })
  preservedExtra.value = undefined
  preservedImportFormat.value = undefined
  preservedSourceFileName.value = ''
}

function edit(persona: UserPersona) {
  editingId.value = persona.id
  editingPersonaScope.value = persona.personaScope || 'global'
  Object.assign(form, {
    name: persona.name,
    avatar: persona.avatar,
    title: persona.title || '',
    description: persona.description || '',
    identity: persona.identity || '',
    age: persona.age || '',
    gender: persona.gender || '',
    birthday: persona.birthday || '',
    height: persona.height || '',
    occupation: persona.occupation || '',
    appearance: persona.appearance || '',
    personality: persona.personality || '',
    publicPersona: persona.publicPersona || '',
    privatePersona: persona.privatePersona || '',
    strengths: persona.strengths || '',
    weaknesses: persona.weaknesses || '',
    interests: persona.interests || '',
    habits: persona.habits || '',
    lifestyle: persona.lifestyle || '',
    background: persona.background || '',
    relationshipNote: persona.relationshipNote || '',
    characterKnowledge: persona.characterKnowledge || '',
    boundaries: persona.boundaries || '',
    tags: (persona.tags || []).join('、'),
    creator: persona.creator || '',
    sourceUrl: persona.sourceUrl || '',
    isDefault: persona.isDefault
  })
  preservedExtra.value = persona.extraFields
  preservedImportFormat.value = persona.importFormat
  preservedSourceFileName.value = persona.sourceFileName || ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refresh() {
  personas.value = await listPersonas()
}

function splitTags(raw: string) {
  return Array.from(new Set(raw.split(/[,，、\n]/).map(item => item.trim()).filter(Boolean)))
}

async function handleAvatarFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.value = '请选择图片文件作为头像。'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    message.value = '头像图片不能超过 8 MB。'
    return
  }
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(reader.error || new Error('头像读取失败'))
      reader.readAsDataURL(file)
    })
    form.avatar = dataUrl
    message.value = '头像图片已选择，保存 Persona 后生效。'
  } catch (error) {
    console.error(error)
    message.value = '头像读取失败，请换一张图片。'
  }
}

async function submit() {
  if (!form.name.trim()) {
    message.value = '请先填写人设名称。'
    return
  }
  await savePersona({
    id: editingId.value || undefined,
    ...form,
    tags: splitTags(form.tags),
    extraFields: preservedExtra.value,
    importFormat: preservedImportFormat.value,
    sourceFileName: preservedSourceFileName.value || undefined
  })
  message.value = editingId.value ? '用户人设已更新。' : '用户人设已创建。'
  resetForm()
  await refresh()
}

async function makeDefault(id: string) {
  await setDefaultPersona(id)
  message.value = '已设为默认用户人设。'
  await refresh()
}

async function remove(persona: UserPersona) {
  if (!window.confirm(`确定删除“${persona.name}”吗？`)) return
  try {
    await deletePersona(persona.id)
    if (editingId.value === persona.id) resetForm()
    message.value = '用户人设已删除。'
    await refresh()
  } catch (error) {
    message.value = error instanceof Error ? error.message : '删除失败。'
  }
}

function sameNameExists(name: string) {
  const normalized = name.trim().toLowerCase()
  return personas.value.some(item => item.name.trim().toLowerCase() === normalized)
}

function openImport() {
  importInput.value?.click()
}

async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    importPreview.value = await parsePersonaFile(file)
    importFileName.value = file.name
    message.value = ''
  } catch (error) {
    importPreview.value = null
    message.value = error instanceof Error ? error.message : '用户人设导入失败。'
  }
}

function patchIntoForm(preview: ImportedPersonaPreview) {
  const patch = preview.patch
  Object.assign(form, {
    name: patch.name || '',
    avatar: patch.avatar || '🧑',
    title: patch.title || '',
    description: patch.description || '',
    identity: patch.identity || '',
    age: patch.age || '',
    gender: patch.gender || '',
    birthday: patch.birthday || '',
    height: patch.height || '',
    occupation: patch.occupation || '',
    appearance: patch.appearance || '',
    personality: patch.personality || '',
    publicPersona: patch.publicPersona || '',
    privatePersona: patch.privatePersona || '',
    strengths: patch.strengths || '',
    weaknesses: patch.weaknesses || '',
    interests: patch.interests || '',
    habits: patch.habits || '',
    lifestyle: patch.lifestyle || '',
    background: patch.background || '',
    relationshipNote: patch.relationshipNote || '',
    characterKnowledge: patch.characterKnowledge || '',
    boundaries: patch.boundaries || '不要替我说话，不要擅自决定我的行为、想法或感受。',
    tags: (patch.tags || []).join('、'),
    creator: patch.creator || '',
    sourceUrl: patch.sourceUrl || '',
    isDefault: false
  })
  preservedExtra.value = patch.extraFields
  preservedImportFormat.value = preview.format
  preservedSourceFileName.value = importFileName.value
}

function editImported() {
  if (!importPreview.value) return
  resetForm()
  patchIntoForm(importPreview.value)
  importPreview.value = null
  message.value = '已填入编辑器，请确认内容后保存。'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function importAsNew() {
  const preview = importPreview.value
  if (!preview) return
  const sameNames = personas.value.filter(item => item.name.trim().toLowerCase() === preview.patch.name.trim().toLowerCase())
  let name = preview.patch.name
  if (sameNames.length) name = `${name}（导入 ${sameNames.length + 1}）`
  await savePersona({
    ...preview.patch,
    name,
    isDefault: false,
    importFormat: preview.format,
    sourceFileName: importFileName.value
  })
  importPreview.value = null
  message.value = `已导入“${name}”。`
  await refresh()
}

async function overwriteSameName() {
  const preview = importPreview.value
  if (!preview) return
  const existing = personas.value.find(item => item.name.trim().toLowerCase() === preview.patch.name.trim().toLowerCase())
  if (!existing) return importAsNew()
  await savePersona({
    ...preview.patch,
    id: existing.id,
    isDefault: existing.isDefault,
    importFormat: preview.format,
    sourceFileName: importFileName.value
  })
  importPreview.value = null
  message.value = `已覆盖同名 Persona“${existing.name}”。`
  await refresh()
}

function downloadPersona(persona: UserPersona) {
  const blob = new Blob([exportPersonaJson(persona)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${persona.name.replace(/[\\/:*?"<>|]/g, '_')}_Persona.json`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(refresh)
</script>

<template>
  <PhoneFrame title="用户人设 Persona" show-back>
    <main class="persona-page">
      <section class="intro-card">
        <b>你在故事里是谁</b>
        <p>可以建立现实、校园、古风或游戏世界中的不同身份。每个聊天可单独选择一套 Persona。</p>
        <div class="import-actions">
          <button class="primary compact" type="button" @click="openImport">导入 Persona JSON / TXT</button>
          <input ref="importInput" class="hidden-file" type="file" accept=".json,.txt,.md,application/json,text/plain" @change="onImportFile" />
        </div>
        <small>兼容本项目 Persona、通用 JSON、Tavo/酒馆文本人设，也可把 Character Card V2/V3 明确转换为用户 Persona。世界书和预设会被拦截。</small>
      </section>

      <section v-if="importPreview" class="preview-card">
        <div class="preview-head">
          <div><small>导入预览 · {{ importFileName }}</small><h2>{{ importPreview.patch.name }}</h2></div>
          <button type="button" @click="importPreview = null">×</button>
        </div>
        <div class="detect-row"><b>{{ importPreview.recognition.label }}</b><span>{{ importPreview.format }}</span></div>
        <div class="preview-grid">
          <div><small>已识别字段</small><b>{{ importPreview.mappedFields.length }}</b></div>
          <div><small>保留扩展字段</small><b>{{ importPreview.preservedExtraKeys.length }}</b></div>
        </div>
        <p v-if="importPreview.patch.identity"><b>身份：</b>{{ importPreview.patch.identity }}</p>
        <p v-if="importPreview.patch.appearance"><b>外貌：</b>{{ importPreview.patch.appearance?.slice(0, 160) }}{{ (importPreview.patch.appearance?.length || 0) > 160 ? '…' : '' }}</p>
        <p v-if="importPreview.patch.personality"><b>性格：</b>{{ importPreview.patch.personality?.slice(0, 160) }}{{ (importPreview.patch.personality?.length || 0) > 160 ? '…' : '' }}</p>
        <p v-for="note in importPreview.notes" :key="note" class="note">{{ note }}</p>
        <div class="preview-actions">
          <button type="button" @click="editImported">编辑后导入</button>
          <button class="primary compact" type="button" @click="importAsNew">直接导入</button>
          <button v-if="sameNameExists(importPreview.patch.name)" type="button" @click="overwriteSameName">覆盖同名</button>
        </div>
      </section>

      <form class="editor-card" @submit.prevent="submit">
        <div class="section-title">
          <h2>{{ editingId ? '编辑用户人设' : '新建用户人设' }}</h2>
          <button v-if="editingId" type="button" @click="resetForm">取消编辑</button>
        </div>

        <div class="two-fields">
          <label>名称<input v-model="form.name" maxlength="40" placeholder="例如：现实中的我" /></label>
          <label class="persona-avatar-editor">头像
            <div class="persona-avatar-editor__row">
              <CharacterAvatar :avatar="form.avatar || '🧑'" :name="form.name || '我'" :size="46" />
              <input v-if="!form.avatar.startsWith('data:image/')" v-model="form.avatar" maxlength="8" placeholder="🧑" />
              <span v-else class="persona-avatar-editor__image-label">本地图片</span>
            </div>
            <label class="avatar-file-button">选择本地照片<input class="hidden-file" type="file" accept="image/*" @change="handleAvatarFile" /></label>
            <button v-if="form.avatar.startsWith('data:image/')" type="button" class="avatar-clear-button" @click="form.avatar='🧑'">移除照片</button>
          </label>
        </div>
        <label>人设标题<input v-model="form.title" maxlength="80" placeholder="可选，仅用于自己辨认这套 Persona" /></label>
        <div class="three-fields">
          <label>年龄<input v-model="form.age" maxlength="30" placeholder="例如：25岁" /></label>
          <label>性别<input v-model="form.gender" maxlength="30" placeholder="可选" /></label>
          <label>身高<input v-model="form.height" maxlength="30" placeholder="可选" /></label>
        </div>
        <label>身份<input v-model="form.identity" maxlength="120" placeholder="例如：大学生、调查员、旅行者" /></label>
        <label>职业<input v-model="form.occupation" maxlength="120" placeholder="当前工作或学习状态" /></label>
        <label>生日<input v-model="form.birthday" maxlength="60" placeholder="例如：4月15日" /></label>
        <label>外貌<textarea v-model="form.appearance" rows="4" placeholder="角色能够知道的外貌、体态、穿着等" /></label>
        <label>性格<textarea v-model="form.personality" rows="4" placeholder="你的核心性格与表达方式" /></label>
        <details class="advanced-fields">
          <summary>更多 Persona 细节</summary>
          <label>完整原始描述<textarea v-model="form.description" rows="5" placeholder="导入社区人设时会保留原始描述，避免字段映射造成信息丢失" /></label>
          <label>公开表现<textarea v-model="form.publicPersona" rows="3" /></label>
          <label>私下表现<textarea v-model="form.privatePersona" rows="3" /></label>
          <label>优点<textarea v-model="form.strengths" rows="3" /></label>
          <label>弱点<textarea v-model="form.weaknesses" rows="3" /></label>
          <label>兴趣<textarea v-model="form.interests" rows="3" /></label>
          <label>明确习惯<textarea v-model="form.habits" rows="3" placeholder="只有真正属于你的稳定习惯才写在这里" /></label>
          <label>生活状态<textarea v-model="form.lifestyle" rows="3" /></label>
          <label>标签<input v-model="form.tags" placeholder="用逗号、顿号或换行分隔" /></label>
          <label>作者 / 来源作者<input v-model="form.creator" maxlength="100" /></label>
          <label>来源链接<input v-model="form.sourceUrl" maxlength="500" /></label>
        </details>
        <label>背景<textarea v-model="form.background" rows="4" placeholder="在当前世界中的经历和处境" /></label>
        <label>与角色的关系补充<textarea v-model="form.relationshipNote" rows="3" placeholder="例如：我们从小认识，但还没有确认关系" /></label>
        <label>角色已经知道的事<textarea v-model="form.characterKnowledge" rows="3" placeholder="明确允许角色长期知道的信息" /></label>
        <label>边界<textarea v-model="form.boundaries" rows="3" /></label>
        <p class="truth-tip">未填写的用户习惯、偏好、经历和现实信息一律视为未知。角色不能为了显得熟悉而自行补全。</p>
        <label v-if="editingPersonaScope !== 'character'" class="default-switch"><input v-model="form.isDefault" type="checkbox" />设为默认人设</label>
        <p v-else class="truth-tip">这是角色专属 Persona，只会用于绑定的角色，不能设为全局默认。</p>
        <button class="primary" type="submit">{{ editingId ? '保存修改' : '创建人设' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="persona-list">
        <article v-for="persona in personas" :key="persona.id" class="persona-card">
          <div class="persona-avatar"><CharacterAvatar :avatar="persona.avatar" :name="persona.name" :size="48" /></div>
          <div class="persona-copy">
            <div>
              <b>{{ persona.name }}</b>
              <span v-if="persona.isDefault">默认</span>
              <span v-if="persona.personaScope === 'character'">角色专属</span>
            </div>
            <small>
              {{ persona.personaScope === 'character' && persona.boundCharacterName
                ? `仅用于 ${persona.boundCharacterName}`
                : (persona.identity || persona.occupation || '未填写身份') }}
            </small>
            <p>{{ persona.personality || persona.description || persona.background || '还没有详细描述。' }}</p>
            <small v-if="persona.importFormat">导入：{{ persona.importFormat }}<template v-if="persona.sourceFileName"> · {{ persona.sourceFileName }}</template></small>
          </div>
          <div class="card-actions">
            <button type="button" @click="edit(persona)">编辑</button>
            <button type="button" @click="downloadPersona(persona)">导出 JSON</button>
            <button v-if="!persona.isDefault && persona.personaScope !== 'character'" type="button" @click="makeDefault(persona.id)">设为默认</button>
            <button class="danger" type="button" @click="remove(persona)">删除</button>
          </div>
        </article>
      </section>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.persona-page{min-height:100%;padding:14px;background:#f2f8fc;color:#40566a}.intro-card,.editor-card,.persona-card,.preview-card{border:1px solid rgba(109,70,87,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.intro-card{padding:16px;margin-bottom:12px}.intro-card p{margin:6px 0;color:#748b9e;line-height:1.6;font-size:13px}.intro-card small{display:block;margin-top:9px;color:#7d91a3;line-height:1.5}.import-actions{margin-top:12px}.hidden-file{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none}.editor-card{display:grid;gap:12px;padding:16px}.section-title,.preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title h2,.preview-head h2{margin:0;font-size:18px}.section-title button,.card-actions button,.preview-head button,.preview-actions button{border:0;background:#eaf3fa;color:#6f9dc4;border-radius:10px;padding:7px 10px}.editor-card label,.advanced-fields label{display:grid;gap:6px;font-size:13px;font-weight:700}.editor-card input,.editor-card textarea{width:100%;box-sizing:border-box;border:1px solid #d7e5f0;border-radius:12px;background:#fbfdff;padding:10px 12px;color:#40566a;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 150px;gap:10px}.persona-avatar-editor__row{display:flex;align-items:center;gap:8px}.persona-avatar-editor__row input{min-width:0}.persona-avatar-editor__image-label{flex:1;color:#9b7a88;font-size:11px}.avatar-file-button{display:block!important;padding:8px 9px;border-radius:10px;background:#eaf4fb;color:#668eae;text-align:center;cursor:pointer}.avatar-clear-button{padding:6px 8px;border:0;border-radius:9px;background:#eef7fd;color:#b75570;font-size:11px}.three-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.default-switch{display:flex!important;grid-template-columns:auto 1fr;align-items:center}.default-switch input{width:auto}.primary{border:0;border-radius:14px;background:#79add8!important;color:#fff!important;padding:12px;font-weight:800}.compact{padding:9px 12px!important}.message{padding:10px 12px;border-radius:12px;background:#f5faff;color:#b65178}.truth-tip{margin:0;padding:10px 12px;border-radius:12px;background:#f5faff;color:#718fa8;font-size:12px;line-height:1.55}.advanced-fields{border:1px solid #e2eef7;border-radius:14px;padding:10px 12px}.advanced-fields summary{cursor:pointer;font-weight:800;color:#6f94b2}.advanced-fields[open]{display:grid;gap:10px}.advanced-fields[open] summary{margin-bottom:4px}.persona-list{display:grid;gap:10px;margin-top:14px;padding-bottom:30px}.persona-card{display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;padding:14px}.persona-avatar{display:grid;place-items:center;width:48px;height:48px}.persona-copy{min-width:0}.persona-copy>div{display:flex;align-items:center;gap:7px}.persona-copy span{border-radius:999px;background:#dcecf7;color:#5f8fb8;padding:2px 7px;font-size:10px}.persona-copy small{color:#748b9e}.persona-copy p{margin:7px 0;color:#506a80;line-height:1.5;font-size:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.card-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.card-actions .danger{color:#b64c63}.preview-card{padding:16px;margin-bottom:12px}.preview-head small{color:#a1818f}.preview-head button{border-radius:50%;width:34px;height:34px;font-size:20px}.detect-row{display:flex;align-items:center;justify-content:space-between;margin:12px 0;padding:10px 12px;border-radius:12px;background:#f5faff}.detect-row span{font-size:11px;color:#718fa8}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.preview-grid>div{display:grid;gap:3px;padding:11px;border-radius:12px;background:#f4f9fd}.preview-grid small{color:#9b7b88}.preview-grid b{font-size:20px;color:#6d9fc8}.preview-card p{font-size:12px;line-height:1.55;white-space:pre-wrap}.preview-card .note{color:#718fa8}.preview-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}@media(max-width:390px){.two-fields,.three-fields{grid-template-columns:1fr}.card-actions{justify-content:flex-start}}
</style>
