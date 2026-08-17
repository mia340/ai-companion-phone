import { db } from '../db/database'
import { listResourceBindings } from './resourceBindingService'
import type { Character, LorebookEntry } from '../types/domain'

export interface CardReaderSection {
  key: string
  label: string
  content: string
}

export interface CardReaderEntry {
  id: string
  title: string
  content: string
}

export interface CharacterCardLocalIndex {
  sourceFormat: string
  sourceFileName?: string
  sections: CardReaderSection[]
  userMentionCount: number
  userTemplate?: string
  greetingCount: number
  lorebookCount: number
  regexCount: number
  characterDefinitionEntries: CardReaderEntry[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function looksLikeCharacterDefinition(entry: LorebookEntry) {
  const title = entry.title.trim()
  if (!title || title.length > 40) return false
  const sample = entry.content.slice(0, 2400)
  const personSignals = [
    /(?:人设|人物设定|角色设定|身份|性格|外貌|年龄|身高|职业|背景故事)/,
    /(?:男|女)[｜|,，\s].{0,12}(?:岁|cm|厘米)/i,
    /(?:以下是|以下为).{0,24}(?:人设|设定)/
  ]
  const uiSignals = /<!DOCTYPE|<style\b|<script\b|findRegex|replaceString|输出格式|状态栏/i
  return personSignals.some(pattern => pattern.test(sample)) && !uiSignals.test(sample)
}

export async function buildCharacterCardLocalIndex(character: Character): Promise<CharacterCardLocalIndex | undefined> {
  const archives = (await db.communityResourceArchives.toArray())
    .filter(item => item.kind === 'character-card' && item.characterId === character.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const archive = archives[0]

  if (!archive && !character.importFormat && !character.sourceSpec) return undefined

  const raw = asRecord(archive?.rawJson)
  const data = Object.keys(asRecord(raw.data)).length ? asRecord(raw.data) : raw
  const sections: CardReaderSection[] = []
  const push = (key: string, label: string, value: unknown) => {
    const content = asText(value)
    if (content) sections.push({ key, label, content })
  }
  push('description', 'description · 角色描述', data.description ?? character.cardDescription)
  push('personality', 'personality · 性格', data.personality ?? character.cardPersonality)
  push('scenario', 'scenario · 场景 / 背景', data.scenario ?? character.scenario)
  push('system_prompt', 'system_prompt · 作者系统规则', data.system_prompt ?? character.systemPrompt)
  push('post_history_instructions', 'post_history_instructions · 回复前规则', data.post_history_instructions ?? character.postHistoryInstructions)
  push('creator_notes', 'creator_notes · 作者备注', data.creator_notes ?? character.creatorNotes)
  push('mes_example', 'mes_example · 示例对话原文', data.mes_example)

  const rawText = archive?.rawText || JSON.stringify(archive?.rawJson || {})
  const userMentionCount = (rawText.match(/\{\{user\}\}/gi) || []).length
  const bindings = await listResourceBindings(character.id)
  const lorebookIds = new Set(bindings.filter(item => item.enabled && item.resourceType === 'lorebook').map(item => item.resourceId))
  const regexIds = new Set(bindings.filter(item => item.enabled && item.resourceType === 'regex').map(item => item.resourceId))
  const allEntries = await db.lorebookEntries.toArray()
  const boundEntries = allEntries.filter(item => Boolean(item.lorebookId && lorebookIds.has(item.lorebookId)))
  const characterDefinitionEntries = boundEntries.filter(looksLikeCharacterDefinition).map(item => ({
    id: item.id,
    title: item.title,
    content: item.content
  }))

  return {
    sourceFormat: archive?.sourceFormat || character.importFormat || character.sourceSpec || 'community-card',
    sourceFileName: archive?.fileName,
    sections,
    userMentionCount,
    userTemplate: character.embeddedUserTemplate?.trim() || undefined,
    greetingCount: (character.firstMessage?.trim() ? 1 : 0) + (character.alternateGreetings?.filter(item => item.trim()).length || 0),
    lorebookCount: lorebookIds.size,
    regexCount: regexIds.size,
    characterDefinitionEntries
  }
}
