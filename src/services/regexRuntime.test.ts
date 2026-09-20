import { describe, expect, it } from 'vitest'
import { applyRegexScript, applyRegexStage, looksLikeRichHtml, normalizeCommunityPlainText, normalizeRichHtml, regexEphemerality, regexExecutionOrder, regexScriptsForDynamicDepthPhase, regexScriptsForStage } from './regexRuntime'
import { regexProducesRichUi } from './communityUiRuntime'
import type { RegexScript } from '../types/domain'

const script: RegexScript = {
  id: 'regex',
  worldId: 'world',
  name: 'UI',
  findRegex: '\\\\[UI\\\\]([\\\\s\\\\S]*?)\\\\[/UI\\\\]',
  replaceString: '<div class="card">$1</div>',
  trimStrings: [],
  placement: [2],
  enabled: true,
  markdownOnly: false,
  promptOnly: false,
  runOnEdit: false,
  substituteRegex: 0,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z'
}

describe('regex UI runtime', () => {
  it('transforms output into rich html', () => {
    const output = applyRegexScript('[UI]你好[/UI]', script)
    expect(output).toContain('<div class="card">你好</div>')
    expect(looksLikeRichHtml(output)).toBe(true)
  })


  it('locally tolerates Chinese full-width brackets when author Regex expects square brackets', () => {
    const forum = {
      ...script,
      name: '论坛',
      findRegex: '\\[折叠标题：([^\\]]+)\\]\\s*\\[主题：([^\\]]+)\\]\\s*\\[正文：([\\s\\S]+)',
      replaceString: '<details><summary>$1</summary><div>$2 · $3</div></details>'
    }
    const output = applyRegexScript('【折叠标题：咖啡馆】\n【主题：下雨天】\n【正文：今天下雨了】', forum)
    expect(output).toContain('<details>')
    expect(output).toContain('咖啡馆')
    expect(output).toContain('今天下雨了')
  })
  it('keeps authentic AI text unchanged when the regex does not match', () => {
    const output = applyRegexScript('这是 AI 的普通正文，没有 UI 标签。', script)
    expect(output).toBe('这是 AI 的普通正文，没有 UI 标签。')
  })

  it('recovers execution order from legacy raw regex data without a database migration', () => {
    expect(regexExecutionOrder({ ...script, order: undefined, raw: { order: 7 } })).toBe(7)
    expect(regexExecutionOrder({ ...script, order: 2, raw: { order: 7 } })).toBe(2)
  })

  it('removes whole html code fences before render', () => {
    expect(normalizeRichHtml('```html\\n<div>你好</div>\\n```')).toBe('<div>你好</div>')
  })

  it('把只有 br 的社区开场转换成普通文本换行', () => {
    expect(normalizeCommunityPlainText('第一行<br>第二行<br/>第三行')).toBe('第一行\n第二行\n第三行')
  })
})

it('normalizes a full HTML document into a Shadow-DOM mountable fragment', () => {
  const result = normalizeRichHtml('```html\n<!DOCTYPE html><html><head><style>.card{padding:8px}</style></head><body><div class="card">你好</div></body></html>\n```')
  expect(result).toContain('<style>.card{padding:8px}</style>')
  expect(result).toContain('<div class="card">你好</div>')
  expect(result).not.toContain('<!DOCTYPE html>')
  expect(result).not.toContain('<body>')
})

it('keeps surrounding text when a full HTML UI is embedded in the reply', () => {
  const result = normalizeRichHtml('正文开头\n```html\n<!DOCTYPE html><html><head><style>.card{padding:8px}</style></head><body><div class="card">状态</div></body></html>\n```\n正文结尾')
  expect(result).toContain('正文开头')
  expect(result).toContain('<style>.card{padding:8px}</style>')
  expect(result).toContain('<div class="card">状态</div>')
  expect(result).toContain('正文结尾')
  expect(result).not.toContain('<!DOCTYPE html>')
})

it('resolves user/char macros inside regex replacement UI', () => {
  const output = applyRegexScript('<x>状态</x>', { ...script, findRegex: '/<x>(.*?)<\\/x>/s', replaceString: '<div>{{user}} · {{char}} · $1</div>' }, { user: '用户甲', char: '角色甲' })
  expect(output).toBe('<div>用户甲 · 角色甲 · 状态</div>')
})


