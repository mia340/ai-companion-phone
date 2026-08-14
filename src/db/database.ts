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

    // V11：移除早期演示数据。只按旧版本稳定 ID 清理，不再按角色姓名匹配。
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

    // V12：通用兼容内核清洗。清理孤儿记录、归一聊天兼容策略，
    // 并移除早期导入流程写入社区角色卡的应用默认行为字段。
    this.version(12).stores({
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
      communityResourceArchives: 'id, worldId, kind, characterId, name, fileName, createdAt, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const characters = transaction.table('characters')
      const contactGroups = transaction.table('contactGroups')
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
      const promptPresets = transaction.table('promptPresets')
      const regexScripts = transaction.table('regexScripts')
      const resourceBindings = transaction.table('resourceBindings')
      const promptDebugTraces = transaction.table('promptDebugTraces')
      const archives = transaction.table('communityResourceArchives')

      const characterRows = await characters.toArray()
      const conversationRows = await conversations.toArray()
      const personaRows = await personas.toArray()
      const characterIds = new Set(characterRows.map(row => String(row.id)))
      const conversationIds = new Set(conversationRows.map(row => String(row.id)))
      const personaIds = new Set(personaRows.map(row => String(row.id)))
      const communityCharacterIds = new Set(characterRows
        .filter(row => Boolean((row.importFormat && row.importFormat !== 'native') || row.sourceSpec || row.sourceSpecVersion || row.rawCardExtensions))
        .map(row => String(row.id)))
      const communityConversationIds = new Set(conversationRows
        .filter(row => row.type === 'single' && row.memberIds?.some((id: unknown) => communityCharacterIds.has(String(id))))
        .map(row => String(row.id)))

      const defaultWorldId = String(characterRows[0]?.worldId || conversationRows[0]?.worldId || 'world-default')
      if (!(await contactGroups.get('group-unassigned'))) {
        await contactGroups.put({
          id: 'group-unassigned',
          worldId: defaultWorldId,
          name: '未分组',
          order: 999
        })
      }

      await chatSettings.toCollection().filter(row => !conversationIds.has(String(row.conversationId || row.id))).delete()
      await conversationStates.toCollection().filter(row => !conversationIds.has(String(row.id))).delete()
      await musicStates.toCollection().filter(row => !conversationIds.has(String(row.id))).delete()
      await messages.toCollection().filter(row => !conversationIds.has(String(row.conversationId))).delete()
      // 社区角色卡不再持久化小手机固定状态卡元数据；原卡 HTML/XML/Regex 内容保留在消息正文与 rawContent 中。
      await messages.toCollection().modify(row => {
        if (communityConversationIds.has(String(row.conversationId)) && row.roleCardUi) row.roleCardUi = undefined
      })
      const syntheticPhoneRows = await messages.toCollection()
        .filter(row => row.senderId !== 'user' && row.type === 'action' && /^低头看着手机屏幕，停了一会儿才继续回复[。.!！]?$/.test(String(row.content || '').trim()))
        .toArray()
      if (syntheticPhoneRows.length) await messages.bulkDelete(syntheticPhoneRows.map(row => row.id))
      await memories.toCollection().filter(row => !conversationIds.has(String(row.conversationId)) || !characterIds.has(String(row.characterId))).delete()
      await relationships.toCollection().filter(row => !characterIds.has(String(row.characterId))).delete()
      await relationshipEvents.toCollection().filter(row => !characterIds.has(String(row.characterId)) || !conversationIds.has(String(row.conversationId))).delete()
      await conversationStateHistory.toCollection().filter(row => !characterIds.has(String(row.characterId)) || !conversationIds.has(String(row.conversationId))).delete()
      await promptDebugTraces.toCollection().filter(row => !characterIds.has(String(row.characterId)) || !conversationIds.has(String(row.conversationId))).delete()

      // 社区角色卡默认采用原卡优先策略：移除旧版本小手机关系积分引擎生成的固定“初识/熟悉”等状态。
      await relationships.toCollection().filter(row => communityCharacterIds.has(String(row.characterId))).delete()
      await relationshipEvents.toCollection().filter(row => communityCharacterIds.has(String(row.characterId))).delete()

      // 清理旧版 ConversationState 的应用占位值；有明确场景证据的状态保留。
      await conversationStates.toCollection().modify(row => {
        if (row.innerMood === '平静') row.innerMood = ''
        if (row.innerActivity === '正在等你的消息' || row.innerActivity === '正在等待你的消息') row.innerActivity = ''
        if (row.innerThought === '好像还有很多话想慢慢告诉你。') row.innerThought = ''
        if (row.energy === '平稳') row.energy = ''
        const noPresenceEvidence = !row.reportedPresence && !row.presenceResolutionSource && !row.location && !row.lastActionSummary
        if (row.presence === 'remote' && noPresenceEvidence) row.presence = undefined
      })

      await personas.toCollection().modify(row => {
        if (row.boundCharacterId && !characterIds.has(String(row.boundCharacterId))) {
          row.boundCharacterId = undefined
          row.boundCharacterName = undefined
          row.personaScope = 'global'
          row.isCardTemplate = false
        }
        // 清理早期默认 Persona 自动注入的应用规则；用户自己写入的其它内容不动。
        if (row.relationshipNote === '请让角色根据既有关系自然认识我，不要替我决定动作、想法或感受。') row.relationshipNote = undefined
        if (row.boundaries === '不要替用户说话，不要擅自决定用户的行为、心理和选择。') row.boundaries = undefined
      })

      await lorebooks.toCollection().filter(row => Boolean(row.characterId) && !characterIds.has(String(row.characterId))).delete()
      await regexScripts.toCollection().filter(row => Boolean(row.characterId) && !characterIds.has(String(row.characterId))).delete()
      const liveLorebookIds = new Set((await lorebooks.toArray()).map(row => String(row.id)))
      const liveRegexIds = new Set((await regexScripts.toArray()).map(row => String(row.id)))
      const livePresetIds = new Set((await promptPresets.toArray()).map(row => String(row.id)))
      await lorebookEntries.toCollection().filter(row =>
        (Boolean(row.characterId) && !characterIds.has(String(row.characterId))) ||
        (Boolean(row.lorebookId) && !liveLorebookIds.has(String(row.lorebookId)))
      ).delete()

      await resourceBindings.toCollection().filter(row => {
        const type = String(row.resourceType)
        const resourceId = String(row.resourceId)
        const resourceExists = type === 'lorebook' ? liveLorebookIds.has(resourceId) : type === 'preset' ? livePresetIds.has(resourceId) : type === 'regex' ? liveRegexIds.has(resourceId) : false
        if (!resourceExists) return true
        const scope = row.scope || (row.characterId ? 'character' : 'global')
        const scopeId = String(row.scopeId || row.characterId || '')
        if (scope === 'character') return !characterIds.has(scopeId)
        if (scope === 'conversation') return !conversationIds.has(scopeId)
        if (scope === 'persona') return !personaIds.has(scopeId)
        return false
      }).delete()

      await chatSettings.toCollection().modify(row => {
        row.compatibilityMode = ['auto', 'card-first', 'phone-enhanced'].includes(String(row.compatibilityMode)) ? row.compatibilityMode : 'auto'
        delete row.actionTextLayout
        row.presenceMode = ['auto', 'together', 'remote'].includes(String(row.presenceMode)) ? row.presenceMode : 'auto'
      })

      await characters.toCollection().modify(row => {
        const groups = Array.isArray(row.groups) ? row.groups.filter(Boolean) : []
        if (!groups.length) row.groups = ['group-unassigned']

        // 清理旧版本曾自动写入的占位状态。只处理精确旧文案，不猜测用户真实数据。
        if (row.activity === '刚刚来到这个世界' || row.activity === '正在等待你的消息') row.activity = ''
        if (row.mood === '期待认识你') row.mood = ''

        const isCommunity = Boolean((row.importFormat && row.importFormat !== 'native') || row.sourceSpec || row.sourceSpecVersion || row.rawCardExtensions)
        if (!isCommunity) return
        if (row.persona === '等待你逐渐了解的原创角色。') row.persona = ''
        row.initiative = undefined
        row.narrationStyle = undefined
        row.emojiFrequency = undefined
        row.questionFrequency = undefined
      })

      const validResourceIds = new Set([
        ...(await lorebooks.toArray()).map(row => String(row.id)),
        ...(await promptPresets.toArray()).map(row => String(row.id)),
        ...(await regexScripts.toArray()).map(row => String(row.id))
      ])
      await archives.toCollection().modify(row => {
        const importedIds = Array.isArray(row.importedResourceIds) ? row.importedResourceIds : []
        if (row.kind === 'character-card' && !row.characterId) {
          const legacyCharacterId = importedIds.find((id: unknown) => characterIds.has(String(id)))
          if (legacyCharacterId) row.characterId = String(legacyCharacterId)
        }
        row.importedResourceIds = importedIds.filter((id: unknown) => validResourceIds.has(String(id)))
      })

      // 从无损角色卡归档回填 description / personality 的原始语义边界。
      // 旧版本曾把两者合并进 persona；有原始归档时恢复为独立字段，避免运行时继续丢失作者结构。
      const archiveRows = await archives.toArray()
      for (const archive of archiveRows) {
        const characterId = String(archive.characterId || '')
        if (archive.kind !== 'character-card' || !characterIds.has(characterId)) continue
        const character = await characters.get(characterId)
        if (!character || character.cardDescription || character.cardPersonality) continue
        let raw: unknown = archive.rawJson
        if ((!raw || typeof raw !== 'object') && typeof archive.rawText === 'string' && archive.rawText.trim()) {
          try { raw = JSON.parse(archive.rawText) } catch { raw = undefined }
        }
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
        const root = raw as Record<string, unknown>
        const nested = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
          ? root.data as Record<string, unknown>
          : root
        const text = (...keys: string[]) => {
          for (const key of keys) {
            const value = nested[key]
            if (typeof value === 'string' && value.trim()) return value.trim()
          }
          return undefined
        }
        const cardDescription = text('description', 'desc', 'character_description', 'characterDescription')
        const cardPersonality = text('personality', 'persona', 'character_persona', 'characterPersona')
        if (cardDescription || cardPersonality) {
          await characters.update(characterId, { cardDescription, cardPersonality })
        }
      }
    })

    // V13：AI-only 内容权威化。停止本地模拟回复与本地关系情绪生成，
    // 清理历史 mock/fallback 角色消息，并迁移旧 mock 模型配置到真实 API 配置入口。
    this.version(13).stores({
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
      relationships: null,
      relationshipEvents: null,
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, lorebookId, characterId, enabled, priority, updatedAt',
      lorebooks: 'id, worldId, characterId, name, updatedAt',
      promptPresets: 'id, worldId, name, updatedAt',
      regexScripts: 'id, worldId, characterId, enabled, name, updatedAt',
      resourceBindings: 'id, worldId, characterId, scope, scopeId, resourceType, resourceId, enabled, updatedAt',
      communityResourceArchives: 'id, worldId, kind, characterId, name, fileName, createdAt, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const modelSettings = transaction.table('modelSettings')
      const chatSettings = transaction.table('chatSettings')
      const messages = transaction.table('messages')
      const conversationStates = transaction.table('conversationStates')
      const promptDebugTraces = transaction.table('promptDebugTraces')

      await modelSettings.toCollection().modify(row => {
        delete row.fallbackToMock
        if (row.provider === 'mock') {
          row.provider = 'deepseek'
          row.baseUrl = 'https://api.deepseek.com'
          row.apiKey = ''
          row.model = 'deepseek-v4-flash'
          row.availableModels = ['deepseek-v4-flash', 'deepseek-v4-pro']
          row.visionSupported = undefined
          row.visionTestedSignature = undefined
          row.visionTestedAt = undefined
        }
      })

      await chatSettings.toCollection().modify(row => {
        delete row.autoFallback
      })

      // 历史本地模拟/失败兜底消息不是真实 AI 输出，会污染后续上下文，升级时直接移除。
      const syntheticIds = (await messages.toArray())
        .filter(row => row.senderId !== 'user' && (
          row.provider === 'mock' ||
          row.fallback === true ||
          (row.proactiveSource && !row.provider) ||
          // 非用户主动停止遗留的 pending 角色消息没有完整性证明，统一移除。
          row.status === 'pending'
        ))
        .map(row => row.id)
      if (syntheticIds.length) await messages.bulkDelete(syntheticIds)
      await messages.toCollection().modify(row => {
        // fallback 字段只属于旧本地兜底实现；保留真实 provider/model 元数据即可。
        delete row.fallback
      })

      // 早期心理面板既混有 AI 状态，也混有本地模板/推断，无法可靠区分来源。
      // V13 一次性清空这些派生展示字段；后续只允许角色卡明确值或真实 AI 重新生成。
      await conversationStates.toCollection().modify(row => {
        row.innerMood = ''
        row.innerActivity = ''
        row.innerThought = ''
        row.relationshipNote = ''
        row.thoughtUpdatedAt = undefined
        // 旧版本的这些字段可能来自本地关键词推断，也可能来自 AI，来源无法可靠区分。
        // V13 清空后，auto/card-first 不再本地推断；只有原卡/AI 明确给出或用户显式开启增强层才会重新写入。
        row.unresolvedTopics = []
        row.pendingEvents = []
        row.shortTermGoals = []
        row.lastCompletedEvent = ''
      })

      // V13 直接删除旧 relationships / relationshipEvents stores；关系语义不再由本地积分表持久化。
      await promptDebugTraces.toCollection().filter(row => row.provider === 'mock').delete()
    })

    // V14：资源彻底去“角色所有权” + 通讯录去分组。
    // 世界书 / Regex 的 characterId 只属于旧数据结构；升级后全部转成共享资源本体，
    // 角色是否使用某资源只由 ResourceBinding 决定。contactGroups / Character.groups 仅保留备份兼容结构。
    this.version(14).stores({
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
      relationships: null,
      relationshipEvents: null,
      personas: 'id, isDefault, updatedAt',
      lorebookEntries: 'id, worldId, lorebookId, characterId, enabled, priority, updatedAt',
      lorebooks: 'id, worldId, characterId, name, updatedAt',
      promptPresets: 'id, worldId, name, updatedAt',
      regexScripts: 'id, worldId, characterId, enabled, name, updatedAt',
      resourceBindings: 'id, worldId, characterId, scope, scopeId, resourceType, resourceId, enabled, updatedAt',
      communityResourceArchives: 'id, worldId, kind, characterId, name, fileName, createdAt, updatedAt',
      promptDebugTraces: 'id, conversationId, characterId, createdAt'
    }).upgrade(async transaction => {
      const characters = transaction.table('characters')
      const contactGroups = transaction.table('contactGroups')
      const lorebooks = transaction.table('lorebooks')
      const lorebookEntries = transaction.table('lorebookEntries')
      const regexScripts = transaction.table('regexScripts')
      const resourceBindings = transaction.table('resourceBindings')

      const now = new Date().toISOString()
      const characterRows = await characters.toArray()
      const characterMap = new Map(characterRows.map(row => [String(row.id), row]))

      // “特别关心 / 未分组”等旧通讯录分组不再参与产品逻辑。
      await contactGroups.clear()
      await characters.toCollection().modify(row => {
        row.groups = []

        // 旧版本可能只把 personality 放进 persona，导致详情页只看到一小截。
        // 有原卡 description / personality 时，把它们原样合成“完整角色介绍”；
        // 只有 persona 明显仍是旧单字段值时才自动修复，避免覆盖用户后来手工改写的介绍。
        const description = typeof row.cardDescription === 'string' ? row.cardDescription.trim() : ''
        const personality = typeof row.cardPersonality === 'string' ? row.cardPersonality.trim() : ''
        const persona = typeof row.persona === 'string' ? row.persona.trim() : ''
        const parts = [description]
          .filter(Boolean)
        if (personality && !parts.some(item => item === personality || item.includes(personality))) parts.push(personality)
        const combined = parts.join('\n\n')
        if (combined && (!persona || persona === description || persona === personality)) row.persona = combined
      })

      const bindingRows = await resourceBindings.toArray()
      const bindingKeys = new Set(bindingRows.map(row => {
        const scope = row.scope || (row.characterId ? 'character' : 'global')
        const scopeId = row.scopeId || row.characterId || ''
        return `${row.resourceType}|${row.resourceId}|${scope}|${scopeId}`
      }))

      const ensureBinding = async (input: {
        worldId: string
        characterId?: string
        scope: 'global' | 'character'
        resourceType: 'lorebook' | 'regex'
        resourceId: string
      }) => {
        const scopeId = input.scope === 'character' ? input.characterId : undefined
        if (input.scope === 'character' && !scopeId) return
        const key = `${input.resourceType}|${input.resourceId}|${input.scope}|${scopeId || ''}`
        if (bindingKeys.has(key)) return
        await resourceBindings.add({
          id: crypto.randomUUID(),
          worldId: input.worldId,
          characterId: input.scope === 'character' ? scopeId : undefined,
          scope: input.scope,
          scopeId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          enabled: true,
          order: 100,
          createdAt: now,
          updatedAt: now
        })
        bindingKeys.add(key)
      }

      // 旧“角色专属世界书”迁成：共享世界书本体 + 对原角色的默认绑定。
      const lorebookRows = await lorebooks.toArray()
      for (const row of lorebookRows) {
        const legacyCharacterId = row.characterId ? String(row.characterId) : ''
        if (!legacyCharacterId) continue
        const sourceCharacter = characterMap.get(legacyCharacterId)
        await lorebooks.update(row.id, {
          characterId: undefined,
          sourceCharacterId: row.sourceCharacterId || (sourceCharacter ? legacyCharacterId : undefined),
          sourceCharacterName: row.sourceCharacterName || sourceCharacter?.name,
          updatedAt: now
        })
        if (sourceCharacter) {
          await ensureBinding({
            worldId: String(row.worldId || sourceCharacter.worldId),
            characterId: legacyCharacterId,
            scope: 'character',
            resourceType: 'lorebook',
            resourceId: String(row.id)
          })
        }
      }

      // 有 lorebookId 的条目跟随“书”走，不再保存角色所有权。
      await lorebookEntries.toCollection().modify(row => {
        if (row.lorebookId) row.characterId = undefined
      })

      // 更老的数据可能只有 entry.characterId、没有 LorebookResource。
      // 按原角色收拢成一本共享书；没有角色归属的 loose entries 收拢成全局共享书。
      const looseRows = (await lorebookEntries.toArray()).filter(row => !row.lorebookId)
      const looseGroups = new Map<string, typeof looseRows>()
      for (const row of looseRows) {
        const key = row.characterId ? String(row.characterId) : '__global__'
        const list = looseGroups.get(key) || []
        list.push(row)
        looseGroups.set(key, list)
      }
      for (const [key, rows] of looseGroups) {
        if (!rows.length) continue
        const sourceCharacter = key === '__global__' ? undefined : characterMap.get(key)
        const lorebookId = crypto.randomUUID()
        const worldId = String(rows[0]?.worldId || sourceCharacter?.worldId || 'world-default')
        await lorebooks.add({
          id: lorebookId,
          worldId,
          name: sourceCharacter ? `${sourceCharacter.name} · 历史世界书` : '历史全局世界书',
          description: '由 V14 从旧版散落世界书条目自动整理；现在是可复用的共享资源。',
          characterId: undefined,
          sourceCharacterId: sourceCharacter ? key : undefined,
          sourceCharacterName: sourceCharacter?.name,
          sourceFormat: 'legacy',
          createdAt: now,
          updatedAt: now
        })
        for (const entry of rows) {
          await lorebookEntries.update(entry.id, {
            lorebookId,
            characterId: undefined,
            updatedAt: now
          })
        }
        if (sourceCharacter) {
          await ensureBinding({ worldId, characterId: key, scope: 'character', resourceType: 'lorebook', resourceId: lorebookId })
        } else {
          await ensureBinding({ worldId, scope: 'global', resourceType: 'lorebook', resourceId: lorebookId })
        }
      }

      // Regex 同样只保留来源信息，不保留“所有者”；原角色通过绑定继续使用。
      const regexRows = await regexScripts.toArray()
      for (const row of regexRows) {
        const legacyCharacterId = row.characterId ? String(row.characterId) : ''
        if (!legacyCharacterId) continue
        const sourceCharacter = characterMap.get(legacyCharacterId)
        await regexScripts.update(row.id, {
          characterId: undefined,
          sourceCharacterId: row.sourceCharacterId || (sourceCharacter ? legacyCharacterId : undefined),
          sourceCharacterName: row.sourceCharacterName || sourceCharacter?.name,
          updatedAt: now
        })
        if (sourceCharacter) {
          await ensureBinding({
            worldId: String(row.worldId || sourceCharacter.worldId),
            characterId: legacyCharacterId,
            scope: 'character',
            resourceType: 'regex',
            resourceId: String(row.id)
          })
        }
      }
    })

  }
}

export const db = new CompanionDatabase()
