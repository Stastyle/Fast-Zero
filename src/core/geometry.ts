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
