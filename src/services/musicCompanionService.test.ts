import {
  describe,
  expect,
  it
} from 'vitest'

import {
  MUSIC_MAX_TALK_CHARS,
  buildMusicGreetingMessages,
  buildMusicReplyMessages,
  musicProfileFromCharacter,
  neteaseOpenUrl,
  parseMusicLink,
  sanitizeMusicText,
  songDisplayLabel
} from './musicCompanionService'

import type { Character } from '../types/domain'

function makeCharacter(
  overrides: Partial<Character> = {}
): Character {
  return {
    id: 'c1',
    worldId: 'w1',
    name: '小碗',
    avatar: '🎧',
    persona: '',
    relationship: '',
    mood: '',
    activity: '',
    replySpeed: 'instant',
    createdAt: '',
    ...overrides
  }
}

describe('parseMusicLink', () => {
  it('解析网易云客户端分享文案：捞 id + 标题 + 歌手', () => {
    const parsed = parseMusicLink(
      '分享Vasen的单曲《起风了》: https://y.music.163.com/m/song?id=1363948882&userid=123456'
    )
    expect(parsed).toEqual({
      id: '1363948882',
      title: '起风了',
      artist: 'Vasen'
    })
  })

  it('从纯数字文本拿 id', () => {
    expect(parseMusicLink('  29814390  ')).toEqual({ id: '29814390' })
  })

  it('支持网易云客户端路径式链接 /song/<id>', () => {
    const parsed = parseMusicLink(
      'https://music.163.com/song/186016/?userid=1001'
    )
    expect(parsed?.id).toBe('186016')
  })

  it('从行尾 “— 歌手” 兜底抓歌手', () => {
    const parsed = parseMusicLink('https://music.163.com/song/186016 — 周杰伦')
    expect(parsed?.artist).toBe('周杰伦')
    expect(parsed?.id).toBe('186016')
  })

  it('拿不到 id 返回 null（含过短的假 id）', () => {
    expect(parseMusicLink('')).toBeNull()
    expect(parseMusicLink('随便聊聊')).toBeNull()
    expect(parseMusicLink('https://music.163.com/song?id=123')).toBeNull()
  })
})

describe('neteaseOpenUrl', () => {
  it('id 只留数字拼网易云网页版播放页地址', () => {
    expect(neteaseOpenUrl('186016abc')).toBe(
      'https://music.163.com/m/song?id=186016'
    )
  })
})

describe('songDisplayLabel', () => {
  it('有标题歌手组合展示', () => {
    expect(songDisplayLabel({ id: '1', title: '晴天', artist: '周杰伦' }))
      .toBe('《晴天》 · 周杰伦')
  })

  it('缺歌手只显歌名，缺标题用兜底名', () => {
    expect(songDisplayLabel({ id: '2', title: '晴天' })).toBe('《晴天》')
    expect(songDisplayLabel({ id: '3' })).toBe('网易云歌曲 3')
  })
})

describe('sanitizeMusicText', () => {
  it('剥掉代码围栏与加粗标记', () => {
    expect(sanitizeMusicText('你好 ```粗体``` 世界')).toBe('你好 粗体 世界')
    expect(sanitizeMusicText('**非常好**啊')).toBe('非常好啊')
  })

  it('去掉行首项目符号与中外引号', () => {
    expect(sanitizeMusicText('• 第一行\n- 第二行')).toBe('第一行 第二行')
    expect(sanitizeMusicText('「这首歌真棒」')).toBe('这首歌真棒')
  })

  it('超出上限时压到 MUSIC_MAX_TALK_CHARS', () => {
    const text = sanitizeMusicText('好的'.repeat(200))
    expect(text.length).toBe(MUSIC_MAX_TALK_CHARS)
  })

  it('超长但前段成句时按整句收尾', () => {
    const input = '天气真好。'.repeat(60) + 'x'
    const text = sanitizeMusicText(input)
    expect(text).toBe('天气真好。'.repeat(60))
  })

  it('独立音乐 App 不展示模型生成的 HTML/UI', () => {
    expect(sanitizeMusicText('<div class="player">这首歌让我想起夏天。</div><style>.player{}</style>'))
      .toBe('这首歌让我想起夏天。')
  })

})

describe('音乐聊歌 prompt 构建（纯函数）', () => {
  const profile = musicProfileFromCharacter(makeCharacter({
    name: '小碗',
    persona: '温和、爱笑',
    likes: ['老歌']
  }))

  it('开场：system 带人设与歌名，结尾是让角色开口的任务', () => {
    const messages = buildMusicGreetingMessages(profile, '《晴天》 · 周杰伦')
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('现在播放：《晴天》 · 周杰伦')
    expect(messages[0].content).toContain('小碗')
    expect(messages[0].content).toContain('禁止输出 HTML')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toContain('开场')
  })

  it('回复：只带最近 16 轮历史，我的发言以「我」说开头', () => {
    const history = Array.from({ length: 18 }, (_, index) => ({
      role: (index % 2 === 0 ? 'assistant' : 'user') as 'assistant' | 'user',
      text: `第${index}句`
    }))
    const messages = buildMusicReplyMessages(
      profile,
      '《晴天》 · 周杰伦',
      history,
      '这首歌让我想起学生时代。'
    )
    expect(messages[0].role).toBe('system')
    expect(messages.length).toBe(1 + 16 + 1)
    // 第 18 轮 → 只留第 2..17 句（历史开头 2 条被裁掉）
    expect(messages[1].content).toBe('第2句')
    expect(messages[2].content).toBe('第3句')
    const last = messages[messages.length - 1]
    expect(last.role).toBe('user')
    expect(last.content).toBe('「我」说：这首歌让我想起学生时代。')
  })
})
