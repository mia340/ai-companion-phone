import { db } from '../db/database'
import type { AppCustomization } from '../types/domain'

export type CompanionSpaceVisibility = 'public' | 'friends' | 'private'

export interface CompanionSpaceSettings {
  visibility: CompanionSpaceVisibility
  blacklistCharacterIds: string[]
}

const SPACE_SETTINGS_APP_KEY = '__companion-space__'

export const DEFAULT_COMPANION_SPACE_SETTINGS: CompanionSpaceSettings = {
  visibility: 'public',
  blacklistCharacterIds: []
}

function settingsId(worldId: string) {
  return `${worldId}:${SPACE_SETTINGS_APP_KEY}`
}

export function normalizeCompanionSpaceSettings(
  input?: Pick<AppCustomization, 'spaceVisibility' | 'spaceBlacklistCharacterIds'> | null
): CompanionSpaceSettings {
  const visibility: CompanionSpaceVisibility =
    input?.spaceVisibility === 'friends' || input?.spaceVisibility === 'private'
      ? input.spaceVisibility
      : 'public'

  const blacklistCharacterIds = Array.from(new Set(
    (input?.spaceBlacklistCharacterIds ?? [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  ))

  return { visibility, blacklistCharacterIds }
}

export async function loadCompanionSpaceSettings(worldId: string): Promise<CompanionSpaceSettings> {
  const row = await db.appCustomizations.get(settingsId(worldId))
  return normalizeCompanionSpaceSettings(row)
}

export async function saveCompanionSpaceSettings(
  worldId: string,
  value: CompanionSpaceSettings
): Promise<CompanionSpaceSettings> {
  const normalized = normalizeCompanionSpaceSettings({
    spaceVisibility: value.visibility,
    spaceBlacklistCharacterIds: value.blacklistCharacterIds
  })
  const row: AppCustomization = {
    id: settingsId(worldId),
    worldId,
    appKey: SPACE_SETTINGS_APP_KEY,
    spaceVisibility: normalized.visibility,
    spaceBlacklistCharacterIds: normalized.blacklistCharacterIds,
    updatedAt: new Date().toISOString()
  }
  await db.appCustomizations.put(row)
  return normalized
}

export async function setCompanionSpaceVisibility(
  worldId: string,
  visibility: CompanionSpaceVisibility
): Promise<CompanionSpaceSettings> {
  const current = await loadCompanionSpaceSettings(worldId)
  return saveCompanionSpaceSettings(worldId, { ...current, visibility })
}

export async function setCharacterSpaceBlacklisted(
  worldId: string,
  characterId: string,
  blacklisted: boolean
): Promise<CompanionSpaceSettings> {
  const current = await loadCompanionSpaceSettings(worldId)
  const ids = new Set(current.blacklistCharacterIds)
  if (blacklisted) ids.add(characterId)
  else ids.delete(characterId)
  return saveCompanionSpaceSettings(worldId, {
    ...current,
    blacklistCharacterIds: [...ids]
  })
}

export function isCharacterSpaceBlacklisted(
  settings: CompanionSpaceSettings,
  characterId: string
): boolean {
  return settings.blacklistCharacterIds.includes(characterId)
}
