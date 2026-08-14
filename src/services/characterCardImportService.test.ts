import { describe, expect, it } from 'vitest'
import { parseCharacterCardJson } from './characterCardImportService'

describe('character card import', () => {
  it('imports SillyTavern V2 JSON', () => {
    const result = parseCharacterCardJson(JSON.stringify({
      spec: 'chara_card_v2',
      data: {
        name: '测试角色',
        personality: '克制，慢热',
        description: '身份：医生',
        first_mes: '还没睡？',
        mes_example: '{{user}}: 你想我吗？\n{{char}}: ……你觉得呢。',
        creator: 'tester',
        character_book: { entries: [{ name: '常驻设定', keys: [], content: '角色专属世界书', constant: true, enabled: true, insertion_order: 12 }] }
      }
    }))
    expect(result.format).toBe('sillytavern-v2')
    expect(result.patch.name).toBe('测试角色')
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

it('从内嵌世界书 user人设条目识别角色专属 Persona', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '墨清尘',
      description: '{{char}}是墨清尘。',
      character_book: {
        entries: [
          { id: 1, name: '世界观', comment: '世界观', keys: [], content: '{{user}}幼时生活在中境。', constant: true, enabled: true },
          { id: 2, name: 'user人设', comment: 'user人设', keys: [], content: '{{user}}我是洛梨,墨清尘徒弟,筑基期剑修,20岁.喜欢种地瓜和写话本。', constant: true, enabled: true }
        ]
      }
    }
  }))
  expect(result.embeddedUser?.patch.name).toBe('洛梨')
  expect(result.embeddedUser?.patch.age).toBe('20')
  expect(result.embeddedUser?.patch.identity).toContain('墨清尘徒弟')
  expect(result.embeddedUser?.rawTemplate).toContain('{{user}}我是洛梨')
  expect(result.notes.some(note => note.includes('内嵌世界书 user 人设条目'))).toBe(true)
})

it('识别 description 中带序号的自然语言 {{user}} Persona（夜临格式）', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '夜临',
      description: '{{char}}是夜临。\n③{{user}}我是江梨,女,19岁,162cm.A大大一新生,棕发棕瞳,普通单亲家庭,短暂性失聪,会唇语。'
    }
  }))
  expect(result.embeddedUser?.patch.name).toBe('江梨')
  expect(result.embeddedUser?.patch.age).toBe('19')
  expect(result.embeddedUser?.patch.gender).toBe('女')
  expect(result.embeddedUser?.patch.height).toBe('162cm')
  expect(result.embeddedUser?.patch.identity).toContain('A大大一新生')
})

it('识别多种社区 description 内联 Persona 写法，但不把普通 {{user}} 剧情句当 Persona', () => {
  const cases = [
    ['[用户]{{user}}是{洛梨,女,20岁,170cm,影阁二把手+顶级杀手。', '洛梨'],
    ['{{user}}洛梨，疑似西国女将，武功高强，身份危险。', '洛梨'],
    ['{{user}}姜阮,女,25岁,168cm,纪实记者。', '姜阮']
  ] as const
  for (const [description, name] of cases) {
    const result = parseCharacterCardJson(JSON.stringify({ spec: 'chara_card_v2', data: { name: '测试', description } }))
    expect(result.embeddedUser?.patch.name).toBe(name)
  }

  const ordinary = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '普通剧情',
      description: '{{user}}要求不高，希望开心就好。{{char}}从小照顾{{user}}。\n{{user}}已发生的故事：两人大学相识。'
    }
  }))
  expect(ordinary.embeddedUser).toBeUndefined()
})

it('识别 user基本情况 / user设定 世界书，同时忽略 user_personal_room 等环境资源', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '世界书用户测试',
      description: '{{char}}设定',
      character_book: {
        entries: [
          { id: 1, name: '<user_personal_room>', content: '<user_personal_room>{{user}}住址: 高端公寓</user_personal_room>', constant: true, enabled: true },
          { id: 2, name: 'user基本情况', content: '姜阮,女,20岁,168cm,插画师。', constant: true, enabled: true }
        ]
      }
    }
  }))
  expect(result.embeddedUser?.patch.name).toBe('姜阮')
  expect(result.embeddedUser?.patch.age).toBe('20')
  expect(result.embeddedUser?.patch.height).toBe('168cm')
  expect(result.embeddedUser?.rawTemplate).toContain('姜阮')
})
