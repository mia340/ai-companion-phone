import { describe, expect, it } from 'vitest'
import { collectCharacterGreetings, hasMultipleCharacterGreetings } from './characterGreetingService'

describe('character greeting service', () => {
  it('keeps the default greeting first and removes blank/duplicate alternates', () => {
    expect(collectCharacterGreetings(' 默认 ', ['备用一', '', '默认', '备用二'])).toEqual(['默认', '备用一', '备用二'])
  })

  it('only asks the user to choose when there are at least two distinct greetings', () => {
    expect(hasMultipleCharacterGreetings('默认', ['默认', ''])).toBe(false)
    expect(hasMultipleCharacterGreetings('默认', ['备用'])).toBe(true)
  })
})
