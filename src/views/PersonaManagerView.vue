<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import PhoneFrame from '../components/PhoneFrame.vue'
import {
  deletePersona,
  listPersonas,
  savePersona,
  setDefaultPersona
} from '../services/personaService'
import type { UserPersona } from '../types/domain'

const personas = ref<UserPersona[]>([])
const editingId = ref('')
const message = ref('')
const form = reactive({
  name: '',
  avatar: '🧑',
  identity: '',
  appearance: '',
  personality: '',
  background: '',
  relationshipNote: '',
  characterKnowledge: '',
  boundaries: '不要替我说话，不要擅自决定我的行为、想法或感受。',
  isDefault: false
})

function resetForm() {
  editingId.value = ''
  form.name = ''
  form.avatar = '🧑'
  form.identity = ''
  form.appearance = ''
  form.personality = ''
  form.background = ''
  form.relationshipNote = ''
  form.characterKnowledge = ''
  form.boundaries = '不要替我说话，不要擅自决定我的行为、想法或感受。'
  form.isDefault = false
}

function edit(persona: UserPersona) {
  editingId.value = persona.id
  form.name = persona.name
  form.avatar = persona.avatar
  form.identity = persona.identity || ''
  form.appearance = persona.appearance || ''
  form.personality = persona.personality || ''
  form.background = persona.background || ''
  form.relationshipNote = persona.relationshipNote || ''
  form.characterKnowledge = persona.characterKnowledge || ''
  form.boundaries = persona.boundaries || ''
  form.isDefault = persona.isDefault
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function refresh() {
  personas.value = await listPersonas()
}

async function submit() {
  if (!form.name.trim()) {
    message.value = '请先填写人设名称。'
    return
  }

  await savePersona({
    id: editingId.value || undefined,
    name: form.name,
    avatar: form.avatar,
    identity: form.identity,
    appearance: form.appearance,
    personality: form.personality,
    background: form.background,
    relationshipNote: form.relationshipNote,
    characterKnowledge: form.characterKnowledge,
    boundaries: form.boundaries,
    isDefault: form.isDefault
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

onMounted(refresh)
</script>

<template>
  <PhoneFrame title="用户人设 Persona" show-back>
    <main class="persona-page">
      <section class="intro-card">
        <b>你在故事里是谁</b>
        <p>可以建立现实、校园、古风或游戏世界中的不同身份。每个聊天可单独选择一套 Persona。</p>
      </section>

      <form class="editor-card" @submit.prevent="submit">
        <div class="section-title">
          <h2>{{ editingId ? '编辑用户人设' : '新建用户人设' }}</h2>
          <button v-if="editingId" type="button" @click="resetForm">取消编辑</button>
        </div>

        <div class="two-fields">
          <label>名称<input v-model="form.name" maxlength="30" placeholder="例如：现实中的我" /></label>
          <label>头像<input v-model="form.avatar" maxlength="8" placeholder="🧑" /></label>
        </div>
        <label>身份<input v-model="form.identity" maxlength="80" placeholder="例如：大学生、调查员、旅行者" /></label>
        <label>外貌<textarea v-model="form.appearance" rows="3" placeholder="角色能够看到的外貌与穿着" /></label>
        <label>性格<textarea v-model="form.personality" rows="3" placeholder="你的性格、习惯和表达方式" /></label>
        <label>背景<textarea v-model="form.background" rows="4" placeholder="在当前世界中的经历和处境" /></label>
        <label>与角色的关系补充<textarea v-model="form.relationshipNote" rows="3" placeholder="例如：我们从小认识，但还没有确认关系" /></label>
        <label>角色已经知道的事<textarea v-model="form.characterKnowledge" rows="3" placeholder="不需要每次重新解释的重要信息" /></label>
        <label>边界<textarea v-model="form.boundaries" rows="3" /></label>
        <label class="default-switch"><input v-model="form.isDefault" type="checkbox" />设为默认人设</label>
        <button class="primary" type="submit">{{ editingId ? '保存修改' : '创建人设' }}</button>
      </form>

      <p v-if="message" class="message">{{ message }}</p>

      <section class="persona-list">
        <article v-for="persona in personas" :key="persona.id" class="persona-card">
          <div class="persona-avatar">{{ persona.avatar }}</div>
          <div class="persona-copy">
            <div><b>{{ persona.name }}</b><span v-if="persona.isDefault">默认</span></div>
            <small>{{ persona.identity || '未填写身份' }}</small>
            <p>{{ persona.personality || persona.background || '还没有详细描述。' }}</p>
          </div>
          <div class="card-actions">
            <button type="button" @click="edit(persona)">编辑</button>
            <button v-if="!persona.isDefault" type="button" @click="makeDefault(persona.id)">设为默认</button>
            <button class="danger" type="button" @click="remove(persona)">删除</button>
          </div>
        </article>
      </section>
    </main>
  </PhoneFrame>
</template>

<style scoped>
.persona-page{min-height:100%;padding:14px;background:#f7f0f3;color:#5d4350}.intro-card,.editor-card,.persona-card{border:1px solid rgba(109,70,87,.08);border-radius:20px;background:#fff;box-shadow:0 8px 28px rgba(79,46,61,.06)}.intro-card{padding:16px;margin-bottom:12px}.intro-card p{margin:6px 0 0;color:#947482;line-height:1.6;font-size:13px}.editor-card{display:grid;gap:12px;padding:16px}.section-title{display:flex;align-items:center;justify-content:space-between}.section-title h2{margin:0;font-size:18px}.section-title button,.card-actions button{border:0;background:#f5e9ee;color:#9b6078;border-radius:10px;padding:7px 10px}.editor-card label{display:grid;gap:6px;font-size:13px;font-weight:700}.editor-card input,.editor-card textarea{width:100%;box-sizing:border-box;border:1px solid #eadce2;border-radius:12px;background:#fffbfc;padding:10px 12px;color:#593f4b;font:inherit;resize:vertical}.two-fields{display:grid;grid-template-columns:1fr 96px;gap:10px}.default-switch{display:flex!important;grid-template-columns:auto 1fr;align-items:center}.default-switch input{width:auto}.primary{border:0;border-radius:14px;background:#dc76a0;color:#fff;padding:12px;font-weight:800}.message{padding:10px 12px;border-radius:12px;background:#fff5f8;color:#b65178}.persona-list{display:grid;gap:10px;margin-top:14px;padding-bottom:30px}.persona-card{display:grid;grid-template-columns:48px minmax(0,1fr);gap:10px;padding:14px}.persona-avatar{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:#f8e8ef;font-size:25px}.persona-copy{min-width:0}.persona-copy>div{display:flex;align-items:center;gap:7px}.persona-copy span{border-radius:999px;background:#f1d2df;color:#b14f78;padding:2px 7px;font-size:10px}.persona-copy small{color:#9a7a88}.persona-copy p{margin:7px 0 0;color:#755965;line-height:1.5;font-size:12px}.card-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:7px}.card-actions .danger{color:#b64c63}@media(max-width:390px){.two-fields{grid-template-columns:1fr}}
</style>
