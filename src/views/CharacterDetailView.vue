<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import { db } from '../db/database'
import { createSingleConversation, deleteCharacterSafely, getOrCreateSingleConversation, listSingleConversations } from '../services/characterService'
import { listResourceBindings } from '../services/resourceBindingService'
import { buildCharacterCardLocalIndex, type CharacterCardLocalIndex } from '../services/characterCardIndexService'
import { renderRoleplayText } from '../services/textMacroService'
import { characterMacroName } from '../services/characterCardCompatibility'
import type { Character, Conversation } from '../types/domain'

const route = useRoute()
const router = useRouter()
const character = ref<Character | null>(null)
const isLoading = ref(true)
const isDeleting = ref(false)
const errorMessage = ref('')
const resourceStats = ref({ lorebookEntries: 0, lorebooks: 0, regexScripts: 0, presets: 0, hasDepthPrompt: false })
const boundPersonaName = ref('')
const cardIndex = ref<CharacterCardLocalIndex>()
const showDeletePanel = ref(false)
const deleteConfirmName = ref('')
const conversations = ref<Conversation[]>([])
const characterId = computed(() => String(route.params.id ?? ''))

const canDelete = computed(() => Boolean(character.value && deleteConfirmName.value.trim() === character.value.name))
const hasStatus = computed(() => Boolean(!cardIndex.value && (character.value?.mood?.trim() || character.value?.activity?.trim())))
const hasLikes = computed(() => Boolean(!cardIndex.value && (character.value?.likes?.length || character.value?.dislikes?.length)))
const hasBoundResources = computed(() => Boolean(
  resourceStats.value.lorebooks || resourceStats.value.regexScripts || resourceStats.value.presets || resourceStats.value.hasDepthPrompt
))

function isImageAvatar(avatar?: string) {
  return Boolean(avatar && /^(data:image\/|blob:|https?:\/\/)/i.test(avatar))
}

