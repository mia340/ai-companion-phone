import { db } from '../db/database'
import { estimateDataUrlBytes } from './imageService'
import { getMessageImages } from './messageImageService'
import { assertBackupReferenceIntegrity, parseBackupEnvelope } from './backupValidation'

import type {
  Character,
  CharacterMemory,
  ChatSettings,
  ContactGroup,
  Conversation,
  ConversationState,
  ConversationStateHistory,
  Message,
  MessageImage,
  MomentComment,
  MomentPost,
  MusicState,
  UserProfile,
  UserPersona,
  LorebookEntry,
  LorebookResource,
  PromptPreset,
  RegexScript,
  ResourceBinding,
  CommunityResourceArchive,
  World,
  AppCustomization,
  CharacterSocialProfile
} from '../types/domain'


/**
 * Backup V9 旧字段兼容类型。V13 运行时不再创建/恢复本地关系积分数据。
 */
interface LegacyCharacterRelationship {
  id: string
  characterId: string
  intimacy: number
  trust: number
  familiarity: number
  stage: string
  emotion: string
  emotionReason: string
  lastInteractionAt: string
  lastProactiveAt: string
  chatDays: number
  musicCount: number
  updatedAt: string
}

interface LegacyRelationshipEvent {
  id: string
  characterId: string
  conversationId: string
  type: string
  title: string
  description: string
  createdAt: string
}

export interface CompanionBackup {
  format: 'ai-companion-phone-backup'
  version: 12
  exportedAt: string

  data: {
    worlds: World[]
    characters: Character[]
    contactGroups: ContactGroup[]
    conversations: Conversation[]
    messages: Message[]
    userProfiles: UserProfile[]
    chatSettings: ChatSettings[]
    memories: CharacterMemory[]
    conversationStates: ConversationState[]
    musicStates: MusicState[]
    relationships: LegacyCharacterRelationship[]
    relationshipEvents: LegacyRelationshipEvent[]
    personas: UserPersona[]
    lorebookEntries: LorebookEntry[]
    lorebooks: LorebookResource[]
    promptPresets: PromptPreset[]
    regexScripts: RegexScript[]
    resourceBindings: ResourceBinding[]
    communityResourceArchives: CommunityResourceArchive[]
    conversationStateHistory: ConversationStateHistory[]
    // Backup V10：朋友圈动态与评论。
    momentPosts: MomentPost[]
    momentComments: MomentComment[]
    appCustomizations: AppCustomization[]
    // Backup V12：每位角色的朋友圈权限与活跃度。
    socialProfiles: CharacterSocialProfile[]
  }
}

export interface BackupSummary {
  worlds: number
  characters: number
  contactGroups: number
  conversations: number
  messages: number
  userProfiles: number
  memories: number
  relationships: number
  relationshipEvents: number
  personas: number
  lorebookEntries: number
  lorebooks: number
  promptPresets: number
  regexScripts: number
  resourceBindings: number
  communityResourceArchives: number
  stateHistory: number
  momentPosts: number
  momentComments: number
  appCustomizations: number
  socialProfiles: number
  images: number
  imageBytes: number
}

