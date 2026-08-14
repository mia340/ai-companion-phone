export interface ChatTextPart {
  type: 'text'
  text: string
}

export interface ChatImagePart {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export type ChatTurnContent =
  | string
  | Array<ChatTextPart | ChatImagePart>

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: ChatTurnContent
}

export interface CharacterReplyContext {
  characterName: string
  userName?: string
  identity?: string
  persona?: string
  speakingStyle?: string
  background?: string
  relationship?: string
  mood?: string
  activity?: string
  likes?: string[]
  dislikes?: string[]
  scenario?: string
  roleplayMode?: 'daily' | 'immersive' | 'deep'
  initiative?: 'low' | 'natural' | 'high'
  narrationStyle?: 'none' | 'light' | 'immersive'
  emojiFrequency?: 'none' | 'low' | 'natural' | 'high'
  questionFrequency?: 'low' | 'natural' | 'high'
}

export interface ChatRequest {
  model: string
  messages: ChatTurn[]
  temperature?: number
  character?: CharacterReplyContext
  signal?: AbortSignal
}

export interface ChatResponse {
  text: string
  raw?: unknown
  finishReason?: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface ChatStreamChunk {
  delta: string
  text: string
}

export interface ChatStreamHandlers {
  onDelta?: (
    chunk: ChatStreamChunk
  ) => void | Promise<void>
}

export interface ProviderModel {
  id: string
  name?: string
  ownedBy?: string
}

export interface ModelProvider {
  id: string
  name: string
  chat(
    request: ChatRequest
  ): Promise<ChatResponse>
  chatStream(
    request: ChatRequest,
    handlers?: ChatStreamHandlers
  ): Promise<ChatResponse>
  listModels(): Promise<ProviderModel[]>
  testConnection(): Promise<boolean>
  testVision(): Promise<boolean>
}

export interface OpenAICompatibleProviderOptions {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  maxTokens?: number
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
    code?: string
  }
  message?: string
  detail?: string
}

interface OpenAIModelListResponse {
  data?: unknown
  models?: unknown
  error?: {
    message?: string
    code?: string
  }
  message?: string
  detail?: string
}

function normalizeBaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/(?:chat\/completions|models)\/?$/i, '')
    .replace(/\/+$/, '')
}

