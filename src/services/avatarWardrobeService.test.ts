import { describe, expect, it } from 'vitest'
import {
  addWardrobeOutfit,
  chooseDailyOutfit,
  colorValue,
  createAvatarAppearanceProfile,
  normalizeWardrobeState,
  rememberCustomColor,
  resolveAvatarLook,
  setAvatarGenderStyle,
  setDailyMode,
  updateActiveOutfit,
  upsertWardrobeProfile
} from './avatarWardrobeService'

describe('avatarWardrobeService', () => {
  it('keeps one independent appearance profile per self/character target', () => {
    const me = createAvatarAppearanceProfile('self', 'self', 'female')
    const him = createAvatarAppearanceProfile('c-1', 'character', 'male')
    let state = normalizeWardrobeState(undefined)
    state = upsertWardrobeProfile(state, me)
    state = upsertWardrobeProfile(state, him)
    expect(Object.keys(state.profiles).sort()).toEqual(['c-1', 'self'])
    expect(state.profiles['c-1'].genderStyle).toBe('male')
  })

  it('switches male/female silhouettes without losing the active outfit record', () => {
    const profile = createAvatarAppearanceProfile('self', 'self', 'female')
    const changed = setAvatarGenderStyle(profile, 'male')
    expect(changed.genderStyle).toBe('male')
    expect(changed.outfits.length).toBeGreaterThanOrEqual(6)
    expect(changed.outfits.some(row => row.id === profile.activeOutfitId)).toBe(true)
  })

  it('supports multiple outfits and resolves active colors for the shared sprite runtime', () => {
    let profile = createAvatarAppearanceProfile('c-1', 'character', 'female')
    profile = addWardrobeOutfit(profile, '约会')
    profile = updateActiveOutfit(profile, { topColor: '#7E5AA8', bottomStyle: 'skirt', headwear: 'beret' })
    expect(profile.outfits.length).toBeGreaterThan(6)
    const look = resolveAvatarLook(profile)
    expect(look.bottomStyle).toBe('skirt')
    expect(look.topColor).toBe('#7E5AA8')
    expect(look.headwear).toBe('beret')
  })

  it('keeps Wardrobe V1 persisted profiles compatible with V1.2 and upgrades starter outfits/accessory slots', () => {
    const legacy = createAvatarAppearanceProfile('self', 'self', 'female')
    legacy.outfits = [legacy.outfits[0]]
    legacy.outfits[0] = { ...legacy.outfits[0], accessory: 'glasses', headwear: undefined, facewear: undefined, neckwear: undefined }
    const state = normalizeWardrobeState({ version: 1, profiles: { self: legacy } })
    expect(state.version).toBe(1)
    expect(state.profiles.self.outfits.length).toBeGreaterThanOrEqual(6)
    expect(resolveAvatarLook(state.profiles.self).facewear).toBe('glasses')
  })

  it('lets characters pick one stable daily outfit while avoiding the most recent looks when possible', () => {
    let profile = createAvatarAppearanceProfile('c-1', 'character', 'female')
    profile = setDailyMode(profile, 'auto')
    const dayOne = chooseDailyOutfit(profile, '2026-09-24')
    const sameDay = chooseDailyOutfit(dayOne, '2026-09-24')
    const dayTwo = chooseDailyOutfit(dayOne, '2026-09-25')
    expect(sameDay.activeOutfitId).toBe(dayOne.activeOutfitId)
    expect(dayTwo.outfitHistory?.length).toBe(2)
  })

  it('supports custom HEX colors and remembers user favorites', () => {
    let profile = createAvatarAppearanceProfile('self', 'self', 'female')
    profile = rememberCustomColor(profile, '#12abef')
    expect(profile.customColors?.[0]).toBe('#12ABEF')
    expect(colorValue('#12abef')).toBe('#12ABEF')
  })
})