export async function createBackup(options?: {
  includeImages?: boolean
}): Promise<CompanionBackup> {
  const [
    worlds,
    characters,
    contactGroups,
    conversations,
    messages,
    userProfiles,
    chatSettings,
    memories,
    conversationStates,
    musicStates,
    personas,
    lorebookEntries,
    lorebooks,
    promptPresets,
    regexScripts,
    resourceBindings,
    communityResourceArchives,
    conversationStateHistory,
    momentPosts,
    momentComments,
    appCustomizations,
    socialProfiles
  ] = await Promise.all([
    db.worlds.toArray(),
    db.characters.toArray(),
    db.contactGroups.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.userProfiles.toArray(),
    db.chatSettings.toArray(),
    db.memories.toArray(),
    db.conversationStates.toArray(),
    db.musicStates.toArray(),
    db.personas.toArray(),
    db.lorebookEntries.toArray(),
    db.lorebooks.toArray(),
    db.promptPresets.toArray(),
    db.regexScripts.toArray(),
    db.resourceBindings.toArray(),
    db.communityResourceArchives.toArray(),
    db.conversationStateHistory.toArray(),
    db.momentPosts.toArray(),
    db.momentComments.toArray(),
    db.appCustomizations.toArray(),
    db.socialProfiles.toArray()
  ])

  // Backup V9 兼容字段继续保留，但 V13 起不再有本地关系积分 stores。
  const relationships: LegacyCharacterRelationship[] = []
  const relationshipEvents: LegacyRelationshipEvent[] = []

  const includeImages = options?.includeImages ?? true
  const exportMessages = includeImages
    ? messages
    : messages.map((message: Message) => ({
      ...message,
      imageDataUrl: undefined,
      imageBytes: undefined,
      images: message.images?.map((image: MessageImage) => ({ ...image, dataUrl: undefined, bytes: undefined }))
    }))

  return {
    format: 'ai-companion-phone-backup',
    version: 12,
    exportedAt: new Date().toISOString(),
    data: {
      worlds,
      characters,
      contactGroups,
      conversations,
      messages: exportMessages,
      userProfiles,
      chatSettings,
      memories,
      conversationStates,
      musicStates,
      relationships,
      relationshipEvents,
      personas,
      lorebookEntries,
      lorebooks,
      promptPresets,
      regexScripts,
      resourceBindings,
      communityResourceArchives,
      conversationStateHistory,
      momentPosts,
      momentComments,
      appCustomizations,
      socialProfiles
    }
  }
}

export function getBackupSummary(
  backup: CompanionBackup
): BackupSummary {
  return {
    worlds: backup.data.worlds.length,
    characters: backup.data.characters.length,
    contactGroups: backup.data.contactGroups.length,
    conversations: backup.data.conversations.length,
    messages: backup.data.messages.length,
    userProfiles: backup.data.userProfiles.length,
    memories: backup.data.memories.length,
    relationships: backup.data.relationships.length,
    relationshipEvents: backup.data.relationshipEvents.length,
    personas: backup.data.personas.length,
    lorebookEntries: backup.data.lorebookEntries.length,
    lorebooks: backup.data.lorebooks.length,
    promptPresets: backup.data.promptPresets.length,
    regexScripts: backup.data.regexScripts.length,
    resourceBindings: backup.data.resourceBindings.length,
    communityResourceArchives: backup.data.communityResourceArchives.length,
    stateHistory: backup.data.conversationStateHistory.length,
    momentPosts: backup.data.momentPosts.length,
    momentComments: backup.data.momentComments.length,
    appCustomizations: backup.data.appCustomizations.length,
    socialProfiles: backup.data.socialProfiles.length,
    images: backup.data.messages.reduce(
      (total, message) => total + getMessageImages(message).filter(image => Boolean(image.dataUrl)).length,
      0
    ),
    imageBytes: backup.data.messages.reduce((total, message) => total + getMessageImages(message).reduce((sum, image) => {
      if (!image.dataUrl) return sum
      return sum + (image.bytes || estimateDataUrlBytes(image.dataUrl))
    }, 0), 0)
  }
}

function createFileTime() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-') + '_' + [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('-')
}

export function downloadBackup(backup: CompanionBackup) {
  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json;charset=utf-8' }
  )

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `ai-companion-backup_${createFileTime()}.json`

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * The Zod envelope deliberately validates stable identity/reference fields and keeps
 * historical/domain-specific payload fields in passthrough mode. Crossing from that
 * validated transport shape into our current domain arrays is therefore an explicit
 * trust boundary rather than a claim that Zod has reconstructed every current field.
 *
 * Full compatibility normalization still happens in restoreBackup() before the
 * destructive transaction, followed by assertBackupReferenceIntegrity().
 */
