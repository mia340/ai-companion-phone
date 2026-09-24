import { z } from 'zod'
import { db } from '../db/database'
import type { AppCustomization, Character } from '../types/domain'

export type AvatarGenderStyle = 'female' | 'male'
export type AvatarOutfitCategory = 'daily' | 'home' | 'date' | 'sleepwear' | 'formal' | 'private'
export type AvatarAnimation = 'idle' | 'walk' | 'rollDice' | 'closeDistance' | 'holdHands' | 'hug' | 'kiss'
export type AvatarDailyMode = 'auto' | 'ask' | 'manual'

export interface AvatarOutfitHistoryEntry {
  date: string
  outfitId: string
}

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
  /** V1 legacy single-slot accessory. Retained so old saved wardrobes keep rendering. */
  accessory: string
  /** V1.2 layered accessory slots. */
  headwear?: string
  facewear?: string
  neckwear?: string
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
  dailyMode?: AvatarDailyMode
  dailyOutfitDate?: string
  dailyOutfitId?: string
  outfitHistory?: AvatarOutfitHistoryEntry[]
  customColors?: string[]
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
  headwear: string
  facewear: string
  neckwear: string
}

export const WARDROBE_APP_KEY = '__wardrobe__'
export const SELF_AVATAR_TARGET_ID = 'self'

export const SKIN_TONES = [
  { id: 'porcelain', label: '白皙', color: '#f1c7af' },
  { id: 'warm', label: '暖肤', color: '#dfad88' },
  { id: 'honey', label: '蜜糖', color: '#c8845f' },
  { id: 'deep', label: '深肤', color: '#8a5843' }
] as const

export const HAIR_COLORS = [
  { id: 'ink', label: '墨黑', color: '#2b2830' },
  { id: 'espresso', label: '深咖', color: '#49342f' },
  { id: 'coffee', label: '咖棕', color: '#65443a' },
  { id: 'chestnut', label: '栗棕', color: '#8f5544' },
  { id: 'ash', label: '雾灰', color: '#716c78' },
  { id: 'blonde', label: '麦金', color: '#d2aa68' },
  { id: 'rose', label: '莓粉', color: '#aa5876' },
  { id: 'plum', label: '梅紫', color: '#68405f' }
] as const

export const OUTFIT_COLORS = [
  { id: 'cream', label: '奶油', color: '#f4e8dc' },
  { id: 'ivory', label: '象牙白', color: '#fff6e8' },
  { id: 'blush', label: '裸粉', color: '#e7b6b7' },
  { id: 'rose', label: '玫瑰', color: '#b95c7b' },
  { id: 'wine', label: '酒红', color: '#78354f' },
  { id: 'brick', label: '陶红', color: '#a85645' },
  { id: 'caramel', label: '焦糖', color: '#b87a49' },
  { id: 'mustard', label: '芥黄', color: '#c6a04b' },
  { id: 'navy', label: '深蓝', color: '#354d68' },
  { id: 'denim', label: '牛仔蓝', color: '#57799b' },
  { id: 'sky', label: '雾蓝', color: '#91afc4' },
  { id: 'sage', label: '鼠尾草', color: '#7f9980' },
  { id: 'forest', label: '森林绿', color: '#496b58' },
  { id: 'black', label: '墨黑', color: '#353239' },
  { id: 'graphite', label: '石墨灰', color: '#5b5960' },
  { id: 'lavender', label: '薰衣草', color: '#9b8db4' }
] as const

export const HAIR_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'long', label: '长直发' }, { id: 'waves', label: '柔卷长发' }, { id: 'bob', label: '短波波' },
    { id: 'ponytail', label: '低马尾' }, { id: 'twin', label: '双马尾' }, { id: 'braid', label: '侧编发' },
    { id: 'short', label: '清爽短发' }
  ],
  male: [
    { id: 'crop', label: '短碎' }, { id: 'side', label: '侧分' }, { id: 'soft', label: '柔顺短发' },
    { id: 'messy', label: '微乱层次' }, { id: 'buzz', label: '利落寸头' }, { id: 'long', label: '中长发' }
  ]
}

