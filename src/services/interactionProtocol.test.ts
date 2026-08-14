import { describe, expect, it } from 'vitest'
import {
  extractInlineSceneActions,
  findUnsupportedUserFactClaims,
  naturalnessWarnings,
  parseCompanionOutput,
  scoreNaturalness,
  shapeCompanionActions,
  visibleStreamingText
} from './interactionProtocol'
import { createDefaultChatSettings, createDefaultConversationState } from './chatSettings'
import type { Character } from '../types/domain'

const character: Character = {
  id: 'r', worldId: 'w', name: '测试角色', avatar: '🙂', persona: '克制，慢热，会在意用户',
  relationship: '朋友', mood: '平静', activity: '看书', groups: [], replySpeed: 'natural',
  createdAt: '2026-01-01T00:00:00.000Z'
}

describe('interaction protocol V2', () => {
  it('parses messages, pauses, reactions and persistent state', () => {
    const raw = '<companion_packet>{"messages":[{"kind":"text","content":"原来你喜欢这种类型。"},{"kind":"typing_pause","content":"","delayMs":650},{"kind":"react_to_message","content":"😒","targetMessageId":"latest_user"},{"kind":"voice","content":"我才没有吃醋。"}],"status":{"mood":"有一点吃醋","location":"卧室","energy":"平稳","unresolvedTopics":["想知道用户更喜欢哪一张"]}}</companion_packet>'
    const result = parseCompanionOutput(raw)
    expect(result.messages.map(item => item.kind)).toEqual(['text', 'typing_pause', 'react_to_message', 'voice'])
    expect(result.status?.energy).toBe('平稳')
    expect(result.status?.unresolvedTopics).toEqual(['想知道用户更喜欢哪一张'])
    expect(result.visibleText).not.toContain('companion_packet')
  })


  it('parses scene actions and keeps remote actions independent', () => {
    const parsed = parseCompanionOutput('<companion_packet>{"messages":[{"kind":"scene_action","content":"他低头看了眼手机。"},{"kind":"text","content":"行李拿到了。我现在出来。"}],"status":{"presence":"remote"}}</companion_packet>')
    expect(parsed.messages[0].kind).toBe('scene_action')
    const settings = createDefaultChatSettings('c')
    const state = { ...createDefaultConversationState('c'), presence: 'remote' as const }
    const shaped = shapeCompanionActions(parsed.messages, character, settings, true, state)
    expect(shaped.some(item => item.kind === 'scene_action')).toBe(true)
    expect(shaped.filter(item => item.kind === 'text').length).toBeGreaterThanOrEqual(1)
  })

  it('merges scene action and dialogue into one parenthesized bubble when together', () => {
    const settings = { ...createDefaultChatSettings('c'), presenceMode: 'together' as const }
    const shaped = shapeCompanionActions([
      { kind: 'scene_action', content: '他把菜单推到你面前。' },
      { kind: 'text', content: '先看看想吃什么。' },
      { kind: 'scene_action', content: '抬眼看你。' },
      { kind: 'text', content: '不是刚才还喊饿吗？' }
    ], character, settings, true, createDefaultConversationState('c'))
    expect(shaped).toHaveLength(1)
    expect(shaped[0].kind).toBe('text')
    expect(shaped[0].content).toContain('（他把菜单推到你面前。）')
    expect(shaped[0].content).toContain('先看看想吃什么。')
  })

  it('extracts legacy parenthesized actions from plain text', () => {
    const rows = extractInlineSceneActions('（看了你一眼）别急。')
    expect(rows.map(item => item.kind)).toEqual(['scene_action', 'text'])
  })

  it('keeps plain text as a normal message', () => {
    const result = parseCompanionOutput('你回来啦。')
    expect(result.messages).toEqual([{ kind: 'text', content: '你回来啦。' }])
  })

  it('hides partial protocol while streaming', () => {
    expect(visibleStreamingText('先等等。<companion_')).toBe('先等等。')
    expect(visibleStreamingText('<scene_action perspective="remote">靠近你</scene_action>')).toBe('（靠近你）')
    expect(visibleStreamingText('<scene_action perspective="remote">靠近')).not.toContain('scene_action')
  })

  it('detects assistant phrasing and scores a natural reply higher', () => {
    expect(naturalnessWarnings('你分享了三张图片。你是想分析角色还是画风？').length).toBeGreaterThan(1)
    const natural = scoreNaturalness({ text: '一次发三张给我看……看来你是真的很喜欢他。', character, latestUserText: '他是我喜欢的角色' })
    const robotic = scoreNaturalness({ text: '你分享了三张图片。你是想分析角色还是画风？', character, latestUserText: '他是我喜欢的角色' })
    expect(natural.total).toBeGreaterThan(robotic.total)
  })
  it('远程模式一个完整句子一个气泡，并在始终显示动作时保证 scene_action', () => {
    const settings = { ...createDefaultChatSettings('c'), presenceMode: 'remote' as const, actionVisibility: 'always' as const, multiBubble: true }
    const state = { ...createDefaultConversationState('c'), presence: 'remote' as const, location: '训练场', innerActivity: '正在收拾球拍' }
    const shaped = shapeCompanionActions([
      { kind: 'text', content: '训练结束了。刚拿到手机。你十二点下班对吧？我等你。' }
    ], character, settings, false, state)
    expect(shaped[0].kind).toBe('scene_action')
    expect(shaped.filter(item => item.kind === 'text').map(item => item.content)).toEqual([
      '训练结束了。', '刚拿到手机。', '你十二点下班对吧？', '我等你。'
    ])
  })


  it('parses scene_action tags with attributes and never leaks the XML tag', () => {
    const parsed = parseCompanionOutput('<scene_action perspective="remote">撑起身子，把脸埋进你颈窝里，低低地笑</scene_action>')
    expect(parsed.messages).toEqual([{ kind: 'scene_action', content: '撑起身子，把脸埋进你颈窝里，低低地笑' }])
    expect(parsed.visibleText).not.toContain('scene_action')
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.conflict).toBe(false)
  })

  it('overrides reported remote when the current reply directly touches the user', () => {
    const raw = '<companion_packet>{"messages":[{"kind":"scene_action","content":"翻过身，将你捞进怀里。"},{"kind":"text","content":"我也没睡。"}],"status":{"presence":"remote"}}</companion_packet>'
    const parsed = parseCompanionOutput(raw)
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.conflict).toBe(true)
    const settings = createDefaultChatSettings('c')
    const renderState = { ...createDefaultConversationState('c'), presence: parsed.status?.presence || 'remote' }
    const shaped = shapeCompanionActions(parsed.messages, character, settings, true, renderState)
    expect(shaped).toHaveLength(1)
    expect(shaped[0].kind).toBe('text')
    expect(shaped[0].content).toContain('（翻过身，将你捞进怀里。）')
  })

  it('detects invented user habits when history and memory do not support them', () => {
    expect(findUnsupportedUserFactClaims('我记得上次你想吃寿司。', '用户说：晚上吃什么？')).toHaveLength(1)
    expect(findUnsupportedUserFactClaims('我记得上次你想吃寿司。', '用户说：我上次想吃寿司。')).toHaveLength(0)
    expect(findUnsupportedUserFactClaims('你一直很喜欢吃寿司。', '用户说：我今天想吃寿司。')).toHaveLength(1)
    expect(findUnsupportedUserFactClaims('你一直很喜欢吃寿司。', '用户说：我一直很喜欢吃寿司。')).toHaveLength(0)
  })

})

