import { describe, expect, it } from 'vitest'
import {
  buildPresentationOverridePrompt,
  extractInlineSceneActions,
  naturalnessWarnings,
  parseCompanionOutput,
  scoreNaturalness,
  segmentNaturalPhoneMessages,
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
    const settings = { ...createDefaultChatSettings('c'), conversationPresentationMode: 'phone-split' as const }
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
  it('普通远程回复保持整轮一颗气泡，不凭空补设备动作或按句子切碎', () => {
    const settings = { ...createDefaultChatSettings('c'), presenceMode: 'remote' as const, actionVisibility: 'always' as const, multiBubble: true }
    const state = { ...createDefaultConversationState('c'), presence: 'remote' as const, location: '训练场', innerActivity: '正在收拾球拍' }
    const shaped = shapeCompanionActions([
      { kind: 'text', content: '训练结束了。等我收拾一下。你十二点下班对吧？我等你。' }
    ], character, settings, false, state)
    expect(shaped).toEqual([{ kind: 'text', content: '训练结束了。等我收拾一下。你十二点下班对吧？我等你。' }])
  })

  it('隐藏协议明确给出多条 text 时保留多气泡意图', () => {
    const settings = { ...createDefaultChatSettings('c'), presenceMode: 'remote' as const, multiBubble: true }
    const shaped = shapeCompanionActions([
      { kind: 'text', content: '第一条。' },
      { kind: 'typing_pause', content: '', delayMs: 500 },
      { kind: 'text', content: '第二条。' }
    ], character, settings, true, createDefaultConversationState('c'))
    expect(shaped.filter(item => item.kind === 'text').map(item => item.content)).toEqual(['第一条。', '第二条。'])
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

  it('recognizes close contact such as pinching the user chin as together', () => {
    const parsed = parseCompanionOutput('角色松开手，指腹擦过你的下巴，随后半侧身看着你。')
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.source).toBe('direct-contact')
  })


  it('recognizes current Persona listed in role-card participants as together', () => {
    const parsed = parseCompanionOutput('📆太初历3824年7月18｜7:00｜晨光熹微\n🗺天枢山后山菜园\n😶在场角色:测试角色；测试用户\n💛负手立于田埂\n♥内心:平静\n他正垂眸看着你。', { interpretNativeProtocol: false, userName: '测试用户' })
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.source).toBe('ui-surroundings')
  })

  it('recognizes natural gaze wording such as 垂眸看着你 as co-presence', () => {
    const parsed = parseCompanionOutput('他正垂眸看着你蹲在田垄里，一手泥地捧着刚刨出的地瓜。')
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.source).toBe('co-presence')
  })
  it('recognizes gaze on the user in the same room as co-presence', () => {
    const parsed = parseCompanionOutput('他目光落在你覆着白纱的双眼上，停了片刻，才缓缓开口。')
    expect(parsed.status?.presence).toBe('together')
    expect(parsed.presenceResolution?.source).toBe('co-presence')
  })



})

it('V0.4.4.5 三种呈现方式与相处状态解耦', () => {
  const remoteState = { ...createDefaultConversationState('layout'), presence: 'remote' as const }
  const source = [
    { kind: 'scene_action' as const, content: '低头看了一眼手机。' },
    { kind: 'text' as const, content: '我刚到。' }
  ]

  const merged = { ...createDefaultChatSettings('merged'), conversationPresentationMode: 'scene-merged' as const }
  const mergedRows = shapeCompanionActions(source, character, merged, true, remoteState)
  expect(mergedRows).toHaveLength(1)
  expect(mergedRows[0].content).toBe('（低头看了一眼手机。）我刚到。')

  const phoneText = { ...createDefaultChatSettings('phone'), conversationPresentationMode: 'phone-text' as const }
  const phoneRows = shapeCompanionActions(source, character, phoneText, true, remoteState)
  expect(phoneRows).toEqual([{ kind: 'text', content: '我刚到。' }])

  const split = { ...createDefaultChatSettings('split'), conversationPresentationMode: 'phone-split' as const }
  const splitRows = shapeCompanionActions(source, character, split, true, remoteState)
  expect(splitRows.map(item => item.kind)).toEqual(['scene_action', 'text'])
})

