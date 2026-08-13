import { describe, expect, it } from 'vitest'
import { inspectCommunityResourceJson, parseLorebookJson, parsePromptPresetJson, parseRegexJson } from './resourceImportService'

describe('community resource import', () => {
  it('preserves advanced lorebook fields', () => {
    const parsed = parseLorebookJson(JSON.stringify({
      name: '测试世界书',
      entries: [{
        id: 7,
        name: '地点',
        keys: ['学院'],
        secondary_keys: ['校庆'],
        content: '学院设定',
        enabled: true,
        selective: true,
        use_regex: false,
        insertion_order: 42,
        extensions: { position: 4, depth: 2, probability: 80, useProbability: true }
      }]
    }))
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].secondaryKeys).toEqual(['校庆'])
    expect(parsed.entries[0].insertionOrder).toBe(42)
    expect(parsed.entries[0].position).toBe(4)
    expect(parsed.entries[0].depth).toBe(2)
    expect(parsed.entries[0].probability).toBe(80)
  })

  it('reads prompt order', () => {
    const parsed = parsePromptPresetJson(JSON.stringify({
      name: '测试预设',
      prompts: [
        { identifier: 'main', name: 'Main', marker: true },
        { identifier: 'tone', name: '语气', role: 'system', content: '自然说话' }
      ],
      prompt_order: [{ order: [{ identifier: 'tone', enabled: true }, { identifier: 'main', enabled: true }] }]
    }))
    expect(parsed.preset.promptOrder.map(item => item.identifier)).toEqual(['tone', 'main'])
  })

  it('reads Tavo style regex scripts', () => {
    const parsed = parseRegexJson(JSON.stringify({
      regex_scripts: [{
        scriptName: '状态栏',
        findRegex: '\\\\[状态\\\\]([\\\\s\\\\S]*?)\\\\[/状态\\\\]',
        replaceString: '<div>$1</div>',
        placement: [2],
        enabled: true
      }]
    }))
    expect(parsed.scripts).toHaveLength(1)
    expect(parsed.scripts[0].placement).toEqual([2])
  })
  it('recognizes community themes without executing them', () => {
    const report = inspectCommunityResourceJson(JSON.stringify({
      name: '粉色主题',
      blur_strength: 8,
      main_text_color: '#ffffff'
    }), 'theme.json')
    expect(report.kind).toBe('theme')
    expect(report.supported).toContain('原始 JSON 无损归档')
  })

  it('recognizes character cards as archiveable resources', () => {
    const report = inspectCommunityResourceJson(JSON.stringify({
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: { name: '测试角色', description: '设定' }
    }), 'card.json')
    expect(report.kind).toBe('character-card')
    expect(report.name).toBe('测试角色')
  })

})

it('识别 Tavo 世界书 camelCase 字段并使用 order', () => {
  const parsed = parseLorebookJson(JSON.stringify({
    name: 'Tavo 世界书',
    entries: [{
      uid: 99,
      key: ['学院'],
      keysecondary: ['校庆'],
      comment: '学院规则',
      content: '规则正文',
      disable: false,
      order: 666,
      selective: true,
      selectiveLogic: 3,
      caseSensitive: false,
      matchWholeWords: true,
      groupOverride: false,
      groupWeight: 100,
      scanDepth: 2,
      excludeRecursion: false,
      preventRecursion: false,
      delayUntilRecursion: true,
      useGroupScoring: false,
      matchScenario: true,
      addMemo: true
    }]
  }))
  const row = parsed.entries[0]
  expect(row.insertionOrder).toBe(666)
  expect(row.selectiveLogic).toBe(3)
  expect(row.matchWholeWords).toBe(true)
  expect(row.scanDepth).toBe(2)
  expect(row.delayUntilRecursion).toBe(true)
  expect(row.matchScenario).toBe(true)
  expect(row.sourceEntryId).toBe(99)
  expect(row.rawExtensions?.addMemo).toBe(true)
})

it('多个 prompt_order 时选择覆盖 prompts 最完整的一组并保留全部分组', () => {
  const parsed = parsePromptPresetJson(JSON.stringify({
    name: '多分组预设',
    prompts: [
      { identifier: 'main', name: 'Main', marker: true },
      { identifier: 'a', name: 'A', content: 'A' },
      { identifier: 'b', name: 'B', content: 'B' }
    ],
    prompt_order: [
      { character_id: 100000, order: [{ identifier: 'main', enabled: true }] },
      { character_id: 100001, order: [{ identifier: 'a', enabled: true }, { identifier: 'b', enabled: true }, { identifier: 'main', enabled: true }] }
    ]
  }))
  expect(parsed.preset.promptOrder.map(item => item.identifier)).toEqual(['a', 'b', 'main'])
  expect(parsed.preset.promptOrderGroups).toHaveLength(2)
  expect(Array.isArray(parsed.preset.rawConfig?.prompt_order)).toBe(true)
})