export const TOP_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'tee', label: '短袖 T 恤' }, { id: 'blouse', label: '圆领衬衫' }, { id: 'sweater', label: '针织毛衣' },
    { id: 'cardigan', label: '小开衫' }, { id: 'hoodie', label: '连帽卫衣' }, { id: 'sailor', label: '学院海军领' },
    { id: 'cami', label: '细肩吊带' }, { id: 'turtleneck', label: '高领针织' }, { id: 'dress', label: '连衣裙' },
    { id: 'party', label: '约会礼服' }
  ],
  male: [
    { id: 'tee', label: '短袖 T 恤' }, { id: 'shirt', label: '衬衫' }, { id: 'sweater', label: '针织毛衣' },
    { id: 'hoodie', label: '连帽卫衣' }, { id: 'jacket', label: '休闲夹克' }, { id: 'varsity', label: '学院棒球服' },
    { id: 'polo', label: 'Polo 衫' }, { id: 'turtleneck', label: '高领针织' }, { id: 'vest', label: '针织背心' },
    { id: 'formal', label: '轻正式西装' }
  ]
}

export const BOTTOM_STYLES: Record<AvatarGenderStyle, Array<{ id: string; label: string }>> = {
  female: [
    { id: 'skirt', label: 'A 字短裙' }, { id: 'pleated', label: '百褶裙' }, { id: 'midi', label: '中长裙' },
    { id: 'jeans', label: '牛仔裤' }, { id: 'pants', label: '直筒长裤' }, { id: 'shorts', label: '短裤' },
    { id: 'wide', label: '阔腿裤' }
  ],
  male: [
    { id: 'pants', label: '直筒长裤' }, { id: 'jeans', label: '牛仔裤' }, { id: 'cargo', label: '工装裤' },
    { id: 'shorts', label: '休闲短裤' }, { id: 'wide', label: '宽松长裤' }, { id: 'formal', label: '西装裤' }
  ]
}

export const SHOES_STYLES = [
  { id: 'sneakers', label: '运动鞋' }, { id: 'loafers', label: '乐福鞋' }, { id: 'boots', label: '短靴' },
  { id: 'maryjane', label: '玛丽珍' }, { id: 'slippers', label: '居家拖鞋' }
] as const

export const HEADWEAR = [
  { id: 'none', label: '无' }, { id: 'ribbon', label: '蝴蝶结' }, { id: 'headband', label: '发带' },
  { id: 'flower', label: '小花' }, { id: 'beret', label: '贝雷帽' }, { id: 'cap', label: '棒球帽' },
  { id: 'strawhat', label: '草帽' }, { id: 'witch', label: '小巫师帽' }
] as const

export const FACEWEAR = [
  { id: 'none', label: '无' }, { id: 'glasses', label: '圆框眼镜' }, { id: 'square-glasses', label: '方框眼镜' },
  { id: 'hairpin', label: '侧边发夹' }
] as const

export const NECKWEAR = [
  { id: 'none', label: '无' }, { id: 'necklace', label: '小项链' }, { id: 'choker', label: '细颈链' },
  { id: 'scarf', label: '围巾' }, { id: 'bowtie', label: '领结' }
] as const

/** Legacy single-slot list kept for old imports and tests. */
export const ACCESSORIES = [
  { id: 'none', label: '无' }, { id: 'glasses', label: '眼镜' }, { id: 'earrings', label: '耳饰' },
  { id: 'necklace', label: '项链' }, { id: 'cap', label: '帽子' }, { id: 'ribbon', label: '发带' }
] as const

const outfitSchema = z.object({
  id: z.string().min(1), name: z.string().min(1).max(24),
  category: z.enum(['daily', 'home', 'date', 'sleepwear', 'formal', 'private']),
  topStyle: z.string().min(1), topColor: z.string().min(1),
  bottomStyle: z.string().min(1), bottomColor: z.string().min(1),
  shoesStyle: z.string().min(1), shoesColor: z.string().min(1), accessory: z.string().min(1),
  headwear: z.string().optional(), facewear: z.string().optional(), neckwear: z.string().optional()
})

const historySchema = z.object({ date: z.string().min(1), outfitId: z.string().min(1) })

const profileSchema = z.object({
  targetId: z.string().min(1), targetType: z.enum(['self', 'character']),
  genderStyle: z.enum(['female', 'male']), skinTone: z.string().min(1), hairStyle: z.string().min(1),
  hairColor: z.string().min(1), eyeStyle: z.string().min(1), activeOutfitId: z.string().min(1),
  outfits: z.array(outfitSchema).min(1).max(30),
  dailyMode: z.enum(['auto', 'ask', 'manual']).optional(), dailyOutfitDate: z.string().optional(), dailyOutfitId: z.string().optional(),
  outfitHistory: z.array(historySchema).max(30).optional(), customColors: z.array(z.string()).max(18).optional(),
  updatedAt: z.string().min(1)
})

const wardrobeSchema = z.object({ version: z.literal(1), profiles: z.record(profileSchema) })

function stateId(worldId: string) { return `${worldId}:${WARDROBE_APP_KEY}` }
function token(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }

