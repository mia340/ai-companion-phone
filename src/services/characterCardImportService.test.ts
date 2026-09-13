import { describe, expect, it } from 'vitest'
import { exportCharacterCardJson, parseCharacterCardJson } from './characterCardImportService'

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
    expect(result.patch.cardDescription).toBe('身份：医生')
    expect(result.patch.cardPersonality).toBe('克制，慢热')
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
      description: '{{char}}:\n  职业: 影视行业资深演员\n{{user}}:\n  职业: 影视行业新人演员',
      alternate_greetings: null,
      character_book: null,
      tags: [],
      extensions: {}
    }
  }))
  expect(result.patch.alternateGreetings).toEqual([])
  expect(result.patch.tags).toEqual([])
  expect(result.lorebookEntries).toEqual([])
  expect(result.embeddedUser?.patch.occupation).toBe('影视行业新人演员')
  expect(result.embeddedUser?.rawTemplate).toContain('职业: 影视行业新人演员')
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
  expect(result.patch.initiative).toBeUndefined()
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
      name: '角色甲',
      description: '{{char}}是角色甲。',
      character_book: {
        entries: [
          { id: 1, name: '世界观', comment: '世界观', keys: [], content: '{{user}}幼时生活在中境。', constant: true, enabled: true },
          { id: 2, name: 'user人设', comment: 'user人设', keys: [], content: '{{user}}我是洛梨,角色甲徒弟,筑基期剑修,20岁.喜欢种地瓜和写话本。', constant: true, enabled: true }
        ]
      }
    }
  }))
  expect(result.embeddedUser?.patch.name).toBe('洛梨')
  expect(result.embeddedUser?.patch.age).toBe('20')
  expect(result.embeddedUser?.patch.identity).toContain('角色甲徒弟')
  expect(result.embeddedUser?.rawTemplate).toContain('{{user}}我是洛梨')
  expect(result.notes.some(note => note.includes('内嵌世界书 user 人设条目'))).toBe(true)
})

it('识别 description 中带序号的自然语言 {{user}} Persona（带序号自然语言格式）', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '角色乙',
      description: '{{char}}是角色乙。\n③{{user}}我是江梨,女,19岁,162cm.A大大一新生,棕发棕瞳,普通单亲家庭,短暂性失聪,会唇语。'
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


it('识别 creator_notes 中明确标注的用户设定块，并继续保持 creator_notes 不直接进 Prompt', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: '褚焚川',
      description: '[{{char}}和{{user}}关系]\n褚焚川与姜阮初次见面，相互试探。',
      creator_notes: [
        '请使用通用预设世界书',
        '主控人设剪切至用户角色卡',
        '',
        '[用户设定(禁止陌生关系时直接获悉底层身份,长期卧底剧情,获悉信息只能经用户透露)]',
        '姜阮,女,23岁(生日12月3日),168cm,55kg,真实身份ISIG特工,代号Cipher,专攻暗网军火交易追踪。',
        '-能力:狙击/战术爆破/黑客/近战冷兵器暗杀'
      ].join('\n')
    }
  }))

  expect(result.embeddedUser?.patch.name).toBe('姜阮')
  expect(result.embeddedUser?.patch.age).toBe('23')
  expect(result.embeddedUser?.patch.gender).toBe('女')
  expect(result.embeddedUser?.patch.height).toBe('168cm')
  expect(result.embeddedUser?.rawTemplate).toContain('真实身份ISIG特工')
  expect(result.notes.some(note => note.includes('creator_notes 用户设定块'))).toBe(true)
  expect(result.notes.some(note => note.includes('creator_notes 只在原卡阅读器展示'))).toBe(true)
})


