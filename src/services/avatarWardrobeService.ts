import { z } from 'zod'
import { db } from '../db/database'
import type { AppCustomization, Character } from '../types/domain'

export type AvatarGenderStyle = 'female' | 'male'
export type AvatarOutfitCategory = 'daily' | 'home' | 'date' | 'sleepwear' | 'formal' | 'private'
export type AvatarAnimation = 'idle' | 'walk' | 'rollDice' | 'closeDistance' | 'holdHands' | 'hug' | 'kiss'

export interface AvatarOutfit {
  id: string
  name: string
  category: AvatarOutfitCategory
  topStyle: string
  topColor: string
  bottomStyle: string
  bottomColor: string
  shoesStyle: string
  shoesColor: string
  accessory: string
}

export interface AvatarAppearanceProfile {
  targetId: string
  targetType: 'self' | 'character'
  genderStyle: AvatarGenderStyle
  skinTone: string
  hairStyle: string
  hairColor: string
  eyeStyle: string
  activeOutfitId: string
  outfits: AvatarOutfit[]
  updatedAt: string
}

export interface WardrobeState {
  version: 1
  profiles: Record<string, AvatarAppearanceProfile>
}

export interface AvatarLook {
  genderStyle: AvatarGenderStyle
  skinTone: string
  hairStyle: string
  hairColor: string
  eyeStyle: string
  topStyle: string
  topColor: string
  bottomStyle: string
  bottomColor: string
  shoesStyle: string
  shoesColor: string
  accessory: string
}

export const WARDROBE_APP_KEY = '__wardrobe__'
export const SELF_AVATAR_TARGET_ID = 'self'

export const SKIN_TONES = [
  { id: 'porcelain', label: '白皙', color: '#f3ceb9' },
  { id: 'warm', label: '暖肤', color: '#e5b493' },
  { id: 'honey', label: '蜜糖', color: '#c98d67' },
  { id: 'deep', label: '深肤', color: '#8f5c46' }
] as const

export const HAIR_COLORS = [
  { id: 'ink', label: '墨黑', color: '#332b33' },
  { id: 'coffee', label: '咖棕', color: '#62443c' },
  { id: 'chestnut', label: '栗棕', color: '#8a5648' },
  { id: 'ash', label: '雾灰', color: '#756f7b' },
  { id: 'blonde', label: '浅金', color: '#d6b77a' },
  { id: 'rose', label: '莓粉', color: '#a85a73' }
] as const

export const OUTFIT_COLORS = [
  { id: 'cream', label: '奶油', color: '#f4e8dd' },
  { id: 'rose', label: '玫瑰', color: '#b85d7d' },
  { id: 'wine', label: '酒红', color: '#78344f' },
  { id: 'navy', label: '深蓝', color: '#394f68' },
  { id: 'sky', label: '雾蓝', color: '#8fa9bd' },
  { id: 'sage', label: '鼠尾草', color: '#809a82' },
  { id: 'black', label: '黑色', color: '#38353c' },
  { id: 'lavender', label: '薰衣草', color: '#9b8eb4' }
] as const

export const HAIR_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'long', label: '长发' }, { id: 'waves', label: '微卷' }, { id: 'bob', label: '短波波' },
    { id: 'ponytail', label: '马尾' }, { id: 'short', label: '短发' }
  ],
  male: [
    { id: 'crop', label: '短碎' }, { id: 'side', label: '侧分' }, { id: 'soft', label: '柔顺' },
    { id: 'buzz', label: '寸头' }, { id: 'long', label: '长发' }
  ]
}

export const TOP_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'tee', label: '短袖' }, { id: 'blouse', label: '衬衫' }, { id: 'sweater', label: '针织' },
    { id: 'hoodie', label: '卫衣' }, { id: 'cami', label: '吊带' }, { id: 'dress', label: '连衣裙' }
  ],
  male: [
    { id: 'tee', label: '短袖' }, { id: 'shirt', label: '衬衫' }, { id: 'sweater', label: '针织' },
    { id: 'hoodie', label: '卫衣' }, { id: 'jacket', label: '夹克' }, { id: 'tank', label: '背心' }
  ]
}

