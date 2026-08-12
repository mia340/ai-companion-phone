import { db } from '../db/database'
import { removeResourceBindingsForResource, setResourceBinding } from './resourceBindingService'
import { inspectCommunityResourceJson, parseCommunityResourceJson, parseLorebookJson, parsePromptPresetJson, parseRegexJson, extractJsonFilesFromZip, type ResourceCompatibilityReport } from './resourceImportService'
import { saveLorebook, saveLorebookEntry } from './lorebookService'
import type { CommunityResourceArchive, PromptPreset, RegexScript, ResourceType } from '../types/domain'

export type ImportedCommunityResource =
  | { type: 'lorebook'; id: string; name: string; report: ResourceCompatibilityReport; archiveId?: string }
  | { type: 'preset'; id: string; name: string; report: ResourceCompatibilityReport; archiveId?: string }
  | { type: 'regex'; ids: string[]; name: string; report: ResourceCompatibilityReport; archiveId?: string }
  | { type: 'archive'; archiveId: string; name: string; report: ResourceCompatibilityReport }


function safeParseJson(text: string): unknown {
  try { return JSON.parse(text) as unknown } catch { return undefined }
}

async function saveArchive(options: {
  worldId: string
  fileName: string
  mimeType?: string
  rawText?: string
  report: ResourceCompatibilityReport
  importedResourceIds: string[]
}): Promise<CommunityResourceArchive> {
  const now = new Date().toISOString()
  const row: CommunityResourceArchive = {
    id: crypto.randomUUID(),
    worldId: options.worldId,
    kind: options.report.kind,
    name: options.report.name,
    fileName: options.fileName,
    mimeType: options.mimeType,
    sourceFormat: options.report.format,
    rawText: options.rawText,
    rawJson: options.rawText ? safeParseJson(options.rawText) : undefined,
    importedResourceIds: [...options.importedResourceIds],
    compatibility: {
      format: options.report.format,
      summary: [...options.report.summary],
      supported: [...options.report.supported],
      warnings: [...options.report.warnings]
    },
    createdAt: now,
    updatedAt: now
  }
  await db.communityResourceArchives.put(row)
  return row
}

