<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { renderRoleplayText } from '../services/textMacroService'
import type { Character } from '../types/domain'

const router = useRouter()
const characters = ref<Character[]>([])
const searchText = ref('')
const errorMessage = ref('')
const isLoading = ref(true)

const filteredCharacters = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return characters.value

  return characters.value.filter(character => {
    const subtitle = contactSubtitle(character).toLowerCase()
    return character.name.toLowerCase().includes(keyword) || subtitle.includes(keyword)
  })
})

function contactSubtitle(character: Character) {
  const rows = [character.relationship?.trim(), character.activity?.trim()].filter(Boolean)
  if (!rows.length) return ''
  return renderRoleplayText(rows.join(' · '), '你', character.name) || rows.join(' · ')
}

async function loadContacts() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    characters.value = (await db.characters.toArray())
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.createdAt.localeCompare(b.createdAt))
  } catch (error) {
    console.error('读取通讯录失败：', error)
    errorMessage.value = error instanceof Error ? `通讯录加载失败：${error.message}` : '通讯录加载失败。'
  } finally {
    isLoading.value = false
  }
}

function openCharacterDetail(characterId: string) {
  router.push(`/characters/${characterId}`)
}

onMounted(loadContacts)
</script>

<template>
  <PhoneFrame title="通讯录">
    <section class="contacts-page">
      <label class="search-field">
        <span aria-hidden="true">⌕</span>
        <input v-model="searchText" type="search" placeholder="搜索联系人" aria-label="搜索通讯录" />
        <button v-if="searchText" type="button" aria-label="清空搜索" @click="searchText = ''">×</button>
      </label>

      <section class="quick-section">
        <button class="quick-row" type="button" @click="router.push('/characters/new')">
          <span class="quick-icon">＋</span>
          <span>新建角色</span>
          <span class="row-arrow">›</span>
        </button>
      </section>

      <p class="section-label">角色</p>

      <p v-if="isLoading" class="state-message">正在读取通讯录……</p>
      <p v-else-if="errorMessage" class="contact-error">{{ errorMessage }}</p>

      <template v-else>
        <section v-if="filteredCharacters.length" class="contact-list">
          <button
            v-for="character in filteredCharacters"
            :key="character.id"
            class="contact-row"
            type="button"
            @click="openCharacterDetail(character.id)"
          >
            <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="50" />
            <span class="contact-main">
              <b>{{ character.name }}</b>
              <small v-if="contactSubtitle(character)">{{ contactSubtitle(character) }}</small>
            </span>
            <span class="row-arrow">›</span>
          </button>
        </section>

        <div v-else class="empty-state">
          <div>👥</div>
          <strong>{{ searchText ? '没有找到角色' : '通讯录还是空的' }}</strong>
          <p>{{ searchText ? '换个关键词试试。' : '创建或导入角色卡后，会出现在这里。' }}</p>
        </div>
      </template>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.contacts-page {
  min-height: 100%;
  padding: 10px 0 36px;
  background: #f5f9fc;
}

.search-field {
  height: 36px;
  margin: 0 14px 14px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 7px;
  border-radius: 10px;
  background: #eaf1f6;
  color: #8294a3;
}

.search-field > span {
  font-size: 20px;
  transform: translateY(-1px);
}

.search-field input {
  min-width: 0;
  height: 100%;
  flex: 1;
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  color: #23394c;
  font-size: 15px;
}

.search-field input::-webkit-search-cancel-button {
  display: none;
}

.search-field button {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #a7b4bf;
  color: #fff;
}

.quick-section,
.contact-list {
  background: #fff;
  border-top: 1px solid rgba(48, 78, 103, .07);
  border-bottom: 1px solid rgba(48, 78, 103, .07);
}

.quick-row,
.contact-row {
  position: relative;
  width: 100%;
  min-height: 66px;
  padding: 8px 14px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  color: #23394c;
  text-align: left;
}

.quick-row:active,
.contact-row:active {
  background: #eef4f8;
}

.quick-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: #76b6e4;
  color: #fff;
  font-size: 28px;
  font-weight: 300;
}

.quick-row > span:nth-child(2) {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
}

.section-label {
  margin: 18px 16px 7px;
  color: #7f92a2;
  font-size: 12px;
}

.contact-row::after {
  content: '';
  position: absolute;
  left: 76px;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(48, 78, 103, .08);
}

.contact-row:last-child::after {
  display: none;
}

.contact-main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 5px;
}

.contact-main b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #23394c;
  font-size: 16px;
  font-weight: 650;
}

.contact-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #8293a1;
  font-size: 12px;
}

.row-arrow {
  flex: 0 0 auto;
  color: #b4c0c9;
  font-size: 25px;
  font-weight: 300;
}

.state-message,
.contact-error {
  margin: 14px;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  line-height: 1.6;
}

.state-message {
  background: #fff;
  color: #7e91a1;
}

.contact-error {
  background: #fff0f1;
  color: #b45562;
}

.empty-state {
  padding: 70px 34px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #8193a1;
  text-align: center;
}

.empty-state > div {
  margin-bottom: 12px;
  font-size: 42px;
}

.empty-state strong {
  color: #38546b;
  font-size: 16px;
}

.empty-state p {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.6;
}
</style>
