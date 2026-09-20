import { describe, expect, it } from 'vitest'
import { renderCharacterCardPromptText, renderRoleplayText } from './textMacroService'

describe('Character Card prompt macros', () => {
  it('替换 user / char 并移除注释宏', () => {
    expect(renderCharacterCardPromptText('{{char}}看见{{user}}。{{// 不进Prompt }}', '小梨', '阿昼', 'seed')).toBe('阿昼看见小梨。')
  })

  it('pick 在同一 seed 下稳定', () => {
    const a = renderCharacterCardPromptText('{{pick:甲,乙,丙}}', 'U', 'C', 'same')
    const b = renderCharacterCardPromptText('{{pick:甲,乙,丙}}', 'U', 'C', 'same')
    expect(a).toBe(b)
    expect(['甲', '乙', '丙']).toContain(a)
  })

  it('roll 返回合法范围', () => {
    const value = Number(renderCharacterCardPromptText('{{roll:d6}}', 'U', 'C'))
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(6)
  })

  it('UI 稳定宏不会执行 random', () => {
    expect(renderRoleplayText('{{char}}/{{user}}/{{random:甲,乙}}', 'U', 'C')).toBe('C/U/{{random:甲,乙}}')
  })
})


it('V3 angle aliases 仅在兼容层显式开启时替换', () => {
  expect(renderCharacterCardPromptText('<char> / <bot>', 'U', '昵称', 'seed', { angleCharacterAliases: true })).toBe('昵称 / 昵称')
  expect(renderCharacterCardPromptText('<char>', 'U', '昵称', 'seed')).toBe('<char>')
})

it('comment / hidden_key 在发送 Prompt 时不会泄漏给模型', () => {
  expect(renderCharacterCardPromptText('A{{comment:作者注释}}B{{hidden_key:secret}}C', 'U', 'C')).toBe('ABC')
})
