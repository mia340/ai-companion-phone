import { describe, expect, it } from 'vitest'
import { COUPLE_BOARD_MAP_STOPS, getCoupleBoardMapStop, mapStopBias } from './coupleBoardMapService'

describe('coupleBoardMapService', () => {
  it('maps every stable board index to one themed date-route stop', () => {
    expect(COUPLE_BOARD_MAP_STOPS).toHaveLength(30)
    expect(COUPLE_BOARD_MAP_STOPS.map(row => row.index)).toEqual(Array.from({ length: 30 }, (_, index) => index))
    expect(new Set(COUPLE_BOARD_MAP_STOPS.map(row => row.name)).size).toBe(30)
    expect(COUPLE_BOARD_MAP_STOPS.every(row => row.x >= 0 && row.x <= 100 && row.y >= 0 && row.y <= 100)).toBe(true)
  })

  it('keeps private locations biased toward intimacy without changing board rules', () => {
    const stop = getCoupleBoardMapStop(28)
    expect(stop.name).toBe('床边')
    expect(mapStopBias(stop).themes).toContain('intimacy')
    expect(mapStopBias(stop).themes).toContain('private')
  })
})