function buildEndpoint(
  baseUrl: string,
  path: string
) {
  return `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
}

function extractErrorMessage(
  data: unknown
) {
  if (
    typeof data === 'object' &&
    data !== null
  ) {
    const record = data as Record<string, unknown>
    const error = record.error

    if (
      typeof error === 'object' &&
      error !== null
    ) {
      const message = (
        error as Record<string, unknown>
      ).message

      if (typeof message === 'string') {
        return message
      }
    }

    if (typeof error === 'string') {
      return error
    }

    if (typeof record.message === 'string') {
      return record.message
    }

    if (typeof record.detail === 'string') {
      return record.detail
    }
  }

  return ''
}

export class TokenLimitError extends Error {
  readonly kind: 'context' | 'output' | 'quota'

  constructor(kind: 'context' | 'output' | 'quota', message: string) {
    super(message)
    this.name = 'TokenLimitError'
    this.kind = kind
  }
}

export function isTokenLimitError(error: unknown): error is TokenLimitError {
  return error instanceof TokenLimitError
}

function tokenErrorKind(message: string): TokenLimitError['kind'] | undefined {
  const source = message.toLowerCase()
  if (/(insufficient[_ -]?quota|quota exceeded|billing|credit balance|account balance|余额不足|额度不足|配额不足)/i.test(source)) return 'quota'
  if (/(context[_ -]?length|maximum context|context window|too many tokens|prompt is too long|input tokens|上下文.{0,8}(超|过|不足)|输入.{0,8}token)/i.test(source)) return 'context'
  if (/(max[_ -]?tokens|token limit|output tokens|completion tokens|达到.{0,8}token|输出.{0,8}token)/i.test(source)) return 'output'
  return undefined
}

function tokenLimitMessage(kind: TokenLimitError['kind'], detail = '') {
  const suffix = detail ? `：${detail}` : ''
  if (kind === 'quota') return `API Token/额度不足，无法继续生成。请补充额度或更换可用接口后重试${suffix}`
  if (kind === 'context') return `上下文 Token 已超过模型可用窗口，无法继续生成。请缩短上下文、压缩记忆或更换更大上下文模型后重试${suffix}`
  return `本轮回复达到最大输出 Token，无法保证内容完整，因此本轮不会保存。请提高“最大输出长度”后重试${suffix}`
}

function tokenErrorFromMessage(message: string) {
  const kind = tokenErrorKind(message)
  return kind ? new TokenLimitError(kind, tokenLimitMessage(kind, message)) : undefined
}

function assertCompletionFinished(finishReason?: string | null) {
  if (!finishReason) return
  const normalized = finishReason.toLowerCase()
  if (normalized === 'length' || normalized === 'max_tokens') {
    throw new TokenLimitError('output', tokenLimitMessage('output'))
  }
}

function assertOutputBudget(
  usage: ChatResponse['usage'] | undefined,
  finishReason: string | undefined,
  maxTokens: number
) {
  // 少数 OpenAI-compatible 接口不返回 finish_reason。若输出恰好打满请求上限，
  // 宁可视为可能截断并停止，也不把半句话保存成角色回复。
  if (finishReason || !usage?.completionTokens) return
  if (usage.completionTokens >= maxTokens) {
    throw new TokenLimitError('output', tokenLimitMessage('output'))
  }
}

export class ProviderHttpError extends Error {
  readonly status: number
  readonly providerMessage: string

  constructor(status: number, message: string, providerMessage = '') {
    super(message)
    this.name = 'ProviderHttpError'
    this.status = status
    this.providerMessage = providerMessage
  }
}

function createHttpError(
  status: number,
  providerMessage = ''
) {
  const tokenError = tokenErrorFromMessage(providerMessage)
  if (tokenError) return tokenError
  // 多数 OpenAI-compatible 服务用 HTTP 402 表示余额/额度耗尽。
  // 这类情况必须硬停止，不能退回本地角色内容。
  if (status === 402) {
    return new TokenLimitError('quota', tokenLimitMessage('quota', providerMessage))
  }

  const suffix = providerMessage
    ? `：${providerMessage}`
    : ''

  let message: string

  if (status === 400) {
    message = `请求格式或模型名称错误${suffix}`
  } else if (status === 401) {
    message = `API Key 无效或已失效${suffix}`
  } else if (status === 403) {
    message = `没有接口访问权限，或账户余额不足${suffix}`
  } else if (status === 404) {
    message = `没有找到接口，请检查 API 地址是否需要包含 /v1${suffix}`
  } else if (status === 429) {
    message = `请求过于频繁，或接口额度不足${suffix}`
  } else if (status >= 500) {
    message = `模型服务暂时异常（HTTP ${status}）${suffix}`
  } else {
    message = `模型请求失败（HTTP ${status}）${suffix}`
  }

  return new ProviderHttpError(status, message, providerMessage)
}

export function isVisionUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) return false

  const source = error.message.toLowerCase()
  const visionTerms = [
    'image_url',
    'image input',
    'vision',
    'multimodal',
    'content must be a string',
    'unsupported content',
    'does not support image',
    '不支持图片',
    '不支持图像',
    '不支持多模态',
    '消息内容必须是字符串',
    'invalid content type',
    'content array',
    'array is not allowed',
    'expected string'
  ]

  const status = error instanceof ProviderHttpError
    ? error.status
    : undefined

  return (
    status === 400 ||
    status === 404 ||
    status === 415 ||
    status === 422
  ) && visionTerms.some(term => source.includes(term))
}


async function readJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error(
      `模型服务返回了无法解析的数据（HTTP ${response.status}）。`
    )
  }
}

function parseModelEntries(
  source: unknown
): ProviderModel[] {
  const candidates: unknown[] = []

  if (Array.isArray(source)) {
    candidates.push(...source)
  } else if (
    typeof source === 'object' &&
    source !== null
  ) {
    const record = source as Record<string, unknown>

    if (Array.isArray(record.data)) {
      candidates.push(...record.data)
    }

    if (Array.isArray(record.models)) {
      candidates.push(...record.models)
    }
  }

  const models = candidates
    .map((item): ProviderModel | null => {
      if (typeof item === 'string') {
        const id = item.trim()

        return id
          ? { id }
          : null
      }

      if (
        typeof item !== 'object' ||
        item === null
      ) {
        return null
      }

      const record =
        item as Record<string, unknown>

      const rawId =
        record.id ??
        record.model ??
        record.name

      if (typeof rawId !== 'string') {
        return null
      }

      const id = rawId.trim()

      if (!id) return null

      const name =
        typeof record.name === 'string'
          ? record.name.trim()
          : undefined

      const ownedByRaw =
        record.owned_by ??
        record.ownedBy ??
        record.provider

      const ownedBy =
        typeof ownedByRaw === 'string'
          ? ownedByRaw.trim()
          : undefined

      return {
        id,
        name: name || undefined,
        ownedBy: ownedBy || undefined
      }
    })
    .filter(
      (item): item is ProviderModel =>
        item !== null
    )

  const unique = new Map<
    string,
    ProviderModel
  >()

  for (const model of models) {
    if (!unique.has(model.id)) {
      unique.set(model.id, model)
    }
  }

  return [...unique.values()]
}

function extractAssistantText(
  content: string | Array<{ type?: string; text?: string }> | undefined
) {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''

  return content
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim()
}

function extractStreamingText(value: unknown) {
  if (typeof value === 'string') return value

  if (!Array.isArray(value)) return ''

  return value
    .map(part => {
      if (
        typeof part === 'object' &&
        part !== null &&
        typeof (part as Record<string, unknown>).text === 'string'
      ) {
        return (part as Record<string, unknown>).text as string
      }

      return ''
    })
    .join('')
}

function parseJsonSafely(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function extractStreamDelta(payload: unknown) {
  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return ''
  }

  const choices = (
    payload as Record<string, unknown>
  ).choices

  if (!Array.isArray(choices)) return ''

  const first = choices[0]

  if (
    typeof first !== 'object' ||
    first === null
  ) {
    return ''
  }

  const choice = first as Record<string, unknown>
  const delta = choice.delta

  if (
    typeof delta === 'object' &&
    delta !== null
  ) {
    const content = (
      delta as Record<string, unknown>
    ).content

    const text = extractStreamingText(content)
    if (text) return text
  }

  if (typeof choice.text === 'string') {
    return choice.text
  }

  const message = choice.message

  if (
    typeof message === 'object' &&
    message !== null
  ) {
    return extractStreamingText(
      (message as Record<string, unknown>).content
    )
  }

  return ''
}


function extractStreamMeta(payload: unknown) {
  if (typeof payload !== 'object' || payload === null) return {}
  const record = payload as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0]
  const finishReason = typeof first === 'object' && first !== null && typeof (first as Record<string, unknown>).finish_reason === 'string'
    ? String((first as Record<string, unknown>).finish_reason)
    : undefined
  const usageRaw = typeof record.usage === 'object' && record.usage !== null
    ? record.usage as Record<string, unknown>
    : undefined
  const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
  return {
    finishReason,
    usage: usageRaw ? {
      promptTokens: numberValue(usageRaw.prompt_tokens),
      completionTokens: numberValue(usageRaw.completion_tokens),
      totalTokens: numberValue(usageRaw.total_tokens)
    } : undefined
  }
}

async function emitStreamText(
  handlers: ChatStreamHandlers | undefined,
  delta: string,
  fullText: string
) {
  if (!delta) return

  await handlers?.onDelta?.({
    delta,
    text: fullText
  })
}

async function readEventStream(
  response: Response,
  handlers: ChatStreamHandlers | undefined,
  maxTokens: number
): Promise<ChatResponse> {
  if (!response.body) {
    throw new Error('当前浏览器无法读取流式回复。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let rawText = ''
  let text = ''
  let eventCount = 0
  let finishReason: string | undefined
  let usage: ChatResponse['usage']

  const consumeBlock = async (block: string) => {
    const dataLines = block
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())

    for (const dataLine of dataLines) {
      if (!dataLine || dataLine === '[DONE]') continue

      const payload = parseJsonSafely(dataLine)
      if (payload === undefined) continue

      eventCount += 1
      const meta = extractStreamMeta(payload)
      if (meta.finishReason) finishReason = meta.finishReason
      if (meta.usage) usage = { ...(usage || {}), ...meta.usage }
      const delta = extractStreamDelta(payload)

      if (delta) {
        text += delta
        await emitStreamText(
          handlers,
          delta,
          text
        )
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()

    if (done) break

    const decoded = decoder.decode(value, {
      stream: true
    })
    buffer += decoded
    rawText += decoded

    while (true) {
      const boundary = buffer.match(/\r?\n\r?\n/)
      if (!boundary || boundary.index === undefined) break

      const block = buffer.slice(0, boundary.index)
      buffer = buffer.slice(
        boundary.index + boundary[0].length
      )

      await consumeBlock(block)
    }
  }

  const tail = decoder.decode()
  buffer += tail
  rawText += tail

  if (buffer.trim()) {
    await consumeBlock(buffer)
  }

  if (!text) {
    const fallbackData = parseJsonSafely(rawText.trim())

    if (fallbackData !== undefined) {
      const meta = extractStreamMeta(fallbackData)
      if (meta.finishReason) finishReason = meta.finishReason
      if (meta.usage) usage = { ...(usage || {}), ...meta.usage }
      const fallbackText = extractStreamDelta(fallbackData)

      if (fallbackText) {
        text = fallbackText
        await emitStreamText(
          handlers,
          fallbackText,
          fallbackText
        )
      }
    }
  }

  if (!text) {
    throw new Error('模型没有返回有效的流式回复。')
  }

  assertCompletionFinished(finishReason)
  assertOutputBudget(usage, finishReason, maxTokens)

  return {
    text: text.trim(),
    finishReason,
    usage,
    raw: {
      streamed: true,
      eventCount,
      finishReason,
      usage
    }
  }
}

const VISION_TEST_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zq2sAAAAASUVORK5CYII='

export class OpenAICompatibleProvider
implements ModelProvider {
  id: string
  name: string

  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly model: string
  private readonly maxTokens: number

  constructor(
    options: OpenAICompatibleProviderOptions
  ) {
    this.id = options.id
    this.name = options.name
    this.baseUrl = normalizeBaseUrl(
      options.baseUrl
    )
    this.apiKey = options.apiKey.trim()
    this.model = options.model.trim()
    this.maxTokens = options.maxTokens ?? 2048
  }

  private validateEndpointConfig() {
    if (!this.baseUrl) {
      throw new Error('请填写 API 地址。')
    }

    if (!this.apiKey) {
      throw new Error('请填写 API Key。')
    }
  }

  private validateConfig() {
    this.validateEndpointConfig()

    if (!this.model) {
      throw new Error(
        '请选择或手动填写模型名称。'
      )
    }
  }

  async chat(
    request: ChatRequest
  ): Promise<ChatResponse> {
    this.validateConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'chat/completions'
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model:
              request.model || this.model,
            messages: request.messages,
            temperature:
              request.temperature ?? 0.8,
            max_tokens: this.maxTokens,
            stream: false
          }),
          signal: request.signal
        }
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    const data = await readJsonResponse(
      response
    ) as OpenAIChatCompletionResponse

    if (!response.ok) {
      throw createHttpError(
        response.status,
        extractErrorMessage(data)
      )
    }

    const finishReason = data.choices?.[0]?.finish_reason || undefined
    const usage: ChatResponse['usage'] = {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens
    }
    assertCompletionFinished(finishReason)
    assertOutputBudget(usage, finishReason, this.maxTokens)

    const text = extractAssistantText(
      data.choices?.[0]?.message?.content
    )

    if (!text) {
      throw new Error('模型没有返回有效回复。')
    }

    return {
      text,
      raw: data,
      finishReason,
      usage
    }
  }

  async chatStream(
    request: ChatRequest,
    handlers?: ChatStreamHandlers
  ): Promise<ChatResponse> {
    this.validateConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'chat/completions'
        ),
        {
          method: 'POST',
          headers: {
            Accept: 'text/event-stream, application/json',
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model:
              request.model || this.model,
            messages: request.messages,
            temperature:
              request.temperature ?? 0.8,
            max_tokens: this.maxTokens,
            stream: true
          }),
          signal: request.signal
        }
      )
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error
      }

      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    if (!response.ok) {
      const raw = await response.text()
      const data = parseJsonSafely(raw)
      const providerMessage =
        extractErrorMessage(data) ||
        raw.trim().slice(0, 500)

      throw createHttpError(
        response.status,
        providerMessage
      )
    }

    const contentType =
      response.headers.get('content-type')?.toLowerCase() ?? ''

    if (contentType.includes('application/json')) {
      const data = await readJsonResponse(
        response
      ) as OpenAIChatCompletionResponse

      const finishReason = data.choices?.[0]?.finish_reason || undefined
      const usage: ChatResponse['usage'] = {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
      assertCompletionFinished(finishReason)
      assertOutputBudget(usage, finishReason, this.maxTokens)

      const text = extractAssistantText(
        data.choices?.[0]?.message?.content
      )

      if (!text) {
        throw new Error('模型没有返回有效回复。')
      }

      await emitStreamText(
        handlers,
        text,
        text
      )

      return {
        text,
        raw: data,
        finishReason,
        usage
      }
    }

    return readEventStream(
      response,
      handlers,
      this.maxTokens
    )
  }

  async listModels(): Promise<ProviderModel[]> {
    this.validateEndpointConfig()

    let response: Response

    try {
      response = await fetch(
        buildEndpoint(
          this.baseUrl,
          'models'
        ),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization:
              `Bearer ${this.apiKey}`
          }
        }
      )
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `网络连接失败：${error.message}`
          : '网络连接失败，请检查 API 地址。'
      )
    }

    const data = await readJsonResponse(
      response
    ) as OpenAIModelListResponse

    if (!response.ok) {
      throw createHttpError(
        response.status,
        extractErrorMessage(data)
      )
    }

    const models = parseModelEntries(data)

    if (models.length === 0) {
      throw new Error(
        '接口已连接，但没有返回可用模型列表。请改用手动填写。'
      )
    }

    return models
  }

  async testConnection(): Promise<boolean> {
    await this.chat({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: '请只回复“连接成功”。'
        }
      ]
    })

    return true
  }

  async testVision(): Promise<boolean> {
    await this.chat({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '这是一张极小的测试图片。请只回复“图片可读”。'
            },
            {
              type: 'image_url',
              image_url: {
                url: VISION_TEST_IMAGE,
                detail: 'low'
              }
            }
          ]
        }
      ]
    })

    return true
  }
}
