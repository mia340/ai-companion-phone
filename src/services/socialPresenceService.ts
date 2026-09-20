import { db } from '../db/database'
import { loadCompanionSpaceSettings } from './companionSpaceSettings'

import type {
  Character,
  CharacterSocialProfile,
  MomentPost,
  SocialActivity,
  SocialInteractionLevel
} from '../types/domain'

export interface SocialCandidateSignal {
  character: Character
  profile: CharacterSocialProfile
  relationshipScore: number
  relevanceScore: number
  cooldownFactor: number
  score: number
}

export type SocialCapability = 'view' | 'like' | 'comment' | 'reply' | 'post'

const LEVEL_MULTIPLIER: Record<SocialInteractionLevel, number> = {
  quiet: 0.7,
  normal: 1,
  active: 1.28
}

const LEVEL_COOLDOWN_MS: Record<SocialInteractionLevel, number> = {
  quiet: 90 * 60_000,
  normal: 35 * 60_000,
  active: 12 * 60_000
}

export const SOCIAL_LEVEL_LABELS: Record<SocialInteractionLevel, { label: string; desc: string }> = {
  quiet: { label: '安静', desc: '很少主动出现，更多时候只是看看' },
  normal: { label: '自然', desc: '按关系、内容和最近互动自然参与' },
  active: { label: '活跃', desc: '更愿意点赞、评论和接话' }
}

export function defaultCharacterSocialProfile(character: Pick<Character, 'id' | 'worldId'>): CharacterSocialProfile {
  const now = new Date().toISOString()
  return {
    id: character.id,
    worldId: character.worldId,
    characterId: character.id,
    canViewMoments: true,
    canLikeMoments: true,
    canCommentMoments: true,
    canReplyToComments: true,
    canPostMoments: true,
    interactionLevel: 'normal',
    createdAt: now,
    updatedAt: now
  }
}

export async function getCharacterSocialProfile(character: Pick<Character, 'id' | 'worldId'>): Promise<CharacterSocialProfile> {
  const existing = await db.socialProfiles.get(character.id)
  return existing ?? defaultCharacterSocialProfile(character)
}

export async function listCharacterSocialProfiles(
  characters: Array<Pick<Character, 'id' | 'worldId'>>
): Promise<CharacterSocialProfile[]> {
  const ids = characters.map(character => character.id)
  const rows = ids.length ? await db.socialProfiles.bulkGet(ids) : []
  return characters.map((character, index) => rows[index] ?? defaultCharacterSocialProfile(character))
}

export async function saveCharacterSocialProfile(
  character: Pick<Character, 'id' | 'worldId'>,
  patch: Partial<Omit<CharacterSocialProfile, 'id' | 'worldId' | 'characterId' | 'createdAt' | 'updatedAt'>>
): Promise<CharacterSocialProfile> {
  const current = await getCharacterSocialProfile(character)
  const now = new Date().toISOString()
  const next: CharacterSocialProfile = {
    ...current,
    ...patch,
    id: character.id,
    worldId: character.worldId,
    characterId: character.id,
    createdAt: current.createdAt || now,
    updatedAt: now
  }
  await db.socialProfiles.put(next)
  return next
}

