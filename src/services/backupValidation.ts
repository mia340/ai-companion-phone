import { z } from 'zod'
import type { CompanionBackup } from './dataBackup'

const id = z.string().min(1)
const looseRecord = z.object({ id }).passthrough()
const worldSchema = z.object({ id, name: z.string() }).passthrough()
const characterSchema = z.object({ id, worldId: id, name: z.string() }).passthrough()
const conversationSchema = z.object({ id, worldId: id, memberIds: z.array(id) }).passthrough()
const messageSchema = z.object({ id, conversationId: id, senderId: z.string(), content: z.string() }).passthrough()
const userProfileSchema = z.object({ id }).passthrough()

const optionalRows = () => z.array(looseRecord).optional().default([])

/**
 * Backup V12 envelope validation. We intentionally validate the durable envelope and
 * stable identity/reference fields instead of duplicating every domain field here.
 * Domain migrations still own historical field normalization.
 */
export const companionBackupEnvelopeSchema = z.object({
  format: z.literal('ai-companion-phone-backup'),
  version: z.number().int().min(1).max(12),
  exportedAt: z.string().optional(),
  data: z.object({
    worlds: z.array(worldSchema),
    characters: z.array(characterSchema),
    contactGroups: z.array(looseRecord),
    conversations: z.array(conversationSchema),
    messages: z.array(messageSchema),
    userProfiles: z.array(userProfileSchema),
    chatSettings: optionalRows(),
    memories: optionalRows(),
    conversationStates: optionalRows(),
    musicStates: optionalRows(),
    relationships: optionalRows(),
    relationshipEvents: optionalRows(),
    personas: optionalRows(),
    lorebookEntries: optionalRows(),
    lorebooks: optionalRows(),
    promptPresets: optionalRows(),
    regexScripts: optionalRows(),
    resourceBindings: optionalRows(),
    communityResourceArchives: optionalRows(),
    conversationStateHistory: optionalRows(),
    momentPosts: optionalRows(),
    momentComments: optionalRows(),
    appCustomizations: optionalRows(),
    socialProfiles: optionalRows()
  }).passthrough()
}).passthrough()

export function parseBackupEnvelope(value: unknown) {
  const parsed = companionBackupEnvelopeSchema.safeParse(value)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path?.length ? first.path.join('.') : 'root'
    throw new Error(`备份结构校验失败：${where} ${first?.message || '数据无效'}`)
  }
  return parsed.data
}

function duplicateIds(rows: Array<{ id: string }>, label: string, errors: string[]) {
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.id)) errors.push(`${label} 存在重复 id：${row.id}`)
    seen.add(row.id)
  }
  return seen
}

/**
 * Restore preflight. Must run before the Dexie clearing transaction so a broken backup
 * cannot partially replace local data. Historical migrations should run first.
 */
