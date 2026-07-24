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
 * 查找角色对应的单聊会话。
 */
export async function findSingleConversation(
  characterId: string,
  worldId: string
): Promise<Conversation | undefined> {
  const conversations =
    await db.conversations
      .where('worldId')
      .equals(worldId)
      .toArray()

  return conversations.find(
    conversation =>
      conversation.type === 'single' &&
      conversation.memberIds.length === 1 &&
      conversation.memberIds[0] ===
        characterId
  )
}

/**
 * 获取角色单聊。
 * 如果不存在，则自动创建。
 */
export async function getOrCreateSingleConversation(
  character: Character
): Promise<Conversation> {
  const existing =
    await findSingleConversation(
      character.id,
      character.worldId
    )

  if (existing) {
    return existing
  }

  const now = new Date().toISOString()

  const conversation: Conversation = {
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

  return conversation
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
        await db.conversations.update(
          conversation.id,
          {
            title: nextName,
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

          await db.conversations.delete(
            conversation.id
          )

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

          await db.conversations.delete(
            conversation.id
          )

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

      await db.characters.delete(
        characterId
      )
    }
  )

  return result
}