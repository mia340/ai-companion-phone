import { db } from '../db/database'
import { toPlainStorageValue } from './storageSanitizer'
import type {
  PromptDebugMessage,
  PromptDebugTrace
} from '../types/domain'

const MAX_TRACES_PER_CONVERSATION = 20

export async function savePromptDebugTrace(
  input: Omit<PromptDebugTrace, 'id' | 'createdAt'> & Partial<Pick<PromptDebugTrace, 'id' | 'createdAt'>>
): Promise<PromptDebugTrace> {
  const trace: PromptDebugTrace = {
    ...input,
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || new Date().toISOString()
  }
  await db.promptDebugTraces.put(toPlainStorageValue(trace))
  const rows = await db.promptDebugTraces.where('conversationId').equals(trace.conversationId).sortBy('createdAt')
  const overflow = rows.length - MAX_TRACES_PER_CONVERSATION
  if (overflow > 0) await db.promptDebugTraces.bulkDelete(rows.slice(0, overflow).map(item => item.id))
  return trace
}

export async function patchPromptDebugTrace(id: string, patch: Partial<PromptDebugTrace>) {
  await db.promptDebugTraces.update(id, toPlainStorageValue(patch))
}

export async function listPromptDebugTraces(conversationId: string) {
  const rows = await db.promptDebugTraces.where('conversationId').equals(conversationId).toArray()
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function clearPromptDebugTraces(conversationId: string) {
  await db.promptDebugTraces.where('conversationId').equals(conversationId).delete()
}

export function estimatePromptCharacters(systemPrompt: string, messages: Array<{ content: string }>) {
  return systemPrompt.length + messages.reduce((total, item) => total + item.content.length, 0)
}

const SECTION_LABELS: Record<string, string> = {
  角色卡: '角色卡与表达',
  用户人设: '用户 Persona',
  关系状态: '关系状态',
  长期记忆: '长期记忆',
  长期剧情摘要: '剧情摘要',
  此前剧情摘要: '剧情摘要',
  本轮触发的世界书: '世界书',
  示例对话: '示例对话',
  自然交流规则: '自然回复规则',
  视觉信息使用规则: '图片内部观察规则',
  '社区 UI 输出接管 · 最高优先级': '社区 UI 输出协议',
  '小手机互动协议 V2': '小手机动作协议',
  小手机互动协议: '小手机动作协议',
  回复前最终提醒: '最终约束'
}

export function analyzePromptSections(systemPrompt: string, messages: PromptDebugMessage[]) {
  const matches = Array.from(systemPrompt.matchAll(/【([^】]+)】/g))
  const sections: NonNullable<PromptDebugTrace['promptSections']> = []
  if (!matches.length) {
    sections.push({ key: 'system', label: 'System Prompt', characters: systemPrompt.length, budget: 24000, truncated: false })
  } else {
    if ((matches[0].index || 0) > 0) {
      sections.push({ key: 'base', label: '基础角色协议', characters: matches[0].index || 0, budget: 2800, truncated: false })
    }
    matches.forEach((match, index) => {
      const start = match.index || 0
      const end = matches[index + 1]?.index ?? systemPrompt.length
      const key = match[1]
      const characters = end - start
      const budget = key.includes('记忆') ? 5000 : key.includes('世界书') ? 5000 : key.includes('角色') ? 7000 : key.includes('示例') ? 4500 : 3200
      sections.push({ key, label: SECTION_LABELS[key] || key, characters, budget, truncated: characters > budget })
    })
  }
  sections.push({
    key: 'recentMessages',
    label: '最近聊天上下文',
    characters: messages.reduce((sum, item) => sum + item.content.length, 0),
    budget: 12000,
    truncated: false
  })
  return sections
}

export function buildTruncationNotes(options: {
  allMessageCount: number
  includedMessageCount: number
  systemPrompt: string
  sections: NonNullable<PromptDebugTrace['promptSections']>
}) {
  const notes: string[] = []
  const omitted = Math.max(0, options.allMessageCount - options.includedMessageCount)
  if (omitted) notes.push(`${omitted} 条较早消息未直接携带，依赖剧情摘要与长期记忆。`)
  for (const section of options.sections) {
    if (section.truncated) notes.push(`${section.label}超过建议字符预算（${section.characters}/${section.budget}），模型可能降低对后部内容的关注。`)
  }
  if (options.systemPrompt.length > 26000) notes.push('System Prompt 总长度较大，建议精简重复角色设定或世界书。')
  return notes
}

export function buildRuleInfluences(systemPrompt: string) {
  const rules: string[] = []
  if (systemPrompt.includes('日常陪伴')) rules.push('当前使用日常陪伴模式，动作描写应较少。')
  if (systemPrompt.includes('沉浸剧情')) rules.push('当前使用沉浸剧情规则，强调场景连续。')
  if (systemPrompt.includes('深度角色扮演')) rules.push('当前使用深度角色扮演，角色卡与世界设定优先。')
  if (systemPrompt.includes('连续短消息')) rules.push('允许根据角色性格拆分连续短消息。')
  if (systemPrompt.includes('不要像客服')) rules.push('启用了去客服腔和减少二选一追问规则。')
  if (systemPrompt.includes('视觉信息使用规则')) rules.push('图片分析被限制为内部观察，最终必须以角色口吻表达。')
  if (systemPrompt.includes('被用户锁定的记忆')) rules.push('本轮包含用户锁定的高可信记忆。')
  if (systemPrompt.includes('社区 UI 输出接管 · 最高优先级')) rules.push('检测到社区 JSON 自带 UI / 固定输出协议；本轮由社区格式接管，小手机动作/对白排版不会覆盖它。')
  return rules
}

export function buildPromptDebugReport(trace: PromptDebugTrace) {
  const lines = [
    '# Prompt 调试报告',
    '',
    `- 时间：${new Date(trace.createdAt).toLocaleString('zh-CN', { hour12: false })}`,
    `- 模型：${trace.provider} / ${trace.model}`,
    `- 角色模式：${trace.roleplayMode}`,
    `- Persona：${trace.personaName}`,
    `- 上下文字符：${trace.estimatedCharacters}`,
    `- 图片：${trace.imageCount} 张`,
    '',
    '## 预算分区',
    ...(trace.promptSections || []).map(item => `- ${item.label}：${item.characters}${item.budget ? ` / 建议 ${item.budget}` : ''}${item.truncated ? '（偏长）' : ''}`),
    '',
    '## 世界书触发',
    ...(trace.activatedLorebook.length ? trace.activatedLorebook.map(item => `- ${item.title}${item.reason ? `：${item.reason}` : ''}`) : ['- 无']),
    '',
    '## 记忆命中',
    ...(trace.memoryHits.length ? trace.memoryHits.map(item => `- [${item.layer || '未分类'}] ${item.content}（重要度 ${item.importance}${item.score === undefined ? '' : `，分数 ${item.score}`}）${item.reason ? `：${item.reason}` : ''}`) : ['- 无']),
    '',
    '## 截断与风险',
    ...(trace.truncations?.length ? trace.truncations.map(item => `- ${item}`) : ['- 未发现明确截断风险']),
    '',
    '## 自然度',
    ...(trace.naturalnessWarnings?.length ? trace.naturalnessWarnings.map(item => `- ${item}`) : ['- 未命中已知 AI 腔规则']),
    trace.naturalnessScore ? `- 综合评分：${trace.naturalnessScore.total}/100` : '',
    '',
    '## 场景判定',
    trace.presenceResolution
      ? `- ${trace.presenceResolution.resolvedPresence === 'together' ? '同场景' : trace.presenceResolution.resolvedPresence === 'remote' ? '远程' : '未确定'}：${trace.presenceResolution.reason}${trace.presenceResolution.conflict ? '（已解决冲突）' : ''}`
      : '- 未记录',
    '',
    '## 互动动作',
    trace.actionSummary || '尚未解析',
    '',
    '## 原始输出',
    trace.rawOutput || '无',
    '',
    '## 用户看到的回复',
    trace.visibleOutput || '无'
  ]
  return lines.filter((line, index) => line || lines[index - 1] !== '').join('\n')
}
