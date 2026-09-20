import { describe, expect, it } from 'vitest'
import { assertBackupReferenceIntegrity, parseBackupEnvelope } from './backupValidation'
import type { CompanionBackup } from './dataBackup'

function minimalBackup(): CompanionBackup {
  return {
    format: 'ai-companion-phone-backup', version: 12, exportedAt: '2026-09-18T00:00:00.000Z',
    data: {
      worlds: [{ id: 'w1', name: '世界', eventLevel: 'daily', paused: false, createdAt: '' }],
      characters: [], contactGroups: [], conversations: [], messages: [], userProfiles: [], chatSettings: [], memories: [], conversationStates: [], musicStates: [], relationships: [], relationshipEvents: [], personas: [], lorebookEntries: [], lorebooks: [], promptPresets: [], regexScripts: [], resourceBindings: [], communityResourceArchives: [], conversationStateHistory: [], momentPosts: [], momentComments: [], appCustomizations: [], socialProfiles: []
    }
  }
}

describe('Backup Zod + restore preflight', () => {
  it('旧备份缺少后期可选数组时自动补为空数组', () => {
    const value = minimalBackup() as unknown as Record<string, unknown>
    const data = { ...(value.data as Record<string, unknown>) }
    delete data.socialProfiles
    delete data.appCustomizations
    const parsed = parseBackupEnvelope({ ...value, version: 8, data })
    expect(parsed.data.socialProfiles).toEqual([])
    expect(parsed.data.appCustomizations).toEqual([])
  })

  it('恢复前阻止悬空会话/消息引用，避免清库后才发现坏备份', () => {
    const backup = minimalBackup()
    backup.data.messages.push({ id: 'm1', worldId: 'w1', conversationId: 'missing', senderId: 'user', content: 'x', type: 'text', status: 'delivered', createdAt: '' })
    expect(() => assertBackupReferenceIntegrity(backup)).toThrow(/不存在的会话/)
  })

  it('恢复前阻止朋友圈评论指向不存在的动态', () => {
    const backup = minimalBackup()
    backup.data.momentComments.push({
      id: 'mc1', worldId: 'w1', momentId: 'missing', authorType: 'user', authorId: 'user', content: 'x', source: 'manual', createdAt: ''
    })
    expect(() => assertBackupReferenceIntegrity(backup)).toThrow(/不存在的动态/)
  })

  it('恢复前阻止资源绑定指向不存在的资源', () => {
    const backup = minimalBackup()
    backup.data.resourceBindings.push({
      id: 'rb1', worldId: 'w1', scope: 'global', resourceType: 'lorebook', resourceId: 'missing', enabled: true, order: 1, createdAt: '', updatedAt: ''
    })
    expect(() => assertBackupReferenceIntegrity(backup)).toThrow(/不存在的 lorebook/)
  })

  it('恢复前阻止实体引用不存在的世界', () => {
    const backup = minimalBackup()
    backup.data.characters.push({
      id: 'c1', worldId: 'missing', name: '角色', avatar: '', persona: '', relationship: '', mood: '', activity: '', replySpeed: 'natural', createdAt: '', updatedAt: ''
    })
    expect(() => assertBackupReferenceIntegrity(backup)).toThrow(/不存在的 worldId/)
  })

  it('恢复前阻止重复主键，避免 bulkPut 静默覆盖', () => {
    const backup = minimalBackup()
    backup.data.worlds.push({ id: 'w1', name: '重复世界', eventLevel: 'daily', paused: false, createdAt: '' })
    expect(() => assertBackupReferenceIntegrity(backup)).toThrow(/重复 id/)
  })

})
