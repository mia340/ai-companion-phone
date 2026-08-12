import { describe, expect, it } from 'vitest'
import { applyRegexScript, looksLikeRichHtml, normalizeRichHtml } from './regexRuntime'
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

  it('removes whole html code fences before render', () => {
    expect(normalizeRichHtml('```html\\n<div>你好</div>\\n```')).toBe('<div>你好</div>')
  })
})
