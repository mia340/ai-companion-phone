import { describe, expect, it } from 'vitest'
import {
  CUSTOMIZABLE_APPS,
  DOCK_APPS,
  HOME_APPS,
  HOME_GRID_COLUMNS,
  HOME_GRID_ROWS,
  addHomeAppToFolder,
  createHomeFolder,
  collapseHomeLayoutPageIntoPrevious,
  inspectHomeLayout,
  normalizeHomeAppearance,
  moveHomeAppPlacement,
  moveHomeAppToGrid,
  moveHomeFolderAppToDock,
  moveHomeFolderAppToGrid,
  moveHomeWidgetToGrid,
  resizeHomeWidgetInGrid,
  removeHomeAppFromFolder,
  removeHomeLayoutPages,
  repairHomeLayoutIntegrity,
  reorderHomeFolderApps,
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
    expect(items.find(item => item.id === 'widget:music')).toMatchObject({ w: 4, h: 1 })
    expect(items.find(item => item.id === 'widget:companion')).toMatchObject({ w: 2, h: 1 })
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

  it('把后一页最后一个项目移走后会立即回收空白页', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const moved = moveHomeAppToGrid(current, 'profile', 0, 1, 0)
    expect(moved.homeLayoutPages).toHaveLength(1)
    expect(moved.homeLayoutPages[0].items.map(item => item.id).sort()).toEqual(['app:music', 'app:profile'])
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


  it('显式自愈幽灵页时会同时重算 App/Widget 列表，不会把幽灵项目再次补回来', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const repaired = removeHomeLayoutPages(current, [1])
    expect(repaired.homeLayoutPages).toHaveLength(1)
    expect(repaired.homeAppKeys).toEqual(['music'])
    expect(repaired.homeLayoutPages[0].items.map(item => item.id)).toEqual(['app:music'])
  })

  it('归一化会删除中间和尾部幽灵空页，并把后续非空页前移', () => {
    const normalized = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [] },
        { items: [{ id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted',
      homeLayoutRevision: 7
    })

    expect(normalized.homeLayoutPages).toHaveLength(2)
    expect(normalized.homeLayoutPages[0].items.map(item => item.id)).toEqual(['app:music'])
    expect(normalized.homeLayoutPages[1].items.map(item => item.id)).toEqual(['app:profile'])
  })

  it('App 拖到已有项目之间时按插入顺序流式后移，而不是简单交换', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile', 'memory', 'backup'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 },
        { id: 'app:profile', type: 'app', key: 'profile', x: 1, y: 0, w: 1, h: 1 },
        { id: 'app:memory', type: 'app', key: 'memory', x: 2, y: 0, w: 1, h: 1 },
        { id: 'app:backup', type: 'app', key: 'backup', x: 3, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const moved = moveHomeAppToGrid(current, 'backup', 0, 1, 0)
    const ordered = [...moved.homeLayoutPages[0].items]
      .sort((a, b) => (a.y * HOME_GRID_COLUMNS + a.x) - (b.y * HOME_GRID_COLUMNS + b.x))
      .map(item => item.key)
    expect(ordered).toEqual(['music', 'backup', 'profile', 'memory'])
    expect(moved.homeLayoutPages[0].items.find(item => item.id === 'app:backup')).toMatchObject({ x: 1, y: 0 })
    expect(moved.homeLayoutPages[0].items.find(item => item.id === 'app:profile')).toMatchObject({ x: 2, y: 0 })
    expect(moved.homeLayoutPages[0].items.find(item => item.id === 'app:memory')).toMatchObject({ x: 3, y: 0 })
  })

  it('Widget 与 App 共用插入重排，组件尺寸参与占位并把后续 App 向后推', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: ['companion'],
      homeLayoutPages: [{ items: [
        { id: 'widget:companion', type: 'widget', key: 'companion', x: 0, y: 0, w: 2, h: 1 },
        { id: 'app:music', type: 'app', key: 'music', x: 2, y: 0, w: 1, h: 1 },
        { id: 'app:profile', type: 'app', key: 'profile', x: 3, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const moved = moveHomeWidgetToGrid(current, 'companion', 0, 2, 0)
    const page = moved.homeLayoutPages[0]
    expect(page.items.find(item => item.id === 'app:music')).toMatchObject({ x: 0, y: 0 })
    expect(page.items.find(item => item.id === 'app:profile')).toMatchObject({ x: 1, y: 0 })
    expect(page.items.find(item => item.id === 'widget:companion')).toMatchObject({ x: 2, y: 0, w: 2, h: 1 })

    const resized = resizeHomeWidgetInGrid(moved, 'companion', 2, 2)
    expect(resized.homeLayoutPages[0].items.find(item => item.id === 'widget:companion')).toMatchObject({ w: 2, h: 2 })
  })



  it('两个 App 可以组成文件夹，并继续加入第三个 App', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile', 'memory'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 },
        { id: 'app:profile', type: 'app', key: 'profile', x: 1, y: 0, w: 1, h: 1 },
        { id: 'app:memory', type: 'app', key: 'memory', x: 2, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const grouped = createHomeFolder(current, 'music', 'profile')
    const folder = grouped.homeLayoutPages[0].items.find(item => item.type === 'folder')
    expect(folder).toBeTruthy()
    expect(folder?.type === 'folder' ? folder.appKeys : []).toEqual(['profile', 'music'])
    expect(grouped.homeAppKeys).toEqual(expect.arrayContaining(['music', 'profile', 'memory']))

    const withThird = folder?.type === 'folder'
      ? addHomeAppToFolder(grouped, 'memory', folder.id)
      : grouped
    const updated = withThird.homeLayoutPages[0].items.find(item => item.type === 'folder')
    expect(updated?.type === 'folder' ? updated.appKeys : []).toEqual(['profile', 'music', 'memory'])
    expect(withThird.homeLayoutPages[0].items.filter(item => item.type === 'app')).toHaveLength(0)
  })

  it('文件夹只剩一个 App 时自动解散回普通图标', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'folder:profile-music', type: 'folder', key: 'profile-music', name: '文件夹', appKeys: ['profile', 'music'], x: 0, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const folder = current.homeLayoutPages[0].items.find(item => item.type === 'folder')
    expect(folder?.type).toBe('folder')
    const next = folder?.type === 'folder'
      ? removeHomeAppFromFolder(current, folder.id, 'music', 0)
      : current
    expect(next.homeLayoutPages[0].items.some(item => item.type === 'folder')).toBe(false)
    expect(next.homeLayoutPages[0].items.some(item => item.type === 'app' && item.key === 'profile')).toBe(true)
    expect(next.homeLayoutPages[0].items.some(item => item.type === 'app' && item.key === 'music')).toBe(true)
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

  it('文件夹内 App 可以拖回桌面精确格位，并在只剩一个成员时自动解散', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile', 'memory'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'folder:profile-music-memory', type: 'folder', key: 'profile-music-memory', name: '常用', appKeys: ['profile', 'music', 'memory'], x: 0, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const moved = moveHomeFolderAppToGrid(current, 'folder:profile-music-memory', 'music', 0, 2, 0)
    const folder = moved.homeLayoutPages[0].items.find(item => item.type === 'folder')
    expect(folder?.type === 'folder' ? folder.appKeys : []).toEqual(['profile', 'memory'])
    expect(moved.homeLayoutPages[0].items.find(item => item.type === 'app' && item.key === 'music')).toMatchObject({ type: 'app', key: 'music' })

    const dissolved = moveHomeFolderAppToGrid(moved, folder?.type === 'folder' ? folder.id : '', 'memory', 0, 3, 0)
    expect(dissolved.homeLayoutPages[0].items.some(item => item.type === 'folder')).toBe(false)
    expect(dissolved.homeLayoutPages[0].items.some(item => item.type === 'app' && item.key === 'profile')).toBe(true)
    expect(dissolved.homeLayoutPages[0].items.some(item => item.type === 'app' && item.key === 'memory')).toBe(true)
  })

  it('文件夹内 App 可以拖到 Dock，且剩余一个成员时自动解散', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'folder:profile-music', type: 'folder', key: 'profile-music', name: '文件夹', appKeys: ['profile', 'music'], x: 0, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const moved = moveHomeFolderAppToDock(current, 'folder:profile-music', 'music')
    expect(moved.dockAppKeys).toContain('music')
    expect(moved.homeLayoutPages[0].items.some(item => item.type === 'folder')).toBe(false)
    expect(moved.homeLayoutPages[0].items.some(item => item.type === 'app' && item.key === 'profile')).toBe(true)
  })

  it('文件夹内部拖动按插入顺序重排成员，而不是只能移出', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile', 'memory'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'folder:profile-music-memory', type: 'folder', key: 'profile-music-memory', name: '常用', appKeys: ['profile', 'music', 'memory'], x: 0, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const reordered = reorderHomeFolderApps(current, 'folder:profile-music-memory', 'memory', 'profile')
    const folder = reordered.homeLayoutPages[0].items.find(item => item.type === 'folder')
    expect(folder?.type === 'folder' ? folder.appKeys : []).toEqual(['memory', 'profile', 'music'])
  })

  it('幽灵页修复会把非空页面的项目安全搬回前页，再删除页面', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const repaired = collapseHomeLayoutPageIntoPrevious(current, 1)
    expect(repaired.homeLayoutPages).toHaveLength(1)
    expect(repaired.homeLayoutPages[0].items.map(item => item.type === 'app' ? item.key : item.id)).toEqual(expect.arrayContaining(['music', 'profile']))
  })

  it('幽灵页修复在空位碎片化时会先安全重排前页再回收页面', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['profile', 'memory', 'backup'],
      homeWidgetKeys: ['music'],
      homeLayoutPages: [
        { items: [
          { id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 },
          { id: 'app:memory', type: 'app', key: 'memory', x: 0, y: 2, w: 1, h: 1 },
          { id: 'app:backup', type: 'app', key: 'backup', x: 0, y: 4, w: 1, h: 1 }
        ] },
        { items: [
          { id: 'widget:music', type: 'widget', key: 'music', x: 0, y: 0, w: 4, h: 2 }
        ] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })

    const repaired = collapseHomeLayoutPageIntoPrevious(current, 1)
    expect(repaired.homeLayoutPages).toHaveLength(1)
    expect(repaired.homeLayoutPages[0].items.map(item => item.id)).toEqual(expect.arrayContaining([
      'app:profile', 'app:memory', 'app:backup', 'widget:music'
    ]))
  })

  it('默认桌面和归一化都不会硬编码第二页', () => {
    const normalized = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      dockAppKeys: ['banxin', 'new-character', 'world', 'settings'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    expect(normalized.homeLayoutPages).toHaveLength(1)
    expect(normalized.homePageKeys).toHaveLength(1)
  })

  it('强制移除幽灵页只移除桌面布局归属，不影响其他页项目', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:profile', type: 'app', key: 'profile', x: 0, y: 0, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    const repaired = removeHomeLayoutPages(current, [1])
    expect(repaired.homeLayoutPages).toHaveLength(1)
    expect(repaired.homeLayoutPages[0].items.map(item => item.id)).toEqual(['app:music'])
    expect(repaired.homeAppKeys).toEqual(['music'])
  })

  it('归一化会移除 Dock 与桌面的重复 App，避免历史重复项制造幽灵页', () => {
    const normalized = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile', 'banxin'],
      homeWidgetKeys: [],
      homeLayoutPages: [
        { items: [{ id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 }] },
        { items: [{ id: 'app:banxin', type: 'app', key: 'banxin', x: 0, y: 0, w: 1, h: 1 }] }
      ],
      dockAppKeys: ['banxin', 'new-character', 'world', 'settings'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    expect(normalized.homeLayoutPages).toHaveLength(1)
    expect(normalized.homeAppKeys).toEqual(['music'])
  })

  it('HomeLayout Inspector 会报告重复/重叠并由结构修复器安全收敛', () => {
    const current = normalizeHomeAppearance({
      homeAppKeys: ['music', 'profile'],
      homeWidgetKeys: [],
      homeLayoutPages: [{ items: [
        { id: 'app:music', type: 'app', key: 'music', x: 0, y: 0, w: 1, h: 1 },
        { id: 'app:profile', type: 'app', key: 'profile', x: 1, y: 0, w: 1, h: 1 }
      ] }],
      dockAppKeys: ['banxin'],
      iconScale: 1,
      showAppLabels: true,
      widgetStyle: 'frosted'
    })
    const diagnostics = inspectHomeLayout(current)
    expect(diagnostics.pageCount).toBe(1)
    expect(diagnostics.pages[0].itemCount).toBe(2)
    expect(diagnostics.pages[0].occupiedCells).toBe(2)
    expect(repairHomeLayoutIntegrity(current).homeLayoutPages).toHaveLength(1)
  })

})