it('流式截断和带额外空格的 scene_action 标签都不会泄漏', () => {
  const weird = '<scene_action perspective=" remote " >把你圈进怀里，轻轻拍了下你的后背</scene_action>这么好笑？'
  expect(visibleStreamingText(weird)).toBe('（把你圈进怀里，轻轻拍了下你的后背）这么好笑？')
  expect(visibleStreamingText('<scene_action perspective=" remote " >把你圈进怀里</scene_act')).toBe('（把你圈进怀里）')
  expect(visibleStreamingText('<scene_act')).toBe('')
})

it('V0.4.4.6 不把结构化状态栏中的括号备注误判为动作', () => {
  const raw = `📅日期：2024年7月15日-周
⏰时间：17:27
🏢地点：公司楼下
🚶人物：我，测试角色，大门保安
👉相对位置：我站在写字楼大门口(刚出来)，测试角色站在我面前
👔衣着：测试角色-深蓝色西装，黑色领带(铂金领带夹)

（点头）“回去吧。”`
  const parsed = parseCompanionOutput(raw)
  const actions = parsed.messages.filter(item => item.kind === 'scene_action').map(item => item.content)
  expect(actions).toEqual(['点头'])
  expect(parsed.messages.map(item => item.content).join('\n')).toContain('(刚出来)')
  expect(parsed.messages.map(item => item.content).join('\n')).toContain('(铂金领带夹)')
})

it('V0.4.4.6 纯手机模式只保留角色语句并从叙事中抽取引号对白', () => {
  const settings = { ...createDefaultChatSettings('phone-only'), conversationPresentationMode: 'phone-text' as const }
  const state = { ...createDefaultConversationState('phone-only'), presence: 'together' as const }
  const source = parseCompanionOutput('测试角色抬眼看向你，伸手把伞往你那边倾了倾。\n\n“我送你回去。”\n\n他顿了一下。\n\n“外面还在下雨。”')
  const shaped = shapeCompanionActions(source.messages, character, settings, Boolean(source.rawPacket), state)
  expect(shaped.every(item => item.kind === 'text')).toBe(true)
  expect(shaped.map(item => item.content).join('\n')).toContain('我送你回去。')
  expect(shaped.map(item => item.content).join('\n')).toContain('外面还在下雨。')
  expect(shaped.map(item => item.content).join('\n')).not.toContain('抬眼')
  expect(shaped.map(item => item.content).join('\n')).not.toContain('他顿了一下')
})

it('V0.4.4.6 纯手机模式隐藏状态栏与明显用户侧 HTML 消息', () => {
  const settings = { ...createDefaultChatSettings('phone-html'), conversationPresentationMode: 'phone-text' as const }
  const source = parseCompanionOutput(`📅日期：2024年7月15日
🏢地点：公司楼下
<!-- 自己文字消息 (靠右-有气泡) --><div>用户没说过的话</div>
<!-- 对方文字消息 (靠左-有气泡) --><div>到家了吗</div>
<!-- 对方文字消息 (靠左-有气泡) --><div>我刚停好车。</div>`)
  const shaped = shapeCompanionActions(source.messages, character, settings, false, createDefaultConversationState('phone-html'))
  const visible = shaped.map(item => item.content).join('\n')
  expect(visible).toContain('到家了吗')
  expect(visible).toContain('我刚停好车。')
  expect(visible).not.toContain('用户没说过的话')
  expect(visible).not.toContain('日期')
  expect(visible).not.toContain('地点')
})

