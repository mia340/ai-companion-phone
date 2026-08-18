<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'
import { db } from '../db/database'
import { renderRoleplayText } from '../services/textMacroService'
import type { Character } from '../types/domain'

const router = useRouter()
const characters = ref<Character[]>([])
const errorMessage = ref('')
const isLoading = ref(true)

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
  <PhoneFrame title="通讯录" show-back>
    <section class="list-page contacts-page">
      <RouterLink class="primary create-button" to="/characters/new">＋ 创建新角色</RouterLink>

      <p v-if="isLoading" class="state-message">正在读取通讯录……</p>
      <p v-else-if="errorMessage" class="contact-error">{{ errorMessage }}</p>

      <template v-else>
        <section class="contact-list">
          <button
            v-for="character in characters"
            :key="character.id"
            class="contact-row"
            type="button"
            @click="openCharacterDetail(character.id)"
          >
            <CharacterAvatar :avatar="character.avatar" :name="character.name" :size="52" />
            <span class="contact-main">
              <b>{{ character.name }}</b>
              <small v-if="contactSubtitle(character)">{{ contactSubtitle(character) }}</small>
            </span>
            <span class="row-arrow">›</span>
          </button>
        </section>

        <p v-if="characters.length === 0" class="empty-tip">暂时还没有角色，点击上方按钮创建或导入角色卡。</p>
      </template>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.contacts-page{height:100%;overflow-y:auto;box-sizing:border-box;padding-bottom:28px}.create-button{width:100%;min-height:50px;margin-bottom:16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-decoration:none;cursor:pointer;position:relative;z-index:10;pointer-events:auto}.contact-list{display:grid;gap:10px}.contact-row{width:100%;min-height:72px;box-sizing:border-box;padding:10px 13px;border:none;border-radius:18px;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.72);color:inherit;cursor:pointer;text-align:left;box-shadow:0 5px 18px rgba(104,63,82,.05)}.contact-row:active{transform:scale(.99)}.contact-main{min-width:0;flex:1;display:grid;gap:5px;text-align:left}.contact-main b{overflow:hidden;color:#573d47;font-size:16px;text-overflow:ellipsis;white-space:nowrap}.contact-main small{overflow:hidden;color:#9b7885;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.row-arrow{flex:0 0 auto;color:#ba8d9e;font-size:28px;line-height:1}.state-message,.contact-error,.empty-tip{padding:14px;border-radius:14px;text-align:center;line-height:1.6}.state-message,.empty-tip{background:rgba(255,255,255,.58);color:#876875}.contact-error{background:#edf6fd;color:#aa4052}
</style>