export const BOTTOM_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'skirt', label: '短裙' }, { id: 'pleated', label: '百褶裙' }, { id: 'jeans', label: '牛仔裤' },
    { id: 'pants', label: '长裤' }, { id: 'shorts', label: '短裤' }
  ],
  male: [
    { id: 'pants', label: '长裤' }, { id: 'jeans', label: '牛仔裤' }, { id: 'cargo', label: '工装裤' },
    { id: 'shorts', label: '短裤' }
  ]
}

export const ACCESSORIES = [
  { id: 'none', label: '无' }, { id: 'glasses', label: '眼镜' }, { id: 'earrings', label: '耳饰' },
  { id: 'necklace', label: '项链' }, { id: 'cap', label: '帽子' }, { id: 'ribbon', label: '发带' }
] as const

const outfitSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(24),
  category: z.enum(['daily', 'home', 'date', 'sleepwear', 'formal', 'private']),
  topStyle: z.string().min(1), topColor: z.string().min(1),
  bottomStyle: z.string().min(1), bottomColor: z.string().min(1),
  shoesStyle: z.string().min(1), shoesColor: z.string().min(1), accessory: z.string().min(1)
})

const profileSchema = z.object({
  targetId: z.string().min(1), targetType: z.enum(['self', 'character']),
  genderStyle: z.enum(['female', 'male']), skinTone: z.string().min(1), hairStyle: z.string().min(1),
  hairColor: z.string().min(1), eyeStyle: z.string().min(1), activeOutfitId: z.string().min(1),
  outfits: z.array(outfitSchema).min(1).max(20), updatedAt: z.string().min(1)
})

const wardrobeSchema = z.object({ version: z.literal(1), profiles: z.record(profileSchema) })

function stateId(worldId: string) { return `${worldId}:${WARDROBE_APP_KEY}` }
function token(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }

function defaultOutfit(genderStyle: AvatarGenderStyle, targetId: string): AvatarOutfit {
  return {
    id: `default-${targetId}`,
    name: '默认穿搭',
    category: 'daily',
    topStyle: genderStyle === 'female' ? 'sweater' : 'tee',
    topColor: genderStyle === 'female' ? 'rose' : 'navy',
    bottomStyle: genderStyle === 'female' ? 'pleated' : 'pants',
    bottomColor: genderStyle === 'female' ? 'cream' : 'black',
    shoesStyle: 'sneakers',
    shoesColor: 'cream',
    accessory: 'none'
  }
}

export function defaultGenderStyle(gender?: Character['gender']): AvatarGenderStyle {
  return gender === 'male' ? 'male' : 'female'
}

export function createAvatarAppearanceProfile(
  targetId: string,
  targetType: 'self' | 'character',
  genderStyle: AvatarGenderStyle = 'female'
): AvatarAppearanceProfile {
  const outfit = defaultOutfit(genderStyle, targetId)
  return {
    targetId, targetType, genderStyle,
    skinTone: 'warm', hairStyle: genderStyle === 'female' ? 'long' : 'crop', hairColor: 'ink', eyeStyle: 'soft',
    activeOutfitId: outfit.id, outfits: [outfit], updatedAt: new Date().toISOString()
  }
}

export function normalizeWardrobeState(value: unknown): WardrobeState {
  const parsed = wardrobeSchema.safeParse(value)
  if (parsed.success) return parsed.data
  return { version: 1, profiles: {} }
}

export async function loadWardrobeState(worldId: string): Promise<WardrobeState> {
  const row = await db.appCustomizations.get(stateId(worldId))
  return normalizeWardrobeState(row?.wardrobeState)
}

export async function saveWardrobeState(worldId: string, state: WardrobeState): Promise<WardrobeState> {
  const normalized = normalizeWardrobeState(state)
  const existing = await db.appCustomizations.get(stateId(worldId))
  const row: AppCustomization = {
    ...(existing ?? {}),
    id: stateId(worldId), worldId, appKey: WARDROBE_APP_KEY,
    wardrobeState: normalized,
    updatedAt: new Date().toISOString()
  }
  await db.appCustomizations.put(row)
  return normalized
}

