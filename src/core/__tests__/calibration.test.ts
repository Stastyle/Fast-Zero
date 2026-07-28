import { describe, expect, it } from 'vitest'
import { computePxPerCm, MIN_CALIBRATION_PX, validateCalibration } from '../calibration'

describe('computePxPerCm', () => {
  it('computes scale from an axis-aligned pair', () => {
    expect(computePxPerCm({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)).toBe(10)
  })

  it('uses the diagonal distance, not axis projections', () => {
    // 3-4-5 triangle scaled ×30 → 150px over 10cm = 15 px/cm
    expect(computePxPerCm({ x: 0, y: 0 }, { x: 90, y: 120 }, 10)).toBe(15)
  })
})

describe('validateCalibration', () => {
  const a = { x: 0, y: 0 }

  it('accepts a valid pair', () => {
    expect(validateCalibration(a, { x: 200, y: 0 }, 10)).toEqual({ ok: true })
  })

  it('rejects points closer than the minimum pixel distance', () => {
    const b = { x: MIN_CALIBRATION_PX - 1, y: 0 }
    expect(validateCalibration(a, b, 10)).toEqual({ ok: false, reason: 'points-too-close' })
  })

  it('rejects zero, negative, and non-finite distances', () => {
    expect(validateCalibration(a, { x: 200, y: 0 }, 0)).toEqual({ ok: false, reason: 'bad-distance' })
    expect(validateCalibration(a, { x: 200, y: 0 }, -5)).toEqual({ ok: false, reason: 'bad-distance' })
    expect(validateCalibration(a, { x: 200, y: 0 }, NaN)).toEqual({ ok: false, reason: 'bad-distance' })
  })
})
