import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_APPEARANCE, moveHomeAppToGrid } from './appCustomizationService'
import { parseHomeLayoutBackup, serializeHomeLayoutBackup } from './homeLayoutBackup'

describe('homeLayoutBackup', () => {
  it('round-trips a free launcher layout through the validated format', () => {
    const moved = moveHomeAppToGrid(DEFAULT_HOME_APPEARANCE, 'profile', 1, 3, 5)
    const restored = parseHomeLayoutBackup(serializeHomeLayoutBackup(moved))
    const profilePage = restored.homeLayoutPages.findIndex(page => page.items.some(item => item.type === 'app' && item.key === 'profile'))
    expect(profilePage).toBe(1)
    expect(restored.dockAppKeys).toEqual(moved.dockAppKeys)
  })

  it('rejects arbitrary JSON before it reaches IndexedDB', () => {
    expect(() => parseHomeLayoutBackup('{"hello":"world"}')).toThrow(/不兼容/)
  })
})
