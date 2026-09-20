import { z } from 'zod'

export const AGENT_ACTION_KINDS = [
  'message.send',
  'social.post',
  'social.comment',
  'social.reply',
  'social.like',
  'music.play',
  'music.pause',
  'calendar.create',
  'notification.local',
  'memory.propose'
] as const

export type AgentActionKind = typeof AGENT_ACTION_KINDS[number]
export type AgentActionRisk = 'read-only' | 'local-write' | 'social-write' | 'user-sensitive'

export interface AgentActionCapability {
  kind: AgentActionKind
  risk: AgentActionRisk
  requiresConfirmation: boolean
  description: string
}

export const AGENT_ACTION_CAPABILITIES: Record<AgentActionKind, AgentActionCapability> = {
  'message.send': { kind: 'message.send', risk: 'social-write', requiresConfirmation: false, description: '向既有会话发送角色消息' },
  'social.post': { kind: 'social.post', risk: 'social-write', requiresConfirmation: false, description: '发布角色动态' },
  'social.comment': { kind: 'social.comment', risk: 'social-write', requiresConfirmation: false, description: '评论可见动态' },
  'social.reply': { kind: 'social.reply', risk: 'social-write', requiresConfirmation: false, description: '回复可见评论' },
  'social.like': { kind: 'social.like', risk: 'social-write', requiresConfirmation: false, description: '点赞可见动态' },
  'music.play': { kind: 'music.play', risk: 'local-write', requiresConfirmation: false, description: '控制本地音乐状态' },
  'music.pause': { kind: 'music.pause', risk: 'local-write', requiresConfirmation: false, description: '暂停本地音乐状态' },
  'calendar.create': { kind: 'calendar.create', risk: 'user-sensitive', requiresConfirmation: true, description: '创建用户日程' },
  'notification.local': { kind: 'notification.local', risk: 'local-write', requiresConfirmation: false, description: '创建本地通知' },
  'memory.propose': { kind: 'memory.propose', risk: 'user-sensitive', requiresConfirmation: true, description: '提议写入高影响长期记忆' }
}

const actionEnvelope = {
  id: z.string().min(1).optional(),
  actorCharacterId: z.string().min(1),
  worldId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  causedBy: z.string().optional(),
  scheduledAt: z.string().datetime().optional()
}

/**
 * AgentAction 使用按 kind 收窄的 payload，而不是任意 record。
 * 模型只能提出 App 明确理解的参数；字段拼错或越权字段会在副作用发生前被拒绝。
 */
export const agentActionProposalSchema = z.discriminatedUnion('kind', [
  z.object({
    ...actionEnvelope,
    kind: z.literal('message.send'),
    payload: z.object({ content: z.string().min(1) }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('social.post'),
    payload: z.object({ content: z.string().min(1), aiModel: z.string().optional() }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('social.comment'),
    payload: z.object({ momentId: z.string().min(1), content: z.string().min(1) }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('social.reply'),
    payload: z.object({ momentId: z.string().min(1), replyToCommentId: z.string().min(1), content: z.string().min(1) }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('social.like'),
    payload: z.object({ momentId: z.string().min(1) }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('music.play'),
    payload: z.object({ trackId: z.string().min(1).optional() }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('music.pause'),
    payload: z.object({}).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('calendar.create'),
    payload: z.object({
      title: z.string().min(1),
      startsAt: z.string().datetime().optional(),
      notes: z.string().max(2000).optional()
    }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('notification.local'),
    payload: z.object({ title: z.string().min(1), body: z.string().max(2000).optional() }).strict()
  }).strict(),
  z.object({
    ...actionEnvelope,
    kind: z.literal('memory.propose'),
    payload: z.object({
      content: z.string().min(1),
      layer: z.enum(['fact', 'subjective', 'shared', 'promise', 'relationship', 'story']).optional()
    }).strict()
  }).strict()
])

export type AgentActionProposal = z.infer<typeof agentActionProposalSchema>

export interface AgentActionContext {
  grantedKinds: ReadonlySet<AgentActionKind>
  confirmedActionIds?: ReadonlySet<string>
}

export type AgentActionDecision =
  | { status: 'allowed'; proposal: AgentActionProposal & { id: string }; capability: AgentActionCapability }
  | { status: 'needs-confirmation'; proposal: AgentActionProposal & { id: string }; capability: AgentActionCapability; reason: string }
  | { status: 'denied'; reason: string }

export function evaluateAgentAction(input: unknown, context: AgentActionContext): AgentActionDecision {
  const parsed = agentActionProposalSchema.safeParse(input)
  if (!parsed.success) return { status: 'denied', reason: '动作结构无效，未执行。' }

  const proposal = { ...parsed.data, id: parsed.data.id || crypto.randomUUID() } as AgentActionProposal & { id: string }
  const capability = AGENT_ACTION_CAPABILITIES[proposal.kind]
  if (!context.grantedKinds.has(proposal.kind)) {
    return { status: 'denied', reason: `当前角色没有 ${proposal.kind} 能力，未执行。` }
  }
  if (capability.requiresConfirmation && !context.confirmedActionIds?.has(proposal.id)) {
    return { status: 'needs-confirmation', proposal, capability, reason: `${capability.description}需要用户确认。` }
  }
  return { status: 'allowed', proposal, capability }
}

export type AgentActionExecutor = (proposal: AgentActionProposal & { id: string }) => Promise<unknown>

/**
 * App Runtime owns side effects. The model can only propose a typed action; no natural-language
 * marker is allowed to write IndexedDB directly. Callers explicitly provide executors.
 */
export async function executeAgentAction(
  input: unknown,
  context: AgentActionContext,
  executors: Partial<Record<AgentActionKind, AgentActionExecutor>>
) {
  const decision = evaluateAgentAction(input, context)
  if (decision.status !== 'allowed') return decision
  const executor = executors[decision.proposal.kind]
  if (!executor) return { status: 'denied' as const, reason: `App Runtime 尚未注册 ${decision.proposal.kind} 执行器，未执行。` }
  const result = await executor(decision.proposal)
  return { status: 'executed' as const, proposal: decision.proposal, capability: decision.capability, result }
}
