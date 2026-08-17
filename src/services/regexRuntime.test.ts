import { describe, expect, it } from 'vitest'
import { applyRegexScript, looksLikeRichHtml, normalizeCommunityPlainText, normalizeRichHtml, regexExecutionOrder } from './regexRuntime'
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