export async function listCommunityResourceArchives(worldId: string) {
  return (await db.communityResourceArchives.where('worldId').equals(worldId).toArray())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function deleteCommunityResourceArchive(id: string) {
  await db.communityResourceArchives.delete(id)
}

export async function importLorebookText(options: { text: string; fileName: string; worldId: string; characterId?: string; autoBind?: boolean }) {
  const parsed = parseLorebookJson(options.text, options.fileName)
  const book = await saveLorebook({ ...parsed.lorebook, worldId: options.worldId, characterId: options.characterId })
  for (const entry of parsed.entries) {
    await saveLorebookEntry({ ...entry, worldId: options.worldId, lorebookId: book.id, characterId: options.characterId })
  }
  if (options.characterId && options.autoBind !== false) {
    await setResourceBinding({ worldId: options.worldId, characterId: options.characterId, resourceType: 'lorebook', resourceId: book.id, enabled: true })
  }
  return { type: 'lorebook' as const, id: book.id, name: book.name, report: parsed.report }
}

export async function savePromptPresetResource(input: Omit<PromptPreset, 'id' | 'worldId' | 'createdAt' | 'updatedAt'> & { worldId: string }) {
  const now = new Date().toISOString()
  const row: PromptPreset = { ...input, id: crypto.randomUUID(), worldId: input.worldId, createdAt: now, updatedAt: now }
  await db.promptPresets.put(row)
  return row
}

export async function importPresetText(options: { text: string; fileName: string; worldId: string; characterId?: string; autoBind?: boolean }) {
  const parsed = parsePromptPresetJson(options.text, options.fileName)
  const preset = await savePromptPresetResource({ ...parsed.preset, worldId: options.worldId })
  if (options.characterId && options.autoBind) {
    await setResourceBinding({ worldId: options.worldId, characterId: options.characterId, resourceType: 'preset', resourceId: preset.id, enabled: true })
  }
  return { type: 'preset' as const, id: preset.id, name: preset.name, report: parsed.report }
}

export async function saveRegexScriptResource(input: Omit<RegexScript, 'id' | 'worldId' | 'createdAt' | 'updatedAt'> & { worldId: string }) {
  const now = new Date().toISOString()
  const row: RegexScript = { ...input, id: crypto.randomUUID(), worldId: input.worldId, createdAt: now, updatedAt: now }
  await db.regexScripts.put(row)
  return row
}

export async function importRegexText(options: { text: string; fileName: string; worldId: string; characterId?: string; autoBind?: boolean }) {
  const parsed = parseRegexJson(options.text, options.fileName)
  const ids: string[] = []
  for (const script of parsed.scripts) {
    const row = await saveRegexScriptResource({ ...script, worldId: options.worldId, characterId: options.characterId })
    ids.push(row.id)
    if (options.characterId && options.autoBind !== false) {
      await setResourceBinding({ worldId: options.worldId, characterId: options.characterId, resourceType: 'regex', resourceId: row.id, enabled: true })
    }
  }
  return { type: 'regex' as const, ids, name: parsed.report.name, report: parsed.report }
}

export async function importCommunityFile(options: { file: File; worldId: string; characterId?: string; autoBind?: boolean }): Promise<ImportedCommunityResource[]> {
  if (options.file.name.toLowerCase().endsWith('.zip')) {
    const files = await extractJsonFilesFromZip(options.file)
    const output: ImportedCommunityResource[] = []
    for (const inner of files) {
      try {
        const parsed = parseCommunityResourceJson(inner.text, inner.name)
        if ('scripts' in parsed) {
          const imported = await importRegexText({ text: inner.text, fileName: inner.name, worldId: options.worldId, characterId: options.characterId, autoBind: options.autoBind })
          const archive = await saveArchive({
            worldId: options.worldId,
            fileName: `${options.file.name} / ${inner.name}`,
            mimeType: 'application/json',
            rawText: inner.text,
            report: imported.report,
            importedResourceIds: imported.ids
          })
          output.push({ ...imported, archiveId: archive.id })
        }
      } catch {
        // ZIP 正则包里常含说明/配置 JSON；无法识别的 JSON 仍不执行。
      }
    }
    if (!output.length) throw new Error('ZIP 中没有找到可导入的正则 JSON。')
    return output
  }
  const lowerName = options.file.name.toLowerCase()
  if (!lowerName.endsWith('.json')) {
    if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
      const text = await options.file.text()
      const report: ResourceCompatibilityReport = {
        kind: 'unknown',
        format: 'text resource',
        name: options.file.name.replace(/\.(txt|md)$/i, ''),
        summary: ['文本资源已归档'],
        supported: ['原始文本无损保存'],
        warnings: ['当前不会自动把未知文本注入 Prompt；可等待后续兼容器或手动复制到世界书。']
      }
      const archive = await saveArchive({ worldId: options.worldId, fileName: options.file.name, mimeType: options.file.type || 'text/plain', rawText: text, report, importedResourceIds: [] })
      return [{ type: 'archive', archiveId: archive.id, name: report.name, report }]
    }
    throw new Error('资源中心目前支持 JSON、TXT / MD 与正则 ZIP。')
  }
  const text = await options.file.text()
  const report = inspectCommunityResourceJson(text, options.file.name)
  if (!['lorebook', 'preset', 'regex'].includes(report.kind)) {
    const archive = await saveArchive({ worldId: options.worldId, fileName: options.file.name, mimeType: options.file.type || 'application/json', rawText: text, report, importedResourceIds: [] })
    return [{ type: 'archive', archiveId: archive.id, name: report.name, report }]
  }
  const parsed = parseCommunityResourceJson(text, options.file.name)
  if ('lorebook' in parsed) {
    const imported = await importLorebookText({ text, fileName: options.file.name, worldId: options.worldId, characterId: options.characterId, autoBind: options.autoBind })
    const archive = await saveArchive({ worldId: options.worldId, fileName: options.file.name, mimeType: options.file.type || 'application/json', rawText: text, report: imported.report, importedResourceIds: [imported.id] })
    return [{ ...imported, archiveId: archive.id }]
  }
  if ('preset' in parsed) {
    const imported = await importPresetText({ text, fileName: options.file.name, worldId: options.worldId, characterId: options.characterId, autoBind: options.autoBind })
    const archive = await saveArchive({ worldId: options.worldId, fileName: options.file.name, mimeType: options.file.type || 'application/json', rawText: text, report: imported.report, importedResourceIds: [imported.id] })
    return [{ ...imported, archiveId: archive.id }]
  }
  if ('scripts' in parsed) {
    const imported = await importRegexText({ text, fileName: options.file.name, worldId: options.worldId, characterId: options.characterId, autoBind: options.autoBind })
    const archive = await saveArchive({ worldId: options.worldId, fileName: options.file.name, mimeType: options.file.type || 'application/json', rawText: text, report: imported.report, importedResourceIds: imported.ids })
    return [{ ...imported, archiveId: archive.id }]
  }
  throw new Error('暂时无法导入这个资源。')
}

export async function deleteCommunityResource(type: ResourceType, id: string) {
  await removeResourceBindingsForResource(type, id)
  if (type === 'lorebook') {
    const entries = await db.lorebookEntries.where('lorebookId').equals(id).toArray()
    if (entries.length) await db.lorebookEntries.bulkDelete(entries.map(item => item.id))
    await db.lorebooks.delete(id)
  } else if (type === 'preset') {
    await db.promptPresets.delete(id)
  } else {
    await db.regexScripts.delete(id)
  }
}

export async function listCommunityResources(worldId: string) {
  const [lorebooks, presets, regexes, bindings] = await Promise.all([
    db.lorebooks.where('worldId').equals(worldId).toArray(),
    db.promptPresets.where('worldId').equals(worldId).toArray(),
    db.regexScripts.where('worldId').equals(worldId).toArray(),
    db.resourceBindings.where('worldId').equals(worldId).toArray()
  ])
  const archives = await listCommunityResourceArchives(worldId)
  return { lorebooks, presets, regexes, bindings, archives }
}
