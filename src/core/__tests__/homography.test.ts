import { describe, expect, it } from 'vitest'
import {
  a4MappingFromCorners,
  applyHomography,
  computeHomography,
  sortCorners,
} from '../homography'
import { makeCmConverter, pxToCm } from '../geometry'
import type { Vec2 } from '../types'

const TL = { x: 100, y: 100 }
const TR = { x: 700, y: 100 }
const BR = { x: 700, y: 950 }
const BL = { x: 100, y: 950 }

describe('sortCorners', () => {
  it('orders any tap order into tl,tr,br,bl', () => {
    const orders: Vec2[][] = [
      [TL, TR, BR, BL],
      [BR, TL, BL, TR],
      [BL, BR, TR, TL],
      [TR, BL, TL, BR],
    ]
    for (const order of orders) {
      expect(sortCorners(order)).toEqual([TL, TR, BR, BL])
    }
  })
})

describe('computeHomography / applyHomography', () => {
  it('maps the source corners exactly onto the destination corners', () => {
    const dst = [
      { x: 0, y: 0 },
      { x: 21, y: 0 },
      { x: 21, y: 29.7 },
      { x: 0, y: 29.7 },
    ]
    const h = computeHomography([TL, TR, BR, BL], dst)!
    for (let i = 0; i < 4; i++) {
      const m = applyHomography(h, [TL, TR, BR, BL][i])
      expect(m.x).toBeCloseTo(dst[i].x, 6)
      expect(m.y).toBeCloseTo(dst[i].y, 6)
    }
  })

  it('for an axis-aligned rectangle behaves as pure scaling', () => {
    const h = computeHomography(
      [TL, TR, BR, BL],
      [
        { x: 0, y: 0 },
        { x: 21, y: 0 },
        { x: 21, y: 29.7 },
        { x: 0, y: 29.7 },
      ],
    )!
    // center of the rect → center of the page
    const c = applyHomography(h, { x: 400, y: 525 })
    expect(c.x).toBeCloseTo(10.5, 6)
    expect(c.y).toBeCloseTo(14.85, 6)
  })

  it('handles a perspective trapezoid (top edge shorter than bottom)', () => {
    // A page photographed tilted away: top edge appears shorter
    const src = [
      { x: 200, y: 100 },
      { x: 600, y: 100 },
      { x: 700, y: 900 },
      { x: 100, y: 900 },
    ]
    const dst = [
      { x: 0, y: 0 },
      { x: 21, y: 0 },
      { x: 21, y: 29.7 },
      { x: 0, y: 29.7 },
    ]
    const h = computeHomography(src, dst)!
    // Corners map exactly
    for (let i = 0; i < 4; i++) {
      const m = applyHomography(h, src[i])
      expect(m.x).toBeCloseTo(dst[i].x, 5)
      expect(m.y).toBeCloseTo(dst[i].y, 5)
    }
    // Midpoint of the top edge → midpoint of the page's top edge
    const mid = applyHomography(h, { x: 400, y: 100 })
    expect(mid.x).toBeCloseTo(10.5, 5)
    expect(mid.y).toBeCloseTo(0, 5)
  })

  it('returns null for collinear points', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 300, y: 0 },
    ]
    expect(
      computeHomography(src, [
        { x: 0, y: 0 },
        { x: 21, y: 0 },
        { x: 21, y: 29.7 },
        { x: 0, y: 29.7 },
      ]),
    ).toBeNull()
  })
})

describe('a4MappingFromCorners', () => {
  it('portrait page: width 21, height 29.7', () => {
    const m = a4MappingFromCorners([BR, TL, TR, BL])
    if (!m.ok) throw new Error('expected ok')
    expect(m.pageWidthCm).toBe(21)
    expect(m.pageHeightCm).toBe(29.7)
    const c = applyHomography(m.homography, { x: 400, y: 525 })
    expect(c.x).toBeCloseTo(10.5, 5)
    expect(c.y).toBeCloseTo(14.85, 5)
  })

  it('landscape page in the photo: width 29.7, height 21', () => {
    // wide rectangle: horizontal edges longer than vertical
    const corners = [
      { x: 100, y: 200 },
      { x: 950, y: 200 },
      { x: 950, y: 800 },
      { x: 100, y: 800 },
    ]
    const m = a4MappingFromCorners(corners)
    if (!m.ok) throw new Error('expected ok')
    expect(m.pageWidthCm).toBe(29.7)
    expect(m.pageHeightCm).toBe(21)
  })

  it('rejects corners that are too close together', () => {
    const m = a4MappingFromCorners([TL, { x: TL.x + 5, y: TL.y + 5 }, BR, BL])
    expect(m).toEqual({ ok: false, reason: 'corners-too-close' })
  })
})

describe('makeCmConverter', () => {
  it('linear mode matches pxToCm', () => {
    const conv = makeCmConverter({ pxPerCm: 10, homography: null })!
    const origin = { x: 100, y: 100 }
    const p = { x: 130, y: 150 }
    expect(conv(p, origin)).toEqual(pxToCm(p, origin, 10))
  })

  it('homography mode: a hit below-left of aim gives negative right and negative up', () => {
    const m = a4MappingFromCorners([TL, TR, BR, BL])
    if (!m.ok) throw new Error('expected ok')
    const conv = makeCmConverter({ homography: m.homography, pxPerCm: null })!
    // rect is 600px wide = 21cm → 28.571 px/cm
    const aim = { x: 400, y: 500 }
    const hit = { x: 400 - 57.14, y: 500 + 114.29 } // 2cm left, 4cm down
    // the 600×850px test rect is not exact A4 ratio, so axis scales differ slightly
    const cm = conv(hit, aim)
    expect(cm.right).toBeCloseTo(-2, 1)
    expect(cm.up).toBeCloseTo(-4, 1)
  })

  it('homography wins over pxPerCm when both are set', () => {
    const m = a4MappingFromCorners([TL, TR, BR, BL])
    if (!m.ok) throw new Error('expected ok')
    const conv = makeCmConverter({ homography: m.homography, pxPerCm: 999 })!
    const cm = conv({ x: 400, y: 525 }, { x: 100, y: 100 })
    expect(cm.right).toBeCloseTo(10.5, 4)
  })

  it('returns null when no calibration exists', () => {
    expect(makeCmConverter({ homography: null, pxPerCm: null })).toBeNull()
  })
})
