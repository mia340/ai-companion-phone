import { describe, expect, it } from 'vitest'
import {
  buildFriendGuessMessages,
  buildFriendQuestionMessages,
  buildHostQuestionMessages,
  describeHost,
  inspectQuestion,
  makeDefaultTurtleHost,
  parseScenarioResponse,
  rateSoupGame,
  sanitizeSoupText,
  soupHostFromCharacter
} from './turtleSoupService'

describe('parseScenarioResponse', () => {
  it('解析干净 JSON（含别名键）', () => {
    const raw = JSON.stringify({
      title: '巷口的灯',
      situation: '我在巷口看到三楼的灯亮灭三次。',
      solution: '那是楼里的小女孩在给楼下暗号。',
      hint: '注意亮灭的节奏。'
    })
    expect(parseScenarioResponse(raw)).toEqual({
      title: '巷口的灯',
      situation: '我在巷口看到三楼的灯亮灭三次。',
      solution: '那是楼里的小女孩在给楼下暗号。',
      hint: '注意亮灭的节奏。'
    })
  })

  it('容忍 markdown 围栏与前后废话', () => {
    const raw =
      '好的，为你准备了一锅：\n```json\n{"汤面":"电梯里只有两个人却超载了","汤底":"其中一个其实是很胖的影子","线索":"数数看有几双脚"}\n```\n祝你玩得开心！'
    expect(parseScenarioResponse(raw)).toEqual({
      title: '一锅无名汤',
      situation: '电梯里只有两个人却超载了',
      solution: '其中一个其实是很胖的影子',
      hint: '数数看有几双脚'
    })
  })

  it('hint 缺失也能解析（可选）', () => {
    const raw = JSON.stringify({ situation: '灯亮了。', solution: '有人拉线。' })
    const parsed = parseScenarioResponse(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.hint).toBeUndefined()
  })

  it('缺失汤底视为解析失败', () => {
    expect(parseScenarioResponse(JSON.stringify({ situation: '有汤面没汤底' }))).toBeNull()
    expect(parseScenarioResponse('主持人什么都没说')).toBeNull()
    expect(parseScenarioResponse('')).toBeNull()
  })


  it('JSON 字段误带 HTML/CSS 时只保留自然语言', () => {
    const raw = JSON.stringify({
      title: '<b>怪灯</b>',
      situation: '<div class="card">灯灭了。</div>',
      solution: '<style>.x{}</style><p>停电了。</p>',
      hint: '<span>看看电表。</span>'
    })
    expect(parseScenarioResponse(raw)).toEqual({
      title: '怪灯',
      situation: '灯灭了。',
      solution: '停电了。',
      hint: '看看电表。'
    })
  })
})

describe('soupHostFromCharacter / describeHost', () => {
  it('角色转主持人保留关键人设字段', () => {
    const host = soupHostFromCharacter({
      name: '谢无矣',
      avatar: '😎',
      persona: '冷静克制',
      speakingStyle: '话少但毒舌',
      relationship: '老同学',
      identity: '程序员',
      age: 27
    })
    expect(host.kind).toBe('character')
    expect(host.name).toBe('谢无矣')
    expect(host.avatar).toBe('😎')
    expect(host.persona).toBe('冷静克制')
  })

  it('空角色回退名字', () => {
    expect(soupHostFromCharacter({}).name).toBe('无名角色')
  })

  it('描述含核心人设行', () => {
    const text = describeHost(
      soupHostFromCharacter({ name: '夜临', persona: '夜猫子', speakingStyle: '懒洋洋' })
    )
    expect(text).toContain('名字：夜临')
    expect(text).toContain('性格：夜猫子')
    expect(text).toContain('说话风格：懒洋洋')
  })

  it('普通 🐢 主持人有兜底人设', () => {
    const host = makeDefaultTurtleHost()
    expect(host.kind).toBe('turtle')
    expect(host.avatar).toBe('🐢')
    expect(host.persona).toContain('卖关子')
  })
})

describe('inspectQuestion', () => {
  it('接受封闭问句与开放问句（角色主持都能接）', () => {
    expect(inspectQuestion('他是在喝汤吗？').ok).toBe(true)
    expect(inspectQuestion('为什么他要哭').ok).toBe(true)
    expect(inspectQuestion('那灯亮灭三次是谁弄的').ok).toBe(true)
  })

  it('拒绝过短与过长', () => {
    expect(inspectQuestion('').ok).toBe(false)
    expect(inspectQuestion('呃').ok).toBe(false)
    expect(inspectQuestion('是'.repeat(200)).ok).toBe(false)
  })

  it('规范化空白与首尾', () => {
    expect(inspectQuestion('  那 灯是  谁 弄的  ').question).toBe('那灯是谁弄的')
  })
})

