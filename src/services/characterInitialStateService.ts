import type { Character } from '../types/domain'

export const LEGACY_NEW_CHARACTER_ACTIVITY = '刚刚来到这个世界'
export const LEGACY_NEW_CHARACTER_MOOD = '期待认识你'

function normalizeOpeningText(value: string) {
  return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/&nbsp;/gi, ' ').trim()
}

export function inferCardInitialActivity(opening?: string) {
  if (!opening?.trim()) return ''
  const source = normalizeOpeningText(opening)
  const xmlActivity = source.match(/<(?:活动|状态|当前活动)>\s*([\s\S]{1,60}?)\s*<\/(?:活动|状态|当前活动)>/i)?.[1]?.trim()
  const plain = source
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n{2,}/g, '\n')
  const explicit = xmlActivity
    || plain.match(/(?:^|\n)\s*(?:💛|活动|状态|当前活动)\s*[:：]?\s*([^\n]{1,60})/i)?.[1]?.trim()
  return explicit?.replace(/[。.!！]+$/, '').slice(0, 60) || ''
}

export function inferCardInitialRelationship(opening?: string) {
  if (!opening?.trim()) return ''
  const normalized = normalizeOpeningText(opening)
  return normalized.match(/(?:^|\n)\s*[▪•·-]?\s*关系\s*[:：]\s*([^\n<]{1,24})/i)?.[1]?.trim() || ''
}

export function normalizeLegacyCharacterInitialState(character: Character): Partial<Character> {
  const patch: Partial<Character> = {}
  if (character.activity === LEGACY_NEW_CHARACTER_ACTIVITY) {
    patch.activity = inferCardInitialActivity(character.firstMessage) || ''
  }
  if (character.mood === LEGACY_NEW_CHARACTER_MOOD) patch.mood = '平静'

  const explicitRelationship = inferCardInitialRelationship(character.firstMessage)
  if (explicitRelationship && (!character.relationship || character.relationship === '朋友' || character.relationship === '未设定')) {
    patch.relationship = explicitRelationship
  }
  return patch
}
