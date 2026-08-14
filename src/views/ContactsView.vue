<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  computed,
  onMounted,
  ref
} from 'vue'

import { useRouter } from 'vue-router'

import PhoneFrame from '../components/PhoneFrame.vue'
import CharacterAvatar from '../components/CharacterAvatar.vue'

import { db } from '../db/database'

import type {
  Character,
  ContactGroup
} from '../types/domain'

const router = useRouter()

const groups = ref<ContactGroup[]>([])
const characters = ref<Character[]>([])
const errorMessage = ref('')
const isLoading = ref(true)

const groupedContacts = computed(() => {
  const shownCharacterIds =
    new Set<string>()

  return groups.value
    .map(group => {
      const members =
        characters.value.filter(
          character => {
            if (
              shownCharacterIds.has(
                character.id
              )
            ) {
              return false
            }

            const characterGroups =
              Array.isArray(
                character.groups
              )
                ? character.groups
                : []

            return characterGroups.includes(
              group.id
            )
          }
        )

      members.forEach(character => {
        shownCharacterIds.add(
          character.id
        )
      })

      return {
        group,
        members
      }
    })
    .filter(
      section =>
        section.members.length > 0
    )
})

async function loadContacts() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [
      groupRows,
      characterRows
    ] = await Promise.all([
      db.contactGroups
        .orderBy('order')
        .toArray(),

      db.characters.toArray()
    ])

    groups.value = groupRows
    characters.value = characterRows
  } catch (error) {
    console.error(
      '读取通讯录失败：',
      error
    )

    errorMessage.value =
      error instanceof Error
        ? `通讯录加载失败：${error.message}`
        : '通讯录加载失败。'
  } finally {
    isLoading.value = false
  }
}


function openCharacterDetail(
  characterId: string
) {
  router.push(
    `/characters/${characterId}`
  )
}

onMounted(loadContacts)
</script>

<template>
  <PhoneFrame
    title="通讯录"
    show-back
  >
    <section class="list-page contacts-page">
     <RouterLink
     class="primary create-button"
     to="/characters/new"
     >
     ＋ 创建新角色
    </RouterLink>

      <p
        v-if="isLoading"
        class="state-message"
      >
        正在读取通讯录……
      </p>

      <p
        v-else-if="errorMessage"
        class="contact-error"
      >
        {{ errorMessage }}
      </p>

      <template v-else>
        <section
          v-for="section in groupedContacts"
          :key="section.group.id"
          class="group"
        >
          <h3>
            {{ section.group.name }}
          </h3>

          <button
            v-for="character in section.members"
            :key="character.id"
            class="contact-row"
            type="button"
            @click="
              openCharacterDetail(
                character.id
              )
            "
          >
            <CharacterAvatar
              :avatar="character.avatar"
              :name="character.name"
              :size="52"
            />

            <span class="contact-main">
              <b>{{ character.name }}</b>

              <small>
                {{ character.relationship || '未设定关系' }}
                <template v-if="character.activity"> · {{ character.activity }}</template>
              </small>
            </span>

            <span class="row-arrow">
              ›
            </span>
          </button>
        </section>

        <p
          v-if="
            characters.length === 0
          "
          class="empty-tip"
        >
          暂时还没有角色，点击上方按钮创建一个吧。
        </p>
      </template>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.contacts-page {
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  padding-bottom: 28px;
}

.create-button {
  width: 100%;
  min-height: 50px;
  margin-bottom: 16px;
  box-sizing: border-box;

  display: flex;
  align-items: center;
  justify-content: center;

  text-decoration: none;
  cursor: pointer;
  position: relative;
  z-index: 10;
  pointer-events: auto;
}

.group {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
}

.group h3 {
  margin: 0;
  padding: 0 4px;
  color: #8a6472;
  font-size: 15px;
}

.contact-row {
  width: 100%;
  min-height: 72px;
  box-sizing: border-box;
  padding: 10px 13px;
  border: none;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(
    255,
    255,
    255,
    0.72
  );
  color: inherit;
  cursor: pointer;
  text-align: left;
  box-shadow:
    0 5px 18px
    rgba(104, 63, 82, 0.05);
}

.contact-row:active {
  transform: scale(0.99);
}

.contact-main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 5px;
  text-align: left;
}

.contact-main b {
  overflow: hidden;
  color: #573d47;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-main small {
  overflow: hidden;
  color: #9b7885;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-arrow {
  flex: 0 0 auto;
  color: #ba8d9e;
  font-size: 28px;
  line-height: 1;
}

.state-message,
.contact-error,
.empty-tip {
  padding: 14px;
  border-radius: 14px;
  text-align: center;
  line-height: 1.6;
}

.state-message,
.empty-tip {
  background:
    rgba(255, 255, 255, 0.58);
  color: #876875;
}

.contact-error {
  background: #ffe5e8;
  color: #aa4052;
}
</style>