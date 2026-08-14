<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { deleteCharacterSafely, getOrCreateSingleConversation } from '../services/characterService'
import { listResourceBindings } from '../services/resourceBindingService'
import { renderRoleplayText } from '../services/textMacroService'
import type { Character } from '../types/domain'

const route = useRoute()
const router = useRouter()
const character = ref<Character | null>(null)
const isLoading = ref(true)
const isDeleting = ref(false)
const errorMessage = ref('')
const resourceStats = ref({ lorebookEntries: 0, lorebooks: 0, regexScripts: 0, presets: 0, hasDepthPrompt: false })
const boundPersonaName = ref('')
const showDeletePanel = ref(false)
const deleteConfirmName = ref('')
const characterId = computed(() => String(route.params.id ?? ''))

const canDelete = computed(() => Boolean(character.value && deleteConfirmName.value.trim() === character.value.name))
const hasStatus = computed(() => Boolean(character.value?.mood?.trim() || character.value?.activity?.trim()))
const hasLikes = computed(() => Boolean(character.value?.likes?.length || character.value?.dislikes?.length))
const hasBoundResources = computed(() => Boolean(
  resourceStats.value.lorebooks || resourceStats.value.regexScripts || resourceStats.value.presets || resourceStats.value.hasDepthPrompt
))

function isImageAvatar(avatar?: string) {
  return Boolean(avatar && /^(data:image\/|blob:|https?:\/\/)/i.test(avatar))
}

function renderVisible(value?: string | number) {
  if (value === undefined || value === null || String(value).trim() === '') return ''
  return renderRoleplayText(String(value), boundPersonaName.value || '你', character.value?.name) || String(value)
}

function showList(values?: string[]) {
  return (values || []).map(item => item.trim()).filter(Boolean).join('、')
}

const characterIntroduction = computed(() => {
  const row = character.value
  if (!row) return ''
  const sections: string[] = []
  const description = row.cardDescription?.trim() || ''
  const personality = row.cardPersonality?.trim() || ''
  const persona = row.persona?.trim() || ''

  // persona 在 V0.4.4.2 中就是“完整角色介绍”的展示字段。
  // 角色卡导入时会把原始 description / personality 原样合并到这里；用户手动编辑时也以这里为准。
  if (persona) {
    sections.push(persona)
  } else {
    if (description) sections.push(description)
    if (personality && personality !== description && !description.includes(personality)) {
      sections.push(description ? `${description}\n\n${personality}` : personality)
    }
  }

  // 某些资源型卡连 description/personality 都没有；只把原卡已有字段并进一个介绍卡，不自行生成内容。
  if (!sections.length && row.identity?.trim()) sections.push(`【身份】\n${row.identity.trim()}`)
  if (!sections.length && row.scenario?.trim()) sections.push(`【场景 / 背景】\n${row.scenario.trim()}`)
  if (!sections.length && row.creatorNotes?.trim()) sections.push(row.creatorNotes.trim())

  return renderVisible(sections.join('\n\n'))
})

async function loadCharacter() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const result = await db.characters.get(characterId.value)
    if (!result) throw new Error('这个角色不存在或已经被删除。')
    character.value = result

    const [bindings, boundPersona, allEntries] = await Promise.all([
      listResourceBindings(result.id),
      db.personas.filter(item => item.boundCharacterId === result.id).first(),
      db.lorebookEntries.toArray()
    ])
    boundPersonaName.value = boundPersona?.name || ''
    const activeLorebookIds = new Set(bindings.filter(item => item.enabled && item.resourceType === 'lorebook').map(item => item.resourceId))
    resourceStats.value = {
      lorebookEntries: allEntries.filter(item => Boolean(item.lorebookId && activeLorebookIds.has(item.lorebookId))).length,
      lorebooks: activeLorebookIds.size,
      regexScripts: bindings.filter(item => item.enabled && item.resourceType === 'regex').length,
      presets: bindings.filter(item => item.enabled && item.resourceType === 'preset').length,
      hasDepthPrompt: Boolean(result.depthPrompt?.prompt?.trim())
    }
  } catch (error) {
    console.error('读取角色详情失败：', error)
    errorMessage.value = error instanceof Error ? error.message : '读取角色失败。'
  } finally {
    isLoading.value = false
  }
}

async function openChat() {
  if (!character.value) return
  try {
    const conversation = await getOrCreateSingleConversation(character.value)
    router.push(`/chat/${conversation.id}`)
  } catch (error) {
    console.error('打开聊天失败：', error)
    errorMessage.value = error instanceof Error ? error.message : '无法打开聊天。'
  }
}

function openCard() {
  if (character.value) router.push(`/characters/${character.value.id}/card`)
}

function openEdit() {
  if (character.value) router.push(`/characters/${character.value.id}/edit`)
}

