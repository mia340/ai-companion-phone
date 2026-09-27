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
    expect(changed.outfits.length).toBeGreaterThanOrEqual(12)
    expect(changed.outfits.some(row => row.id === profile.activeOutfitId)).toBe(true)
  })

  it('supports multiple outfits and resolves active colors for the shared sprite runtime', () => {
    let profile = createAvatarAppearanceProfile('c-1', 'character', 'female')
    profile = addWardrobeOutfit(profile, '约会')
    profile = updateActiveOutfit(profile, { topColor: '#7E5AA8', bottomStyle: 'skirt', headwear: 'beret' })
    expect(profile.outfits.length).toBeGreaterThan(12)
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
    expect(state.profiles.self.outfits.length).toBeGreaterThanOrEqual(12)
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

  it('ships a broader style library for both female and male avatars', () => {
    const female = createAvatarAppearanceProfile('f-1', 'character', 'female')
    const male = createAvatarAppearanceProfile('m-1', 'character', 'male')
    expect(female.outfits.map(row => row.name)).toEqual(expect.arrayContaining(['甜美花园', '复古学院', '夜色酷甜', '向日葵田园']))
    expect(male.outfits.map(row => row.name)).toEqual(expect.arrayContaining(['田园背带', '阳光户外', '学院复古', '城市约会']))
  })

  it('upgrades V1.2 outfits with V1.3 accent, carry, legwear and pattern layers', () => {
    const legacy = createAvatarAppearanceProfile('legacy', 'character', 'female')
    legacy.outfits = [{ ...legacy.outfits[0], carrywear: undefined, legwear: undefined, pattern: undefined, accentColor: undefined }]
    const state = normalizeWardrobeState({ version: 1, profiles: { legacy } })
    const look = resolveAvatarLook(state.profiles.legacy)
    expect(look.carrywear).toBe('none')
    expect(look.legwear).toBe('none')
    expect(look.pattern).toBe('none')
    expect(look.accentColor).toBeTruthy()
  })

  it('resolves custom accent colors independently from the main garment color', () => {
    let profile = createAvatarAppearanceProfile('self', 'self', 'female')
    profile = updateActiveOutfit(profile, { topColor: '#222222', accentColor: '#F0A0B0', pattern: 'plaid' })
    const look = resolveAvatarLook(profile)
    expect(look.topColor).toBe('#222222')
    expect(look.accentColor).toBe('#F0A0B0')
    expect(look.pattern).toBe('plaid')
  })


  it('keeps sleepwear and private looks out of autonomous daytime rotation', () => {
    let profile = createAvatarAppearanceProfile('daily-safe', 'character', 'female')
    profile = setDailyMode(profile, 'auto')
    for (const day of ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']) {
      profile = chooseDailyOutfit(profile, day)
      const active = profile.outfits.find(row => row.id === profile.activeOutfitId)
      expect(active?.category).not.toBe('sleepwear')
      expect(active?.category).not.toBe('private')
    }
  })

})