it('V0.4.3.4 自动排版：远程默认分开、同场景默认合并且动作后不换行', () => {
  const remote = createDefaultChatSettings('remote-layout')
  const remoteState = { ...createDefaultConversationState('remote-layout'), presence: 'remote' as const }
  const remoteRows = shapeCompanionActions([
    { kind: 'scene_action', content: '低头看了一眼手机。' },
    { kind: 'text', content: '我刚到。' }
  ], character, remote, true, remoteState)
  expect(remoteRows[0].kind).toBe('scene_action')

  const together = createDefaultChatSettings('together-layout')
  const togetherState = { ...createDefaultConversationState('together-layout'), presence: 'together' as const }
  const togetherRows = shapeCompanionActions([
    { kind: 'scene_action', content: '翻过身，将你捞进怀里。' },
    { kind: 'text', content: '我也没睡着。' }
  ], character, together, true, togetherState)
  expect(togetherRows).toHaveLength(1)
  expect(togetherRows[0].content).toBe('（翻过身，将你捞进怀里。）我也没睡着。')
  expect(togetherRows[0].content).not.toContain('\n')
})

it('旧版手动动作排版值不再覆盖自动场景规则', () => {
  const togetherLegacy = { ...createDefaultChatSettings('layout-a'), presenceMode: 'together' as const, actionTextLayout: 'separate' as const }
  const togetherRows = shapeCompanionActions([
    { kind: 'scene_action', content: '抬手碰了碰你的额头。' },
    { kind: 'text', content: '不烫。' }
  ], character, togetherLegacy, true, createDefaultConversationState('layout-a'))
  expect(togetherRows).toHaveLength(1)
  expect(togetherRows[0].content).toBe('（抬手碰了碰你的额头。）不烫。')

  const remoteLegacy = { ...createDefaultChatSettings('layout-b'), presenceMode: 'remote' as const, actionTextLayout: 'merged' as const }
  const remoteRows = shapeCompanionActions([
    { kind: 'scene_action', content: '靠在椅背上看手机。' },
    { kind: 'text', content: '等我一下。' }
  ], character, remoteLegacy, true, createDefaultConversationState('layout-b'))
  expect(remoteRows.map(item => item.kind)).toEqual(['scene_action', 'text'])
})

it('流式截断和带额外空格的 scene_action 标签都不会泄漏', () => {
  const weird = '<scene_action perspective=" remote " >把你圈进怀里，轻轻拍了下你的后背</scene_action>这么好笑？'
  expect(visibleStreamingText(weird)).toBe('（把你圈进怀里，轻轻拍了下你的后背）这么好笑？')
  expect(visibleStreamingText('<scene_action perspective=" remote " >把你圈进怀里</scene_act')).toBe('（把你圈进怀里）')
  expect(visibleStreamingText('<scene_act')).toBe('')
})
