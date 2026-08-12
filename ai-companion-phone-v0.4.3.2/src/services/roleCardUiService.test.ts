import { describe, expect, it } from 'vitest'
import { extractRoleCardUiHints, inferPresenceFromRoleCardScene, parseRoleCardUi, roleCardUiToConversationPatch } from './roleCardUiService'

describe('role card UI compatibility', () => {
  it('parses brace UI and scene presence', () => {
    const source = '{日期:2017-6-9|时间:晚上}\\n{地点:主卧}\\n{内心:想抱她}\\n{周围:用户在场}\\n{待办:1.休息.2.拍摄}\\n\\n（将你揽进怀里）我也没睡。'
    const parsed = parseRoleCardUi(source)
    const patch = roleCardUiToConversationPatch(parsed.content, parsed.ui)
    expect(parsed.ui?.location).toBe('主卧')
    expect(patch.presence).toBe('together')
    expect(patch.shortTermGoals).toHaveLength(2)
  })

  it('extracts pipe-style Tavo status without removing raw text', () => {
    const source = '[角色]\\n时间 | 3055年6月5日 18:30\\n地点 | 府邸·卧室\\n心声 | 她还没睡\\n正文 | 你好\\n[/角色]'
    const hints = extractRoleCardUiHints(source)
    expect(hints?.time).toContain('3055年6月5日')
    expect(hints?.location).toBe('府邸·卧室')
    expect(inferPresenceFromRoleCardScene('（把你抱进怀里）', hints)).toBe('together')
  })
})
