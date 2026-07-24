<script setup lang="ts">
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
const openingCharacterId = ref('')
const errorMessage = ref('')

const groupedContacts = computed(() => {
  const shownCharacterIds = new Set<string>()

  return groups.value
    .map(group => {
      const members = characters.value.filter(character => {
        if (shownCharacterIds.has(character.id)) {
          return false
        }

        return character.groups.includes(group.id)
      })

      members.forEach(character => {
        shownCharacterIds.add(character.id)
      })

      return {
        group,
        members
      }
    })
    .filter(section => section.members.length > 0)
})

async function loadContacts() {
  errorMessage.value = ''

  try {
    const [groupRows, characterRows] =
      await Promise.all([
        db.contactGroups
          .orderBy('order')
          .toArray(),

        db.characters.toArray()
      ])

    groups.value = groupRows
    characters.value = characterRows
  } catch (error) {
    console.error('读取通讯录失败：', error)
    errorMessage.value = '通讯录加载失败。'
  }
}

async function openCharacterChat(
  character: Character
) {
  if (openingCharacterId.value) return

  openingCharacterId.value = character.id
  errorMessage.value = ''

  try {
    const conversations =
      await db.conversations
        .where('worldId')
        .equals(character.worldId)
        .toArray()

    let conversation = conversations.find(item => {
      return (
        item.type === 'single' &&
        item.memberIds.length === 1 &&
        item.memberIds[0] === character.id
      )
    })

    if (!conversation) {
      const now = new Date().toISOString()

      conversation = {
        id: crypto.randomUUID(),
        worldId: character.worldId,
        type: 'single',
        title: character.name,
        memberIds: [character.id],
        pinned: false,
        muted: false,
        unread: 0,
        updatedAt: now
      }

      await db.conversations.add(conversation)
    }

    await router.push(`/chat/${conversation.id}`)
  } catch (error) {
    console.error('打开聊天失败：', error)
    errorMessage.value =
      '暂时无法打开聊天，请稍后重试。'
  } finally {
    openingCharacterId.value = ''
  }
}
onMounted(loadContacts)
</script>

<template>
  <PhoneFrame title="通讯录" show-back>
    <section class="list-page">
      <button
        class="primary"
        type="button"
        @click="$router.push('/characters/new')"
      >
        ＋ 创建新角色
      </button>

      <p
        v-if="errorMessage"
        class="contact-error"
      >
        {{ errorMessage }}
      </p>

      <div
        v-for="section in groupedContacts"
        :key="section.group.id"
        class="group"
      >
        <h3>{{ section.group.name }}</h3>

        <button
          v-for="character in section.members"
          :key="character.id"
          class="contact-row"
          type="button"
          :disabled="
            openingCharacterId === character.id
          "
          @click="openCharacterChat(character)"
        >
          <CharacterAvatar
            :avatar="character.avatar"
            :name="character.name"
            :size="52"
          />

          <span class="contact-main">
            <b>{{ character.name }}</b>

            <small>
              {{ character.relationship }}
              ·
              {{ character.activity }}
            </small>
          </span>

          <span>
            {{
              openingCharacterId === character.id
                ? '…'
                : '›'
            }}
          </span>
        </button>
      </div>

      <p
        v-if="
          !errorMessage &&
          characters.length === 0
        "
        class="empty-tip"
      >
        暂时还没有角色，点击上方按钮创建一个吧。
      </p>
    </section>
  </PhoneFrame>
</template>

<style scoped>
.contact-main {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 5px;
  text-align: left;
}

.contact-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contact-error,
.empty-tip {
  padding: 12px;
  border-radius: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.58);
}
</style>