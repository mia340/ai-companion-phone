import { describe, expect, it } from 'vitest'
import { isBlockedCharacterCardField, sanitizeCharacterCardMetadata } from './characterCardSecurity'

describe('characterCardSecurity', () => {
  it('递归剥离凭据、UI 偏好和运行时状态，但保留标准角色/世界书字段', () => {
    const result = sanitizeCharacterCardMetadata({
      spec: 'chara_card_v3',
      data: {
        name: '测试角色',
        description: '角色设定',
        extensions: {
          api_key: 'never-export-me',
          embeddedTheme: { name: '发送者主题' },
          custom_safe_extension: { enabled: true },
          character_book: {
            token_budget: 900,
            entries: [{ key: ['学院'], content: '设定' }]
          }
        },
        phoneState: { secretDiary: true }
      }
    })

    const json = JSON.stringify(result.value)
    expect(json).not.toContain('never-export-me')
    expect(json).not.toContain('发送者主题')
    expect(json).not.toContain('secretDiary')
    expect(json).toContain('custom_safe_extension')
    expect(json).toContain('token_budget')
    expect(result.removedPaths.some(path => path.endsWith('api_key'))).toBe(true)
  })

  it('统一识别不同命名风格并阻止原型污染字段', () => {
    expect(isBlockedCharacterCardField('apiKey')).toBe(true)
    expect(isBlockedCharacterCardField('api_key')).toBe(true)
    expect(isBlockedCharacterCardField('__proto__')).toBe(true)
    expect(isBlockedCharacterCardField('token_budget')).toBe(false)
  })
})
