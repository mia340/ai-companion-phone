import { db } from '../db/database'
import { estimateDataUrlBytes } from './imageService'
import { getMessageImages } from './messageImageService'

import type {
  Character,
  CharacterMemory,
  CharacterRelationship,
  ChatSettings,
  ContactGroup,
  Conversation,
  ConversationState,
  Message,
  MessageImage,
  MusicState,
  RelationshipEvent,
  UserProfile,
  UserPersona,
  LorebookEntry,
  World
} from '../types/domain'

export interface CompanionBackup {
  format: 'ai-companion-phone-backup'
  version: 6
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
    personas: UserPersona[]
    lorebookEntries: LorebookEntry[]
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
  images: number
  imageBytes: number
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
    relationships,
    relationshipEvents,
    personas,
    lorebookEntries
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
    db.relationshipEvents.toArray(),
    db.personas.toArray(),
    db.lorebookEntries.toArray()
  ])

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
    version: 6,
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
      lorebookEntries
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

  if (![1, 2, 3, 4, 5, 6].includes(Number(parsed.version))) {
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
    version: 6,
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
      relationshipEvents: optionalArray('relationshipEvents') as RelationshipEvent[],
      personas: optionalArray('personas') as UserPersona[],
      lorebookEntries: optionalArray('lorebookEntries') as LorebookEntry[]
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
    await db.personas.clear()
    await db.lorebookEntries.clear()
    await db.promptDebugTraces.clear()

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
    if (plainBackup.data.personas.length) {
      await db.personas.bulkPut(plainBackup.data.personas)
    }
    if (plainBackup.data.lorebookEntries.length) {
      await db.lorebookEntries.bulkPut(plainBackup.data.lorebookEntries)
    }
  })
}
