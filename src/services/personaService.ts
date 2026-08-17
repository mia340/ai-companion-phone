import { db } from '../db/database'
import { getOrCreateUserProfile } from './userProfile'
import type { ChatSettings, UserPersona } from '../types/domain'
import { toPlainStorageValue } from './storageSanitizer'

export async function ensureDefaultPersona(): Promise<UserPersona> {
  const existingDefault = await db.personas
    .filter((item: UserPersona) => item.isDefault && item.personaScope !== 'character')
    .first()

  if (existingDefault) return existingDefault

  const existing = await db.personas
    .filter((item: UserPersona) => item.personaScope !== 'character')
    .toArray()
  const latestGlobal = existing.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  if (latestGlobal) {
    await db.personas.update(latestGlobal.id, { isDefault: true })
    return { ...latestGlobal, isDefault: true }
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
    relationshipNote: undefined,
    characterKnowledge: '',
    boundaries: undefined,
    personaScope: 'global',
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
  const clean = (value?: string) => value?.trim() || undefined
  const persona: UserPersona = {
    id: input.id || crypto.randomUUID(),
    name: input.name.trim() || '未命名人设',
    avatar: input.avatar?.trim() || existing?.avatar || '🧑',
    title: clean(input.title),
    description: clean(input.description),
    identity: clean(input.identity),
    age: clean(input.age),
    gender: clean(input.gender),
    birthday: clean(input.birthday),
    height: clean(input.height),
    occupation: clean(input.occupation),
    appearance: clean(input.appearance),
    personality: clean(input.personality),
    publicPersona: clean(input.publicPersona),
    privatePersona: clean(input.privatePersona),
    strengths: clean(input.strengths),
    weaknesses: clean(input.weaknesses),
    interests: clean(input.interests),
    habits: clean(input.habits),
    lifestyle: clean(input.lifestyle),
    background: clean(input.background),
    relationshipNote: clean(input.relationshipNote),
    characterKnowledge: clean(input.characterKnowledge),
    boundaries: clean(input.boundaries),
    tags: input.tags?.map(item => item.trim()).filter(Boolean),
    creator: clean(input.creator),
    sourceUrl: clean(input.sourceUrl),
    sourceFileName: clean(input.sourceFileName),
    importFormat: input.importFormat || existing?.importFormat,
    extraFields: input.extraFields || existing?.extraFields,
    personaScope: input.personaScope || existing?.personaScope || 'global',
    boundCharacterId: clean(input.boundCharacterId) || existing?.boundCharacterId,
    boundCharacterName: clean(input.boundCharacterName) || existing?.boundCharacterName,
    sourceUserTemplate: clean(input.sourceUserTemplate) || existing?.sourceUserTemplate,
    isCardTemplate: input.isCardTemplate ?? existing?.isCardTemplate ?? false,
    isDefault: (input.personaScope || existing?.personaScope) === 'character'
      ? false
      : (input.isDefault ?? existing?.isDefault ?? false),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }

  // 导入预览可能保留 reactive/Proxy 的 extraFields 或 tags，统一去代理后再落库。
  const storablePersona = toPlainStorageValue(persona)

  await db.transaction('rw', db.personas, async () => {
    if (persona.isDefault) {
      const rows = await db.personas.toArray()
      for (const row of rows) {
        if (row.id !== persona.id && row.isDefault) {
          await db.personas.update(row.id, { isDefault: false })
        }
      }
    }
    await db.personas.put(storablePersona)
  })

  const globalDefaultCount = await db.personas
    .filter((item: UserPersona) => item.isDefault && item.personaScope !== 'character')
    .count()
  if (!globalDefaultCount && storablePersona.personaScope !== 'character') {
    await db.personas.update(storablePersona.id, { isDefault: true })
    storablePersona.isDefault = true
  }

  return storablePersona
}

export async function setDefaultPersona(id: string): Promise<void> {
  const target = await db.personas.get(id)
  if (!target || target.personaScope === 'character') {
    throw new Error('角色专属 Persona 不能设为全局默认。')
  }
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

export async function listPersonasForCharacter(characterId: string): Promise<UserPersona[]> {
  const rows = await listPersonas()
  return rows.filter(item => !item.boundCharacterId || item.boundCharacterId === characterId)
}

export async function bindPersonaToCharacterChats(characterId: string, personaId: string): Promise<number> {
  const conversations = await db.conversations
    .filter(item => item.type === 'single' && item.memberIds.includes(characterId))
    .toArray()

  for (const conversation of conversations) {
    const existing = await db.chatSettings.get(conversation.id)
    if (existing) {
      await db.chatSettings.update(existing.id, {
        personaId,
        updatedAt: new Date().toISOString()
      })
    }
  }

  return conversations.length
}

export function buildPersonaPrompt(persona: UserPersona): string {
  const cardTemplateRaw = persona.isCardTemplate
    ? (persona.sourceUserTemplate?.trim() || persona.description?.trim() || '')
    : ''

  // 角色卡内嵌的 {{user}} Persona 以作者原模板作为事实源。
  // 本地为阅读/筛选解析出的年龄、职业、性格等字段不再和原模板重复注入，避免一份 User 人设占两遍 Token。
  if (cardTemplateRaw) {
    return [
      `用户使用的人设名：${persona.name}`,
      persona.personaScope === 'character' && persona.boundCharacterName
        ? `这是“${persona.boundCharacterName}”角色卡专属 Persona，只在该角色相关聊天中作为用户身份使用。`
        : '',
      `【角色卡自带 {{user}} 模板原文】\n${cardTemplateRaw}`,
      persona.relationshipNote ? `用户手动补充的关系说明：${persona.relationshipNote}` : '',
      persona.characterKnowledge ? `角色已知的用户信息：${persona.characterKnowledge}` : '',
      persona.boundaries ? `用户手动补充的边界：${persona.boundaries}` : '',
      '【用户事实约束】没有出现在本 Persona 原文、长期记忆或用户当前/历史消息中的用户习惯、偏好、经历、公司地点、作息、家庭和关系事实，一律视为未知。不得为了显得熟悉而自行补全。',
      '不得替用户决定行为、台词、心理或感受；只描写角色自身。'
    ].filter(Boolean).join('\n')
  }

  const basic = [
    persona.title ? `用户人设标题：${persona.title}` : '',
    persona.identity ? `用户身份：${persona.identity}` : '',
    persona.age ? `用户年龄：${persona.age}` : '',
    persona.gender ? `用户性别：${persona.gender}` : '',
    persona.birthday ? `用户生日：${persona.birthday}` : '',
    persona.height ? `用户身高：${persona.height}` : '',
    persona.occupation ? `用户职业：${persona.occupation}` : ''
  ].filter(Boolean)
  const detail = [
    persona.appearance ? `用户外貌：${persona.appearance}` : '',
    persona.personality ? `用户性格：${persona.personality}` : '',
    persona.publicPersona ? `用户公开表现：${persona.publicPersona}` : '',
    persona.privatePersona ? `用户私下表现：${persona.privatePersona}` : '',
    persona.strengths ? `用户优点：${persona.strengths}` : '',
    persona.weaknesses ? `用户弱点：${persona.weaknesses}` : '',
    persona.interests ? `用户兴趣：${persona.interests}` : '',
    persona.habits ? `用户明确习惯：${persona.habits}` : '',
    persona.lifestyle ? `用户生活状态：${persona.lifestyle}` : '',
    persona.background ? `用户背景：${persona.background}` : ''
  ].filter(Boolean)
  const rawDescription = persona.description && !detail.length
    ? `用户人设描述：${persona.description}`
    : ''
  return [
    `用户使用的人设名：${persona.name}`,
    persona.personaScope === 'character' && persona.boundCharacterName
      ? `这是“${persona.boundCharacterName}”角色卡专属 Persona，只在该角色相关聊天中作为用户身份使用。`
      : '',
    ...basic,
    ...detail,
    rawDescription,
    persona.relationshipNote ? `用户与角色关系补充：${persona.relationshipNote}` : '',
    persona.characterKnowledge ? `角色已知的用户信息：${persona.characterKnowledge}` : '',
    persona.boundaries ? `用户边界：${persona.boundaries}` : '',
    '【用户事实约束】没有出现在本 Persona、长期记忆或用户当前/历史消息中的用户习惯、偏好、经历、公司地点、作息、家庭和关系事实，一律视为未知。不得为了显得熟悉而自行补全。',
    '一次性行为或本轮临时偏好不能自动升级成长期习惯；只有用户明确表达“平时/一直/通常/喜欢/不喜欢”等稳定事实或已有可信记忆时才能这么说。',
    '不得替用户决定行为、台词、心理或感受；只描写角色自身。'
  ].filter(Boolean).join('\n')
}
