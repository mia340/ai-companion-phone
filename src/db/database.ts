import Dexie, {
  type EntityTable
} from 'dexie'

import type {
  Character,
  CharacterMemory,
  ChatSettings,
  ContactGroup,
  Conversation,
  ConversationState,
  Message,
  MusicState,
  UserProfile,
  World
} from '../types/domain'

import type { ModelSettings } from '../types/modelSettings'

export class CompanionDatabase extends Dexie {
  worlds!: EntityTable<World, 'id'>
  characters!: EntityTable<Character, 'id'>
  contactGroups!: EntityTable<ContactGroup, 'id'>
  conversations!: EntityTable<Conversation, 'id'>
  messages!: EntityTable<Message, 'id'>
  userProfiles!: EntityTable<UserProfile, 'id'>
  modelSettings!: EntityTable<ModelSettings, 'id'>
  chatSettings!: EntityTable<ChatSettings, 'id'>
  memories!: EntityTable<CharacterMemory, 'id'>
  conversationStates!: EntityTable<ConversationState, 'id'>
  musicStates!: EntityTable<MusicState, 'id'>

  constructor() {
    super('companion-world-v1')

    this.version(1).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt'
    })

    this.version(2).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt',
      userProfiles: 'id, updatedAt'
    })

    this.version(3).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt'
    })

    // V4：聊天偏好、三层记忆、角色心理状态与一起听歌。
    this.version(4).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, updatedAt',
      conversationStates: 'id, updatedAt',
      musicStates: 'id, updatedAt'
    })
  }
}

export const db = new CompanionDatabase()
