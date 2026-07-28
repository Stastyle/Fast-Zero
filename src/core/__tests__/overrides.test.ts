import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILES,
  stripLegacyOverride,
  stripRedundantOverride,
} from '../../data/defaultProfiles'
import { makeCmConverter } from '../geometry'

describe('stripLegacyOverride', () => {
  it('drops the pre-rename frozen name for mepro-reflex', () => {
    const cleaned = stripLegacyOverride('mepro-reflex', {
      name: 'מפרו (רפלקס)',
      elevationCmPerClick: 0.5,
    })
    expect(cleaned).toEqual({ elevationCmPerClick: 0.5 })
  })

  it('drops the old estimated click values but keeps deliberate ones', () => {
    expect(
      stripLegacyOverride('mepro-reflex', { elevationCmPerClick: 0.7, windageCmPerClick: 0.7 }),
    ).toEqual({})
    expect(stripLegacyOverride('mepro-reflex', { elevationCmPerClick: 0.5 })).toEqual({
      elevationCmPerClick: 0.5,
    })
  })

  it('keeps a genuinely custom name', () => {
    expect(stripLegacyOverride('mepro-reflex', { name: 'הכוונת שלי' })).toEqual({
      name: 'הכוונת שלי',
    })
  })

  it('leaves profiles without legacy entries untouched', () => {
    expect(stripLegacyOverride('m4-iron', { name: 'X' })).toEqual({ name: 'X' })
  })
})

describe('stripRedundantOverride', () => {
  it('drops fields equal to the current shipped default', () => {
    const m5 = DEFAULT_PROFILES.find((p) => p.id === 'mepro-reflex')!
    const cleaned = stripRedundantOverride('mepro-reflex', {
      name: m5.name,
      elevationCmPerClick: 0.5,
    })
    expect(cleaned).toEqual({ elevationCmPerClick: 0.5 })
  })
})

describe('M5 default reflects the manufacturer spec', () => {
  it('0.5 MOA per click ≈ 0.36cm at 25m', () => {
    const m5 = DEFAULT_PROFILES.find((p) => p.id === 'mepro-reflex')!
    expect(m5.name).toBe('מפרולייט M5')
    expect(m5.elevationCmPerClick).toBeCloseTo(0.36, 2)
    expect(m5.windageCmPerClick).toBeCloseTo(0.36, 2)
  })
})

describe('makeCmConverter rejects degenerate calibrations', () => {
  it('returns null for zero, negative, and NaN pxPerCm', () => {
    expect(makeCmConverter({ pxPerCm: 0, homography: null })).toBeNull()
    expect(makeCmConverter({ pxPerCm: -3, homography: null })).toBeNull()
    expect(makeCmConverter({ pxPerCm: NaN, homography: null })).toBeNull()
  })

  it('returns null for a homography containing non-finite values', () => {
    const h = [1, 0, 0, 0, 1, 0, 0, 0, NaN]
    expect(makeCmConverter({ pxPerCm: null, homography: h })).toBeNull()
  })
})
