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
  ConversationStateHistory,
  Message,
  MusicState,
  CharacterRelationship,
  RelationshipEvent,
  UserProfile,
  UserPersona,
  LorebookEntry,
  LorebookResource,
  PromptPreset,
  RegexScript,
  ResourceBinding,
  CommunityResourceArchive,
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
  lorebooks!: EntityTable<LorebookResource, 'id'>
  promptPresets!: EntityTable<PromptPreset, 'id'>
  regexScripts!: EntityTable<RegexScript, 'id'>
  resourceBindings!: EntityTable<ResourceBinding, 'id'>
  communityResourceArchives!: EntityTable<CommunityResourceArchive, 'id'>
  promptDebugTraces!: EntityTable<PromptDebugTrace, 'id'>
  conversationStateHistory!: EntityTable<ConversationStateHistory, 'id'>

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

    // V8：多层记忆、状态协议 V2、主动消息来源与状态变化历史。
    this.version(8).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status, type, proactiveSource',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, layer, status, topicKey, dueAt, updatedAt',
      conversationStates: 'id, updatedAt',
      conversationStateHistory: 'id, conversationId, characterId, field, createdAt',
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, characterId, enabled, priority, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const memories = transaction.table('memories')
      await memories.toCollection().modify(memory => {
        memory.layer = memory.layer || (memory.category === 'promise' ? 'promise' : memory.category === 'relationship' ? 'relationship' : memory.category === 'event' ? 'shared' : 'fact')
        memory.status = memory.status || 'active'
        memory.confidence = typeof memory.confidence === 'number' ? memory.confidence : .82
        memory.locked = Boolean(memory.locked)
        memory.hitCount = Number(memory.hitCount || 0)
        memory.sourceType = memory.sourceType || (memory.sourceMessageId ? 'automatic' : 'manual')
      })
      const states = transaction.table('conversationStates')
      await states.toCollection().modify(state => {
        state.unresolvedTopics = Array.isArray(state.unresolvedTopics) ? state.unresolvedTopics : []
        state.pendingEvents = Array.isArray(state.pendingEvents) ? state.pendingEvents : []
        state.shortTermGoals = Array.isArray(state.shortTermGoals) ? state.shortTermGoals : []
        state.timePeriod = state.timePeriod || ''
        state.energy = state.energy || '平稳'
        state.stateVersion = 2
      })
    })

    // V9：Tavo / SillyTavern 资源兼容运行时。世界书按“书”管理，并新增预设、正则与角色资源绑定。
    this.version(9).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status, type, proactiveSource',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, layer, status, topicKey, dueAt, updatedAt',
      conversationStates: 'id, updatedAt',
      conversationStateHistory: 'id, conversationId, characterId, field, createdAt',
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, lorebookId, characterId, enabled, priority, updatedAt',
      lorebooks: 'id, worldId, characterId, name, updatedAt',
      promptPresets: 'id, worldId, name, updatedAt',
      regexScripts: 'id, worldId, characterId, enabled, name, updatedAt',
      resourceBindings: 'id, worldId, characterId, resourceType, resourceId, enabled, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    })

    // V10：社区资源无损归档与兼容报告。解析后的资源继续放在原表，原始 JSON/元数据单独保存。
    this.version(10).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status, type, proactiveSource',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, layer, status, topicKey, dueAt, updatedAt',
      conversationStates: 'id, updatedAt',
      conversationStateHistory: 'id, conversationId, characterId, field, createdAt',
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, lorebookId, characterId, enabled, priority, updatedAt',
      lorebooks: 'id, worldId, characterId, name, updatedAt',
      promptPresets: 'id, worldId, name, updatedAt',
      regexScripts: 'id, worldId, characterId, enabled, name, updatedAt',
      resourceBindings: 'id, worldId, characterId, scope, scopeId, resourceType, resourceId, enabled, updatedAt',
      communityResourceArchives: 'id, worldId, kind, name, fileName, createdAt, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const bindings = transaction.table('resourceBindings')
      await bindings.toCollection().modify(binding => {
        if (!binding.scope) {
          binding.scope = binding.characterId ? 'character' : 'global'
          binding.scopeId = binding.characterId || undefined
        }
      })
    })

    // V11：移除早期演示角色与伪通知数据。只在数据库升级时执行一次，
    // 迁移后用户仍可自行创建“林夏 / 顾言 / 苏晚”等同名角色。
    this.version(11).stores({
      worlds: 'id, createdAt',
      characters: 'id, worldId, name, *groups, createdAt',
      contactGroups: 'id, worldId, order',
      conversations: 'id, worldId, type, updatedAt, pinned',
      messages: 'id, worldId, conversationId, createdAt, status, type, proactiveSource',
      userProfiles: 'id, updatedAt',
      modelSettings: 'id, provider, updatedAt',
      chatSettings: 'id, conversationId, updatedAt',
      memories: 'id, conversationId, characterId, importance, layer, status, topicKey, dueAt, updatedAt',
      conversationStates: 'id, updatedAt',
      conversationStateHistory: 'id, conversationId, characterId, field, createdAt',
      musicStates: 'id, updatedAt',
      relationships: 'id, characterId, stage, updatedAt',
      relationshipEvents: 'id, characterId, conversationId, createdAt',
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, lorebookId, characterId, enabled, priority, updatedAt',
      lorebooks: 'id, worldId, characterId, name, updatedAt',
      promptPresets: 'id, worldId, name, updatedAt',
      regexScripts: 'id, worldId, characterId, enabled, name, updatedAt',
      resourceBindings: 'id, worldId, characterId, scope, scopeId, resourceType, resourceId, enabled, updatedAt',
      communityResourceArchives: 'id, worldId, kind, name, fileName, createdAt, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const legacyNames = new Set(['林夏', '顾言', '苏晚'])
      const legacyCharacterIds = new Set(['char-lin', 'char-gu', 'char-su'])
      const legacyConversationIds = new Set(['conv-lin', 'conv-gu', 'conv-su'])

      const characters = transaction.table('characters')
      const conversations = transaction.table('conversations')
      const messages = transaction.table('messages')
      const chatSettings = transaction.table('chatSettings')
      const memories = transaction.table('memories')
      const conversationStates = transaction.table('conversationStates')
      const conversationStateHistory = transaction.table('conversationStateHistory')
      const musicStates = transaction.table('musicStates')
      const relationships = transaction.table('relationships')
      const relationshipEvents = transaction.table('relationshipEvents')
      const personas = transaction.table('personas')
      const lorebookEntries = transaction.table('lorebookEntries')
      const lorebooks = transaction.table('lorebooks')
      const regexScripts = transaction.table('regexScripts')
      const resourceBindings = transaction.table('resourceBindings')
      const promptDebugTraces = transaction.table('promptDebugTraces')

      const characterRows = await characters.toArray()
      for (const character of characterRows) {
        if (legacyNames.has(String(character.name || '').trim())) {
          legacyCharacterIds.add(String(character.id))
        }
      }

      const deleteConversationData = async (conversationId: string) => {
        await messages.where('conversationId').equals(conversationId).delete()
        await memories.where('conversationId').equals(conversationId).delete()
        await relationshipEvents.where('conversationId').equals(conversationId).delete()
        await conversationStateHistory.where('conversationId').equals(conversationId).delete()
        await promptDebugTraces.where('conversationId').equals(conversationId).delete()
        await chatSettings.delete(conversationId)
        await conversationStates.delete(conversationId)
        await musicStates.delete(conversationId)
        await conversations.delete(conversationId)
      }

      const conversationRows = await conversations.toArray()
      for (const conversation of conversationRows) {
        const memberIds = Array.isArray(conversation.memberIds)
          ? conversation.memberIds.map((id: unknown) => String(id))
          : []
        const remainingMemberIds = memberIds.filter((id: string) => !legacyCharacterIds.has(id))
        const touchesLegacyCharacter = remainingMemberIds.length !== memberIds.length
        const isLegacyConversation = legacyConversationIds.has(String(conversation.id))

        if (!touchesLegacyCharacter && !isLegacyConversation) continue

        if (conversation.type === 'single' || remainingMemberIds.length === 0 || isLegacyConversation) {
          await deleteConversationData(String(conversation.id))
        } else {
          await conversations.update(conversation.id, {
            memberIds: remainingMemberIds,
            updatedAt: new Date().toISOString()
          })
        }
      }

      // 群聊中由演示角色发送的历史消息也一并移除。
      await messages
        .toCollection()
        .filter(message => legacyCharacterIds.has(String(message.senderId || '')))
        .delete()

      for (const characterId of legacyCharacterIds) {
        await relationships.where('characterId').equals(characterId).delete()
        await relationshipEvents.where('characterId').equals(characterId).delete()
        await conversationStateHistory.where('characterId').equals(characterId).delete()
        await lorebookEntries.where('characterId').equals(characterId).delete()
        await lorebooks.where('characterId').equals(characterId).delete()
        await regexScripts.where('characterId').equals(characterId).delete()
        await resourceBindings.where('characterId').equals(characterId).delete()
        await resourceBindings.where('scopeId').equals(characterId).delete()
        await promptDebugTraces.where('characterId').equals(characterId).delete()
        await characters.delete(characterId)
      }

      const personaRows = await personas.toArray()
      const legacyPersonaIds = personaRows
        .filter(persona => legacyCharacterIds.has(String(persona.boundCharacterId || '')))
        .map(persona => persona.id)
      if (legacyPersonaIds.length) await personas.bulkDelete(legacyPersonaIds)
    })

  }
}

export const db = new CompanionDatabase()
