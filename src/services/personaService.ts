import { db } from '../db/database'
import { getOrCreateUserProfile } from './userProfile'
import type { ChatSettings, UserPersona } from '../types/domain'

export async function ensureDefaultPersona(): Promise<UserPersona> {
  const existingDefault = await db.personas
    .filter((item: UserPersona) => item.isDefault)
    .first()

  if (existingDefault) return existingDefault

  const existing = await db.personas.orderBy('updatedAt').reverse().first()
  if (existing) {
    await db.personas.update(existing.id, { isDefault: true })
    return { ...existing, isDefault: true }
  }

  const profile = await getOrCreateUserProfile()
  const now = new Date().toISOString()
  const persona: UserPersona = {
    id: crypto.randomUUID(),
    name: profile.name || '我',
    avatar: profile.avatar || '🧑',
    identity: profile.identity,
    personality: profile.bio,
    background: profile.bio,
    relationshipNote: '请让角色根据既有关系自然认识我，不要替我决定动作、想法或感受。',
    characterKnowledge: '',
    boundaries: '不要替用户说话，不要擅自决定用户的行为、心理和选择。',
    isDefault: true,
    createdAt: now,
    updatedAt: now
  }

  await db.personas.add(persona)
  return persona
}

export async function listPersonas(): Promise<UserPersona[]> {
  await ensureDefaultPersona()
  const rows = await db.personas.toArray()
  return rows.sort((a: UserPersona, b: UserPersona) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

export async function getPersonaForChat(
  settings: Pick<ChatSettings, 'personaId'>
): Promise<UserPersona> {
  if (settings.personaId) {
    const selected = await db.personas.get(settings.personaId)
    if (selected) return selected
  }

  return ensureDefaultPersona()
}

export async function savePersona(
  input: Partial<UserPersona> & Pick<UserPersona, 'name'>
): Promise<UserPersona> {
  const now = new Date().toISOString()
  const existing = input.id ? await db.personas.get(input.id) : undefined
  const persona: UserPersona = {
    id: input.id || crypto.randomUUID(),
    name: input.name.trim() || '未命名人设',
    avatar: input.avatar?.trim() || existing?.avatar || '🧑',
    identity: input.identity?.trim() || undefined,
    appearance: input.appearance?.trim() || undefined,
    personality: input.personality?.trim() || undefined,
    background: input.background?.trim() || undefined,
    relationshipNote: input.relationshipNote?.trim() || undefined,
    characterKnowledge: input.characterKnowledge?.trim() || undefined,
    boundaries: input.boundaries?.trim() || undefined,
    isDefault: input.isDefault ?? existing?.isDefault ?? false,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }

  await db.transaction('rw', db.personas, async () => {
    if (persona.isDefault) {
      const rows = await db.personas.toArray()
      for (const row of rows) {
        if (row.id !== persona.id && row.isDefault) {
          await db.personas.update(row.id, { isDefault: false })
        }
      }
    }
    await db.personas.put(persona)
  })

  if (!(await db.personas.filter((item: UserPersona) => item.isDefault).count())) {
    await db.personas.update(persona.id, { isDefault: true })
    persona.isDefault = true
  }

  return persona
}

export async function setDefaultPersona(id: string): Promise<void> {
  const rows = await db.personas.toArray()
  await db.transaction('rw', db.personas, async () => {
    for (const row of rows) {
      await db.personas.update(row.id, { isDefault: row.id === id })
    }
  })
}

export async function deletePersona(id: string): Promise<void> {
  const row = await db.personas.get(id)
  if (!row) return

  const count = await db.personas.count()
  if (count <= 1) {
    throw new Error('至少需要保留一套用户人设。')
  }

  await db.personas.delete(id)
  if (row.isDefault) {
    const next = await db.personas.toCollection().first()
    if (next) await setDefaultPersona(next.id)
  }

  const settingsRows = await db.chatSettings
    .filter((item: ChatSettings) => item.personaId === id)
    .toArray()
  for (const settings of settingsRows) {
    await db.chatSettings.update(settings.id, { personaId: undefined })
  }
}

export function buildPersonaPrompt(persona: UserPersona): string {
  return [
    `用户使用的人设名：${persona.name}`,
    persona.identity ? `用户身份：${persona.identity}` : '',
    persona.appearance ? `用户外貌：${persona.appearance}` : '',
    persona.personality ? `用户性格：${persona.personality}` : '',
    persona.background ? `用户背景：${persona.background}` : '',
    persona.relationshipNote ? `用户与角色关系补充：${persona.relationshipNote}` : '',
    persona.characterKnowledge ? `角色已知的用户信息：${persona.characterKnowledge}` : '',
    persona.boundaries ? `用户边界：${persona.boundaries}` : '',
    '不得替用户决定行为、台词、心理或感受；只描写角色自身。'
  ].filter(Boolean).join('\n')
}
