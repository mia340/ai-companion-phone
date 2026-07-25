import Dexie, {
  type EntityTable
} from 'dexie'

import type {
  Character,
  ContactGroup,
  Conversation,
  Message,
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

  constructor() {
    super('companion-world-v1')

    // 原有数据库结构
    this.version(1).stores({
      worlds: 'id, createdAt',
      characters:
        'id, worldId, name, *groups, createdAt',
      contactGroups:
        'id, worldId, order',
      conversations:
        'id, worldId, type, updatedAt, pinned',
      messages:
        'id, worldId, conversationId, createdAt'
    })

    // V2：新增用户资料表
    this.version(2).stores({
      worlds: 'id, createdAt',
      characters:
        'id, worldId, name, *groups, createdAt',
      contactGroups:
        'id, worldId, order',
      conversations:
        'id, worldId, type, updatedAt, pinned',
      messages:
        'id, worldId, conversationId, createdAt',
      userProfiles:
        'id, updatedAt'
    })

    // V3：新增模型设置表
    this.version(3).stores({
      worlds: 'id, createdAt',
      characters:
        'id, worldId, name, *groups, createdAt',
      contactGroups:
        'id, worldId, order',
      conversations:
        'id, worldId, type, updatedAt, pinned',
      messages:
        'id, worldId, conversationId, createdAt',
      userProfiles:
        'id, updatedAt',
      modelSettings:
        'id, provider, updatedAt'
    })
  }
}

export const db = new CompanionDatabase()