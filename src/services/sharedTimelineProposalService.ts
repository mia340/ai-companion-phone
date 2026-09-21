import { createProvider } from './ai/providerFactory'
import { getModelSettings } from './modelSettings'
import { sanitizeNativeAppText } from './appPresentationPolicy'
import type { ChatTurn } from './ai/provider'
import type { SharedTimelineItem } from './sharedTimelineService'

export interface SharedTimelineProposal {
  id: string
  title: string
  reason: string
}

export class SharedTimelineAiUnconfiguredError extends Error {
  constructor() {
    super('还没配好可用的 AI。请先到「设置 → API 与模型」完成配置。')
    this.name = 'SharedTimelineAiUnconfiguredError'
  }
}

function clampText(value: unknown, max: number) {
  return sanitizeNativeAppText(String(value ?? ''), { singleLine: true }).slice(0, max).trim()
}

export function buildSharedTimelineProposalMessages(items: readonly SharedTimelineItem[]): ChatTurn[] {
  const evidence = items.slice(0, 40).map(item => ({
    id: item.id,
    date: item.occurredAt.slice(0, 10),
    person: item.characterName || '未知角色',
    kind: item.sourceKind,
    text: item.summary.slice(0, 180)
  }))
  return [
    {
      role: 'system',
      content: [
        '你在帮用户整理“共同回忆”时间线。你不能创造、补写、猜测任何没有证据的经历。',
        '你只能从用户提供的 evidence 中选择条目，并且返回 evidence 中已经存在的 id。',
        '最多选 5 条真正值得收藏的节点；没有合适内容时返回空数组。',
        'title 最多 18 个汉字，reason 最多 36 个汉字。',
        '严格返回 JSON 数组，格式：[{"id":"memory:...","title":"...","reason":"..."}]。',
        '不要返回 Markdown、代码围栏、HTML、XML 或其它文字。'
      ].join('\n')
    },
    {
      role: 'user',
      content: `evidence:\n${JSON.stringify(evidence)}`
    }
  ]
}

export function parseSharedTimelineProposal(
  raw: string,
  allowedItems: readonly SharedTimelineItem[]
): SharedTimelineProposal[] {
  const allowed = new Set(allowedItems.map(item => item.id))
  const text = String(raw ?? '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end < start) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const proposals: SharedTimelineProposal[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    if (!allowed.has(id) || seen.has(id)) continue
    const title = clampText(row.title, 18)
    const reason = clampText(row.reason, 36)
    if (!title) continue
    seen.add(id)
    proposals.push({ id, title, reason })
    if (proposals.length >= 5) break
  }
  return proposals
}

export async function proposeSharedTimelineMilestones(
  items: readonly SharedTimelineItem[]
): Promise<{ proposals: SharedTimelineProposal[]; model: string }> {
  const candidates = items.filter(item => !item.hidden).slice(0, 40)
  if (!candidates.length) return { proposals: [], model: '' }
  const settings = await getModelSettings()
  if (!settings.baseUrl.trim() || !settings.apiKey.trim() || !settings.model.trim()) {
    throw new SharedTimelineAiUnconfiguredError()
  }
  const provider = createProvider(settings)
  const response = await provider.chat({
    model: settings.model,
    temperature: Math.min(0.5, Math.max(0, settings.temperature ?? 0.3)),
    messages: buildSharedTimelineProposalMessages(candidates)
  })
  return {
    proposals: parseSharedTimelineProposal(response.text, candidates),
    model: settings.model
  }
}
