import { describe, expect, it } from 'vitest'
import {
  CUSTOMIZABLE_APPS,
  DOCK_APPS,
  HOME_APPS,
  normalizeHomeAppearance
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
  })
})
