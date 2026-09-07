import { describe, expect, it } from 'vitest'
import {
  NATIVE_APP_TEXT_ONLY_RULE,
  sanitizeNativeAppText,
  stripGeneratedPresentationMarkup
} from './appPresentationPolicy'

describe('native app presentation policy', () => {
  it('明确独立 App 只收内容，不收第二层 UI', () => {
    expect(NATIVE_APP_TEXT_ONLY_RULE).toContain('禁止输出 HTML')
    expect(NATIVE_APP_TEXT_ONLY_RULE).toContain('原生界面')
  })

  it('剥掉 HTML/CSS/脚本壳，只保留自然语言', () => {
    const raw = '<style>.card{color:red}</style><div class="card">今晚风很轻。</div><script>alert(1)</script>'
    expect(sanitizeNativeAppText(raw, { singleLine: true })).toBe('今晚风很轻。')
  })

  it('保留游戏里的短动作与心理描写', () => {
    const raw = '（他指尖顿了一下。）不是。\n（心里：这条线索快被你摸到了。）'
    expect(sanitizeNativeAppText(raw)).toContain('（他指尖顿了一下。）')
    expect(sanitizeNativeAppText(raw)).toContain('（心里：这条线索快被你摸到了。）')
  })

  it('代码围栏与富文本标签不会残留到原生 App', () => {
    expect(stripGeneratedPresentationMarkup('```html\n<section>你好</section>\n```'))
      .not.toMatch(/section|```/i)
  })
})
