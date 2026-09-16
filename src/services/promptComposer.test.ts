import { describe, expect, it } from 'vitest'
import { composeRoleplaySystemPrompt, resolvePromptUserMacroName } from './promptComposer'
import type { Character, ChatSettings, UserPersona } from '../types/domain'

function persona(name: string, isDefault = true): UserPersona {
  const now = '2026-09-13T00:00:00.000Z'
  return {
    id: 'persona-test',
    name,
    avatar: '🙂',
    personaScope: 'global',
    isDefault,
    createdAt: now,
    updatedAt: now
  }
}

function character(): Character {
  const now = '2026-09-13T00:00:00.000Z'
  return {
    id: 'char-test',
    worldId: 'world-test',
    name: '测试角色',
    avatar: '',
    persona: '',
    relationship: '',
    mood: '',
    activity: '',
    replySpeed: 'natural',
    createdAt: now,
    importFormat: 'sillytavern-v2',
    sourceSpec: 'chara_card_v2',
    sourceSpecVersion: '2.0',
    cardDescription: [
      '与{{user}}长期相处。',
      '用户资料里会写“她很独立”，这只是资料描述。',
      '语言风格：对{{user}}使用自然的第二人称。'
    ].join('\n')
  }
}

const settings = {
  roleplayMode: 'daily',
  replyLength: 'natural',
  multiBubble: false,
  actionProtocolEnabled: false,
  conversationPresentationMode: 'scene-merged',
  proactiveAllowedSources: []
} as unknown as ChatSettings

describe('prompt narration-person continuity', () => {
  it('把默认 Persona 名“我”视为 UI 标签，不把 {{user}} 宏改写成第一人称“我”', () => {
    const p = persona('我')
    expect(resolvePromptUserMacroName(p)).toBe('{{user}}')

    const prompt = composeRoleplaySystemPrompt({ character: character(), persona: p, settings })
    expect(prompt).toContain('与{{user}}长期相处')
    expect(prompt).not.toContain('与我长期相处')
    expect(prompt).toContain('【叙事人称连续性】')
    expect(prompt).toContain('只是资料描述，不构成第三人称叙事指令')
    expect(prompt).toContain('从本轮恢复第二人称')
  })

  it('真实 Persona 姓名仍正常替换社区卡 {{user}} 宏', () => {
    const p = persona('林夏', false)
    expect(resolvePromptUserMacroName(p)).toBe('林夏')
    const prompt = composeRoleplaySystemPrompt({ character: character(), persona: p, settings })
    expect(prompt).toContain('与林夏长期相处')
    expect(prompt).toContain('对林夏使用自然的第二人称')
  })
})