function presetOutfits(genderStyle: AvatarGenderStyle, targetId: string): AvatarOutfit[] {
  const female: AvatarOutfit[] = [
    { id: `default-${targetId}`, name: '奶油日常', category: 'daily', topStyle: 'cardigan', topColor: 'cream', bottomStyle: 'pleated', bottomColor: 'navy', shoesStyle: 'maryjane', shoesColor: 'black', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'necklace' },
    { id: `preset-date-${targetId}`, name: '玫瑰约会', category: 'date', topStyle: 'party', topColor: 'rose', bottomStyle: 'midi', bottomColor: 'wine', shoesStyle: 'maryjane', shoesColor: 'cream', accessory: 'none', headwear: 'ribbon', facewear: 'none', neckwear: 'none' },
    { id: `preset-home-${targetId}`, name: '居家软绵', category: 'home', topStyle: 'sweater', topColor: 'ivory', bottomStyle: 'wide', bottomColor: 'sage', shoesStyle: 'slippers', shoesColor: 'cream', accessory: 'none', headwear: 'headband', facewear: 'none', neckwear: 'none' },
    { id: `preset-black-${targetId}`, name: '黑色系', category: 'date', topStyle: 'turtleneck', topColor: 'black', bottomStyle: 'midi', bottomColor: 'graphite', shoesStyle: 'boots', shoesColor: 'black', accessory: 'none', headwear: 'beret', facewear: 'none', neckwear: 'choker' },
    { id: `preset-sleep-${targetId}`, name: '晚安睡衣', category: 'sleepwear', topStyle: 'tee', topColor: 'lavender', bottomStyle: 'shorts', bottomColor: 'cream', shoesStyle: 'slippers', shoesColor: 'cream', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'none' },
    { id: `preset-formal-${targetId}`, name: '轻正式', category: 'formal', topStyle: 'blouse', topColor: 'ivory', bottomStyle: 'midi', bottomColor: 'navy', shoesStyle: 'loafers', shoesColor: 'black', accessory: 'none', headwear: 'flower', facewear: 'none', neckwear: 'necklace' }
  ]
  const male: AvatarOutfit[] = [
    { id: `default-${targetId}`, name: '清爽日常', category: 'daily', topStyle: 'shirt', topColor: 'ivory', bottomStyle: 'pants', bottomColor: 'navy', shoesStyle: 'sneakers', shoesColor: 'cream', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'none' },
    { id: `preset-date-${targetId}`, name: '深色约会', category: 'date', topStyle: 'turtleneck', topColor: 'black', bottomStyle: 'formal', bottomColor: 'graphite', shoesStyle: 'loafers', shoesColor: 'black', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'necklace' },
    { id: `preset-home-${targetId}`, name: '居家宽松', category: 'home', topStyle: 'hoodie', topColor: 'sage', bottomStyle: 'wide', bottomColor: 'cream', shoesStyle: 'slippers', shoesColor: 'cream', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'none' },
    { id: `preset-campus-${targetId}`, name: '学院感', category: 'daily', topStyle: 'varsity', topColor: 'navy', bottomStyle: 'jeans', bottomColor: 'denim', shoesStyle: 'sneakers', shoesColor: 'ivory', accessory: 'none', headwear: 'cap', facewear: 'none', neckwear: 'none' },
    { id: `preset-sleep-${targetId}`, name: '晚安睡衣', category: 'sleepwear', topStyle: 'tee', topColor: 'sky', bottomStyle: 'shorts', bottomColor: 'graphite', shoesStyle: 'slippers', shoesColor: 'cream', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'none' },
    { id: `preset-formal-${targetId}`, name: '轻正式', category: 'formal', topStyle: 'formal', topColor: 'graphite', bottomStyle: 'formal', bottomColor: 'black', shoesStyle: 'loafers', shoesColor: 'black', accessory: 'none', headwear: 'none', facewear: 'none', neckwear: 'bowtie' }
  ]
  return genderStyle === 'female' ? female : male
}

export function defaultGenderStyle(gender?: Character['gender']): AvatarGenderStyle {
  return gender === 'male' ? 'male' : 'female'
}

export function createAvatarAppearanceProfile(
  targetId: string,
  targetType: 'self' | 'character',
  genderStyle: AvatarGenderStyle = 'female'
): AvatarAppearanceProfile {
  const outfits = presetOutfits(genderStyle, targetId)
  return {
    targetId, targetType, genderStyle,
    skinTone: 'warm', hairStyle: genderStyle === 'female' ? 'waves' : 'crop', hairColor: 'ink', eyeStyle: 'soft',
    activeOutfitId: outfits[0].id, outfits,
    dailyMode: targetType === 'character' ? 'auto' : 'manual', outfitHistory: [], customColors: [],
    updatedAt: new Date().toISOString()
  }
}

