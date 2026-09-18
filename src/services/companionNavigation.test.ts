import { describe, expect, it } from 'vitest'
import {
  CUSTOMIZABLE_APPS,
  DOCK_APPS,
  HOME_APPS,
  HOME_GRID_COLUMNS,
  HOME_GRID_ROWS,
  normalizeHomeAppearance,
  moveHomeAppPlacement,
  moveHomeAppToGrid,
  paginateHomeAppKeys
} from './appCustomizationService'

describe('知间桌面入口与布局', () => {
  it('恢复音乐、海龟汤和真实手机式四格 Dock', () => {
    expect(HOME_APPS.map(item => item.key)).toEqual([
      'music',
      'turtle-soup',
      'profile',
      'memory',
      'backup'
    ])
    expect(HOME_APPS.find(item => item.key === 'music')?.route).toBe('/app/音乐')
    expect(HOME_APPS.find(item => item.key === 'turtle-soup')?.route).toBe('/app/海龟汤')
    expect(DOCK_APPS.map(item => item.key)).toEqual([
      'banxin',
      'new-character',
      'world',
      'settings'
    ])
  })

  it('桌面自定义列表保持唯一，并能安全清洗玩家布局', () => {
    expect(new Set(CUSTOMIZABLE_APPS.map(item => item.key)).size).toBe(CUSTOMIZABLE_APPS.length)
    expect(CUSTOMIZABLE_APPS.map(item => item.key)).toEqual([
      'banxin',
      'music',
      'turtle-soup',
      'profile',
      'memory',
      'world',
      'backup',
      'settings',
      'new-character'
    ])

    const normalized = normalizeHomeAppearance({
      iconScale: 99,
      showAppLabels: false,
      homeAppKeys: ['music', 'music', 'turtle-soup', 'unknown'] as never,
      dockAppKeys: ['banxin', 'world', 'settings', 'new-character', 'music'] as never,
      homeWidgetKeys: ['greeting', 'greeting', 'music', 'unknown'] as never,
      widgetStyle: 'clear'
    })

    expect(normalized.iconScale).toBe(1.12)
    expect(normalized.showAppLabels).toBe(false)
    expect(normalized.homeAppKeys).toEqual(['music', 'turtle-soup'])
    expect(normalized.dockAppKeys).toEqual(['banxin', 'world', 'settings', 'new-character'])
    expect(normalized.homeWidgetKeys).toEqual(['greeting', 'music'])
    expect(normalized.widgetStyle).toBe('clear')
    expect(normalized.homeLayoutPages.length).toBeGreaterThanOrEqual(1)
  })

  it('Launcher Grid 固定为 4×6，Widget 与 App 共享同一网格', () => {
    expect(HOME_GRID_COLUMNS).toBe(4)
    expect(HOME_GRID_ROWS).toBe(6)

    const normalized = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: ['companion', 'world', 'music'],
      dockAppKeys: ['banxin', 'new-character', 'world', 'settings'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    const items = normalized.homeLayoutPages.flatMap(page => page.items)
    expect(items.find(item => item.id === 'widget:music')).toMatchObject({ w: 4, h: 2 })
    expect(items.find(item => item.id === 'widget:companion')).toMatchObject({ w: 2, h: 2 })
    expect(items.find(item => item.id === 'app:music')).toMatchObject({ w: 1, h: 1 })
  })

  it('Dock 满位时支持拖拽交换', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'turtle-soup', 'profile'],
      dockAppKeys: ['banxin', 'new-character', 'world', 'settings'],
      homeWidgetKeys: [],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    const moved = moveHomeAppPlacement(current, 'music', 'dock', 'world')
    expect(moved.dockAppKeys).toEqual(['banxin', 'new-character', 'music', 'settings'])
    expect(moved.homeAppKeys).toContain('world')
  })

  it('允许把一个 App 单独放到新页，并保留明确页归属', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'turtle-soup', 'profile'],
      homePageKeys: [['music', 'turtle-soup', 'profile']],
      dockAppKeys: ['banxin', 'new-character', 'world', 'settings'],
      homeWidgetKeys: [],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    const moved = moveHomeAppToGrid(current, 'profile', 1, 0, 0)
    expect(moved.homeLayoutPages).toHaveLength(2)
    expect(moved.homeLayoutPages[1].items).toEqual([
      expect.objectContaining({ type: 'app', key: 'profile', x: 0, y: 0 })
    ])
  })

  it('页面只有在真正清空后才删除，不会把非空页自动挤回前一页', () => {
    const normalized = normalizeHomeAppearance({
      homeAppKeys: ['music', 'backup'],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:backup', type: 'app', key: 'backup', x: 3, y: 5, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin'],
      homeWidgetKeys: [],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    expect(normalized.homeLayoutPages).toHaveLength(2)
    expect(normalized.homeLayoutPages[1].items[0]).toMatchObject({ key: 'backup', x: 3, y: 5 })
  })

  it('保留旧分页迁移函数，兼容历史备份', () => {
    expect(paginateHomeAppKeys([
      'music', 'turtle-soup', 'profile', 'memory', 'backup', 'world', 'settings', 'banxin',
      'new-character'
    ], true)).toEqual([
      ['music', 'turtle-soup', 'profile', 'memory'],
      ['backup', 'world', 'settings', 'banxin', 'new-character']
    ])
  })
})
