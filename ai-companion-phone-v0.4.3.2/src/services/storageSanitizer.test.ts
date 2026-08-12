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
})
