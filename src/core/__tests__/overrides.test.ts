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

describe('Meprolight defaults reflect the manufacturer specs', () => {
  it('M5: 0.5 MOA per click ≈ 0.36cm at 25m', () => {
    const m5 = DEFAULT_PROFILES.find((p) => p.id === 'mepro-reflex')!
    expect(m5.name).toBe('מפרולייט M5')
    expect(m5.elevationCmPerClick).toBeCloseTo(0.36, 2)
    expect(m5.windageCmPerClick).toBeCloseTo(0.36, 2)
  })

  it('M21: 0.5 mrad per click = 1.25cm at 25m', () => {
    const m21 = DEFAULT_PROFILES.find((p) => p.id === 'mepro-21')!
    expect(m21.name).toBe('מפרולייט M21')
    expect(m21.elevationCmPerClick).toBeCloseTo(1.25, 2)
    expect(m21.windageCmPerClick).toBeCloseTo(1.25, 2)
    expect(m21.notes?.startsWith('לפי מפרט')).toBe(true)
  })
})

describe('M21 legacy override cleanup', () => {
  it('drops the pre-rename name and old estimated clicks', () => {
    expect(
      stripLegacyOverride('mepro-21', {
        name: 'מפרו 21',
        elevationCmPerClick: 0.7,
        windageCmPerClick: 0.7,
      }),
    ).toEqual({})
  })

  it('keeps deliberate custom values', () => {
    expect(stripLegacyOverride('mepro-21', { elevationCmPerClick: 1.0 })).toEqual({
      elevationCmPerClick: 1.0,
    })
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