export function profileAllows(profile: CharacterSocialProfile, capability: SocialCapability): boolean {
  if (capability === 'view') return profile.canViewMoments
  if (capability === 'post') return profile.canPostMoments
  if (!profile.canViewMoments) return false
  if (capability === 'like') return profile.canLikeMoments
  if (capability === 'comment') return profile.canCommentMoments
  return profile.canReplyToComments
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function compactText(value: string): string {
  return value
    .toLocaleLowerCase('zh-CN')
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：“”‘’（）【】《》,.!?;:'"`()\[\]{}<>\-_/\\]/g, '')
}

/**
 * 轻量内容相关性：不做隐式“关系积分”，只根据明确资料/记忆与本条文本的词片重合判断。
 */
export function textRelevanceScore(postText: string, signalTexts: string[]): number {
  const post = compactText(postText)
  if (!post) return 0

  const postPairs = new Set<string>()
  for (let i = 0; i < post.length - 1; i += 1) postPairs.add(post.slice(i, i + 2))
  if (!postPairs.size) return 0

  let hits = 0
  let checks = 0
  for (const text of signalTexts) {
    const normalized = compactText(text)
    if (!normalized) continue
    for (let i = 0; i < normalized.length - 1 && checks < 180; i += 1) {
      const pair = normalized.slice(i, i + 2)
      checks += 1
      if (postPairs.has(pair)) hits += 1
    }
    if (checks >= 180) break
  }
  return clamp01(hits / Math.max(4, Math.min(24, checks * 0.18)))
}

export function relationshipFreshnessScore(updatedAt: string | undefined, memoryCount: number, now = Date.now()): number {
  let recency = 0.1
  if (updatedAt) {
    const updated = Date.parse(updatedAt)
    if (Number.isFinite(updated)) {
      const age = Math.max(0, now - updated)
      if (age <= 3 * 24 * 60 * 60_000) recency = 1
      else if (age <= 14 * 24 * 60 * 60_000) recency = 0.76
      else if (age <= 60 * 24 * 60 * 60_000) recency = 0.48
      else recency = 0.22
    }
  }
  const memory = Math.min(1, Math.max(0, memoryCount) / 6)
  return clamp01(recency * 0.72 + memory * 0.28)
}

export function cooldownFactor(
  level: SocialInteractionLevel,
  lastActivityAt: string | undefined,
  now = Date.now()
): number {
  if (!lastActivityAt) return 1
  const last = Date.parse(lastActivityAt)
  if (!Number.isFinite(last)) return 1
  const age = Math.max(0, now - last)
  const windowMs = LEVEL_COOLDOWN_MS[level]
  if (age >= windowMs) return 1
  const progress = age / windowMs
  return 0.12 + progress * 0.78
}

export function scoreSocialCandidate(input: {
  profile: CharacterSocialProfile
  relationshipScore: number
  relevanceScore: number
  cooldownFactor: number
  rand?: () => number
}): number {
  const rand = input.rand ?? Math.random
  const relationship = clamp01(input.relationshipScore)
  const relevance = clamp01(input.relevanceScore)
  const cooldown = clamp01(input.cooldownFactor)
  const level = LEVEL_MULTIPLIER[input.profile.interactionLevel]
  const jitter = 0.9 + rand() * 0.2
  return Math.max(0.01, (0.42 + relationship * 0.38 + relevance * 0.52) * level * cooldown * jitter)
}

export function pickWeightedSocialCandidates<T extends { score: number }>(
  candidates: T[],
  count: number,
  rand: () => number = Math.random
): T[] {
  const pool = [...candidates]
  const selected: T[] = []
  const take = Math.max(0, Math.min(count, pool.length))

  while (selected.length < take && pool.length) {
    const total = pool.reduce((sum, item) => sum + Math.max(0.001, item.score), 0)
    let cursor = rand() * total
    let index = pool.length - 1
    for (let i = 0; i < pool.length; i += 1) {
      cursor -= Math.max(0.001, pool[i].score)
      if (cursor <= 0) {
        index = i
        break
      }
    }
    selected.push(pool[index])
    pool.splice(index, 1)
  }
  return selected
}

function latestConversationByCharacter(
  conversations: Array<{ memberIds: string[]; type: 'single' | 'group'; updatedAt: string }>,
  characterId: string
): string | undefined {
  return conversations
    .filter(row => row.memberIds.includes(characterId))
    .map(row => row.updatedAt)
    .sort((a, b) => b.localeCompare(a))[0]
}

function latestActivityByCharacter(activities: SocialActivity[], characterId: string): string | undefined {
  return activities
    .filter(row => row.actorCharacterId === characterId && row.status === 'done')
    .map(row => row.updatedAt)
    .sort((a, b) => b.localeCompare(a))[0]
}

export async function buildSocialCandidateSignals(input: {
  post: Pick<MomentPost, 'worldId' | 'content'>
  characters: Character[]
  capability: SocialCapability
  now?: number
}): Promise<SocialCandidateSignal[]> {
  const now = input.now ?? Date.now()
  const [profiles, conversations, memories, activities, spaceSettings] = await Promise.all([
    listCharacterSocialProfiles(input.characters),
    db.conversations.where('worldId').equals(input.post.worldId).toArray(),
    db.memories.toArray(),
    db.socialActivities.where('worldId').equals(input.post.worldId).toArray(),
    loadCompanionSpaceSettings(input.post.worldId)
  ])
  const blacklisted = new Set(spaceSettings.blacklistCharacterIds)

  const profileById = new Map(profiles.map(profile => [profile.characterId, profile]))
  const memoriesByCharacter = new Map<string, string[]>()
  for (const memory of memories) {
    const rows = memoriesByCharacter.get(memory.characterId) ?? []
    if (rows.length < 12) rows.push(memory.content)
    memoriesByCharacter.set(memory.characterId, rows)
  }

  const signals: SocialCandidateSignal[] = []
  for (const character of input.characters) {
    if (blacklisted.has(character.id)) continue
    const profile = profileById.get(character.id) ?? defaultCharacterSocialProfile(character)
    if (!profileAllows(profile, input.capability)) continue

    const characterMemories = memoriesByCharacter.get(character.id) ?? []
    const relationshipScore = relationshipFreshnessScore(
      latestConversationByCharacter(conversations, character.id),
      characterMemories.length,
      now
    )
    const relevanceScore = textRelevanceScore(input.post.content || '', [
      character.name,
      character.nickname || '',
      character.identity || '',
      character.relationship || '',
      character.likes?.join(' ') || '',
      character.tags?.join(' ') || '',
      ...characterMemories
    ])
    const cool = cooldownFactor(
      profile.interactionLevel,
      latestActivityByCharacter(activities, character.id),
      now
    )
    signals.push({
      character,
      profile,
      relationshipScore,
      relevanceScore,
      cooldownFactor: cool,
      score: scoreSocialCandidate({ profile, relationshipScore, relevanceScore, cooldownFactor: cool })
    })
  }

  return signals
}
