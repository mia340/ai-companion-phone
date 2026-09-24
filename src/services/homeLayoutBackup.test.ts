import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_APPEARANCE, HOME_LAYOUT_REVISION, moveHomeAppToGrid, normalizeHomeAppearance } from './appCustomizationService'
import { parseHomeLayoutBackup, serializeHomeLayoutBackup } from './homeLayoutBackup'

describe('homeLayoutBackup', () => {
  it('round-trips a free launcher layout through the validated format', () => {
    const moved = moveHomeAppToGrid(DEFAULT_HOME_APPEARANCE, 'profile', 1, 3, 5)
    const restored = parseHomeLayoutBackup(serializeHomeLayoutBackup(moved))
    const profilePage = restored.homeLayoutPages.findIndex(page => page.items.some(item => item.type === 'app' && item.key === 'profile'))
    expect(profilePage).toBe(1)
    expect(restored.dockAppKeys).toEqual(moved.dockAppKeys)
  })


  it('ships couple board + wardrobe in the default launcher catalog', () => {
    expect(DEFAULT_HOME_APPEARANCE.homeAppKeys).toContain('couple-board')
    expect(DEFAULT_HOME_APPEARANCE.homeAppKeys).toContain('wardrobe')
    expect(HOME_LAYOUT_REVISION).toBe(14)
  })

  it('adds the couple board app once when migrating a revision 12 launcher', () => {
    const legacyPages = DEFAULT_HOME_APPEARANCE.homeLayoutPages.map(page => ({
      items: page.items.filter(item => !(item.type === 'app' && item.key === 'couple-board'))
    }))
    const restored = normalizeHomeAppearance({
      ...DEFAULT_HOME_APPEARANCE,
      homeLayoutRevision: 12,
      homeLayoutPages: legacyPages,
      homeAppKeys: DEFAULT_HOME_APPEARANCE.homeAppKeys.filter(key => key !== 'couple-board')
    })
    const matches = restored.homeLayoutPages.flatMap(page => page.items)
      .filter(item => item.type === 'app' && item.key === 'couple-board')
    expect(matches).toHaveLength(1)
  })


  it('adds the wardrobe app once when migrating a revision 13 launcher', () => {
    const legacyPages = DEFAULT_HOME_APPEARANCE.homeLayoutPages.map(page => ({
      items: page.items.filter(item => !(item.type === 'app' && item.key === 'wardrobe'))
    }))
    const restored = normalizeHomeAppearance({
      ...DEFAULT_HOME_APPEARANCE,
      homeLayoutRevision: 13,
      homeLayoutPages: legacyPages,
      homeAppKeys: DEFAULT_HOME_APPEARANCE.homeAppKeys.filter(key => key !== 'wardrobe')
    })
    const matches = restored.homeLayoutPages.flatMap(page => page.items)
      .filter(item => item.type === 'app' && item.key === 'wardrobe')
    expect(matches).toHaveLength(1)
  })

  it('rejects arbitrary JSON before it reaches IndexedDB', () => {
    expect(() => parseHomeLayoutBackup('{"hello":"world"}')).toThrow(/不兼容/)
  })
})
