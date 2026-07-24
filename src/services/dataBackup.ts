import { db } from '../db/database'

import type {
  Character,
  ContactGroup,
  Conversation,
  Message,
  UserProfile,
  World
} from '../types/domain'

export interface CompanionBackup {
  format: 'ai-companion-phone-backup'
  version: 1
  exportedAt: string

  data: {
    worlds: World[]
    characters: Character[]
    contactGroups: ContactGroup[]
    conversations: Conversation[]
    messages: Message[]
    userProfiles: UserProfile[]
  }
}

export interface BackupSummary {
  worlds: number
  characters: number
  contactGroups: number
  conversations: number
  messages: number
  userProfiles: number
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

export async function createBackup():
Promise<CompanionBackup> {
  const [
    worlds,
    characters,
    contactGroups,
    conversations,
    messages,
    userProfiles
  ] = await Promise.all([
    db.worlds.toArray(),
    db.characters.toArray(),
    db.contactGroups.toArray(),
    db.conversations.toArray(),
    db.messages.toArray(),
    db.userProfiles.toArray()
  ])

  return {
    format: 'ai-companion-phone-backup',
    version: 1,
    exportedAt: new Date().toISOString(),

    data: {
      worlds,
      characters,
      contactGroups,
      conversations,
      messages,
      userProfiles
    }
  }
}

export function getBackupSummary(
  backup: CompanionBackup
): BackupSummary {
  return {
    worlds: backup.data.worlds.length,
    characters: backup.data.characters.length,
    contactGroups:
      backup.data.contactGroups.length,
    conversations:
      backup.data.conversations.length,
    messages: backup.data.messages.length,
    userProfiles:
      backup.data.userProfiles.length
  }
}

function createFileTime() {
  const now = new Date()

  const pad = (value: number) =>
    String(value).padStart(2, '0')

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join('-') +
    '_' +
    [
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds())
    ].join('-')
}

export function downloadBackup(
  backup: CompanionBackup
) {
  const json = JSON.stringify(
    backup,
    null,
    2
  )

  const blob = new Blob(
    [json],
    {
      type: 'application/json;charset=utf-8'
    }
  )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url
  link.download =
    `ai-companion-backup_${createFileTime()}.json`

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export async function parseBackupFile(
  file: File
): Promise<CompanionBackup> {
  let parsed: unknown

  try {
    const text = await file.text()
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      '文件无法读取，请选择有效的 JSON 备份。'
    )
  }

  if (!isRecord(parsed)) {
    throw new Error('备份文件格式错误。')
  }

  if (
    parsed.format !==
    'ai-companion-phone-backup'
  ) {
    throw new Error(
      '这不是 AI Companion Phone 备份文件。'
    )
  }

  if (parsed.version !== 1) {
    throw new Error(
      '当前版本暂不支持此备份版本。'
    )
  }

  if (!isRecord(parsed.data)) {
    throw new Error(
      '备份文件缺少数据内容。'
    )
  }

  const requiredTables = [
    'worlds',
    'characters',
    'contactGroups',
    'conversations',
    'messages',
    'userProfiles'
  ]

  for (const table of requiredTables) {
    if (!Array.isArray(parsed.data[table])) {
      throw new Error(
        `备份文件中的 ${table} 数据无效。`
      )
    }
  }

  return parsed as unknown as CompanionBackup
}

export async function restoreBackup(
  backup: CompanionBackup
): Promise<void> {
  // Vue 的 ref 可能把备份对象变成响应式 Proxy。
  // IndexedDB 无法保存 Proxy，因此先转换为纯 JSON 对象。
  const plainBackup = JSON.parse(
    JSON.stringify(backup)
  ) as CompanionBackup

  await db.transaction(
    'rw',
    db.tables,
    async () => {
      // 按依赖顺序清空当前数据
      await db.messages.clear()
      await db.conversations.clear()
      await db.characters.clear()
      await db.contactGroups.clear()
      await db.userProfiles.clear()
      await db.worlds.clear()

      // 按依赖顺序恢复备份数据
      if (plainBackup.data.worlds.length > 0) {
        await db.worlds.bulkPut(
          plainBackup.data.worlds
        )
      }

      if (
        plainBackup.data.contactGroups.length > 0
      ) {
        await db.contactGroups.bulkPut(
          plainBackup.data.contactGroups
        )
      }

      if (
        plainBackup.data.characters.length > 0
      ) {
        await db.characters.bulkPut(
          plainBackup.data.characters
        )
      }

      if (
        plainBackup.data.conversations.length > 0
      ) {
        await db.conversations.bulkPut(
          plainBackup.data.conversations
        )
      }

      if (
        plainBackup.data.messages.length > 0
      ) {
        await db.messages.bulkPut(
          plainBackup.data.messages
        )
      }

      if (
        plainBackup.data.userProfiles.length > 0
      ) {
        await db.userProfiles.bulkPut(
          plainBackup.data.userProfiles
        )
      }
    }
  )
}