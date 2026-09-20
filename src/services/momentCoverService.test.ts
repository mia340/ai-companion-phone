import { describe, expect, it } from 'vitest'
import { MAX_MOMENT_COVER_BYTES, MOMENT_COVER_KEY, momentCoverId, validateMomentCoverDataUrl } from './momentCoverService'

describe('moment cover', () => {
  it('uses a world-scoped backup record without colliding with app icons', () => {
    expect(momentCoverId('world-a')).toBe(`world-a:${MOMENT_COVER_KEY}`)
    expect(momentCoverId('world-b')).not.toBe(momentCoverId('world-a'))
  })
  it('accepts small static image data and rejects active or remote content', () => {
    expect(validateMomentCoverDataUrl('data:image/jpeg;base64,/9j/')).toBe(true)
    expect(validateMomentCoverDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(validateMomentCoverDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
    expect(validateMomentCoverDataUrl('https://example.org/cover.jpg')).toBe(false)
    expect(validateMomentCoverDataUrl('data:text/html;base64,PGgxPg==')).toBe(false)
    expect(validateMomentCoverDataUrl(`data:image/jpeg;base64,${'A'.repeat(Math.ceil(MAX_MOMENT_COVER_BYTES * 4 / 3) + 4)}`)).toBe(false)
  })
})