it('兼容社区常见用户 Persona 标签与字段，而不是针对单一卡片姓名', () => {
  const creatorNotesInline = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '社区卡A',
      description: '{{char}}会与{{user}}相识。',
      creator_notes: '作者说明：请自行调整 UI。 请注意 [我的设定]林夏,24岁,女,165cm,记者,性格独立。'
    }
  }))
  expect(creatorNotesInline.embeddedUser?.patch.name).toBe('林夏')
  expect(creatorNotesInline.embeddedUser?.patch.age).toBe('24')
  expect(creatorNotesInline.embeddedUser?.patch.height).toBe('165cm')

  const worldBookVariant = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '社区卡B',
      description: '角色说明',
      character_book: {
        entries: [
          { id: 1, name: '玩家人设（自行粘贴）', content: '周宁,女,26岁（生日5月1日）,170cm,医生。', enabled: true }
        ]
      }
    }
  }))
  expect(worldBookVariant.embeddedUser?.patch.name).toBe('周宁')
  expect(worldBookVariant.embeddedUser?.patch.age).toBe('26')

  const communityField = parseCharacterCardJson(JSON.stringify({
    name: '社区卡C',
    description: '角色说明',
    player_profile: {
      姓名: 'Alex',
      年龄: '29岁',
      性别: '男',
      身高: '181cm',
      职业: '摄影师'
    }
  }))
  expect(communityField.embeddedUser?.patch.name).toBe('Alex')
  expect(communityField.embeddedUser?.patch.age).toBe('29')
  expect(communityField.embeddedUser?.patch.height).toBe('181cm')

  const englishCommunityField = parseCharacterCardJson(JSON.stringify({
    name: 'Community Card D',
    description: 'Character description',
    user_profile: {
      name: 'Casey',
      age: '31 years old',
      gender: 'female',
      height: '172 cm',
      occupation: 'designer'
    }
  }))
  expect(englishCommunityField.embeddedUser?.patch.name).toBe('Casey')
  expect(englishCommunityField.embeddedUser?.patch.age).toBe('31')
  expect(englishCommunityField.embeddedUser?.patch.height).toBe('172cm')
})

it('“user 人设自拟/请填写用户设定”只有提示词时不会伪造 Persona', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '自拟用户卡',
      description: '{{char}}会与{{user}}互动。',
      creator_notes: 'user人设自拟，推荐医生、记者、运动康复员等职业；请填写用户设定后再开始。'
    }
  }))
  expect(result.embeddedUser).toBeUndefined()
})

it('不会把普通 creator_notes 作者说明误识别成 Persona', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v2',
    data: {
      name: '普通作者说明',
      description: '{{char}}会和{{user}}慢慢熟悉。',
      creator_notes: '请使用通用世界书。UI 调整一下。作者备注仅供阅读。'
    }
  }))
  expect(result.embeddedUser).toBeUndefined()
})

it('V3 读取 nickname / multilingual notes / assets，并按 V3 回写', () => {
  const result = parseCharacterCardJson(JSON.stringify({
    spec: 'chara_card_v3', spec_version: '3.0',
    data: {
      name: '角色V3', nickname: '阿三', description: '描述', personality: '', scenario: '', first_mes: '你好', mes_example: '',
      creator_notes: 'English fallback', creator_notes_multilingual: { zh: '中文作者说明', en: 'English note' },
      system_prompt: '作者系统', post_history_instructions: '', alternate_greetings: ['备用'], group_only_greetings: [],
      tags: [], creator: 'tester', character_version: '1.0', extensions: {}, source: ['https://example.com/card'],
      assets: [{ type: 'icon', uri: 'https://example.com/a.png', name: 'main', ext: 'png' }]
    }
  }))
  expect(result.patch.nickname).toBe('阿三')
  expect(result.patch.sourceUrl).toBe('https://example.com/card')
  expect(result.patch.avatar).toBe('https://example.com/a.png')
  expect((result.patch.rawCardExtensions?.v3 as Record<string, unknown>)?.assets).toBeTruthy()

  const now = '2026-08-23T00:00:00.000Z'
  const json = exportCharacterCardJson({
    id: 'char', worldId: 'world', name: result.patch.name || '角色V3', nickname: result.patch.nickname,
    avatar: '', persona: result.patch.persona || '', cardDescription: result.patch.cardDescription, cardPersonality: result.patch.cardPersonality,
    relationship: '', mood: '', activity: '', replySpeed: 'natural', createdAt: now,
    importFormat: 'sillytavern-v3', sourceSpec: 'chara_card_v3', sourceSpecVersion: '3.0', rawCardExtensions: result.patch.rawCardExtensions,
    firstMessage: result.patch.firstMessage, alternateGreetings: result.patch.alternateGreetings, creatorNotes: result.patch.creatorNotes,
    systemPrompt: result.patch.systemPrompt, postHistoryInstructions: result.patch.postHistoryInstructions, tags: [], creator: 'tester'
  })
  const exported = JSON.parse(json)
  expect(exported.spec).toBe('chara_card_v3')
  expect(exported.data.nickname).toBe('阿三')
  expect(exported.data.creator_notes_multilingual.zh).toBe('中文作者说明')
  expect(exported.data.assets).toHaveLength(1)
})
