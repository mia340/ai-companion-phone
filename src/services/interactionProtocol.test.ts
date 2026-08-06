import { describe, expect, it } from 'vitest'
import { naturalnessWarnings, parseCompanionOutput, visibleStreamingText } from './interactionProtocol'

describe('interaction protocol', () => {
  it('parses multiple messages and hidden state', () => {
    const raw = '<companion_packet>{"messages":[{"kind":"text","content":"原来你喜欢这种类型。"},{"kind":"emoji","content":"😒"},{"kind":"voice","content":"我才没有吃醋。"}],"status":{"mood":"有一点吃醋","activity":"盯着第二张图","location":"卧室"}}</companion_packet>'
    const result = parseCompanionOutput(raw)
    expect(result.messages).toHaveLength(3)
    expect(result.messages[1].kind).toBe('emoji')
    expect(result.status?.mood).toBe('有一点吃醋')
    expect(result.visibleText).not.toContain('companion_packet')
  })

  it('keeps plain text as a normal message', () => {
    const result = parseCompanionOutput('你回来啦。')
    expect(result.messages).toEqual([{ kind: 'text', content: '你回来啦。' }])
  })

  it('hides partial protocol while streaming', () => {
    expect(visibleStreamingText('先等等。<companion_')).toBe('先等等。')
  })

  it('detects common assistant phrasing', () => {
    expect(naturalnessWarnings('你分享了三张图片。你是想分析角色还是画风？').length).toBeGreaterThan(1)
  })
})
