import type { ModelSettings } from '../../types/modelSettings'

export interface EmbeddingResult {
  text: string
  embedding: number[]
}

export interface EmbeddingTestResult {
  ok: boolean
  dimensions?: number
  model?: string
  error?: string
}

function normalizeBaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/(?:chat\/completions|embeddings|models)\/?$/i, '')
    .replace(/\/+$/, '')
}

export function embeddingModelName(settings: ModelSettings): string {
  return settings.embeddingModel?.trim() || 'text-embedding-3-small'
}

/**
 * Calls an OpenAI-compatible /embeddings endpoint. Reuses the chat baseUrl / apiKey,
 * because most compatible gateways expose chat completions and embeddings together.
 */
export async function createEmbeddings(
  settings: Pick<ModelSettings, 'baseUrl' | 'apiKey'>,
  texts: string[],
  model: string,
  signal?: AbortSignal
): Promise<EmbeddingResult[]> {
  const cleaned = texts.map(text => text.trim()).filter(Boolean)
  if (!cleaned.length) return []

  const endpoint = `${normalizeBaseUrl(settings.baseUrl)}/embeddings`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({ model, input: cleaned }),
    signal
  })

  if (!response.ok) {
    let detail = ''
    try {
      const data = await response.json()
      detail = data?.error?.message || data?.message || ''
    } catch {
      // ignore non-json error body
    }
    throw new Error(
      `Embedding 接口请求失败（HTTP ${response.status}）${detail ? `：${detail}` : '。'}`
    )
  }

  const data = await response.json()
  const rows: Array<{ embedding?: number[] }> = Array.isArray(data?.data) ? data.data : []
  if (!rows.length) throw new Error('Embedding 接口未返回向量数据。')

  // OpenAI-compatible responses are normally ordered; guard against index drift.
  const byIndex = new Map<number, number[]>()
  for (const row of rows) {
    const idx = (row as { index?: number }).index
    if (Array.isArray(row.embedding) && typeof idx === 'number') {
      byIndex.set(idx, row.embedding)
    }
  }

  return cleaned.map((text, index) => {
    const embedding = byIndex.get(index) || rows[index]?.embedding
    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error(`第 ${index + 1} 条文本未获得有效向量。`)
    }
    return { text, embedding }
  })
}

export async function createSingleEmbedding(
  settings: Pick<ModelSettings, 'baseUrl' | 'apiKey'>,
  text: string,
  model: string,
  signal?: AbortSignal
): Promise<number[]> {
  const [result] = await createEmbeddings(settings, [text], model, signal)
  if (!result) throw new Error('未获得向量。')
  return result.embedding
}

export async function testEmbeddingEndpoint(
  settings: ModelSettings
): Promise<EmbeddingTestResult> {
  const model = embeddingModelName(settings)
  try {
    const embedding = await createSingleEmbedding(settings, '连接测试', model)
    return { ok: true, dimensions: embedding.length, model }
  } catch (error) {
    return {
      ok: false,
      model,
      error: error instanceof Error ? error.message : '未知错误。'
    }
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