describe('rateSoupGame', () => {
  it('问得少 → 高分', () => {
    expect(rateSoupGame(6, 90).stars).toBe(5)
    expect(rateSoupGame(6, 90).tag).toContain('一眼看穿')
  })

  it('正常推理 → 侦探级', () => {
    expect(rateSoupGame(12, 200).stars).toBe(4)
    expect(rateSoupGame(12, 200).tag).toContain('推理高手')
  })

  it('问得多 → 鼓励向', () => {
    expect(rateSoupGame(30, 600).stars).toBe(3)
    expect(rateSoupGame(60, 1800).stars).toBe(2)
  })

  it('秒数极快时附加手速提示', () => {
    expect(rateSoupGame(10, 60).tag).toContain('⚡')
  })
})


describe('海龟汤原生呈现策略', () => {
  it('主持人可以有极短动作/心理，但明确禁止生成第二层 UI', () => {
    const host = makeDefaultTurtleHost()
    const messages = buildHostQuestionMessages(
      { title: '灯', situation: '灯灭了。', solution: '停电。' },
      host,
      [],
      '是停电吗？'
    )
    const system = String(messages[0].content)
    expect(system).toContain('动作、神态或心里反应')
    expect(system).toContain('禁止输出 HTML')
  })

  it('误生成 HTML 时只保留游戏叙事文字', () => {
    expect(sanitizeSoupText('<div class="status">（他停顿了一下。）不是。</div><style>.status{}</style>'))
      .toBe('（他停顿了一下。）不是。')
  })
})

describe('反向玩法：好友猜（我当主持人）', () => {
  const guesser = soupHostFromCharacter({
    name: '猫又',
    persona: '好奇心重又机灵',
    speakingStyle: '爱用“诶？”开头'
  })
  const SITUATION = '餐厅老板半夜听到厨房水龙头没人拧自己开了三次。'
  const SECRET = '其实是一条水鬼在给楼上的猫上供。'
  const history = [
    { role: 'user' as const, text: '是水声吗？' },
    { role: 'assistant' as const, text: '朋友（猫又）：是，水声哗啦哗啦的。' }
  ]

  it('提问消息只给汤面与人设，绝不掺汤底', () => {
    const messages = buildFriendQuestionMessages(guesser, SITUATION, history)
    const joined = messages.map(m => String(m.content)).join('\n')
    expect(messages[0].role).toBe('system')
    expect(joined).toContain(SITUATION)
    expect(joined).toContain('名字：猫又')
    expect(joined).not.toContain(SECRET)
    expect(joined).not.toContain('裁判')
    expect(String(messages[messages.length - 1].content)).toContain('轮到你发问')
  })

  it('交卷消息换成“示意好友交卷”的尾句，同样不掺汤底', () => {
    const messages = buildFriendGuessMessages(guesser, SITUATION, history)
    const joined = messages.map(m => String(m.content)).join('\n')
    expect(joined).toContain(SITUATION)
    expect(joined).not.toContain(SECRET)
    expect(String(messages[messages.length - 1].content)).toContain('我推测')
  })

  it('history 按角色原样透传且受长度上限约束', () => {
    const long = Array.from({ length: 90 }, (_, i) => ({
      role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant',
      text: `第${i}句`
    }))
    const messages = buildFriendQuestionMessages(guesser, SITUATION, long)
    // system 1 条 + 上限内 history + 1 条尾句
    expect(messages).toHaveLength(1 + 60 + 1)
    const texts = messages.map(m => String(m.content)).join('')
    // slice(-60)：90 句里只留第 30~89 句
    expect(texts).toContain('第30句')
    expect(texts).toContain('第89句')
    expect(texts).not.toContain('第29句')
  })

  it('猜测方人设缺失时仍有兜底描述可拼', () => {
    const plain = makeDefaultTurtleHost()
    const messages = buildFriendQuestionMessages(plain, SITUATION, [])
    const joined = messages.map(m => String(m.content)).join('\n')
    expect(joined).toContain('一只见多识广')
    expect(joined).toContain('能用')
  })
})
