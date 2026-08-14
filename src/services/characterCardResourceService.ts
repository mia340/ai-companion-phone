import { db } from '../db/database'
import { toPlainStorageValue } from './storageSanitizer'
import type { ImportedCharacterCard } from './characterCardImportService'
import type { CommunityResourceArchive } from '../types/domain'

export interface ReplaceCharacterCardResourcesInput {
  characterId: string
  worldId: string
  characterName: string
  fileName: string
  imported: ImportedCharacterCard
}

/**
 * 用一份新导入的角色卡资源替换该角色之前“由角色卡导入”的资源。
 *
 * 只删除 sourceFormat=character-card / 对应角色卡 archive，绝不碰用户手工创建、
 * 全局共享或其它来源的世界书 / Regex / Preset。
 */
export async function replaceCharacterCardResources(input: ReplaceCharacterCardResourcesInput) {
  const now = new Date().toISOString()
  const importedResourceIds: string[] = []

  await db.transaction(
    'rw',
    [db.lorebooks, db.lorebookEntries, db.regexScripts, db.resourceBindings, db.communityResourceArchives],
    async () => {
      const oldLorebooks = (await db.lorebooks.where('characterId').equals(input.characterId).toArray())
        .filter(row => row.sourceFormat === 'character-card')
      for (const lorebook of oldLorebooks) {
        await db.lorebookEntries.where('lorebookId').equals(lorebook.id).delete()
        await db.resourceBindings.where('resourceId').equals(lorebook.id).delete()
        await db.lorebooks.delete(lorebook.id)
      }

      const oldRegex = (await db.regexScripts.where('characterId').equals(input.characterId).toArray())
        .filter(row => row.sourceFormat === 'character-card')
      for (const script of oldRegex) {
        await db.resourceBindings.where('resourceId').equals(script.id).delete()
        await db.regexScripts.delete(script.id)
      }

      const oldArchives = await db.communityResourceArchives
        .toCollection()
        .filter(row => row.kind === 'character-card' && row.characterId === input.characterId)
        .toArray()
      if (oldArchives.length) await db.communityResourceArchives.bulkDelete(oldArchives.map(row => row.id))

      if (input.imported.lorebookEntries.length) {
        const lorebookId = crypto.randomUUID()
        const sourceLorebook = input.imported.lorebookResource || {}
        await db.lorebooks.add(toPlainStorageValue({
          ...sourceLorebook,
          id: lorebookId,
          worldId: input.worldId,
          characterId: input.characterId,
          name: input.imported.lorebookName || sourceLorebook.name || `${input.characterName} · 角色卡世界书`,
          description: sourceLorebook.description,
          sourceFileName: input.fileName || sourceLorebook.sourceFileName || undefined,
          sourceFormat: 'character-card',
          recursiveScanning: sourceLorebook.recursiveScanning,
          createdAt: now,
          updatedAt: now
        }))
        await db.resourceBindings.add(toPlainStorageValue({
          id: crypto.randomUUID(),
          worldId: input.worldId,
          characterId: input.characterId,
          scope: 'character',
          scopeId: input.characterId,
          resourceType: 'lorebook',
          resourceId: lorebookId,
          enabled: true,
          order: 10,
          createdAt: now,
          updatedAt: now
        }))
        await db.lorebookEntries.bulkAdd(toPlainStorageValue(input.imported.lorebookEntries.map((entry, index) => ({
          id: crypto.randomUUID(),
          worldId: input.worldId,
          ...entry,
          characterId: input.characterId,
          lorebookId,
          priority: entry.priority ?? 50,
          insertionOrder: entry.insertionOrder ?? (100 - index),
          createdAt: now,
          updatedAt: now
        }))))
        importedResourceIds.push(lorebookId)
      }

      for (const [index, script] of input.imported.regexScripts.entries()) {
        const regexId = crypto.randomUUID()
        await db.regexScripts.add(toPlainStorageValue({
          ...script,
          id: regexId,
          worldId: input.worldId,
          characterId: input.characterId,
          sourceFileName: input.fileName || script.sourceFileName,
          sourceFormat: 'character-card',
          createdAt: now,
          updatedAt: now
        }))
        await db.resourceBindings.add(toPlainStorageValue({
          id: crypto.randomUUID(),
          worldId: input.worldId,
          characterId: input.characterId,
          scope: 'character',
          scopeId: input.characterId,
          resourceType: 'regex',
          resourceId: regexId,
          enabled: true,
          order: 20 + index,
          createdAt: now,
          updatedAt: now
        }))
        importedResourceIds.push(regexId)
      }

      if (input.imported.rawSourceJson?.trim()) {
        let rawJson: unknown
        try { rawJson = JSON.parse(input.imported.rawSourceJson) } catch { rawJson = undefined }
        const archive: CommunityResourceArchive = {
          id: crypto.randomUUID(),
          worldId: input.worldId,
          kind: 'character-card',
          characterId: input.characterId,
          name: input.characterName,
          fileName: input.fileName || `${input.characterName}.json`,
          mimeType: input.fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'application/json',
          sourceFormat: input.imported.format,
          rawText: input.imported.rawSourceJson,
          rawJson,
          importedResourceIds,
          compatibility: {
            format: input.imported.format,
            summary: [
              `角色卡字段已更新：${input.characterName}`,
              `内嵌世界书 ${input.imported.lorebookEntries.length} 条`,
              `内嵌正则 ${input.imported.regexScripts.length} 条`
            ],
            supported: [
              '原始角色卡字段',
              '原始 JSON/PNG metadata 归档',
              '内嵌世界书',
              '内嵌 Regex',
              '未知扩展字段保留'
            ],
            warnings: [...input.imported.notes]
          },
          createdAt: now,
          updatedAt: now
        }
        await db.communityResourceArchives.add(toPlainStorageValue(archive))
      }
    }
  )

  return importedResourceIds
}
