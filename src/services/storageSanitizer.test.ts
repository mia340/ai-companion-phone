import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { toPlainStorageValue } from './storageSanitizer'

describe('storage sanitizer', () => {
  it('turns reactive nested arrays into structured-clone-safe plain data', () => {
    const source = reactive({
      tags: ['演员', '隐婚'],
      alternateGreetings: [] as string[],
      lorebookEntries: [{ title: '测试', keywords: ['关键词'] }]
    })

    const plain = toPlainStorageValue(source)
    expect(plain).toEqual({
      tags: ['演员', '隐婚'],
      alternateGreetings: [],
      lorebookEntries: [{ title: '测试', keywords: ['关键词'] }]
    })
    expect(() => structuredClone(plain)).not.toThrow()
  })

  it('keeps IndexedDB-native cloneable values while removing nested proxies', () => {
    const source = reactive({
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
      allowedSources: ['care', 'daily-share'],
      nested: { values: [1, 2, 3] },
      lookup: new Map([['mood', { value: '平静' }]]),
      flags: new Set(['a', 'b'])
    })

    const plain = toPlainStorageValue(source)
    expect(plain.updatedAt).toBeInstanceOf(Date)
    expect(plain.lookup).toBeInstanceOf(Map)
    expect(plain.flags).toBeInstanceOf(Set)
    expect(() => structuredClone(plain)).not.toThrow()
  })
})