export function assertBackupReferenceIntegrity(backup: CompanionBackup) {
  const data = backup.data
  const errors: string[] = []

  const worldIds = duplicateIds(data.worlds, 'worlds', errors)
  const characterIds = duplicateIds(data.characters, 'characters', errors)
  duplicateIds(data.contactGroups, 'contactGroups', errors)
  const conversationIds = duplicateIds(data.conversations, 'conversations', errors)
  const messageIds = duplicateIds(data.messages, 'messages', errors)
  const personaIds = duplicateIds(data.personas, 'personas', errors)
  const memoryIds = duplicateIds(data.memories, 'memories', errors)
  const lorebookIds = duplicateIds(data.lorebooks, 'lorebooks', errors)
  duplicateIds(data.lorebookEntries, 'lorebookEntries', errors)
  const presetIds = duplicateIds(data.promptPresets, 'promptPresets', errors)
  const regexIds = duplicateIds(data.regexScripts, 'regexScripts', errors)
  duplicateIds(data.resourceBindings, 'resourceBindings', errors)
  duplicateIds(data.communityResourceArchives, 'communityResourceArchives', errors)
  duplicateIds(data.conversationStateHistory, 'conversationStateHistory', errors)
  const momentIds = duplicateIds(data.momentPosts, 'momentPosts', errors)
  const commentIds = duplicateIds(data.momentComments, 'momentComments', errors)
  duplicateIds(data.appCustomizations, 'appCustomizations', errors)
  duplicateIds(data.socialProfiles, 'socialProfiles', errors)

  const requireWorld = (worldId: string | undefined, label: string) => {
    if (worldId && !worldIds.has(worldId)) errors.push(`${label} 引用了不存在的 worldId：${worldId}`)
  }
  const requireCharacter = (characterId: string | undefined, label: string) => {
    if (characterId && !characterIds.has(characterId)) errors.push(`${label} 引用了不存在的角色：${characterId}`)
  }
  const requireConversation = (conversationId: string | undefined, label: string) => {
    if (conversationId && !conversationIds.has(conversationId)) errors.push(`${label} 引用了不存在的会话：${conversationId}`)
  }

  for (const character of data.characters) requireWorld(character.worldId, `角色 ${character.id}`)
  for (const group of data.contactGroups) requireWorld(group.worldId, `联系人分组 ${group.id}`)

  for (const conversation of data.conversations) {
    requireWorld(conversation.worldId, `会话 ${conversation.id}`)
    for (const memberId of conversation.memberIds || []) requireCharacter(memberId, `会话 ${conversation.id}`)
  }

  for (const message of data.messages) {
    requireConversation(message.conversationId, `消息 ${message.id}`)
    if (message.senderId && message.senderId !== 'user') requireCharacter(message.senderId, `消息 ${message.id}`)
    if (message.replyTo?.messageId && !messageIds.has(message.replyTo.messageId)) errors.push(`消息 ${message.id} 回复了不存在的消息：${message.replyTo.messageId}`)
  }

  for (const persona of data.personas) {
    if (persona.boundCharacterId) requireCharacter(persona.boundCharacterId, `Persona ${persona.id}`)
  }

  for (const memory of data.memories) {
    requireCharacter(memory.characterId, `记忆 ${memory.id}`)
    requireConversation(memory.conversationId, `记忆 ${memory.id}`)
    if (memory.sourceMessageId && !messageIds.has(memory.sourceMessageId)) errors.push(`记忆 ${memory.id} 引用了不存在的 sourceMessageId：${memory.sourceMessageId}`)
    for (const mergedId of memory.mergedFrom || []) if (!memoryIds.has(mergedId)) errors.push(`记忆 ${memory.id} mergedFrom 引用了不存在的记忆：${mergedId}`)
    for (const conflictId of memory.conflictWith || []) if (!memoryIds.has(conflictId)) errors.push(`记忆 ${memory.id} conflictWith 引用了不存在的记忆：${conflictId}`)
  }

  for (const state of data.conversationStates) {
    if (!conversationIds.has(state.id)) errors.push(`会话状态 ${state.id} 找不到对应会话。`)
  }

  for (const row of data.conversationStateHistory) {
    requireConversation(row.conversationId, `状态历史 ${row.id}`)
    requireCharacter(row.characterId, `状态历史 ${row.id}`)
    if (row.sourceMessageId && !messageIds.has(row.sourceMessageId)) errors.push(`状态历史 ${row.id} 引用了不存在的消息：${row.sourceMessageId}`)
  }

  for (const lorebook of data.lorebooks) {
    requireWorld(lorebook.worldId, `世界书 ${lorebook.id}`)
    requireCharacter(lorebook.characterId, `世界书 ${lorebook.id}`)
    requireCharacter(lorebook.sourceCharacterId, `世界书 ${lorebook.id}`)
  }

  for (const entry of data.lorebookEntries) {
    requireWorld(entry.worldId, `世界书条目 ${entry.id}`)
    requireCharacter(entry.characterId, `世界书条目 ${entry.id}`)
    if (entry.lorebookId && !lorebookIds.has(entry.lorebookId)) errors.push(`世界书条目 ${entry.id} 引用了不存在的 lorebookId：${entry.lorebookId}`)
  }

  for (const preset of data.promptPresets) requireWorld(preset.worldId, `Prompt Preset ${preset.id}`)
  for (const script of data.regexScripts) {
    requireWorld(script.worldId, `Regex ${script.id}`)
    requireCharacter(script.characterId, `Regex ${script.id}`)
    requireCharacter(script.sourceCharacterId, `Regex ${script.id}`)
  }

  const resourceExists = (type: string, resourceId: string) => {
    if (type === 'lorebook') return lorebookIds.has(resourceId)
    if (type === 'regex') return regexIds.has(resourceId)
    if (type === 'preset') return presetIds.has(resourceId)
    return false
  }

  for (const binding of data.resourceBindings) {
    requireWorld(binding.worldId, `资源绑定 ${binding.id}`)
    requireCharacter(binding.characterId, `资源绑定 ${binding.id}`)
    if (binding.scope === 'character') requireCharacter(binding.scopeId, `资源绑定 ${binding.id}`)
    if (binding.scope === 'conversation') requireConversation(binding.scopeId, `资源绑定 ${binding.id}`)
    if (binding.scope === 'persona' && binding.scopeId && !personaIds.has(binding.scopeId)) errors.push(`资源绑定 ${binding.id} 引用了不存在的 Persona：${binding.scopeId}`)
    if (!resourceExists(binding.resourceType, binding.resourceId)) errors.push(`资源绑定 ${binding.id} 引用了不存在的 ${binding.resourceType}：${binding.resourceId}`)
  }

  for (const archive of data.communityResourceArchives) {
    requireWorld(archive.worldId, `资源归档 ${archive.id}`)
    requireCharacter(archive.characterId, `资源归档 ${archive.id}`)
    for (const importedId of archive.importedResourceIds || []) {
      if (!lorebookIds.has(importedId) && !regexIds.has(importedId) && !presetIds.has(importedId) && !characterIds.has(importedId) && !personaIds.has(importedId)) {
        errors.push(`资源归档 ${archive.id} importedResourceIds 引用了不存在的资源：${importedId}`)
      }
    }
  }

  for (const post of data.momentPosts) {
    requireWorld(post.worldId, `朋友圈动态 ${post.id}`)
    if (post.authorType === 'character') requireCharacter(post.authorId, `朋友圈动态 ${post.id}`)
    if (post.conversationId) requireConversation(post.conversationId, `朋友圈动态 ${post.id}`)
  }

  for (const comment of data.momentComments) {
    requireWorld(comment.worldId, `朋友圈评论 ${comment.id}`)
    if (!momentIds.has(comment.momentId)) errors.push(`朋友圈评论 ${comment.id} 引用了不存在的动态：${comment.momentId}`)
    if (comment.authorType === 'character') requireCharacter(comment.authorId, `朋友圈评论 ${comment.id}`)
    if (comment.replyToCommentId && !commentIds.has(comment.replyToCommentId)) errors.push(`朋友圈评论 ${comment.id} 回复了不存在的评论：${comment.replyToCommentId}`)
  }

  for (const customization of data.appCustomizations) {
    requireWorld(customization.worldId, `App 自定义 ${customization.id}`)
    for (const characterId of customization.spaceBlacklistCharacterIds || []) requireCharacter(characterId, `App 自定义 ${customization.id}`)
  }

  for (const profile of data.socialProfiles) {
    requireWorld(profile.worldId, `社交档案 ${profile.id}`)
    requireCharacter(profile.characterId, `社交档案 ${profile.id}`)
  }


  if (errors.length) {
    const preview = errors.slice(0, 12).join('；')
    throw new Error(`备份引用完整性校验失败（${errors.length} 项）：${preview}${errors.length > 12 ? '……' : ''}`)
  }
}

