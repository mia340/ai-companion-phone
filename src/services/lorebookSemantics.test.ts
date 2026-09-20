import { describe, expect, it } from 'vitest'
import { initialLorebookEntryMode } from './lorebookSemantics'
import type { LorebookEntry } from '../types/domain'

function entry(patch: Partial<LorebookEntry> = {}): LorebookEntry {
  const now = '2026-08-23T00:00:00.000Z'
  return {
    id: 'entry', worldId: 'world', title: '测试条目', keywords: [], secondaryKeys: [], content: '普通内容',
    enabled: true, constant: false, caseSensitive: false, useRegex: false, selective: false, priority: 50,
    createdAt: now, updatedAt: now, ...patch
  }
}

describe('WorldBook initial activation semantics', () => {
  it('V3 useRegex + keys 时按关键词 Regex 扫描，不让 constant 覆盖规范语义', () => {
    expect(initialLorebookEntryMode(entry({ constant: true, useRegex: true, keywords: ['foo.*bar'] }))).toBe('keyword')
  })

  it('旧社区导出 constant + useRegex + 空 keys 时保留 constant 兼容兜底', () => {
    expect(initialLorebookEntryMode(entry({ constant: true, useRegex: true, keywords: [] }))).toBe('constant')
  })

  it('无关键词且明确每轮必须输出的合同优先作为 mandatory', () => {
    expect(initialLorebookEntryMode(entry({ constant: true, useRegex: true, content: '每次回复必须在正文末尾输出以下状态栏，不能省略。' }))).toBe('mandatory')
  })

  it('普通零关键词、非 constant 条目不会被擅自常驻', () => {
    expect(initialLorebookEntryMode(entry())).toBe('none')
  })
})
