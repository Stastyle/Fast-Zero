import { describe, expect, it } from 'vitest'
import { computeMpiPx, distancePx, extremeSpreadPx, pxToCm } from '../geometry'
import type { Hit } from '../types'

const hit = (x: number, y: number, excluded = false): Hit => ({
  id: `${x},${y}`,
  posPx: { x, y },
  excluded,
})

describe('computeMpiPx', () => {
  it('returns the single hit position for one hit', () => {
    expect(computeMpiPx([hit(10, 20)])).toEqual({ x: 10, y: 20 })
  })

  it('returns the exact center of a symmetric group', () => {
    const hits = [hit(0, 0), hit(10, 0), hit(0, 10), hit(10, 10)]
    expect(computeMpiPx(hits)).toEqual({ x: 5, y: 5 })
  })

  it('ignores excluded hits', () => {
    const hits = [hit(0, 0), hit(10, 10), hit(1000, 1000, true)]
    expect(computeMpiPx(hits)).toEqual({ x: 5, y: 5 })
  })

  it('returns null when all hits are excluded', () => {
    expect(computeMpiPx([hit(1, 1, true), hit(2, 2, true)])).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(computeMpiPx([])).toBeNull()
  })
})

describe('pxToCm — the y-axis flip', () => {
  const origin = { x: 100, y: 100 }

  it('a hit BELOW the aim point in pixels yields negative up', () => {
    // pixel y grows down, so y=150 is below the origin on screen
    const cm = pxToCm({ x: 100, y: 150 }, origin, 10)
    expect(cm.up).toBe(-5)
    expect(cm.right).toBe(0)
  })

  it('a hit ABOVE the aim point in pixels yields positive up', () => {
    const cm = pxToCm({ x: 100, y: 60 }, origin, 10)
    expect(cm.up).toBe(4)
  })

  it('a hit to the right yields positive right', () => {
    const cm = pxToCm({ x: 130, y: 100 }, origin, 10)
    expect(cm.right).toBe(3)
  })

  it('a hit to the left yields negative right', () => {
    const cm = pxToCm({ x: 80, y: 100 }, origin, 10)
    expect(cm.right).toBe(-2)
  })

  it('scales by pxPerCm', () => {
    const cm = pxToCm({ x: 110, y: 90 }, origin, 5)
    expect(cm).toEqual({ right: 2, up: 2 })
  })
})

describe('distancePx', () => {
  it('computes diagonal (Pythagorean) distance', () => {
    expect(distancePx({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})

describe('extremeSpreadPx', () => {
  it('returns the largest pairwise distance among included hits', () => {
    const hits = [hit(0, 0), hit(3, 4), hit(1, 1)]
    expect(extremeSpreadPx(hits)).toBe(5)
  })

  it('ignores excluded hits and returns 0 for fewer than two included', () => {
    expect(extremeSpreadPx([hit(0, 0), hit(100, 100, true)])).toBe(0)
  })
})
