import { describe, expect, it } from 'vitest'
import { buildCharacterRuntimeManifest, characterMacroName, resolveCharacterPostHistoryInstructions, resolveCharacterSystemPrompt } from './characterCardCompatibility'
import type { Character } from '../types/domain'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'char', worldId: 'world', name: '角色甲', avatar: '', persona: '人设', relationship: '', mood: '', activity: '',
    replySpeed: 'natural', createdAt: '2026-08-23T00:00:00.000Z', ...patch
  }
}

describe('Character Card compatibility layer', () => {
  it('V2 creator_notes 只读，system_prompt 默认覆盖 original', () => {
    const row = character({ importFormat: 'sillytavern-v2', sourceSpec: 'chara_card_v2', creatorNotes: '给用户看的说明', systemPrompt: '作者系统规则' })
    const manifest = buildCharacterRuntimeManifest(row)
    expect(manifest.promptFields.creatorNotes).toBe(false)
    expect(manifest.creatorNotesDisplay).toBe('给用户看的说明')
    expect(resolveCharacterSystemPrompt(row, '默认系统规则')).toEqual({ text: '作者系统规则', mode: 'replace' })
  })

  it('V2/V3 system_prompt 支持 {{original}}', () => {
    const row = character({ importFormat: 'sillytavern-v3', sourceSpec: 'chara_card_v3', systemPrompt: '前置\n{{original}}\n后置' })
    expect(resolveCharacterSystemPrompt(row, '默认系统规则').text).toBe('前置\n默认系统规则\n后置')
  })

  it('V2/V3 post_history_instructions 默认覆盖，并支持 {{original}}', () => {
    const row = character({ importFormat: 'sillytavern-v2', sourceSpec: 'chara_card_v2', postHistoryInstructions: '作者PHI\n{{original}}' })
    expect(resolveCharacterPostHistoryInstructions(row, '默认PHI')).toEqual({ text: '作者PHI\n默认PHI', mode: 'replace-with-original' })
  })

  it('V3 nickname 用于 {{char}} 宏', () => {
    const row = character({ importFormat: 'sillytavern-v3', sourceSpec: 'chara_card_v3', nickname: '小甲' })
    expect(characterMacroName(row)).toBe('小甲')
  })

  it('原生角色保留旧的 system prompt 补充语义', () => {
    const row = character({ importFormat: 'native', systemPrompt: '本地补充' })
    expect(resolveCharacterSystemPrompt(row, '默认系统规则')).toEqual({ text: '默认系统规则\n\n本地补充', mode: 'append' })
  })
})
