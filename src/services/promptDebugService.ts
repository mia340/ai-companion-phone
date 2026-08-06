import { db } from '../db/database'
import type { PromptDebugTrace } from '../types/domain'

const MAX_TRACES_PER_CONVERSATION = 20

export async function savePromptDebugTrace(
  input: Omit<PromptDebugTrace, 'id' | 'createdAt'> &
    Partial<Pick<PromptDebugTrace, 'id' | 'createdAt'>>
): Promise<PromptDebugTrace> {
  const trace: PromptDebugTrace = {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString()
  }

  await db.promptDebugTraces.put(trace)

  const rows = await db.promptDebugTraces
    .where('conversationId')
    .equals(trace.conversationId)
    .sortBy('createdAt')
  const overflow = rows.length - MAX_TRACES_PER_CONVERSATION
  if (overflow > 0) {
    await db.promptDebugTraces.bulkDelete(
      rows.slice(0, overflow).map(item => item.id)
    )
  }

  return trace
}

export async function patchPromptDebugTrace(
  id: string,
  patch: Partial<PromptDebugTrace>
) {
  await db.promptDebugTraces.update(id, patch)
}

export async function listPromptDebugTraces(conversationId: string) {
  const rows = await db.promptDebugTraces
    .where('conversationId')
    .equals(conversationId)
    .toArray()

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function clearPromptDebugTraces(conversationId: string) {
  await db.promptDebugTraces
    .where('conversationId')
    .equals(conversationId)
    .delete()
}

export function estimatePromptCharacters(
  systemPrompt: string,
  messages: Array<{ content: string }>
) {
  return systemPrompt.length + messages.reduce(
    (total, item) => total + item.content.length,
    0
  )
}
