import type { Character } from '../types/domain'

export type CharacterCardFamily = 'native' | 'legacy' | 'v2' | 'v3' | 'community'
export type CharacterSystemPromptMode = 'default' | 'replace' | 'replace-with-original' | 'append'

export interface CharacterRuntimeManifest {
  family: CharacterCardFamily
  sourceLabel: string
  macroCharacterName: string
  greetings: string[]
  creatorNotesDisplay?: string
  systemPromptMode: CharacterSystemPromptMode
  postHistoryMode: CharacterSystemPromptMode
  promptFields: {
    description: boolean
    personality: boolean
    scenario: boolean
    examples: boolean
    systemPrompt: boolean
    postHistoryInstructions: boolean
    creatorNotes: false
  }
  rawExtensionGroups: string[]
  notes: string[]
}

function compact(value?: string) {
  return value?.trim() || ''
}

export function isImportedCommunityCharacter(character: Character) {
  return Boolean(
    (character.importFormat && character.importFormat !== 'native') ||
    character.sourceSpec ||
    character.sourceSpecVersion ||
    character.rawCardExtensions
  )
}

export function detectCharacterCardFamily(character: Character): CharacterCardFamily {
  const spec = `${character.sourceSpec || ''} ${character.sourceSpecVersion || ''}`.toLowerCase()
  if (character.importFormat === 'sillytavern-v3' || spec.includes('chara_card_v3')) return 'v3'
  if (character.importFormat === 'sillytavern-v2' || spec.includes('chara_card_v2')) return 'v2'
  if (character.importFormat === 'legacy-json') return 'legacy'
  if (character.importFormat && character.importFormat !== 'native') return 'community'
  if (character.sourceSpec) return 'community'
  return 'native'
}

export function characterMacroName(character: Character) {
  const family = detectCharacterCardFamily(character)
  if (family === 'v3' && compact(character.nickname)) return compact(character.nickname)
  return character.name.trim() || '角色'
}

export function resolveCharacterSystemPrompt(character: Character, originalSystemPrompt: string) {
  const original = originalSystemPrompt.trim()
  const custom = compact(character.systemPrompt)
  const family = detectCharacterCardFamily(character)

  if (!custom) {
    return { text: original, mode: 'default' as CharacterSystemPromptMode }
  }

  // 只有标准 V2/V3 明确规定 system_prompt 的 override 语义。
  // 原生/旧版/泛社区 JSON 没有该规范保证，沿用旧的“补充规则”行为，避免误解释。
  if (family !== 'v2' && family !== 'v3') {
    return {
      text: [original, custom].filter(Boolean).join('\n\n'),
      mode: 'append' as CharacterSystemPromptMode
    }
  }

  if (/\{\{\s*original\s*\}\}/i.test(custom)) {
    return {
      text: custom.replace(/\{\{\s*original\s*\}\}/gi, original),
      mode: 'replace-with-original' as CharacterSystemPromptMode
    }
  }

  return { text: custom, mode: 'replace' as CharacterSystemPromptMode }
}


export function resolveCharacterPostHistoryInstructions(character: Character, originalPostHistoryInstructions: string) {
  const original = originalPostHistoryInstructions.trim()
  const custom = compact(character.postHistoryInstructions)
  const family = detectCharacterCardFamily(character)

  if (!custom) {
    return { text: original, mode: 'default' as CharacterSystemPromptMode }
  }

  if (family !== 'v2' && family !== 'v3') {
    return {
      text: [original, custom].filter(Boolean).join('\n\n'),
      mode: 'append' as CharacterSystemPromptMode
    }
  }

  if (/\{\{\s*original\s*\}\}/i.test(custom)) {
    return {
      text: custom.replace(/\{\{\s*original\s*\}\}/gi, original),
      mode: 'replace-with-original' as CharacterSystemPromptMode
    }
  }

  return { text: custom, mode: 'replace' as CharacterSystemPromptMode }
}

function multilingualCreatorNotes(character: Character, locale?: string) {
  const stored = character.rawCardExtensions || {}
  const unknownData = stored.unknownData && typeof stored.unknownData === 'object'
    ? stored.unknownData as Record<string, unknown>
    : {}
  const v3 = stored.v3 && typeof stored.v3 === 'object'
    ? stored.v3 as Record<string, unknown>
    : {}
  const source = (v3.creator_notes_multilingual || unknownData.creator_notes_multilingual) as unknown
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined
  const rows = source as Record<string, unknown>
  const language = (locale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'zh').toLowerCase().split('-')[0]
  const preferred = rows[language]
  if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
  const english = rows.en
  if (typeof english === 'string' && english.trim()) return english.trim()
  const first = Object.values(rows).find(value => typeof value === 'string' && value.trim())
  return typeof first === 'string' ? first.trim() : undefined
}

export function buildCharacterRuntimeManifest(character: Character, locale?: string): CharacterRuntimeManifest {
  const family = detectCharacterCardFamily(character)
  const system = resolveCharacterSystemPrompt(character, '')
  const postHistory = resolveCharacterPostHistoryInstructions(character, '')
  const greetings = [character.firstMessage, ...(character.alternateGreetings || [])]
    .map(item => item?.trim() || '')
    .filter(Boolean)
  const dedupedGreetings = Array.from(new Set(greetings))
  const extensionGroups = Object.keys(character.rawCardExtensions || {}).sort()
  const notes: string[] = []

  if (family === 'v2' || family === 'v3') {
    notes.push('creator_notes 仅供用户阅读，不进入模型 Prompt。')
    if (compact(character.systemPrompt)) {
      notes.push(system.mode === 'replace-with-original'
        ? 'system_prompt 使用 {{original}} 合并前端默认 system prompt。'
        : 'system_prompt 按角色卡规范覆盖前端默认 system prompt。')
    }
    if (compact(character.postHistoryInstructions)) {
      notes.push(postHistory.mode === 'replace-with-original'
        ? 'post_history_instructions 使用 {{original}} 合并前端默认 post-history instruction。'
        : 'post_history_instructions 按角色卡规范覆盖前端默认 post-history instruction。')
    }
    notes.push('first_mes / alternate_greetings 只在用户选择开场时作为真实 assistant 历史。')
  }
  if (family === 'v3' && compact(character.nickname)) {
    notes.push(`V3 nickname“${compact(character.nickname)}”用于 {{char}} 宏。`)
  }
  if (extensionGroups.length) notes.push('未知/扩展字段继续保留在 Raw Card 归档，不因当前运行时不认识而丢失。')

  return {
    family,
    sourceLabel: [character.sourceSpec, character.sourceSpecVersion].filter(Boolean).join(' · ') || character.importFormat || 'native',
    macroCharacterName: characterMacroName(character),
    greetings: dedupedGreetings,
    creatorNotesDisplay: multilingualCreatorNotes(character, locale) || compact(character.creatorNotes) || undefined,
    systemPromptMode: system.mode,
    postHistoryMode: postHistory.mode,
    promptFields: {
      description: Boolean(compact(character.cardDescription) || compact(character.persona)),
      personality: Boolean(compact(character.cardPersonality)),
      scenario: Boolean(compact(character.scenario)),
      examples: Boolean(character.exampleDialogues?.length),
      systemPrompt: Boolean(compact(character.systemPrompt)),
      postHistoryInstructions: Boolean(compact(character.postHistoryInstructions)),
      creatorNotes: false
    },
    rawExtensionGroups: extensionGroups,
    notes
  }
}
