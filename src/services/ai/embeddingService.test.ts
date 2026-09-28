import { afterEach, describe, expect, it, vi } from 'vitest'

import { cosineSimilarity, createEmbeddings } from './embeddingService'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('embeddingService', () => {
  it('复用 OpenAI 兼容地址并切换到 embeddings 端点', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://example.com/v1/embeddings')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'embed-model',
        input: ['第一条', '第二条']
      })
      return new Response(JSON.stringify({
        data: [
          { index: 0, embedding: [1, 0] },
          { index: 1, embedding: [0, 1] }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await createEmbeddings(
      { baseUrl: 'https://example.com/v1/chat/completions', apiKey: 'secret' },
      [' 第一条 ', '', '第二条'],
      'embed-model'
    )

    expect(rows).toEqual([
      { text: '第一条', embedding: [1, 0] },
      { text: '第二条', embedding: [0, 1] }
    ])
  })

  it('按响应 index 恢复原输入顺序', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [
        { index: 1, embedding: [0, 2] },
        { index: 0, embedding: [2, 0] }
      ]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const rows = await createEmbeddings(
      { baseUrl: 'https://example.com/v1', apiKey: 'secret' },
      ['A', 'B'],
      'embed-model'
    )

    expect(rows.map(row => row.embedding)).toEqual([[2, 0], [0, 2]])
  })

  it('接口失败时保留可读错误信息', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'model unavailable' }
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })))

    await expect(createEmbeddings(
      { baseUrl: 'https://example.com/v1', apiKey: 'secret' },
      ['A'],
      'embed-model'
    )).rejects.toThrow('HTTP 503')
  })

  it('余弦相似度处理同向、正交和非法维度', () => {
    expect(cosineSimilarity([1, 0], [2, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0], [0, 3])).toBeCloseTo(0)
    expect(cosineSimilarity([1], [1, 2])).toBe(0)
  })
})