it('V0.4.4.6 自然消息分段只拆明显短消息，小作文保持一条', () => {
  expect(segmentNaturalPhoneMessages('我到了。\n\n你先别下来。\n\n外面雨大。')).toEqual(['我到了。', '你先别下来。', '外面雨大。'])
  const essay = '我想了很久，还是觉得应该把这件事跟你说清楚。昨天不是故意不回你，只是当时真的不知道怎么解释。\n\n后来我重新想了一遍，如果一直沉默只会让你更难受，所以这次我想认真告诉你我的想法。'
  expect(segmentNaturalPhoneMessages(essay)).toEqual([essay])
})


it('V0.4.4.6 纯手机最高优先级提示明确禁止 UI 与代写用户消息', () => {
  const settings = { ...createDefaultChatSettings('phone-prompt'), conversationPresentationMode: 'phone-text' as const }
  const prompt = buildPresentationOverridePrompt(settings)
  expect(prompt).toContain('只能包含角色本人真正发送/说出的语句')
  expect(prompt).toContain('不要输出动作、旁白、心理、状态栏')
  expect(prompt).toContain('绝对不要替用户生成')
  expect(prompt).toContain('小作文')
})

it('V0.4.4.7 动作/台词分开识别说话状态括号，但保护状态栏括号备注', () => {
  const settings = { ...createDefaultChatSettings('v447-split'), conversationPresentationMode: 'phone-split' as const }
  const raw = `👉相对位置：我站在写字楼门口(刚出来)，测试角色站在我面前
👔衣着：黑色领带(铂金领带夹)
这附近有家咖啡馆。
（顿了顿，他声音低了几分）还是说，你现在更喜欢咖啡了。`
  const parsed = parseCompanionOutput(raw)
  const shaped = shapeCompanionActions(parsed.messages, character, settings, false, createDefaultConversationState('v447-split'))
  expect(shaped.filter(item => item.kind === 'scene_action').map(item => item.content)).toEqual(['顿了顿，他声音低了几分'])
  expect(shaped.map(item => item.content).join('\n')).not.toContain('铂金领带夹')
  expect(shaped.map(item => item.content).join('\n')).not.toContain('刚出来')
})

it('V0.4.4.7 纯手机排除备忘录文字，保留真正重新发出的消息', () => {
  const settings = { ...createDefaultChatSettings('v447-memo'), conversationPresentationMode: 'phone-text' as const }
  const raw = '车停稳后，他在备忘录里添了一行字：“11.15 下午，淋雨。提醒：姜茶。”\n最终没有直接发消息，等到停车场才把刚才那句话重新发了一遍：到了，水烧好告诉你。'
  const parsed = parseCompanionOutput(raw)
  const shaped = shapeCompanionActions(parsed.messages, character, settings, false, createDefaultConversationState('v447-memo'))
  expect(shaped.map(item => item.content)).toEqual(['到了，水烧好告诉你。'])
})

it('V0.4.4.7 纯手机可抽取夹在旁白中的多段真实对白', () => {
  const settings = { ...createDefaultChatSettings('v447-quotes'), conversationPresentationMode: 'phone-text' as const }
  const raw = '他把围巾搭在你肩上。“外套湿了。”他皱眉，“先喝这个，暖暖胃。空调调高了。”他看向窗外：“这场雨怕是要下到傍晚。”'
  const parsed = parseCompanionOutput(raw)
  const shaped = shapeCompanionActions(parsed.messages, character, settings, false, createDefaultConversationState('v447-quotes'))
  expect(shaped.map(item => item.content)).toEqual(['外套湿了。', '先喝这个，暖暖胃。空调调高了。', '这场雨怕是要下到傍晚。'])
})

it('V0.4.4.7 纯手机在本轮只有旁白动作时宁可不显示，也不把叙事伪装成消息', () => {
  const settings = { ...createDefaultChatSettings('v447-narration-only'), conversationPresentationMode: 'phone-text' as const }
  const raw = '他指尖在方向盘上轻叩两下，车在红灯前停下。绿灯亮了，他踩下油门。'
  const parsed = parseCompanionOutput(raw)
  const shaped = shapeCompanionActions(parsed.messages, character, settings, false, createDefaultConversationState('v447-narration-only'))
  expect(shaped).toEqual([])
})
