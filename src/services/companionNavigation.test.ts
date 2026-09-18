import { describe, expect, it } from 'vitest'
import { CUSTOMIZABLE_APPS, DOCK_APPS, HOME_APPS } from './appCustomizationService'

describe('知间桌面入口整合', () => {
  it('空间桌面只展示六个核心入口，社交功能收进唯一的知间入口', () => {
    expect(HOME_APPS.map(item => item.key)).toEqual([
      'banxin',
      'profile',
      'memory',
      'world',
      'backup',
      'settings'
    ])
    expect(HOME_APPS.find(item => item.key === 'banxin')?.route).toBe('/companion')
    expect(HOME_APPS.find(item => item.key === 'banxin')?.label).toBe('知间')
    expect(HOME_APPS.some(item => ['chat', 'contacts', 'moments', 'wallet', 'music', 'diary', 'turtle-soup'].includes(item.key))).toBe(false)
  })

  it('当前空间桌面不重复渲染 Dock，图标自定义列表保持唯一', () => {
    expect(DOCK_APPS).toEqual([])
    expect(new Set(CUSTOMIZABLE_APPS.map(item => item.key)).size).toBe(CUSTOMIZABLE_APPS.length)
    expect(CUSTOMIZABLE_APPS).toHaveLength(6)
  })
})
