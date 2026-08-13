import { describe, expect, it } from 'vitest'
import { parseCharacterCardJson } from './characterCardImportService'

describe('character card import', () => {
  it('imports SillyTavern V2 JSON', () => {
    const result = parseCharacterCardJson(JSON.stringify({
      spec: 'chara_card_v2',
      data: {
        name: '顾言',
        personality: '克制，慢热',
        description: '身份：医生',
        first_mes: '还没睡？',
        mes_example: '{{user}}: 你想我吗？\n{{char}}: ……你觉得呢。',
        creator: 'tester',
        character_book: { entries: [{ name: '常驻设定', keys: [], content: '角色专属世界书', constant: true, enabled: true, insertion_order: 12 }] }
      }
    }))
    expect(result.format).toBe('sillytavern-v2')
    expect(result.patch.name).toBe('顾言')
    expect(result.patch.exampleDialogues?.length).toBe(1)
    expect(result.lorebookEntries).toHaveLength(1)
    expect(result.lorebookEntries[0]?.constant).toBe(true)
  })
})


it('rejects a lorebook JSON as a character card', () => {
  expect(() => parseCharacterCardJson(JSON.stringify({
    name: '世界书',
    entries: [{ keys: ['测试'], content: '内容' }]
  }))).toThrow('世界书')
})


it('normalizes Tavo null optional collections to clone-safe empty arrays', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '谢无矣',
      description: '{{char}}:\n  职业: 娱乐圈老演员\n{{user}}:\n  职业: 娱乐圈新人女演员',
      alternate_greetings: null,
      character_book: null,
      tags: [],
      extensions: {}
    }
  }))
  expect(result.patch.alternateGreetings).toEqual([])
  expect(result.patch.tags).toEqual([])
  expect(result.lorebookEntries).toEqual([])
  expect(result.embeddedUser?.patch.occupation).toBe('娱乐圈新人女演员')
  expect(result.embeddedUser?.rawTemplate).toContain('职业: 娱乐圈新人女演员')
  expect(() => structuredClone(result)).not.toThrow()
})

it('识别 data/root extensions、depth_prompt、talkativeness 与两处内嵌正则', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v3',
    data: {
      name: '扩展角色',
      description: '设定',
      avatar: 'charaCard/avatar.jpg',
      group_only_greetings: ['群聊开场'],
      extensions: {
        talkativeness: '0.8',
        world: '测试世界书',
        regex_scripts: [{ scriptName: 'data正则', findRegex: 'a', replaceString: 'b', placement: [2] }],
        tavern_helper: { scripts: [{ type: 'script', content: 'import("https://example.com/x.js")' }] }
      }
    },
    extensions: {
      depth_prompt: { prompts: [{ prompt: '深度约束', depth: 4, role: 'system' }] },
      regex_scripts: [{ scriptName: 'root正则', findRegex: 'c', replaceString: 'd', placement: [2] }]
    }
  }))
  expect(result.patch.talkativeness).toBe(0.8)
  expect(result.patch.initiative).toBe('high')
  expect(result.patch.depthPrompt?.prompt).toBe('深度约束')
  expect(result.patch.worldBookHint).toBe('测试世界书')
  expect(result.patch.groupOnlyGreetings).toEqual(['群聊开场'])
  expect(result.regexScripts).toHaveLength(2)
  expect(result.patch.avatar).toBeUndefined()
  expect(result.notes.some(note => note.includes('不会执行第三方 JS'))).toBe(true)
})
