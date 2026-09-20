import { describe, expect, it } from 'vitest'
import {
  parsePersonaJson,
  parsePersonaText,
  recognizeJsonResource
} from './personaImportService'

describe('personaImportService', () => {
  it('识别 Tavo / SillyTavern 角色卡并允许显式转换为 Persona', () => {
    const raw = JSON.stringify({
      spec: 'chara_card_v2',
      spec_version: '2.0',
      data: {
        name: '测试角色',
        description: '身份与外貌描述',
        personality: '性格描述',
        scenario: '现代城市',
        character_book: { entries: [{ keys: ['学校'], content: '设定' }] }
      }
    })
    const result = parsePersonaJson(raw)
    expect(result.recognition.kind).toBe('character-card-v2')
    expect(result.patch.name).toBe('测试角色')
    expect(result.patch.description).toContain('身份与外貌')
    expect(result.patch.extraFields).toBeTruthy()
  })

  it('世界书不会被误导入 Persona', () => {
    expect(() => parsePersonaJson(JSON.stringify({ entries: { 0: { key: ['a'], content: 'b' } } }))).toThrow('世界书')
  })

  it('解析 Tavo 风格文本用户人设', () => {
    const raw = `姓名: "沈昭宁"\n年龄: "32岁"\n身高: "168cm"\n五官特征:\n  - "眼神锐利"\n核心性格:\n  - 果敢直接: "决策干脆"\n优点:\n  - "独立坚韧"\n缺点:\n  - "脾气急躁"`
    const result = parsePersonaText(raw, '庄景修User.txt')
    expect(result.patch.name).toBe('沈昭宁')
    expect(result.patch.age).toBe('32岁')
    expect(result.patch.height).toBe('168cm')
    expect(result.patch.appearance).toContain('眼神锐利')
    expect(result.patch.strengths).toContain('独立坚韧')
  })

  it('通用 JSON 保留未知字段', () => {
    const result = parsePersonaJson(JSON.stringify({ name: '梦垚', occupation: '设计师', zodiac: '天蝎座' }))
    expect(result.patch.occupation).toBe('设计师')
    expect(result.patch.extraFields).toMatchObject({ zodiac: '天蝎座' })
  })

  it('识别预设', () => {
    expect(recognizeJsonResource({ prompts: [], prompt_order: [] }).kind).toBe('preset')
  })
})
