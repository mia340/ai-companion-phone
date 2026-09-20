import { describe, expect, it } from 'vitest'
import { analyzePromptSections, estimateTextTokens } from './promptDebugService'

describe('Prompt Debug Context Inspector', () => {
  it('按实际文本估算 CJK 与普通文本 token，而不是固定字符/4', () => {
    expect(estimateTextTokens('你好世界')).toBeGreaterThanOrEqual(4)
    expect(estimateTextTokens('hello world')).toBeLessThan(estimateTextTokens('你好世界你好世界'))
  })

  it('Prompt section 会保留字符数与 token 估算，并识别预设/世界书/最近消息', () => {
    const sections = analyzePromptSections([
      '基础协议',
      '【当前 Prompt 预设】测试预设',
      '【预设 · tone · system】自然说话',
      '【本轮触发的世界书】雨夜规则'
    ].join('\n'), [
      { role: 'user', content: '今晚下雨吗？' }
    ])
    expect(sections.some(item => item.key.includes('预设') && (item.estimatedTokens || 0) > 0)).toBe(true)
    expect(sections.some(item => item.label === '世界书' && (item.estimatedTokens || 0) > 0)).toBe(true)
    expect(sections.find(item => item.key === 'recentMessages')).toMatchObject({ characters: 6 })
  })
})
