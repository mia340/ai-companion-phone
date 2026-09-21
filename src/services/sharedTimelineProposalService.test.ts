import { describe, expect, it } from 'vitest'
import {
  buildSharedTimelineProposalMessages,
  parseSharedTimelineProposal
} from './sharedTimelineProposalService'
import type { SharedTimelineItem } from './sharedTimelineService'

const evidence: SharedTimelineItem[] = [
  {
    id: 'memory:m1',
    worldId: 'w',
    sourceKind: 'memory',
    sourceId: 'm1',
    characterId: 'c',
    characterName: '小满',
    title: '一个约定',
    summary: '冬天一起去看雪。',
    occurredAt: '2026-09-20T00:00:00.000Z',
    sourceLabel: '聊天 · 记忆',
    sourceRoute: '/chat/x?message=y',
    importance: 5,
    starred: false,
    hidden: false
  },
  {
    id: 'moment:p1',
    worldId: 'w',
    sourceKind: 'moment',
    sourceId: 'p1',
    characterId: 'c',
    characterName: '小满',
    title: 'TA 发过的一条动态',
    summary: '今天风很好。',
    occurredAt: '2026-09-19T00:00:00.000Z',
    sourceLabel: '朋友圈',
    sourceRoute: '/app/朋友圈?moment=p1',
    importance: 3,
    starred: false,
    hidden: false
  }
]

describe('sharedTimelineProposalService', () => {
  it('prompt 明确要求只能返回 evidence 中已有 id', () => {
    const messages = buildSharedTimelineProposalMessages(evidence)
    expect(messages[0].content).toContain('只能从用户提供的 evidence 中选择')
    expect(messages[1].content).toContain('memory:m1')
  })

  it('解析时丢弃模型凭空制造的未知来源', () => {
    const result = parseSharedTimelineProposal(JSON.stringify([
      { id: 'memory:m1', title: '看雪的约定', reason: '这是明确的共同承诺' },
      { id: 'memory:invented', title: '不存在的旅行', reason: '模型编的' }
    ]), evidence)
    expect(result).toEqual([
      { id: 'memory:m1', title: '看雪的约定', reason: '这是明确的共同承诺' }
    ])
  })

  it('兼容代码围栏，但不会自动接受重复 id', () => {
    const raw = '```json\n[{"id":"moment:p1","title":"风很好","reason":"有真实动态来源"},{"id":"moment:p1","title":"重复","reason":"重复"}]\n```'
    expect(parseSharedTimelineProposal(raw, evidence)).toHaveLength(1)
  })

  it('非 JSON 模型输出不会被猜测成回忆', () => {
    expect(parseSharedTimelineProposal('我觉得你们冬天一起去了旅行。', evidence)).toEqual([])
  })
})