export function ensureWardrobeProfile(
  state: WardrobeState,
  targetId: string,
  targetType: 'self' | 'character',
  genderStyle: AvatarGenderStyle = 'female'
): AvatarAppearanceProfile {
  return state.profiles[targetId] ?? createAvatarAppearanceProfile(targetId, targetType, genderStyle)
}

export function upsertWardrobeProfile(state: WardrobeState, profile: AvatarAppearanceProfile): WardrobeState {
  const checked = profileSchema.parse({ ...profile, updatedAt: new Date().toISOString() })
  return { version: 1, profiles: { ...state.profiles, [checked.targetId]: checked } }
}

export function setAvatarGenderStyle(profile: AvatarAppearanceProfile, genderStyle: AvatarGenderStyle): AvatarAppearanceProfile {
  if (profile.genderStyle === genderStyle) return profile
  const current = profile.outfits.find(row => row.id === profile.activeOutfitId) ?? profile.outfits[0]!
  const outfit: AvatarOutfit = {
    ...current,
    topStyle: TOP_STYLES[genderStyle].some(row => row.id === current.topStyle) ? current.topStyle : TOP_STYLES[genderStyle][0].id,
    bottomStyle: BOTTOM_STYLES[genderStyle].some(row => row.id === current.bottomStyle) ? current.bottomStyle : BOTTOM_STYLES[genderStyle][0].id
  }
  return {
    ...profile,
    genderStyle,
    hairStyle: HAIR_STYLES[genderStyle].some(row => row.id === profile.hairStyle) ? profile.hairStyle : HAIR_STYLES[genderStyle][0].id,
    outfits: profile.outfits.map(row => row.id === outfit.id ? outfit : row),
    updatedAt: new Date().toISOString()
  }
}

export function updateActiveOutfit(profile: AvatarAppearanceProfile, patch: Partial<AvatarOutfit>): AvatarAppearanceProfile {
  const outfits = profile.outfits.map(row => row.id === profile.activeOutfitId ? { ...row, ...patch, id: row.id } : row)
  return { ...profile, outfits, updatedAt: new Date().toISOString() }
}

export function addWardrobeOutfit(profile: AvatarAppearanceProfile, name = '新穿搭'): AvatarAppearanceProfile {
  const current = profile.outfits.find(row => row.id === profile.activeOutfitId) ?? profile.outfits[0]!
  const outfit = { ...current, id: token('outfit'), name: name.slice(0, 24) || '新穿搭' }
  return { ...profile, activeOutfitId: outfit.id, outfits: [...profile.outfits, outfit], updatedAt: new Date().toISOString() }
}

export function deleteActiveWardrobeOutfit(profile: AvatarAppearanceProfile): AvatarAppearanceProfile {
  if (profile.outfits.length <= 1) return profile
  const outfits = profile.outfits.filter(row => row.id !== profile.activeOutfitId)
  return { ...profile, outfits, activeOutfitId: outfits[0].id, updatedAt: new Date().toISOString() }
}

export function colorValue(id: string, palette: readonly { id: string; color: string }[] = OUTFIT_COLORS): string {
  return palette.find(row => row.id === id)?.color ?? palette[0].color
}

export function resolveAvatarLook(profile?: AvatarAppearanceProfile): AvatarLook {
  const source = profile ?? createAvatarAppearanceProfile('preview', 'self', 'female')
  const outfit = source.outfits.find(row => row.id === source.activeOutfitId) ?? source.outfits[0]!
  return {
    genderStyle: source.genderStyle,
    skinTone: colorValue(source.skinTone, SKIN_TONES),
    hairStyle: source.hairStyle,
    hairColor: colorValue(source.hairColor, HAIR_COLORS),
    eyeStyle: source.eyeStyle,
    topStyle: outfit.topStyle,
    topColor: colorValue(outfit.topColor),
    bottomStyle: outfit.bottomStyle,
    bottomColor: colorValue(outfit.bottomColor),
    shoesStyle: outfit.shoesStyle,
    shoesColor: colorValue(outfit.shoesColor),
    accessory: outfit.accessory
  }
}