function cancelDelete() {
  showDeletePanel.value = false
  deleteConfirmName.value = ''
}

async function confirmDelete() {
  if (!character.value || !canDelete.value || isDeleting.value) return
  isDeleting.value = true
  errorMessage.value = ''
  const deletedName = character.value.name
  try {
    const result = await deleteCharacterSafely(character.value.id)
    window.alert([
      `“${deletedName}”已经删除。`,
      '',
      `删除单聊：${result.deletedSingleConversations} 个`,
      `删除消息：${result.deletedMessages} 条`,
      `调整群聊：${result.updatedGroupConversations} 个`,
      '世界书 / 正则属于共享资源库，不会因为删除角色而自动删除。'
    ].join('\n'))
    router.replace('/contacts')
  } catch (error) {
    console.error('删除角色失败：', error)
    errorMessage.value = error instanceof Error ? error.message : '删除角色失败。'
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadCharacter)
</script>

<template>
  <PhoneFrame :title="character?.name ?? '角色详情'" show-back>
    <section class="detail-page">
      <p v-if="isLoading" class="state-message">正在读取角色资料……</p>
      <p v-else-if="errorMessage && !character" class="error-message">{{ errorMessage }}</p>

      <template v-else-if="character">
        <section class="profile-card">
          <div class="avatar-shell">
            <img v-if="isImageAvatar(character.avatar)" :src="character.avatar" :alt="character.name" />
            <span v-else>{{ character.avatar || '🙂' }}</span>
          </div>
          <div class="profile-main">
            <h1>{{ character.name }}</h1>
            <p v-if="character.nickname">昵称：{{ character.nickname }}</p>
            <div class="profile-tags">
              <span v-if="character.relationship?.trim()">{{ renderVisible(character.relationship) }}</span>
              <span v-if="character.identity">{{ renderVisible(character.identity) }}</span>
              <span v-if="character.age">{{ character.age }} 岁</span>
            </div>
          </div>
        </section>

        <section v-if="hasStatus" class="status-card">
          <div v-if="character.mood?.trim()"><small>当前心情</small><strong>{{ renderVisible(character.mood) }}</strong></div>
          <div v-if="character.activity?.trim()"><small>当前活动</small><strong>{{ renderVisible(character.activity) }}</strong></div>
        </section>

        <section class="action-grid">
          <button type="button" class="primary-action" @click="openChat">💬 发消息</button>
          <button type="button" class="secondary-action" @click="openEdit">✏️ 编辑资料</button>
          <button type="button" class="secondary-action roleplay-action" @click="openCard">🎭 沉浸角色卡</button>
        </section>

        <section v-if="hasBoundResources" class="info-card community-resource-card">
          <h2>已绑定资源</h2>
          <p>世界书、Regex 和 Preset 都是共享资源库资产；这里只表示当前角色正在使用哪些资源，不代表资源归这个角色所有。</p>
          <div class="resource-tags">
            <span v-if="resourceStats.lorebooks">世界书 {{ resourceStats.lorebooks }} 本 / {{ resourceStats.lorebookEntries }} 条</span>
            <span v-if="resourceStats.regexScripts">Regex {{ resourceStats.regexScripts }}</span>
            <span v-if="resourceStats.presets">Preset {{ resourceStats.presets }}</span>
            <span v-if="resourceStats.hasDepthPrompt">Depth Prompt</span>
          </div>
          <button class="resource-manage" type="button" @click="router.push({ path: '/world', query: { character: character.id, tab: 'lorebooks' } })">管理共享资源</button>
        </section>

        <section v-if="characterIntroduction" class="info-card intro-card">
          <h2>角色介绍</h2>
          <p>{{ characterIntroduction }}</p>
        </section>

        <section v-if="character.speakingStyle?.trim()" class="info-card">
          <h2>说话方式</h2>
          <p>{{ renderVisible(character.speakingStyle) }}</p>
        </section>

        <section v-if="character.background?.trim()" class="info-card">
          <h2>背景故事</h2>
          <p>{{ renderVisible(character.background) }}</p>
        </section>

        <section v-if="hasLikes" class="info-card two-column">
          <div v-if="character.likes?.length"><h2>喜欢</h2><p>{{ showList(character.likes) }}</p></div>
          <div v-if="character.dislikes?.length"><h2>不喜欢</h2><p>{{ showList(character.dislikes) }}</p></div>
        </section>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <section class="danger-zone">
          <h2>危险操作</h2>
          <p>删除角色后，该角色的单聊和聊天记录也会被删除。共享世界书 / 正则不会跟着删除，可以继续给其它角色使用。</p>
          <button v-if="!showDeletePanel" type="button" class="show-delete-button" @click="showDeletePanel = true">删除这个角色</button>
          <div v-else class="delete-confirm-panel">
            <strong>删除前建议先导出数据备份</strong>
            <button type="button" class="backup-link" @click="router.push('/backup')">前往数据备份</button>
            <label>输入角色姓名“{{ character.name }}”确认删除<input v-model="deleteConfirmName" :placeholder="character.name" autocomplete="off" /></label>
            <div class="delete-actions">
              <button type="button" class="cancel-button" :disabled="isDeleting" @click="cancelDelete">取消</button>
              <button type="button" class="delete-button" :disabled="!canDelete || isDeleting" @click="confirmDelete">{{ isDeleting ? '正在删除……' : '永久删除' }}</button>
            </div>
          </div>
        </section>
      </template>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.detail-page {
  height: 100%;
  overflow-y: auto;
  padding: 18px;
  display: grid;
  align-content: start;
  gap: 15px;
  background: #fff7fb;
}

.profile-card,
.status-card,
.info-card,
.danger-zone {
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow:
    0 8px 24px rgba(110, 67, 87, 0.07);
}

.profile-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-shell {
  flex: 0 0 auto;
  width: 86px;
  height: 86px;
  overflow: hidden;
  border-radius: 26px;
  display: grid;
  place-items: center;
  background: #ffe2ee;
  font-size: 42px;
}

.avatar-shell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-main {
  min-width: 0;
}

.profile-main h1 {
  margin: 0 0 5px;
  color: #573b47;
  font-size: 25px;
}

.profile-main p {
  margin: 0 0 10px;
  color: #997580;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.profile-tags span {
  padding: 5px 9px;
  border-radius: 999px;
  background: #fff0f6;
  color: #a95377;
  font-size: 12px;
}

.status-card {
  padding: 16px;
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.status-card div {
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  background: #fff0f6;
}

.status-card small {
  display: block;
  margin-bottom: 6px;
  color: #a6828e;
}

.status-card strong {
  color: #644651;
  line-height: 1.5;
}

.action-grid {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.action-grid button {
  min-height: 50px;
  border: none;
  border-radius: 17px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}

.primary-action {
  background: #dd75a2;
  color: white;
}

.secondary-action {
  background: #ffe2ee;
  color: #a85075;
}

.roleplay-action {
  grid-column: 1 / -1;
  background: linear-gradient(135deg, #f2d7e3, #f8e9ef);
}

.info-card {
  padding: 18px;
}

.info-card h2,
.danger-zone h2 {
  margin: 0 0 9px;
  color: #5d404c;
  font-size: 17px;
}

.info-card p,
.danger-zone p {
  margin: 0;
  color: #866672;
  line-height: 1.75;
  white-space: pre-wrap;
}

.two-column {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.danger-zone {
  margin-bottom: 12px;
  padding: 18px;
  border: 1px solid #ffd2d8;
}

.show-delete-button,
.delete-button,
.cancel-button,
.backup-link {
  min-height: 44px;
  border: none;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
}

.show-delete-button {
  width: 100%;
  margin-top: 14px;
  background: #fff0f1;
  color: #bc4d60;
}

.delete-confirm-panel {
  margin-top: 14px;
  padding: 15px;
  display: grid;
  gap: 12px;
  border-radius: 17px;
  background: #fff0f2;
}

.delete-confirm-panel strong {
  color: #9d4557;
}

.backup-link {
  background: white;
  color: #a55374;
}

.delete-confirm-panel label {
  display: grid;
  gap: 8px;
  color: #744f5d;
  line-height: 1.6;
}

.delete-confirm-panel input {
  min-height: 45px;
  box-sizing: border-box;
  padding: 0 13px;
  border: 1px solid #ecced8;
  border-radius: 13px;
  outline: none;
  font-size: 15px;
}

.delete-actions {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.cancel-button {
  background: white;
  color: #72515d;
}

.delete-button {
  background: #bd5368;
  color: white;
}

.delete-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.state-message,
.error-message {
  padding: 14px;
  border-radius: 15px;
  text-align: center;
}

.state-message {
  background: white;
  color: #80616d;
}

.error-message {
  background: #ffe5e8;
  color: #ab4052;
}

@media (max-width: 420px) {
  .two-column,
  .status-card {
    grid-template-columns: 1fr;
  }
}

.community-resource-card {
  display: grid;
  gap: 10px;
  border: 1px solid rgba(217, 111, 155, 0.16);
}
.community-resource-card p { margin: 0; line-height: 1.65; }
.resource-tags { display: flex; flex-wrap: wrap; gap: 7px; }
.resource-tags span { padding: 5px 9px; border-radius: 999px; background: #fff0f6; color: #a85d7a; font-size: 12px; font-weight: 700; }
.resource-manage{margin-top:12px;border:0;border-radius:12px;background:#f4e7ed;color:#a45675;padding:9px 12px;font-weight:700}.intro-card p{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}


</style>