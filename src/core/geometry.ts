import { applyHomography } from './homography'
import type { CmVec, Hit, Vec2 } from './types'

/** Mean point of impact of the non-excluded hits, in pixel space. Null when none included. */
export function computeMpiPx(hits: Hit[]): Vec2 | null {
  const included = hits.filter((h) => !h.excluded)
  if (included.length === 0) return null
  const sum = included.reduce(
    (acc, h) => ({ x: acc.x + h.posPx.x, y: acc.y + h.posPx.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / included.length, y: sum.y / included.length }
}

/**
 * Convert a pixel-space point to physical cm relative to `origin`.
 * THE y-axis flip lives here and only here: pixel y grows down,
 * physical `up` grows up.
 */
export function pxToCm(point: Vec2, origin: Vec2, pxPerCm: number): CmVec {
  return {
    right: (point.x - origin.x) / pxPerCm,
    up: (origin.y - point.y) / pxPerCm,
  }
}

export function distancePx(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Unified px→cm conversion for both calibration kinds:
 * - homography (A4 corners): both points map onto the page plane in cm,
 *   correct even for photos taken at an angle;
 * - linear pxPerCm (camera-frame crop, schematic, manual two-point).
 * Returned CmVec is relative to `origin` with `up` growing UP.
 */
export function makeCmConverter(cal: {
  homography?: number[] | null
  pxPerCm?: number | null
}): ((point: Vec2, origin: Vec2) => CmVec) | null {
  if (cal.homography) {
    const h = cal.homography
    return (point, origin) => {
      const p = applyHomography(h, point)
      const o = applyHomography(h, origin)
      return { right: p.x - o.x, up: o.y - p.y }
    }
  }
  if (cal.pxPerCm) {
    const scale = cal.pxPerCm
    return (point, origin) => pxToCm(point, origin, scale)
  }
  return null
}

/** Largest pairwise distance among points already converted to cm. */
export function extremeSpreadCm(points: CmVec[]): number {
  let max = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(
        max,
        Math.hypot(points[i].right - points[j].right, points[i].up - points[j].up),
      )
    }
  }
  return max
}

/** Largest distance between any two included hits ("extreme spread"), in px. */
export function extremeSpreadPx(hits: Hit[]): number {
  const included = hits.filter((h) => !h.excluded)
  let max = 0
  for (let i = 0; i < included.length; i++) {
    for (let j = i + 1; j < included.length; j++) {
      max = Math.max(max, distancePx(included[i].posPx, included[j].posPx))
    }
  }
  return max
}
