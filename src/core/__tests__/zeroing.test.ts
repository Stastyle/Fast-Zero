import { describe, expect, it } from 'vitest'
import { computeCorrection, formatCorrectionHe } from '../zeroing'
import type { CmVec, SightProfile } from '../types'

const profile = (overrides: Partial<SightProfile> = {}): SightProfile => ({
  id: 'test',
  name: 'בדיקה',
  kind: 'reflex',
  builtIn: false,
  elevationCmPerClick: 1,
  windageCmPerClick: 1,
  instructions: {
    up: 'סובב למעלה',
    down: 'סובב למטה',
    left: 'סובב שמאלה',
    right: 'סובב ימינה',
  },
  desiredImpactOffsetCm: { right: 0, up: 0 },
  ...overrides,
})

describe('computeCorrection — quadrant table', () => {
  // MPI relative to aim point → expected correction (impact must move opposite)
  const cases: Array<{
    name: string
    mpi: CmVec
    elev: { clicks: number; direction: string }
    wind: { clicks: number; direction: string }
  }> = [
    { name: 'low-left group → up + right', mpi: { right: -3, up: -4 }, elev: { clicks: 4, direction: 'up' }, wind: { clicks: 3, direction: 'right' } },
    { name: 'low-right group → up + left', mpi: { right: 2, up: -5 }, elev: { clicks: 5, direction: 'up' }, wind: { clicks: 2, direction: 'left' } },
    { name: 'high-left group → down + right', mpi: { right: -1, up: 6 }, elev: { clicks: 6, direction: 'down' }, wind: { clicks: 1, direction: 'right' } },
    { name: 'high-right group → down + left', mpi: { right: 4, up: 3 }, elev: { clicks: 3, direction: 'down' }, wind: { clicks: 4, direction: 'left' } },
    { name: 'dead center → none', mpi: { right: 0, up: 0 }, elev: { clicks: 0, direction: 'none' }, wind: { clicks: 0, direction: 'none' } },
  ]

  for (const c of cases) {
    it(c.name, () => {
      const result = computeCorrection(c.mpi, profile())
      expect(result.elevation.clicks).toBe(c.elev.clicks)
      expect(result.elevation.direction).toBe(c.elev.direction)
      expect(result.windage.clicks).toBe(c.wind.clicks)
      expect(result.windage.direction).toBe(c.wind.direction)
    })
  }
})

describe('computeCorrection — click value scaling', () => {
  it('divides by cm-per-click and rounds to the nearest click', () => {
    const p = profile({ elevationCmPerClick: 0.7, windageCmPerClick: 0.4 })
    const c = computeCorrection({ right: 1.0, up: -2.1 }, p)
    expect(c.elevation.clicks).toBe(3) // 2.1 / 0.7
    expect(c.elevation.direction).toBe('up')
    expect(c.windage.clicks).toBe(3) // 1.0 / 0.4 = 2.5 → rounds to 3 (Math.round half-up)
    expect(c.windage.direction).toBe('left')
  })

  it('sub-half-click offset yields 0 clicks and direction none', () => {
    const p = profile({ elevationCmPerClick: 1, windageCmPerClick: 1 })
    const c = computeCorrection({ right: 0.4, up: -0.3 }, p)
    expect(c.elevation).toEqual({ clicks: 0, direction: 'none', residualCm: 0.3 })
    expect(c.windage).toEqual({ clicks: 0, direction: 'none', residualCm: 0.4 })
  })

  it('reports the residual left uncorrected by rounding', () => {
    const p = profile({ elevationCmPerClick: 0.7 })
    const c = computeCorrection({ right: 0, up: -2.0 }, p)
    // 2.0 / 0.7 = 2.857 → 3 clicks = 2.1cm → residual 0.1
    expect(c.elevation.clicks).toBe(3)
    expect(c.elevation.residualCm).toBeCloseTo(0.1, 10)
  })
})

describe('computeCorrection — desired impact offset (POI vs POA)', () => {
  it('a group exactly on the desired offset point needs no correction', () => {
    const p = profile({ desiredImpactOffsetCm: { right: 0, up: -2.5 } })
    const c = computeCorrection({ right: 0, up: -2.5 }, p)
    expect(c.elevation.direction).toBe('none')
    expect(c.windage.direction).toBe('none')
  })

  it('a group on the aim point when POI should be below → correct down', () => {
    const p = profile({ desiredImpactOffsetCm: { right: 0, up: -2.5 } })
    const c = computeCorrection({ right: 0, up: 0 }, p)
    expect(c.elevation.direction).toBe('down')
    expect(c.elevation.clicks).toBe(3) // 2.5 / 1 → round(2.5) = 3
  })
})

describe('formatCorrectionHe', () => {
  it('renders Hebrew click counts with the profile instruction', () => {
    const p = profile()
    const c = computeCorrection({ right: -3, up: -4 }, p)
    const t = formatCorrectionHe(c, p)
    expect(t.elevationText).toBe('4 קליקים למעלה · סובב למעלה')
    expect(t.windageText).toBe('3 קליקים ימינה · סובב ימינה')
    expect(t.doneText).toBeUndefined()
  })

  it('reports zeroed when both axes need nothing', () => {
    const p = profile()
    const c = computeCorrection({ right: 0.1, up: -0.1 }, p)
    const t = formatCorrectionHe(c, p)
    expect(t.elevationText).toBe('גובה: מאופס')
    expect(t.windageText).toBe('צד: מאופס')
    expect(t.doneText).toBe('הנשק מאופס!')
  })
})
