import { db } from '../db/database'

import type {
  Character,
  Conversation
} from '../types/domain'

export type CharacterUpdate =
  Partial<
    Omit<
      Character,
      'id' | 'worldId' | 'createdAt'
    >
  >

export interface DeleteCharacterResult {
  deletedSingleConversations: number
  updatedGroupConversations: number
  deletedMessages: number
}

/**
 * 列出角色的全部单聊。V0.4.4.7 起同一角色可以拥有多份独立剧情档案。
 */
export async function listSingleConversations(
  characterId: string,
  worldId: string
): Promise<Conversation[]> {
  const conversations = await db.conversations
    .where('worldId')
    .equals(worldId)
    .toArray()

  return conversations
    .filter(conversation =>
      conversation.type === 'single' &&
      conversation.memberIds.length === 1 &&
      conversation.memberIds[0] === characterId
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * 兼容旧调用：返回最近的一份单聊。
 */
export async function findSingleConversation(
  characterId: string,
  worldId: string
): Promise<Conversation | undefined> {
  return (await listSingleConversations(characterId, worldId))[0]
}

/**
 * 新建一份完全独立的角色单聊。开场默认 pending，由聊天页让用户选择：
 * 自由开局 / 默认开场 / 任一备用开场。
 */
export async function createSingleConversation(
  character: Character,
  options?: {
    title?: string
    openingMode?: 'pending' | 'free'
    parentConversationId?: string
    rootConversationId?: string
    branchFromMessageId?: string
  }
): Promise<Conversation> {
  const now = new Date().toISOString()
  const previous = await listSingleConversations(character.id, character.worldId)
  const ordinal = previous.length + 1
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    worldId: character.worldId,
    type: 'single',
    title: options?.title?.trim() || (ordinal > 1 ? `${character.name} · 聊天 ${ordinal}` : character.name),
    memberIds: [character.id],
    pinned: false,
    muted: false,
    unread: 0,
    openingMode: options?.openingMode ?? 'pending',
    parentConversationId: options?.parentConversationId,
    rootConversationId: options?.rootConversationId,
    branchFromMessageId: options?.branchFromMessageId,
    createdAt: now,
    updatedAt: now
  }
  await db.conversations.add(conversation)
  return conversation
}

/**
 * 获取最近单聊；不存在时创建一份等待用户选择开场的新聊天。
 */
export async function getOrCreateSingleConversation(
  character: Character
): Promise<Conversation> {
  return await findSingleConversation(character.id, character.worldId)
    ?? await createSingleConversation(character)
}

/**
 * 更新角色资料。
 * 角色改名时，同步更新对应单聊标题。
 */
export async function updateCharacterAndConversation(
  characterId: string,
  updates: CharacterUpdate
): Promise<void> {
  const current =
    await db.characters.get(characterId)

  if (!current) {
    throw new Error(
      '没有找到需要修改的角色。'
    )
  }

  const now = new Date().toISOString()

  const nextName =
    updates.name?.trim() ||
    current.name

  await db.transaction(
    'rw',
    db.tables,
    async () => {
      await db.characters.update(
        characterId,
        {
          ...updates,
          name: nextName,
          updatedAt: now
        }
      )

      const conversations =
        await db.conversations.toArray()

      const singleConversations =
        conversations.filter(
          conversation =>
            conversation.type ===
              'single' &&
            conversation.memberIds
              .length === 1 &&
            conversation.memberIds[0] ===
              characterId
        )

      for (
        const conversation
        of singleConversations
      ) {
        const nextTitle = conversation.title === current.name
          ? nextName
          : conversation.title.startsWith(`${current.name} · `)
            ? `${nextName}${conversation.title.slice(current.name.length)}`
            : conversation.title
        await db.conversations.update(
          conversation.id,
          {
            title: nextTitle,
            updatedAt: now
          }
        )
      }
    }
  )
}

/**
 * 安全删除角色。
 *
 * 单聊：
 * - 删除该角色的单聊会话
 * - 删除该会话的全部消息
 *
 * 群聊：
 * - 将角色从成员列表中移除
 * - 群聊还有其他成员时保留群聊
 * - 群聊没有成员时删除群聊和消息
 */
export async function deleteCharacterSafely(
  characterId: string
): Promise<DeleteCharacterResult> {
  const result: DeleteCharacterResult = {
    deletedSingleConversations: 0,
    updatedGroupConversations: 0,
    deletedMessages: 0
  }

  await db.transaction(
    'rw',
    db.tables,
    async () => {
      const character =
        await db.characters.get(
          characterId
        )

      if (!character) {
        throw new Error(
          '角色已经不存在。'
        )
      }

      const conversations =
        await db.conversations.toArray()

      const relatedConversations =
        conversations.filter(
          conversation =>
            conversation.memberIds.includes(
              characterId
            )
        )

      for (
        const conversation
        of relatedConversations
      ) {
        if (
          conversation.type === 'single'
        ) {
          const messageCount =
            await db.messages
              .where('conversationId')
              .equals(conversation.id)
              .count()

          await db.messages
            .where('conversationId')
            .equals(conversation.id)
            .delete()

          await Promise.all([
            db.conversations.delete(conversation.id),
            db.chatSettings.delete(conversation.id),
            db.conversationStates.delete(conversation.id),
            db.musicStates.delete(conversation.id),
            db.memories
              .where('conversationId')
              .equals(conversation.id)
              .delete()
          ])

          result.deletedMessages +=
            messageCount

          result
            .deletedSingleConversations += 1

          continue
        }

        const remainingMemberIds =
          conversation.memberIds.filter(
            memberId =>
              memberId !== characterId
          )

        if (
          remainingMemberIds.length === 0
        ) {
          const messageCount =
            await db.messages
              .where('conversationId')
              .equals(conversation.id)
              .count()

          await db.messages
            .where('conversationId')
            .equals(conversation.id)
            .delete()

          await Promise.all([
            db.conversations.delete(conversation.id),
            db.chatSettings.delete(conversation.id),
            db.conversationStates.delete(conversation.id),
            db.musicStates.delete(conversation.id),
            db.memories
              .where('conversationId')
              .equals(conversation.id)
              .delete()
          ])

          result.deletedMessages +=
            messageCount
        } else {
          await db.conversations.update(
            conversation.id,
            {
              memberIds:
                remainingMemberIds,

              updatedAt:
                new Date().toISOString()
            }
          )

          result
            .updatedGroupConversations += 1
        }
      }

      // 清理保留群聊中由该角色发送的消息，避免留下 senderId 孤儿记录。
      const remainingCharacterMessages = await db.messages
        .toCollection()
        .filter(message => message.senderId === characterId)
        .toArray()
      if (remainingCharacterMessages.length) {
        await db.messages.bulkDelete(remainingCharacterMessages.map(message => message.id))
        result.deletedMessages += remainingCharacterMessages.length
      }

      // 角色级运行状态、记忆、调试与 Persona 全部跟随角色删除。
      await Promise.all([
        db.memories.where('characterId').equals(characterId).delete(),
        db.conversationStateHistory.where('characterId').equals(characterId).delete(),
        db.promptDebugTraces.where('characterId').equals(characterId).delete(),
        db.personas.toCollection().filter(persona => persona.boundCharacterId === characterId).delete(),
        db.resourceBindings.where('characterId').equals(characterId).delete(),
        db.resourceBindings.where('scopeId').equals(characterId).delete()
      ])

      // V0.4.4.2：世界书 / Regex 是共享资源库资产，不再跟随来源角色删除。
      // 删除角色只移除它自己的 ResourceBinding；资源本体保留，并把“来源角色”降级为文字溯源信息。
      const allLorebooks = await db.lorebooks.toArray()
      const sourcedLorebooks = allLorebooks.filter(row => row.sourceCharacterId === characterId || row.characterId === characterId)
      for (const lorebook of sourcedLorebooks) {
        await db.lorebooks.update(lorebook.id, {
          characterId: undefined,
          sourceCharacterId: undefined,
          sourceCharacterName: lorebook.sourceCharacterName || character.name,
          updatedAt: new Date().toISOString()
        })
        await db.lorebookEntries.where('lorebookId').equals(lorebook.id).modify({ characterId: undefined })
      }

      // 极老版本可能存在没有 lorebookId 的角色专属条目。删除角色前把它们收进一本共享世界书，
      // 防止直接清空 characterId 后变成“无意全局常驻”。资源保留但不自动绑定给其它角色。
      const looseLegacyEntries = await db.lorebookEntries
        .where('characterId')
        .equals(characterId)
        .filter(entry => !entry.lorebookId)
        .toArray()
      if (looseLegacyEntries.length) {
        const now = new Date().toISOString()
        const legacyLorebookId = crypto.randomUUID()
        await db.lorebooks.add({
          id: legacyLorebookId,
          worldId: character.worldId,
          name: `${character.name} · 历史世界书`,
          description: '由旧版角色专属世界书条目迁移而来；资源已进入共享资源库。',
          characterId: undefined,
          sourceCharacterId: undefined,
          sourceCharacterName: character.name,
          sourceFormat: 'legacy',
          createdAt: now,
          updatedAt: now
        })
        for (const entry of looseLegacyEntries) {
          await db.lorebookEntries.update(entry.id, { lorebookId: legacyLorebookId, characterId: undefined, updatedAt: now })
        }
      }
      await db.lorebookEntries.where('characterId').equals(characterId).modify({ characterId: undefined })

      const allRegex = await db.regexScripts.toArray()
      const sourcedRegex = allRegex.filter(row => row.sourceCharacterId === characterId || row.characterId === characterId)
      for (const script of sourcedRegex) {
        await db.regexScripts.update(script.id, {
          characterId: undefined,
          sourceCharacterId: undefined,
          sourceCharacterName: script.sourceCharacterName || character.name,
          updatedAt: new Date().toISOString()
        })
      }

      await db.communityResourceArchives
        .toCollection()
        .filter(archive => archive.characterId === characterId)
        .delete()

      await db.characters.delete(characterId)
    }
  )

  return result
}