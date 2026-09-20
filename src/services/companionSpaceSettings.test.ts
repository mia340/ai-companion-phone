import { describe, expect, it } from 'vitest'
import { normalizeCompanionSpaceSettings } from './companionSpaceSettings'

describe('companionSpaceSettings', () => {
  it('对未知可见范围回退到公开，并清理重复黑名单', () => {
    const value = normalizeCompanionSpaceSettings({
      spaceVisibility: undefined,
      spaceBlacklistCharacterIds: ['a', 'a', '', ' b ']
    })
    expect(value).toEqual({
      visibility: 'public',
      blacklistCharacterIds: ['a', 'b']
    })
  })

  it('保留仅自己可见', () => {
    expect(normalizeCompanionSpaceSettings({ spaceVisibility: 'private' }).visibility).toBe('private')
  })
})
