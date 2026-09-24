import { describe, expect, it } from 'vitest'
import {
  addWardrobeOutfit,
  createAvatarAppearanceProfile,
  normalizeWardrobeState,
  resolveAvatarLook,
  setAvatarGenderStyle,
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
    expect(changed.outfits).toHaveLength(1)
    expect(changed.activeOutfitId).toBe(profile.activeOutfitId)
  })

  it('supports multiple outfits and resolves active colors for the shared sprite runtime', () => {
    let profile = createAvatarAppearanceProfile('c-1', 'character', 'female')
    profile = addWardrobeOutfit(profile, '约会')
    profile = updateActiveOutfit(profile, { topColor: 'lavender', bottomStyle: 'skirt' })
    expect(profile.outfits).toHaveLength(2)
    const look = resolveAvatarLook(profile)
    expect(look.bottomStyle).toBe('skirt')
    expect(look.topColor).toMatch(/^#/)
  })
})