function asValidatedDomainRows<T>(rows: unknown[]): T[] {
  return rows as T[]
}

export async function parseBackupFile(
  file: File
): Promise<CompanionBackup> {
  let parsed: unknown

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('文件无法读取，请选择有效的 JSON 备份。')
  }

  const envelope = parseBackupEnvelope(parsed)
  const data = envelope.data

  return {
    format: 'ai-companion-phone-backup',
    version: 12,
    exportedAt: envelope.exportedAt || new Date().toISOString(),
    data: {
      worlds: asValidatedDomainRows<World>(data.worlds),
      characters: asValidatedDomainRows<Character>(data.characters),
      contactGroups: asValidatedDomainRows<ContactGroup>(data.contactGroups),
      conversations: asValidatedDomainRows<Conversation>(data.conversations),
      messages: asValidatedDomainRows<Message>(data.messages),
      userProfiles: asValidatedDomainRows<UserProfile>(data.userProfiles),
      chatSettings: asValidatedDomainRows<ChatSettings>(data.chatSettings),
      memories: asValidatedDomainRows<CharacterMemory>(data.memories),
      conversationStates: asValidatedDomainRows<ConversationState>(data.conversationStates),
      musicStates: asValidatedDomainRows<MusicState>(data.musicStates),
      relationships: asValidatedDomainRows<LegacyCharacterRelationship>(data.relationships),
      relationshipEvents: asValidatedDomainRows<LegacyRelationshipEvent>(data.relationshipEvents),
      personas: asValidatedDomainRows<UserPersona>(data.personas),
      lorebookEntries: asValidatedDomainRows<LorebookEntry>(data.lorebookEntries),
      lorebooks: asValidatedDomainRows<LorebookResource>(data.lorebooks),
      promptPresets: asValidatedDomainRows<PromptPreset>(data.promptPresets),
      regexScripts: asValidatedDomainRows<RegexScript>(data.regexScripts),
      resourceBindings: asValidatedDomainRows<ResourceBinding>(data.resourceBindings),
      communityResourceArchives: asValidatedDomainRows<CommunityResourceArchive>(data.communityResourceArchives),
      conversationStateHistory: asValidatedDomainRows<ConversationStateHistory>(data.conversationStateHistory),
      momentPosts: asValidatedDomainRows<MomentPost>(data.momentPosts),
      momentComments: asValidatedDomainRows<MomentComment>(data.momentComments),
      appCustomizations: asValidatedDomainRows<AppCustomization>(data.appCustomizations),
      socialProfiles: asValidatedDomainRows<CharacterSocialProfile>(data.socialProfiles)
    }
  }
}

