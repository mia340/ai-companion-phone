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

function createProvider() {
  return new OpenAICompatibleProvider({
    id: 'test',
    name: '测试接口',
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    model: 'test-model'
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
})
