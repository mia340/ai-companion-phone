import { describe, expect, it } from 'vitest'
import { inferCardInitialActivity, inferCardInitialRelationship } from './characterInitialStateService'

describe('characterInitialStateService', () => {
  it('reads generic explicit activity fields without guessing', () => {
    expect(inferCardInitialActivity('💛负手立于田埂\n▪关系:师徒')).toBe('负手立于田埂')
    expect(inferCardInitialActivity('<activity>reading beside the window</activity>')).toBe('reading beside the window')
    expect(inferCardInitialActivity('只是普通开场，没有状态字段。')).toBe('')
  })

  it('reads generic relationship fields without application defaults', () => {
    expect(inferCardInitialRelationship('▪关系:师徒')).toBe('师徒')
    expect(inferCardInitialRelationship('<relationship>rivals</relationship>')).toBe('rivals')
    expect(inferCardInitialRelationship('没有明确关系字段')).toBe('')
  })
})
