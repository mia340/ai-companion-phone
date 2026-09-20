import { describe, expect, it } from 'vitest'
import { containsAssistantSelfRefusal, diagnoseApiResponse, diagnoseApiHttpError } from './apiResponseDiagnostics'

describe('API 响应诊断（仅观察，不改写回复）', () => {
  it('识别自述拒绝文本但不推断源头', () => {
    const text = '我不能继续参与带有浪漫或亲密暗示的虚构剧情互动。作为人工智能，我无法代入恋爱场景。'
    expect(containsAssistantSelfRefusal(text)).toBe(true)
    expect(diagnoseApiResponse({ text, httpStatus: 200, finishReason: 'stop' })).toEqual({
      httpStatus: 200, finishReason: 'stop', structuredRefusal: false,
      textRefusal: true, outcome: 'text-refusal'
    })
  })

  it('正常剧情即使出现角色说“我不能”也不当作系统拒绝', () => {
    const text = '姚栩升看了看你：“我不能陪你去。”'
    expect(containsAssistantSelfRefusal(text)).toBe(false)
    expect(diagnoseApiResponse({ text, httpStatus: 200 }).outcome).toBe('no-refusal-indicator')
  })

  it('结构化拒绝标记优先，保留 finish_reason', () => {
    expect(diagnoseApiResponse({ text: '抱歉', httpStatus: 200, refusalMarker: true, finishReason: 'content_filter' })).toEqual({
      httpStatus: 200, finishReason: 'content_filter', structuredRefusal: true,
      textRefusal: false, outcome: 'structured-refusal'
    })
  })

  it('HTTP 失败只留状态码，不记录服务商错误正文或 API Key', () => {
    const result = diagnoseApiHttpError(403)
    expect(result).toEqual({ httpStatus: 403, structuredRefusal: false, textRefusal: false, outcome: 'http-error' })
    expect(JSON.stringify(result)).not.toMatch(/api.key|authorization|bearer/i)
  })
})
