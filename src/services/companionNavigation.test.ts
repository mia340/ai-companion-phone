import { describe, expect, it } from 'vitest'
import { CUSTOMIZABLE_APPS, DOCK_APPS, HOME_APPS } from './appCustomizationService'

describe('知间桌面入口整合', () => {
  it('将聊天、通讯录、朋友圈、钱包收进唯一的知间桌面入口', () => {
    expect(HOME_APPS.filter(item => item.key === 'banxin')).toHaveLength(1)
    expect(HOME_APPS.find(item => item.key === 'banxin')?.route).toBe('/companion')
    expect(HOME_APPS.find(item => item.key === 'banxin')?.label).toBe('知间')
    expect(HOME_APPS.filter(item => ['chat', 'contacts', 'moments', 'wallet'].includes(item.key))).toHaveLength(0)
  })

  it('Dock 保留知间而非重复展示拆分的社交入口', () => {
    expect(DOCK_APPS.filter(item => item.key === 'banxin')).toHaveLength(1)
    expect(DOCK_APPS.some(item => ['chat', 'contacts', 'moments', 'wallet'].includes(item.key))).toBe(false)
    expect(new Set(CUSTOMIZABLE_APPS.map(item => item.key)).size).toBe(CUSTOMIZABLE_APPS.length)
  })
})
