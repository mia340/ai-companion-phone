import { db } from '../db/database'
import type { ResourceBinding, ResourceBindingScope, ResourceType } from '../types/domain'

export interface ResourceBindingContext {
  worldId?: string
  characterId?: string
  conversationId?: string
  personaId?: string
}

function normalizedScope(item: ResourceBinding): ResourceBindingScope {
  return item.scope || (item.characterId ? 'character' : 'global')
}

function normalizedScopeId(item: ResourceBinding) {
  return item.scopeId || item.characterId
}

export async function listResourceBindings(characterId?: string): Promise<ResourceBinding[]> {
  const rows = await db.resourceBindings.toArray()
  return rows
    .filter(item => !characterId || (normalizedScope(item) === 'character' && normalizedScopeId(item) === characterId))
    .sort((a, b) => a.resourceType.localeCompare(b.resourceType) || a.order - b.order || a.updatedAt.localeCompare(b.updatedAt))
}

export async function getActiveResourceIds(context: ResourceBindingContext, resourceType: ResourceType): Promise<string[]> {
  const rows = await db.resourceBindings.toArray()
  const matched = rows.filter(item => {
    if (!item.enabled || item.resourceType !== resourceType) return false
    if (context.worldId && item.worldId !== context.worldId) return false
    const scope = normalizedScope(item)
    const scopeId = normalizedScopeId(item)
    if (scope === 'global') return true
    if (scope === 'character') return Boolean(context.characterId && scopeId === context.characterId)
    if (scope === 'conversation') return Boolean(context.conversationId && scopeId === context.conversationId)
    if (scope === 'persona') return Boolean(context.personaId && scopeId === context.personaId)
    return false
  })

  const specificity = (item: ResourceBinding) => {
    const scope = normalizedScope(item)
    if (scope === 'conversation') return 4
    if (scope === 'persona') return 3
    if (scope === 'character') return 2
    return 1
  }

  return Array.from(new Set(matched
    .sort((a, b) => specificity(b) - specificity(a) || a.order - b.order || a.updatedAt.localeCompare(b.updatedAt))
    .map(item => item.resourceId)))
}

export async function getCharacterResourceIds(characterId: string, resourceType: ResourceType, worldId?: string): Promise<string[]> {
  const resolvedWorldId = worldId || (await db.characters.get(characterId))?.worldId
  return getActiveResourceIds({ characterId, worldId: resolvedWorldId }, resourceType)
}

export async function setResourceBinding(input: {
  worldId: string
  characterId?: string
  scope?: ResourceBindingScope
  scopeId?: string
  resourceType: ResourceType
  resourceId: string
  enabled: boolean
  order?: number
}): Promise<ResourceBinding> {
  const scope: ResourceBindingScope = input.scope || (input.characterId ? 'character' : 'global')
  const scopeId = input.scopeId || (scope === 'character' ? input.characterId : undefined)
  if (scope !== 'global' && !scopeId) throw new Error('这个资源作用域缺少绑定对象。')

  const rows = await db.resourceBindings.toArray()
  const existing = rows.find(item =>
    item.worldId === input.worldId &&
    normalizedScope(item) === scope &&
    normalizedScopeId(item) === scopeId &&
    item.resourceType === input.resourceType &&
    item.resourceId === input.resourceId
  )
  const now = new Date().toISOString()
  const binding: ResourceBinding = {
    id: existing?.id || crypto.randomUUID(),
    worldId: input.worldId,
    characterId: scope === 'character' ? scopeId : undefined,
    scope,
    scopeId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    enabled: input.enabled,
    order: input.order ?? existing?.order ?? 100,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  }
  await db.resourceBindings.put(binding)
  return binding
}

export async function removeResourceBindingsForResource(resourceType: ResourceType, resourceId: string) {
  const rows = await db.resourceBindings.toArray()
  const ids = rows.filter(item => item.resourceType === resourceType && item.resourceId === resourceId).map(item => item.id)
  if (ids.length) await db.resourceBindings.bulkDelete(ids)
}