function upgradeOutfit(outfit: AvatarOutfit): AvatarOutfit {
  const legacy = outfit.accessory || 'none'
  return {
    ...outfit,
    headwear: outfit.headwear ?? (legacy === 'cap' || legacy === 'ribbon' ? legacy : 'none'),
    facewear: outfit.facewear ?? (legacy === 'glasses' ? 'glasses' : 'none'),
    neckwear: outfit.neckwear ?? (legacy === 'necklace' ? 'necklace' : 'none')
  }
}

function upgradeProfile(profile: AvatarAppearanceProfile): AvatarAppearanceProfile {
  const starter = presetOutfits(profile.genderStyle, profile.targetId)
  const existing = profile.outfits.map(upgradeOutfit)
  const existingIds = new Set(existing.map(row => row.id))
  const merged = [...existing]
  for (const outfit of starter) if (!existingIds.has(outfit.id)) merged.push(outfit)
  return {
    ...profile,
    outfits: merged.slice(0, 30),
    dailyMode: profile.dailyMode ?? (profile.targetType === 'character' ? 'auto' : 'manual'),
    outfitHistory: profile.outfitHistory ?? [], customColors: profile.customColors ?? [],
    updatedAt: profile.updatedAt || new Date().toISOString()
  }
}

export function normalizeWardrobeState(value: unknown): WardrobeState {
  const parsed = wardrobeSchema.safeParse(value)
  if (!parsed.success) return { version: 1, profiles: {} }
  return {
    version: 1,
    profiles: Object.fromEntries(Object.entries(parsed.data.profiles).map(([id, profile]) => [id, upgradeProfile(profile)]))
  }
}

function localDateKey(now = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function loadWardrobeState(worldId: string): Promise<WardrobeState> {
  const row = await db.appCustomizations.get(stateId(worldId))
  const normalized = normalizeWardrobeState(row?.wardrobeState)
  const dateKey = localDateKey()
  let changed = false
  const profiles = Object.fromEntries(Object.entries(normalized.profiles).map(([id, profile]) => {
    const resolved = chooseDailyOutfit(profile, dateKey)
    if (resolved.activeOutfitId !== profile.activeOutfitId || resolved.dailyOutfitDate !== profile.dailyOutfitDate) changed = true
    return [id, resolved]
  }))
  const next: WardrobeState = { version: 1, profiles }
  if (changed && row) {
    await db.appCustomizations.put({ ...row, wardrobeState: next, updatedAt: new Date().toISOString() })
  }
  return next
}

export async function saveWardrobeState(worldId: string, state: WardrobeState): Promise<WardrobeState> {
  const normalized = normalizeWardrobeState(state)
  const existing = await db.appCustomizations.get(stateId(worldId))
  const row: AppCustomization = {
    ...(existing ?? {}), id: stateId(worldId), worldId, appKey: WARDROBE_APP_KEY,
    wardrobeState: normalized, updatedAt: new Date().toISOString()
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
  return state.profiles[targetId] ? upgradeProfile(state.profiles[targetId]) : createAvatarAppearanceProfile(targetId, targetType, genderStyle)
}

export function upsertWardrobeProfile(state: WardrobeState, profile: AvatarAppearanceProfile): WardrobeState {
  const checked = profileSchema.parse({ ...upgradeProfile(profile), updatedAt: new Date().toISOString() })
  return { version: 1, profiles: { ...state.profiles, [checked.targetId]: checked } }
}

export function setAvatarGenderStyle(profile: AvatarAppearanceProfile, genderStyle: AvatarGenderStyle): AvatarAppearanceProfile {
  if (profile.genderStyle === genderStyle) return profile
  const starter = presetOutfits(genderStyle, profile.targetId)
  const current = profile.outfits.find(row => row.id === profile.activeOutfitId) ?? profile.outfits[0]!
  const active: AvatarOutfit = {
    ...current,
    topStyle: TOP_STYLES[genderStyle].some(row => row.id === current.topStyle) ? current.topStyle : starter[0].topStyle,
    bottomStyle: BOTTOM_STYLES[genderStyle].some(row => row.id === current.bottomStyle) ? current.bottomStyle : starter[0].bottomStyle
  }
  const keep = profile.outfits.map(row => row.id === active.id ? active : row)
  const existing = new Set(keep.map(row => row.id))
  for (const outfit of starter) if (!existing.has(outfit.id)) keep.push(outfit)
  return {
    ...profile, genderStyle,
    hairStyle: HAIR_STYLES[genderStyle].some(row => row.id === profile.hairStyle) ? profile.hairStyle : HAIR_STYLES[genderStyle][0].id,
    outfits: keep.slice(0, 30), updatedAt: new Date().toISOString()
  }
}

export function updateActiveOutfit(profile: AvatarAppearanceProfile, patch: Partial<AvatarOutfit>): AvatarAppearanceProfile {
  const outfits = profile.outfits.map(row => row.id === profile.activeOutfitId ? upgradeOutfit({ ...row, ...patch, id: row.id }) : row)
  return { ...profile, outfits, updatedAt: new Date().toISOString() }
}

export function addWardrobeOutfit(profile: AvatarAppearanceProfile, name = '新穿搭'): AvatarAppearanceProfile {
  const current = upgradeOutfit(profile.outfits.find(row => row.id === profile.activeOutfitId) ?? profile.outfits[0]!)
  const outfit = { ...current, id: token('outfit'), name: name.slice(0, 24) || '新穿搭' }
  return { ...profile, activeOutfitId: outfit.id, outfits: [...profile.outfits, outfit].slice(0, 30), updatedAt: new Date().toISOString() }
}

export function deleteActiveWardrobeOutfit(profile: AvatarAppearanceProfile): AvatarAppearanceProfile {
  if (profile.outfits.length <= 1) return profile
  const outfits = profile.outfits.filter(row => row.id !== profile.activeOutfitId)
  return { ...profile, outfits, activeOutfitId: outfits[0].id, updatedAt: new Date().toISOString() }
}

export function rememberCustomColor(profile: AvatarAppearanceProfile, color: string): AvatarAppearanceProfile {
  const normalized = normalizeCustomColor(color)
  if (!normalized) return profile
  const colors = [normalized, ...(profile.customColors ?? []).filter(row => row.toLowerCase() !== normalized.toLowerCase())].slice(0, 12)
  return { ...profile, customColors: colors, updatedAt: new Date().toISOString() }
}

export function normalizeCustomColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const raw = trimmed.slice(1)
    return `#${raw.split('').map(char => char + char).join('')}`.toUpperCase()
  }
  return null
}