function renderVisible(value?: string | number) {
  if (value === undefined || value === null || String(value).trim() === '') return ''
  return renderRoleplayText(String(value), boundPersonaName.value || '你', character.value ? characterMacroName(character.value) : undefined) || String(value)
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

    const [bindings, boundPersona, allEntries, localIndex, chatRows] = await Promise.all([
      listResourceBindings(result.id),
      db.personas.filter(item => item.boundCharacterId === result.id).first(),
      db.lorebookEntries.toArray(),
      buildCharacterCardLocalIndex(result),
      listSingleConversations(result.id, result.worldId)
    ])
    boundPersonaName.value = boundPersona?.name || ''
    conversations.value = chatRows
    cardIndex.value = localIndex
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

async function createNewChat() {
  if (!character.value) return
  try {
    const conversation = await createSingleConversation(character.value, {
      openingMode: (character.value.firstMessage?.trim() || character.value.alternateGreetings?.some(item => item.trim())) ? 'pending' : 'free'
    })
    router.push(`/chat/${conversation.id}`)
  } catch (error) {
    console.error('新建聊天失败：', error)
    errorMessage.value = error instanceof Error ? error.message : '无法新建聊天。'
  }
}

function openConversation(row: Conversation) {
  router.push(`/chat/${row.id}`)
}

function conversationLabel(row: Conversation, index: number) {
  if (row.branchFromMessageId) return row.title || `${character.value?.name || '聊天'} · 分支`
  return row.title || `${character.value?.name || '聊天'} · ${conversations.value.length - index}`
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
              <span v-if="!cardIndex && character.relationship?.trim()">{{ renderVisible(character.relationship) }}</span>
              <span v-if="!cardIndex && character.identity">{{ renderVisible(character.identity) }}</span>
              <span v-if="!cardIndex && character.age">{{ character.age }} 岁</span>
            </div>
          </div>
        </section>

        <section v-if="hasStatus" class="status-card">
          <div v-if="character.mood?.trim()"><small>当前心情</small><strong>{{ renderVisible(character.mood) }}</strong></div>
          <div v-if="character.activity?.trim()"><small>当前活动</small><strong>{{ renderVisible(character.activity) }}</strong></div>
        </section>

        <section class="action-grid">
          <button type="button" class="primary-action" @click="openChat">💬 继续最近聊天</button>
          <button type="button" class="secondary-action" @click="createNewChat">＋ 新建聊天</button>
          <button type="button" class="secondary-action" @click="openEdit">✏️ 编辑资料</button>
          <button type="button" class="secondary-action roleplay-action" @click="openCard">🎭 沉浸角色卡</button>
        </section>

        <section v-if="conversations.length" class="info-card conversation-card">
          <h2>聊天记录 · {{ conversations.length }}</h2>
          <p>同一角色可以拥有多份独立剧情。新建聊天不会复制旧剧情；聊天分支会从指定消息处复制当时的消息、状态与记忆。</p>
          <button v-for="(row, index) in conversations" :key="row.id" type="button" class="conversation-row" @click="openConversation(row)">
            <span><b>{{ conversationLabel(row, index) }}</b><small>{{ row.openingMode === 'free' ? '自由开局' : row.openingMode === 'greeting' ? `开场 ${Number(row.greetingIndex ?? 0) + 1}` : row.openingMode === 'pending' ? '等待选择开场' : '旧版聊天' }}</small></span>
            <time>{{ new Date(row.updatedAt).toLocaleDateString('zh-CN') }}</time>
          </button>
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

        <section v-if="cardIndex" class="info-card card-reader-card">
          <div class="reader-head">
            <div>
              <h2>原卡阅读器</h2>
              <p>把社区角色卡转换成可读页面；解析、索引和查看都在本地完成，不消耗 API Token，也不会把拆分结果重复塞给 AI。</p>
            </div>
            <span>0 Token</span>
          </div>
          <div class="resource-tags">
            <span>{{ cardIndex.sourceFormat }}</span>
            <span v-if="cardIndex.greetingCount">开场 {{ cardIndex.greetingCount }}</span>
            <span v-if="cardIndex.lorebookCount">世界书 {{ cardIndex.lorebookCount }} 本</span>
            <span v-if="cardIndex.regexCount">Regex {{ cardIndex.regexCount }}</span>
          </div>
          <small v-if="cardIndex.sourceFileName" class="reader-file">来源：{{ cardIndex.sourceFileName }}</small>
          <div v-if="cardIndex.compatibilityNotes.length" class="reader-compat">
            <b>兼容层</b>
            <span>宏角色名：{{ cardIndex.macroCharacterName }}</span>
            <span>system_prompt：{{ cardIndex.systemPromptMode }}</span>
              <span>post_history：{{ cardIndex.postHistoryMode }}</span>
            <small v-for="note in cardIndex.compatibilityNotes" :key="note">{{ note }}</small>
          </div>

          <details v-for="section in cardIndex.sections" :key="section.key" class="reader-detail" :open="section.key === 'description'">
            <summary>{{ section.label }}</summary>
            <pre>{{ renderVisible(section.content) }}</pre>
          </details>

          <details class="reader-detail">
            <summary>User 相关 · {{ cardIndex.userMentionCount }} 处 <span v-pre>{{user}}</span></summary>
            <p v-if="cardIndex.userTemplate">检测到可独立查看的用户模板；是否建立 Persona 由你决定，不会为了填表强行猜姓名。</p>
            <p v-else-if="cardIndex.userMentionCount">原卡包含 User 剧情/关系引用，但没有可安全建立独立 Persona 的模板时，只作为原卡设定使用。</p>
            <p v-else>原卡没有检测到 User 占位。</p>
            <pre v-if="cardIndex.userTemplate">{{ cardIndex.userTemplate }}</pre>
          </details>

          <details v-if="cardIndex.characterDefinitionEntries.length" class="reader-detail">
            <summary>世界书中的人物 / 人设条目 · {{ cardIndex.characterDefinitionEntries.length }}</summary>
            <details v-for="entry in cardIndex.characterDefinitionEntries" :key="entry.id" class="reader-nested">
              <summary>{{ entry.title }}</summary>
              <pre>{{ renderVisible(entry.content) }}</pre>
            </details>
          </details>
        </section>

        <section v-if="characterIntroduction && !cardIndex" class="info-card intro-card">
          <h2>角色介绍</h2>
          <p>{{ characterIntroduction }}</p>
        </section>

        <section v-if="!cardIndex && character.speakingStyle?.trim()" class="info-card">
          <h2>说话方式</h2>
          <p>{{ renderVisible(character.speakingStyle) }}</p>
        </section>

        <section v-if="!cardIndex && character.background?.trim()" class="info-card">
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
  min-height: 100%;
  padding: 14px 14px 40px;
  display: grid;
  align-content: start;
  gap: 14px;
  background: #f4f8fb;
}

.profile-card,
.status-card,
.info-card,
.danger-zone {
  overflow: hidden;
  border: 1px solid rgba(45, 67, 85, .07);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(45, 76, 103, .035);
}

.profile-card {
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.avatar-shell {
  flex: 0 0 auto;
  width: 78px;
  height: 78px;
  overflow: hidden;
  border-radius: 22px;
  display: grid;
  place-items: center;
  background: #e7f2fa;
  font-size: 39px;
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
  color: #22394c;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -.02em;
}

.profile-main p {
  margin: 0 0 9px;
  color: #7e91a1;
  font-size: 13px;
}

.profile-tags,
.resource-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.profile-tags span,
.resource-tags span {
  padding: 5px 9px;
  border-radius: 999px;
  background: #edf5fa;
  color: #5f8dae;
  font-size: 11px;
  font-weight: 650;
}

.status-card {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.status-card div {
  min-width: 0;
  padding: 11px 12px;
  border-radius: 13px;
  background: #f1f7fb;
}

.status-card small {
  display: block;
  margin-bottom: 5px;
  color: #8496a4;
  font-size: 10px;
}

.status-card strong {
  color: #34536a;
  font-size: 13px;
  line-height: 1.5;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.action-grid button {
  min-height: 48px;
  border: 0;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
}

.action-grid button:active {
  transform: scale(.99);
}

.primary-action {
  background: #6daedc;
  color: #fff;
  box-shadow: 0 7px 18px rgba(73, 143, 192, .16);
}

.secondary-action {
  background: #e7f2fa;
  color: #4f84aa;
}

.roleplay-action {
  grid-column: 1 / -1;
  background: #fff;
  color: #4f718a;
  border: 1px solid #dce9f2 !important;
}

.info-card {
  padding: 16px;
}

.info-card h2,
.danger-zone h2 {
  margin: 0 0 8px;
  color: #2d475b;
  font-size: 16px;
  font-weight: 700;
}

.info-card p,
.danger-zone p {
  margin: 0;
  color: #748897;
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.two-column {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.community-resource-card,
.card-reader-card,
.conversation-card {
  display: grid;
  gap: 10px;
}

.resource-manage {
  margin-top: 2px;
  border: 0;
  border-radius: 11px;
  background: #e7f2fa;
  color: #568ab0;
  padding: 9px 12px;
  font-weight: 650;
}

.reader-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.reader-head h2 {
  margin: 0 0 5px;
}

.reader-head p {
  color: #748897;
  line-height: 1.6;
}

.reader-head > span {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  background: #eaf7ef;
  color: #4f8065;
  font-size: 10px;
  font-weight: 800;
}

.reader-compat {
  display: grid;
  gap: 5px;
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eef6fc;
  color: #607d98;
}

.reader-compat b { color: #4f7599; }
.reader-compat span,
.reader-compat small { font-size: 11px; line-height: 1.5; }
.reader-file { color: #8799a7; word-break: break-all; }

.reader-detail {
  border: 1px solid #e3edf4;
  border-radius: 12px;
  padding: 10px 12px;
  background: #f9fbfd;
}

.reader-detail summary,
.reader-nested summary {
  cursor: pointer;
  color: #557f9f;
  font-weight: 700;
}

.reader-detail pre,
.reader-nested pre {
  margin: 10px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #425b6d;
  font: inherit;
  font-size: 12px;
  line-height: 1.7;
}

.reader-detail p {
  color: #748897;
  line-height: 1.6;
}

.reader-nested {
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px dashed #dbe7ef;
}

.conversation-card > p {
  color: #748897;
  line-height: 1.65;
}

.conversation-row {
  position: relative;
  width: calc(100% + 16px);
  margin-left: -8px;
  padding: 12px 8px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #344f64;
  text-align: left;
}

.conversation-row + .conversation-row {
  border-top: 1px solid rgba(45, 67, 85, .08);
}

.conversation-row:active {
  background: #eef4f8;
}

.conversation-row span {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-row b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.conversation-row small,
.conversation-row time {
  color: #8da0ae;
  font-size: 10px;
}

.conversation-row time {
  flex: 0 0 auto;
}

.danger-zone {
  margin-bottom: 12px;
  padding: 16px;
  border-color: #f2d7db;
}

.danger-zone h2 {
  color: #a85461;
}

.show-delete-button,
.delete-button,
.cancel-button,
.backup-link {
  min-height: 43px;
  border: 0;
  border-radius: 12px;
  font-weight: 650;
}

.show-delete-button {
  width: 100%;
  margin-top: 13px;
  background: #fff1f2;
  color: #b45160;
}

.delete-confirm-panel {
  margin-top: 13px;
  padding: 14px;
  display: grid;
  gap: 11px;
  border-radius: 13px;
  background: #f7fafc;
}

.delete-confirm-panel strong { color: #9d4557; }
.backup-link { background: #edf5fa; color: #537e9e; }
.delete-confirm-panel label { display: grid; gap: 8px; color: #526c7f; line-height: 1.6; }
.delete-confirm-panel input { min-height: 44px; padding: 0 12px; border: 1px solid #dce8ef; border-radius: 11px; outline: none; font-size: 14px; }
.delete-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.cancel-button { background: #e9f1f6; color: #60798c; }
.delete-button { background: #bd5368; color: #fff; }
.delete-button:disabled { opacity: .45; cursor: not-allowed; }

.state-message,
.error-message {
  padding: 14px;
  border-radius: 13px;
  text-align: center;
}

.state-message { background: #fff; color: #768b9a; }
.error-message { background: #fff0f1; color: #ab4052; }
.intro-card p { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }

@media (max-width: 420px) {
  .two-column,
  .status-card {
    grid-template-columns: 1fr;
  }
}
</style>
