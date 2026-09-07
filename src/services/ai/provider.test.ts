import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  OpenAICompatibleProvider
} from './provider'

function createProvider(maxTokens = 2048) {
  return new OpenAICompatibleProvider({
    id: 'test',
    name: '测试接口',
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    model: 'test-model',
    maxTokens
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OpenAICompatibleProvider.chatStream', () => {
  it('解析 SSE 增量内容', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n'
        ))
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n'
        ))
        controller.enqueue(encoder.encode(
          'data: [DONE]\n\n'
        ))
        controller.close()
      }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream'
        }
      }))
    )

    const chunks: string[] = []
    const response = await createProvider().chatStream(
      {
        model: 'test-model',
        messages: []
      },
      {
        onDelta(chunk) {
          chunks.push(chunk.text)
        }
      }
    )

    expect(response.text).toBe('你好')
    expect(chunks).toEqual(['你', '你好'])
  })

  it('兼容忽略流式参数的 JSON 接口', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '完整回复'
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      ))
    )

    const chunks: string[] = []
    const response = await createProvider().chatStream(
      {
        model: 'test-model',
        messages: []
      },
      {
        onDelta(chunk) {
          chunks.push(chunk.text)
        }
      }
    )

    expect(response.text).toBe('完整回复')
    expect(chunks).toEqual(['完整回复'])
  })

  it('输出达到 finish_reason=length：截断内容照常返回，不再报超长', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: '这是一段被截断的回复' },
              finish_reason: 'length'
            }
          ]
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
    )

    const response = await createProvider(64).chat({
      model: 'test-model',
      messages: []
    })

    expect(response.text).toBe('这是一段被截断的回复')
    expect(response.finishReason).toBe('length')
  })

  it('接口不返回 finish_reason 但 completion_tokens 打满上限：仍照常返回已生成内容', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({
          choices: [
            { message: { content: '可能被截断' } }
          ],
          usage: { completion_tokens: 64 }
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
    )

    const response = await createProvider(64).chat({
      model: 'test-model',
      messages: []
    })

    expect(response.text).toBe('可能被截断')
  })

  it('SSE 流在末尾报告 length 时：截断内容可用，不拒绝整轮结果', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{"content":"半段"}}]}\n\n'
        ))
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n'
        ))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      }))
    )

    const response = await createProvider(64).chatStream({
      model: 'test-model',
      messages: []
    })

    expect(response.text).toBe('半段')
  })

  it('HTTP 402 余额耗尽时按 Token/额度不足硬停止', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(
        JSON.stringify({ error: { message: 'payment required' } }),
        {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
    )

    await expect(createProvider().chat({
      model: 'test-model',
      messages: []
    })).rejects.toMatchObject({ name: 'TokenLimitError', kind: 'quota' })
  })

  it('不设上限(0)：请求体不带 max_tokens，输出到底也不判截断', async () => {
    let sentBody = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '')
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: '这是一段非常长的完整回复' },
                finish_reason: 'length'
              }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      })
    )

    const response = await createProvider(0).chat({
      model: 'test-model',
      messages: []
    })

    expect(sentBody).not.toContain('max_tokens')
    expect(response.text).toBe('这是一段非常长的完整回复')
  })


  it('OpenAI-compatible 默认不注入非标准 thinking 字段', async () => {
    let sentBody = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '')
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    const provider = new OpenAICompatibleProvider({
      id: 'openai-compatible',
      name: '兼容接口',
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      thinkingEnabled: false
    })
    await provider.chat({ model: 'test-model', messages: [] })

    expect(JSON.parse(sentBody)).not.toHaveProperty('thinking')
  })

  it('内置 DeepSeek 可显式关闭 thinking', async () => {
    let sentBody = ''
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? '')
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )

    const provider = new OpenAICompatibleProvider({
      id: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      thinkingEnabled: false
    })
    await provider.chat({ model: 'test-model', messages: [] })

    expect(JSON.parse(sentBody)).toMatchObject({ thinking: { type: 'disabled' } })
  })

  it('SSE 流 + 不设上限(0)：末尾 length 不当作失败，整段可用', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{"content":"半段"}}]}\n\n'
        ))
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n'
        ))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      }))
    )

    const response = await createProvider(0).chatStream({
      model: 'test-model',
      messages: []
    })

    expect(response.text).toBe('半段')
  })

})