export function colorValue(id: string, palette: readonly { id: string; color: string }[] = OUTFIT_COLORS): string {
  const custom = normalizeCustomColor(id)
  if (custom) return custom
  return palette.find(row => row.id === id)?.color ?? palette[0].color
}

function stableHash(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

export function chooseDailyOutfit(profile: AvatarAppearanceProfile, dateKey: string): AvatarAppearanceProfile {
  const upgraded = upgradeProfile(profile)
  if ((upgraded.dailyMode ?? 'manual') !== 'auto') return upgraded
  if (upgraded.dailyOutfitDate === dateKey && upgraded.dailyOutfitId && upgraded.outfits.some(row => row.id === upgraded.dailyOutfitId)) {
    return { ...upgraded, activeOutfitId: upgraded.dailyOutfitId }
  }
  const recent = new Set((upgraded.outfitHistory ?? []).slice(-2).map(row => row.outfitId))
  const candidates = upgraded.outfits.filter(row => !recent.has(row.id))
  const pool = candidates.length ? candidates : upgraded.outfits
  const chosen = pool[stableHash(`${upgraded.targetId}:${dateKey}`) % pool.length]!
  const history = [...(upgraded.outfitHistory ?? []).filter(row => row.date !== dateKey), { date: dateKey, outfitId: chosen.id }].slice(-30)
  return {
    ...upgraded,
    activeOutfitId: chosen.id,
    dailyOutfitDate: dateKey,
    dailyOutfitId: chosen.id,
    outfitHistory: history,
    updatedAt: new Date().toISOString()
  }
}

export function setDailyMode(profile: AvatarAppearanceProfile, mode: AvatarDailyMode): AvatarAppearanceProfile {
  return { ...profile, dailyMode: mode, updatedAt: new Date().toISOString() }
}

export function resolveAvatarLook(profile?: AvatarAppearanceProfile): AvatarLook {
  const source = upgradeProfile(profile ?? createAvatarAppearanceProfile('preview', 'self', 'female'))
  const outfit = upgradeOutfit(source.outfits.find(row => row.id === source.activeOutfitId) ?? source.outfits[0]!)
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
    accessory: outfit.accessory,
    headwear: outfit.headwear ?? 'none',
    facewear: outfit.facewear ?? 'none',
    neckwear: outfit.neckwear ?? 'none'
  }
}
