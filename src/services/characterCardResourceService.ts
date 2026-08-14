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

function normalizedScope(binding: { scope?: string; characterId?: string }) {
  return binding.scope || (binding.characterId ? 'character' : 'global')
}

function normalizedScopeId(binding: { scopeId?: string; characterId?: string }) {
  return binding.scopeId || binding.characterId
}

/**
 * 用一份新角色卡替换该角色“由角色卡导入”的资源。
 *
 * V0.4.4.2 起，世界书 / Regex 是共享资源库资产，不属于任何角色。
 * 角色卡只提供“来源信息 + 默认绑定”。换卡只解除旧资源与当前角色的绑定，
 * 旧资源本体始终保留在共享资源库，是否删除由用户在资源库里明确决定。
 */
export async function replaceCharacterCardResources(input: ReplaceCharacterCardResourcesInput) {
  const now = new Date().toISOString()
  const importedResourceIds: string[] = []

  await db.transaction(
    'rw',
    [db.lorebooks, db.lorebookEntries, db.regexScripts, db.resourceBindings, db.communityResourceArchives],
    async () => {
      const allLorebooks = await db.lorebooks.toArray()
      const oldLorebooks = allLorebooks.filter(row =>
        row.sourceFormat === 'character-card' &&
        (row.sourceCharacterId === input.characterId || row.characterId === input.characterId)
      )

      for (const lorebook of oldLorebooks) {
        const sourceBindings = (await db.resourceBindings.where('resourceId').equals(lorebook.id).toArray())
          .filter(binding => normalizedScope(binding) === 'character' && normalizedScopeId(binding) === input.characterId)
        if (sourceBindings.length) await db.resourceBindings.bulkDelete(sourceBindings.map(binding => binding.id))
        await db.lorebooks.update(lorebook.id, {
          characterId: undefined,
          sourceCharacterId: undefined,
          sourceCharacterName: lorebook.sourceCharacterName || input.characterName,
          updatedAt: now
        })
        await db.lorebookEntries.where('lorebookId').equals(lorebook.id).modify({ characterId: undefined })
      }

      const allRegex = await db.regexScripts.toArray()
      const oldRegex = allRegex.filter(row =>
        row.sourceFormat === 'character-card' &&
        (row.sourceCharacterId === input.characterId || row.characterId === input.characterId)
      )
      for (const script of oldRegex) {
        const sourceBindings = (await db.resourceBindings.where('resourceId').equals(script.id).toArray())
          .filter(binding => normalizedScope(binding) === 'character' && normalizedScopeId(binding) === input.characterId)
        if (sourceBindings.length) await db.resourceBindings.bulkDelete(sourceBindings.map(binding => binding.id))
        await db.regexScripts.update(script.id, {
          characterId: undefined,
          sourceCharacterId: undefined,
          sourceCharacterName: script.sourceCharacterName || input.characterName,
          updatedAt: now
        })
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
          characterId: undefined,
          sourceCharacterId: input.characterId,
          sourceCharacterName: input.characterName,
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
          characterId: undefined,
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
          characterId: undefined,
          sourceCharacterId: input.characterId,
          sourceCharacterName: input.characterName,
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
              '内嵌世界书（共享资源库，可复用）',
              '内嵌 Regex（共享资源库，可复用）',
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