describe('Regex Pipeline V2 ephemerality', () => {
  const makeScript = (overrides: Partial<RegexScript> = {}): RegexScript => ({
    ...script,
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || 'pipeline',
    findRegex: 'SECRET',
    replaceString: 'VISIBLE',
    placement: [2],
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    sourceFormat: 'tavo',
    ...overrides
  })

  it('neither flag means persistent storage mutation only', () => {
    const item = makeScript()
    expect(regexEphemerality(item)).toBe('persistent')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'storage', depth: 0 }).text).toBe('VISIBLE')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'display', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('SECRET')
  })

  it('markdownOnly changes display without mutating storage or outgoing prompt', () => {
    const item = makeScript({ markdownOnly: true })
    expect(regexEphemerality(item)).toBe('display-only')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'storage', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'display', depth: 0 }).text).toBe('VISIBLE')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('SECRET')
  })

  it('promptOnly changes only the outgoing model view', () => {
    const item = makeScript({ promptOnly: true })
    expect(regexEphemerality(item)).toBe('prompt-only')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'storage', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'display', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('VISIBLE')
  })

  it('markdownOnly + promptOnly changes display and model view while preserving storage', () => {
    const item = makeScript({ markdownOnly: true, promptOnly: true })
    expect(regexEphemerality(item)).toBe('display-and-prompt')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'storage', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'display', depth: 0 }).text).toBe('VISIBLE')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('VISIBLE')
  })

  it('respects placement and does not apply an AI-response script to user input', () => {
    const item = makeScript({ placement: [2] })
    expect(applyRegexStage('SECRET', [item], { source: 'user-input', phase: 'storage', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'storage', depth: 0 }).text).toBe('VISIBLE')
  })

  it('respects minDepth and maxDepth where depth 0 is the newest message', () => {
    const item = makeScript({ promptOnly: true, minDepth: 1, maxDepth: 2 })
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 1 }).text).toBe('VISIBLE')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 2 }).text).toBe('VISIBLE')
    expect(applyRegexStage('SECRET', [item], { source: 'assistant-output', phase: 'outgoing-prompt', depth: 3 }).text).toBe('SECRET')
  })

  it('keeps future-depth prompt candidates before each history row knows its actual depth', () => {
    const item = makeScript({ promptOnly: true, minDepth: 2, maxDepth: 4 })
    const candidates = regexScriptsForDynamicDepthPhase([item], { source: 'assistant-output', phase: 'outgoing-prompt' })
    expect(candidates).toHaveLength(1)
    expect(applyRegexStage('SECRET', candidates, { source: 'assistant-output', phase: 'outgoing-prompt', depth: 0 }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', candidates, { source: 'assistant-output', phase: 'outgoing-prompt', depth: 3 }).text).toBe('VISIBLE')
  })

  it('only reruns runOnEdit scripts during an edit event', () => {
    const disabledOnEdit = makeScript({ runOnEdit: false })
    const enabledOnEdit = makeScript({ id: 'edit-enabled', runOnEdit: true })
    expect(applyRegexStage('SECRET', [disabledOnEdit], { source: 'assistant-output', phase: 'storage', depth: 0, event: 'edit' }).text).toBe('SECRET')
    expect(applyRegexStage('SECRET', [enabledOnEdit], { source: 'assistant-output', phase: 'storage', depth: 0, event: 'edit' }).text).toBe('VISIBLE')
  })

  it('keeps imported scripts with empty placement inert but preserves old native compatibility', () => {
    const imported = makeScript({ placement: [], sourceFormat: 'tavo' })
    const native = makeScript({ placement: [], sourceFormat: 'native' })
    expect(regexScriptsForStage([imported], { source: 'assistant-output', phase: 'storage' })).toHaveLength(0)
    expect(regexScriptsForStage([native], { source: 'assistant-output', phase: 'storage' })).toHaveLength(1)
  })

  it('applies persistent and prompt-affecting World Info regex only during prompt assembly', () => {
    const persistent = makeScript({ id: 'wi-persistent', name: 'wi-persistent', placement: [5] })
    const prompt = makeScript({ id: 'wi-prompt', name: 'wi-prompt', placement: [5], promptOnly: true })
    const displayOnly = makeScript({ id: 'wi-display', name: 'wi-display', placement: [5], markdownOnly: true })
    const result = applyRegexStage('SECRET', [persistent, prompt, displayOnly], { source: 'world-info', phase: 'outgoing-prompt' })
    expect(result.applied).toContain(persistent.name)
    expect(result.applied).not.toContain(displayOnly.name)
  })

  it('recognizes rich markdownOnly+promptOnly renderers as display UI, but not promptOnly-only renderers', () => {
    const rich = '<div class="status">$1</div>'
    expect(regexProducesRichUi(makeScript({ markdownOnly: true, promptOnly: true, replaceString: rich }))).toBe(true)
    expect(regexProducesRichUi(makeScript({ markdownOnly: false, promptOnly: true, replaceString: rich }))).toBe(false)
  })
})

it('V0.4.7.1 rich 开场中的 Markdown 图片会转成 SafeRichHtml 可显示的静态图片', () => {
  const html = normalizeRichHtml('<details><summary>状态</summary>![](https://example.com/a.png)</details>')
  expect(html).toContain('<img src="https://example.com/a.png"')
  expect(html).not.toContain('![](')
})
