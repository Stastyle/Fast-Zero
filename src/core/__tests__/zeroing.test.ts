import { describe, expect, it } from 'vitest'
import { computeCorrection, estimateConfidence, formatCorrectionHe } from '../zeroing'
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

describe('estimateConfidence', () => {
  /** Offset = MPI of the hits (desired impact offset zero). */
  const mpiOf = (hits: CmVec[]): CmVec => ({
    right: hits.reduce((a, h) => a + h.right, 0) / hits.length,
    up: hits.reduce((a, h) => a + h.up, 0) / hits.length,
  })

  it('tight 5-shot group with a large offset → high on both axes', () => {
    const hits: CmVec[] = [
      { right: -2.9, up: -4.1 },
      { right: -3.1, up: -3.9 },
      { right: -3.0, up: -4.0 },
      { right: -2.8, up: -4.0 },
      { right: -3.2, up: -4.0 },
    ]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.n).toBe(5)
    expect(c.elevation.level).toBe('high')
    expect(c.windage.level).toBe('high')
    expect(c.level).toBe('high')
    // SE = s/√n: s(right) ≈ 0.158 → SE ≈ 0.071
    expect(c.windage.seCm).toBeCloseTo(0.0707, 3)
  })

  it('a single shot is always low, however large the offset', () => {
    const hits: CmVec[] = [{ right: 7, up: -7 }]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.level).toBe('low')
    expect(c.elevation.seCm).toBe(0)
  })

  it('two shots are always low, even when they agree perfectly', () => {
    const hits: CmVec[] = [
      { right: 5, up: -5 },
      { right: 5, up: -5 },
    ]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.elevation.level).toBe('low')
    expect(c.windage.level).toBe('low')
    expect(c.level).toBe('low')
  })

  it('scattered group with an offset smaller than the noise → low', () => {
    // Symmetric ±3cm scatter around (0.5, 0.5): s = 3.46, SE ≈ 1.73 per axis,
    // offset 0.5 is well inside one SE and the group is too loose to trust.
    const hits: CmVec[] = [
      { right: 3.5, up: 3.5 },
      { right: -2.5, up: -2.5 },
      { right: 3.5, up: -2.5 },
      { right: -2.5, up: 3.5 },
    ]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.windage.seCm).toBeCloseTo(1.732, 2)
    expect(c.level).toBe('low')
  })

  it('borderline: offset between 1·SE and 2·SE → medium', () => {
    // Per axis: mean 1.5, deviations ±√3 twice → s = 2, SE = 1 (n = 4).
    // |offset| = 1.5 sits between SE and 2·SE.
    const d = Math.sqrt(3)
    const hits: CmVec[] = [
      { right: 1.5 + d, up: 1.5 + d },
      { right: 1.5 - d, up: 1.5 - d },
      { right: 1.5 + d, up: 1.5 + d },
      { right: 1.5 - d, up: 1.5 - d },
    ]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.windage.seCm).toBeCloseTo(1, 6)
    expect(c.elevation.level).toBe('medium')
    expect(c.windage.level).toBe('medium')
    expect(c.level).toBe('medium')
  })

  it('tight group already on target → high ("no correction" is trustworthy)', () => {
    const hits: CmVec[] = [
      { right: 0.1, up: 0 },
      { right: -0.1, up: 0 },
      { right: 0, up: 0.1 },
      { right: 0, up: -0.1 },
    ]
    const c = estimateConfidence(hits, { right: 0, up: 0 })
    expect(c.level).toBe('high')
  })

  it('overall level is the worst of the two axes', () => {
    // Elevation: huge clear offset (high). Windage: offset buried in noise
    // with a loose spread (low) → overall must be low.
    const hits: CmVec[] = [
      { right: 4, up: -9.9 },
      { right: -4, up: -10.1 },
      { right: 4.5, up: -10.0 },
      { right: -3.5, up: -10.0 },
    ]
    const c = estimateConfidence(hits, mpiOf(hits))
    expect(c.elevation.level).toBe('high')
    expect(c.windage.level).toBe('low')
    expect(c.level).toBe('low')
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
