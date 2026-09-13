import { describe, expect, it } from 'vitest'

import {
  buildCharacterCommentMessages,
  buildCharacterPostMessages,
  momentProfileFromCharacter,
  sanitizeMomentText,
  truncateBySentence
} from './momentGenerationService'

import type { Character } from '../types/domain'

function makeCharacter(): Character {
  return {
    id: 'char-1',
    worldId: 'world-default',
    name: '阿明',
    avatar: '🙂',
    persona: '性格温柔、有点宅',
    relationship: '青梅竹马',
    mood: '开心',
    activity: '在阳台浇花',
    likes: ['奶茶', '猫'],
    dislikes: ['辣'],
    replySpeed: 'natural',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('momentProfileFromCharacter', () => {
  it('把 Character 映射为 prompt 需要的画像字段', () => {
    const profile = momentProfileFromCharacter(makeCharacter())
    expect(profile).toMatchObject({
      name: '阿明',
      persona: '性格温柔、有点宅',
      relationship: '青梅竹马',
      mood: '开心',
      activity: '在阳台浇花',
      likes: ['奶茶', '猫'],
      dislikes: ['辣']
    })
  })
})

describe('buildCharacterPostMessages', () => {
  const profile = momentProfileFromCharacter(makeCharacter())

  it('生成 system + user 两条，system 强调朋友圈语境', () => {
    const messages = buildCharacterPostMessages(profile)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(String(messages[0].content)).toContain('朋友圈')
    expect(String(messages[0].content)).toContain('第一人称')
    expect(String(messages[0].content)).toContain('禁止输出 HTML')
  })

  it('user 消息包含角色名字与性格设定', () => {
    const messages = buildCharacterPostMessages(profile)
    const userContent = String(messages[1].content)
    expect(userContent).toContain('阿明')
    expect(userContent).toContain('性格温柔')
    expect(userContent).toContain('奶茶')
  })

  it('传入 contextLabel 时会带上时间语境', () => {
    const messages = buildCharacterPostMessages(profile, '周六晚上 10 点')
    expect(String(messages[1].content)).toContain('周六晚上 10 点')
  })
})

describe('buildCharacterCommentMessages', () => {
  const profile = momentProfileFromCharacter(makeCharacter())

  it('user 消息包含我的名字、我的评论与角色动态原文', () => {
    const messages = buildCharacterCommentMessages(
      profile,
      '阳台的花开了，好香。',
      '我',
      '好漂亮！我也想看'
    )
    expect(messages).toHaveLength(2)
    const userContent = String(messages[1].content)
    expect(userContent).toContain('阳台的花开了')
    expect(userContent).toContain('好漂亮！我也想看')
    expect(userContent).toContain('「我」')
  })

  it('system 提示保持朋友圈回复的口吻约束', () => {
    const messages = buildCharacterCommentMessages(
      profile,
      '动态正文',
      '我',
      '评论'
    )
    expect(String(messages[0].content)).toContain('朋友圈')
  })

  it('回复已有角色评论时，prompt 明确是继续评论串而不是重新评论动态', () => {
    const messages = buildCharacterCommentMessages(
      profile,
      '动态正文',
      '我',
      '你怎么知道的？',
      [],
      { characterComment: '看起来你今天心情不错。' }
    )
    const userContent = String(messages[1].content)
    expect(userContent).toContain('你刚才的评论：看起来你今天心情不错。')
    expect(userContent).toContain('「我」回复你：你怎么知道的？')
    expect(userContent).toContain('不要重新评论整条动态')
  })
})

describe('truncateBySentence', () => {
  it('短于上限时原样返回', () => {
    expect(truncateBySentence('你好呀', 100)).toBe('你好呀')
  })

  it('无标点时硬切到 max', () => {
    const text = 'a'.repeat(300)
    const result = truncateBySentence(text, 120)
    expect(result.length).toBe(120)
  })

  it('长文本优先在句号处断句且不超限', () => {
    const text = '甲'.repeat(190) + '。' + '乙'.repeat(200)
    const result = truncateBySentence(text, 300)
    expect(result.length).toBeLessThanOrEqual(300)
    expect(result.endsWith('。')).toBe(true)
    expect(result).toBe('甲'.repeat(190) + '。')
  })

  it('在 max*0.5 之前就有句号时，仍按句号断而不断得太短', () => {
    const text = '早' + '。' + '晚'.repeat(300)
    const result = truncateBySentence(text, 200)
    // 句号出现在 1 处，长度 2 <= max*0.5，应放弃断句改硬切
    expect(result.length).toBe(200)
  })
})

describe('sanitizeMomentText', () => {
  it('剥离 ``` 代码围栏并保留内部文字', () => {
    const raw = '```\n今天拍了很好看的云\n```'
    expect(sanitizeMomentText(raw)).toBe('今天拍了很好看的云')
  })

  it('去掉行首 markdown 标题与列表符号', () => {
    const raw = '# 标题\n- 第一点\n* 第二点'
    expect(sanitizeMomentText(raw)).toBe('标题 第一点 第二点')
  })

  it('去掉包裹整段的外层中文引号', () => {
    expect(sanitizeMomentText('「今天好开心」')).toBe('今天好开心')
    expect(sanitizeMomentText('“遛猫的时候遇到小雨”')).toBe('遛猫的时候遇到小雨')
  })

  it('折行与连续空白压成单行并去首尾空白', () => {
    expect(sanitizeMomentText('\n\n  今天  也很\n\n 开心  \n')).toBe('今天 也很 开心')
  })

  it('超长内容被限制在 max 字以内', () => {
    const raw = '啊'.repeat(400)
    expect(sanitizeMomentText(raw, 140).length).toBeLessThanOrEqual(140)
  })

  it('全角括号包整段也会被去掉（视为模型加的旁白）', () => {
    expect(sanitizeMomentText('（改天一起去爬山吧）')).toBe('改天一起去爬山吧')
  })

  it('空输出归一到空串', () => {
    expect(sanitizeMomentText('```\n```')).toBe('')
    expect(sanitizeMomentText('')).toBe('')
  })


  it('模型误生成 HTML/UI 时只保留朋友圈正文', () => {
    expect(sanitizeMomentText('<style>.card{color:red}</style><div class="card">今晚风很轻。</div>'))
      .toBe('今晚风很轻。')
  })
})