export async function restoreBackup(
  backup: CompanionBackup
): Promise<void> {
  const plainBackup = JSON.parse(
    JSON.stringify(backup)
  ) as CompanionBackup

  // V9 及更早备份不含朋友圈数据；兜底成空数组再统一写回。
  plainBackup.data.momentPosts = plainBackup.data.momentPosts || []
  plainBackup.data.momentComments = plainBackup.data.momentComments || []
  plainBackup.data.socialProfiles = plainBackup.data.socialProfiles || []

  // Backup V9 仍能读取旧结构，但恢复到 V0.4.4.2 时立即按 V14 规则归一：
  // 通讯录不再恢复分组；世界书 / Regex 变成共享资源本体，角色使用关系只通过 ResourceBinding 表达。
  plainBackup.data.contactGroups = []
  plainBackup.data.characters = plainBackup.data.characters.map(character => {
    const next = { ...character, groups: [] }
    const description = next.cardDescription?.trim() || ''
    const personality = next.cardPersonality?.trim() || ''
    const persona = next.persona?.trim() || ''
    const parts = [description].filter(Boolean)
    if (personality && !parts.some(item => item === personality || item.includes(personality))) parts.push(personality)
    const combined = parts.join('\n\n')
    if (combined && (!persona || persona === description || persona === personality)) next.persona = combined
    return next
  })
  const characterMap = new Map(plainBackup.data.characters.map(character => [character.id, character]))
  const bindingKeys = new Set(plainBackup.data.resourceBindings.map(binding => {
    const scope = binding.scope || (binding.characterId ? 'character' : 'global')
    const scopeId = binding.scopeId || binding.characterId || ''
    return `${binding.resourceType}|${binding.resourceId}|${scope}|${scopeId}`
  }))
  const ensureBinding = (input: {
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
    const now = new Date().toISOString()
    plainBackup.data.resourceBindings.push({
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

  for (const lorebook of plainBackup.data.lorebooks) {
    const legacyCharacterId = lorebook.characterId
    if (!legacyCharacterId) continue
    const sourceCharacter = characterMap.get(legacyCharacterId)
    lorebook.sourceCharacterId = lorebook.sourceCharacterId || (sourceCharacter ? legacyCharacterId : undefined)
    lorebook.sourceCharacterName = lorebook.sourceCharacterName || sourceCharacter?.name
    lorebook.characterId = undefined
    if (sourceCharacter) ensureBinding({
      worldId: lorebook.worldId || sourceCharacter.worldId,
      characterId: legacyCharacterId,
      scope: 'character',
      resourceType: 'lorebook',
      resourceId: lorebook.id
    })
  }

  for (const entry of plainBackup.data.lorebookEntries) {
    if (entry.lorebookId) entry.characterId = undefined
  }
  const looseEntries = plainBackup.data.lorebookEntries.filter(entry => !entry.lorebookId)
  const looseGroups = new Map<string, LorebookEntry[]>()
  for (const entry of looseEntries) {
    const key = entry.characterId || '__global__'
    const rows = looseGroups.get(key) || []
    rows.push(entry)
    looseGroups.set(key, rows)
  }
  for (const [key, rows] of looseGroups) {
    if (!rows.length) continue
    const sourceCharacter = key === '__global__' ? undefined : characterMap.get(key)
    const now = new Date().toISOString()
    const lorebookId = crypto.randomUUID()
    const worldId = rows[0]?.worldId || sourceCharacter?.worldId || 'world-default'
    plainBackup.data.lorebooks.push({
      id: lorebookId,
      worldId,
      name: sourceCharacter ? `${sourceCharacter.name} · 历史世界书` : '历史全局世界书',
      description: '由旧备份散落世界书条目自动整理；现在是可复用的共享资源。',
      sourceCharacterId: sourceCharacter ? key : undefined,
      sourceCharacterName: sourceCharacter?.name,
      sourceFormat: 'legacy',
      createdAt: now,
      updatedAt: now
    })
    for (const entry of rows) {
      entry.lorebookId = lorebookId
      entry.characterId = undefined
      entry.updatedAt = now
    }
    if (sourceCharacter) ensureBinding({ worldId, characterId: key, scope: 'character', resourceType: 'lorebook', resourceId: lorebookId })
    else ensureBinding({ worldId, scope: 'global', resourceType: 'lorebook', resourceId: lorebookId })
  }

  for (const script of plainBackup.data.regexScripts) {
    const legacyCharacterId = script.characterId
    if (!legacyCharacterId) continue
    const sourceCharacter = characterMap.get(legacyCharacterId)
    script.sourceCharacterId = script.sourceCharacterId || (sourceCharacter ? legacyCharacterId : undefined)
    script.sourceCharacterName = script.sourceCharacterName || sourceCharacter?.name
    script.characterId = undefined
    if (sourceCharacter) ensureBinding({
      worldId: script.worldId || sourceCharacter.worldId,
      characterId: legacyCharacterId,
      scope: 'character',
      resourceType: 'regex',
      resourceId: script.id
    })
  }

  // 所有历史迁移完成后先做引用完整性检查；失败时尚未触碰本地数据库。
  assertBackupReferenceIntegrity(plainBackup)

  await db.transaction('rw', db.tables, async () => {
    await db.messages.clear()
    await db.conversations.clear()
    await db.characters.clear()
    await db.contactGroups.clear()
    await db.userProfiles.clear()
    await db.worlds.clear()
    await db.chatSettings.clear()
    await db.memories.clear()
    await db.conversationStates.clear()
    await db.musicStates.clear()
    await db.personas.clear()
    await db.lorebookEntries.clear()
    await db.lorebooks.clear()
    await db.promptPresets.clear()
    await db.regexScripts.clear()
    await db.resourceBindings.clear()
    await db.communityResourceArchives.clear()
    await db.conversationStateHistory.clear()
    await db.momentPosts.clear()
    await db.momentComments.clear()
    // Social Runtime 队列是可重建的运行时调度元数据，不进入备份；恢复备份时必须清空旧队列。
    await db.socialActivities.clear()
    await db.socialNotifications.clear()
    await db.socialProfiles.clear()
    await db.appCustomizations.clear()
    await db.promptDebugTraces.clear()

    if (plainBackup.data.worlds.length) {
      await db.worlds.bulkPut(plainBackup.data.worlds)
    }
    if (plainBackup.data.characters.length) {
      await db.characters.bulkPut(plainBackup.data.characters)
    }
    if (plainBackup.data.conversations.length) {
      await db.conversations.bulkPut(plainBackup.data.conversations)
    }
    if (plainBackup.data.messages.length) {
      await db.messages.bulkPut(plainBackup.data.messages)
    }
    if (plainBackup.data.userProfiles.length) {
      await db.userProfiles.bulkPut(plainBackup.data.userProfiles)
    }
    if (plainBackup.data.chatSettings.length) {
      await db.chatSettings.bulkPut(plainBackup.data.chatSettings)
    }
    if (plainBackup.data.memories.length) {
      await db.memories.bulkPut(plainBackup.data.memories)
    }
    if (plainBackup.data.conversationStates.length) {
      await db.conversationStates.bulkPut(plainBackup.data.conversationStates)
    }
    if (plainBackup.data.musicStates.length) {
      await db.musicStates.bulkPut(plainBackup.data.musicStates)
    }
    // 旧备份中的 relationships / relationshipEvents 仅为历史兼容数据，
    // V13 起不再恢复，避免本地关系积分重新污染角色行为。
    if (plainBackup.data.personas.length) {
      await db.personas.bulkPut(plainBackup.data.personas)
    }
    if (plainBackup.data.lorebookEntries.length) {
      await db.lorebookEntries.bulkPut(plainBackup.data.lorebookEntries)
    }
    if (plainBackup.data.lorebooks.length) await db.lorebooks.bulkPut(plainBackup.data.lorebooks)
    if (plainBackup.data.promptPresets.length) await db.promptPresets.bulkPut(plainBackup.data.promptPresets)
    if (plainBackup.data.regexScripts.length) await db.regexScripts.bulkPut(plainBackup.data.regexScripts)
    if (plainBackup.data.resourceBindings.length) await db.resourceBindings.bulkPut(plainBackup.data.resourceBindings)
    if (plainBackup.data.communityResourceArchives.length) await db.communityResourceArchives.bulkPut(plainBackup.data.communityResourceArchives)
    if (plainBackup.data.conversationStateHistory.length) {
      await db.conversationStateHistory.bulkPut(plainBackup.data.conversationStateHistory)
    }
    if (plainBackup.data.momentPosts.length) {
      await db.momentPosts.bulkPut(plainBackup.data.momentPosts)
    }
    if (plainBackup.data.momentComments.length) {
      await db.momentComments.bulkPut(plainBackup.data.momentComments)
    }
    if (plainBackup.data.appCustomizations.length) {
      await db.appCustomizations.bulkPut(plainBackup.data.appCustomizations)
    }
    if (plainBackup.data.socialProfiles.length) {
      await db.socialProfiles.bulkPut(plainBackup.data.socialProfiles)
    }
  })
}
