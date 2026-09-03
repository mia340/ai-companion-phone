import { db } from '../../db/database'
import type { Character, ConversationState, Message } from '../../types/domain'
import { resetConversationRuntime } from './conversationMutationService'

/**
 * Persist one selected Character Card greeting as the new opening seed.
 * Rendering/Regex compilation stays in the caller; this service owns the
 * cross-table reset + write transaction.
 */
export async function installConversationGreeting(options: {
  conversationId: string
  characterId: string
  greetingIndex: number
  message: Message
  state: ConversationState
  characterPatch: Pick<Partial<Character>, 'activity' | 'relationship'>
  resetExisting: boolean
}) {
  const now = options.state.updatedAt || new Date().toISOString()

  await db.transaction(
    'rw',
    [db.messages, db.memories, db.conversationStates, db.conversationStateHistory, db.promptDebugTraces, db.conversations, db.characters],
    async () => {
      if (options.resetExisting) {
        await db.messages.where('conversationId').equals(options.conversationId).delete()
        await db.memories.where('conversationId').equals(options.conversationId).delete()
        await db.conversationStateHistory.where('conversationId').equals(options.conversationId).delete()
        await db.promptDebugTraces.where('conversationId').equals(options.conversationId).delete()
      }
      await db.conversationStates.put(options.state)
      await db.messages.add(options.message)
      await db.conversations.update(options.conversationId, {
        openingMode: 'greeting',
        greetingIndex: options.greetingIndex,
        updatedAt: now
      })
      await db.characters.update(options.characterId, {
        ...options.characterPatch,
        updatedAt: now
      })
    }
  )

  return { updatedAt: now }
}

/**
 * Explicitly switch a conversation to free opening. This is a story reset,
 * therefore all conversation-scoped memories are cleared; character/persona/
 * shared resource records are not touched.
 */
export async function switchConversationToFreeOpening(conversationId: string) {
  return resetConversationRuntime({
    conversationId,
    openingMode: 'free',
    greetingIndex: undefined,
    memoryPolicy: 'all'
  })
}
