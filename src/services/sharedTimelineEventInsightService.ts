import type { ChatTurn } from './ai/provider'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import type { SharedTimelineEvent } from './sharedTimelineEventService'

export interface SharedTimelineEventInsight {
  eventId: string
  evidenceIds: string[]
  title: string
  summary: string
}

export class SharedTimelineEventInsightAiUnconfiguredError extends Error {
  constructor() {
    super('还没配好可用的 AI。请先到「设置 → API 与模型」完成配置。')
    this.name = 'SharedTimelineEventInsightAiUnconfiguredError'
  }
}

function clampText(value: unknown, max: number) {
  return sanitizeNativeAppText(String(value ?? ''), { singleLine: true }).slice(0, max).trim()
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function sameEvidenceSet(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  const set = new Set(left)
  return set.size === left.length && right.every(id => set.has(id))
}

export function buildSharedTimelineEventInsightMessages(event: SharedTimelineEvent): ChatTurn[] {
  const evidence = event.items.slice(0, 24).map(item => ({
    id: item.id,
    date: item.occurredAt.slice(0, 16),
    kind: item.sourceKind,
    source: item.sourceLabel,
    text: item.summary.slice(0, 220),
    excerpt: item.sourceExcerpt?.slice(0, 120)
  }))
  return [
    {
      role: 'system',
      content: [
        '你在整理一个已经由 Runtime 验证过的“共同事件”。',
        '绝对不能创造、补写或猜测 evidence 之外的经历，也不能省略某条 evidence 后假装总结了整个事件。',
        '必须返回当前 eventId，并原样返回全部 evidenceIds；缺一条或多一条都视为无效。',
        'title 最多 18 个汉字；summary 最多 90 个汉字，只概括 evidence 共同支持的事实。',
        '严格返回 JSON 对象：{"eventId":"...","evidenceIds":["..."],"title":"...","summary":"..."}。',
        '不要返回 Markdown、代码围栏、HTML、XML 或其它解释。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        eventId: event.id,
        evidenceIds: event.itemIds,
        currentTitle: event.title,
        evidence
      })
    }
  ]
}

export function parseSharedTimelineEventInsight(
  raw: string,
  event: Pick<SharedTimelineEvent, 'id' | 'itemIds'>
): SharedTimelineEventInsight | undefined {
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const row = parsed as Record<string, unknown>
  const eventId = typeof row.eventId === 'string' ? row.eventId : ''
  const evidenceIds = uniqueStrings(row.evidenceIds)
  if (eventId !== event.id || !sameEvidenceSet(evidenceIds, event.itemIds)) return undefined
  const title = clampText(row.title, 18)
  const summary = clampText(row.summary, 90)
  if (!title || !summary) return undefined
  return { eventId, evidenceIds, title, summary }
}

export async function proposeSharedTimelineEventInsight(
  event: SharedTimelineEvent
): Promise<{ insight?: SharedTimelineEventInsight; model: string }> {
  if (!event.items.length) return { model: '' }
  const [{ createProvider }, { getModelSettings }] = await Promise.all([
    import('./ai/providerFactory'),
    import('./modelSettings')
  ])
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new SharedTimelineEventInsightAiUnconfiguredError()
  }
  const provider = createProvider(settings)
  const response = await provider.chat({
    model: settings.model,
    temperature: Math.min(0.4, Math.max(0, settings.temperature ?? 0.25)),
    messages: buildSharedTimelineEventInsightMessages(event)
  })
  return {
    insight: parseSharedTimelineEventInsight(response.text, event),
    model: settings.model
  }
}
