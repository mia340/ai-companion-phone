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
  CharacterRelationship,
  RelationshipEvent,
  UserProfile,
  UserPersona,
  LorebookEntry,
  PromptDebugTrace,
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
  relationships!: EntityTable<CharacterRelationship, 'id'>
  relationshipEvents!: EntityTable<RelationshipEvent, 'id'>
  personas!: EntityTable<UserPersona, 'id'>
  lorebookEntries!: EntityTable<LorebookEntry, 'id'>
  promptDebugTraces!: EntityTable<PromptDebugTrace, 'id'>

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

    // V5：关系成长、动态情绪、主动陪伴与关系事件。
    this.version(5).stores({
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
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt'
    })

    // V6：角色卡 V2、用户 Persona、世界书和沉浸角色扮演设置。
    this.version(6).stores({
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
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, characterId, enabled, priority, updatedAt'
    })

    // V7：互动动作协议、角色状态输出与本地 Prompt 调试记录。
    this.version(7).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status, type',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, updatedAt',
      conversationStates: 'id, updatedAt',
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, characterId, enabled, priority, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    })

  }
}

export const db = new CompanionDatabase()
