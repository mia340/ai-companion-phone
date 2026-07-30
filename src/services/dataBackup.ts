import { db } from '../db/database'

import type {
  Character,
  CharacterMemory,
  CharacterRelationship,
  ChatSettings,
  ContactGroup,
  Conversation,
  ConversationState,
  Message,
  MusicState,
  RelationshipEvent,
  UserProfile,
  World
} from '../types/domain'

export interface CompanionBackup {
  format: 'ai-companion-phone-backup'
  version: 3
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
    relationships: CharacterRelationship[]
    relationshipEvents: RelationshipEvent[]
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
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

export async function createBackup(): Promise<CompanionBackup> {
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
    relationships,
    relationshipEvents
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
    db.relationships.toArray(),
    db.relationshipEvents.toArray()
  ])

  return {
    format: 'ai-companion-phone-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
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
      relationships,
      relationshipEvents
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
    relationshipEvents: backup.data.relationshipEvents.length
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

export async function parseBackupFile(
  file: File
): Promise<CompanionBackup> {
  let parsed: unknown

  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('文件无法读取，请选择有效的 JSON 备份。')
  }

  if (!isRecord(parsed)) {
    throw new Error('备份文件格式错误。')
  }

  if (parsed.format !== 'ai-companion-phone-backup') {
    throw new Error('这不是 AI Companion Phone 备份文件。')
  }

  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) {
    throw new Error('当前版本暂不支持此备份版本。')
  }

  if (!isRecord(parsed.data)) {
    throw new Error('备份文件缺少数据内容。')
  }

  const data = parsed.data
  const requiredTables = [
    'worlds',
    'characters',
    'contactGroups',
    'conversations',
    'messages',
    'userProfiles'
  ]

  for (const table of requiredTables) {
    if (!Array.isArray(data[table])) {
      throw new Error(`备份文件中的 ${table} 数据无效。`)
    }
  }

  const optionalArray = (name: string) =>
    Array.isArray(data[name]) ? data[name] : []

  return {
    format: 'ai-companion-phone-backup',
    version: 3,
    exportedAt:
      typeof parsed.exportedAt === 'string'
        ? parsed.exportedAt
        : new Date().toISOString(),
    data: {
      worlds: data.worlds as World[],
      characters: data.characters as Character[],
      contactGroups: data.contactGroups as ContactGroup[],
      conversations: data.conversations as Conversation[],
      messages: data.messages as Message[],
      userProfiles: data.userProfiles as UserProfile[],
      chatSettings: optionalArray('chatSettings') as ChatSettings[],
      memories: optionalArray('memories') as CharacterMemory[],
      conversationStates: optionalArray('conversationStates') as ConversationState[],
      musicStates: optionalArray('musicStates') as MusicState[],
      relationships: optionalArray('relationships') as CharacterRelationship[],
      relationshipEvents: optionalArray('relationshipEvents') as RelationshipEvent[]
    }
  }
}

export async function restoreBackup(
  backup: CompanionBackup
): Promise<void> {
  const plainBackup = JSON.parse(
    JSON.stringify(backup)
  ) as CompanionBackup

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
    await db.relationships.clear()
    await db.relationshipEvents.clear()

    if (plainBackup.data.worlds.length) {
      await db.worlds.bulkPut(plainBackup.data.worlds)
    }
    if (plainBackup.data.contactGroups.length) {
      await db.contactGroups.bulkPut(plainBackup.data.contactGroups)
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
    if (plainBackup.data.relationships.length) {
      await db.relationships.bulkPut(plainBackup.data.relationships)
    }
    if (plainBackup.data.relationshipEvents.length) {
      await db.relationshipEvents.bulkPut(plainBackup.data.relationshipEvents)
    }
  })
}
