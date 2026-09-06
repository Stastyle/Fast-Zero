import { distancePx } from './geometry'
import type { Vec2 } from './types'

/** ISO A4 paper, in cm. */
export const A4_SHORT_CM = 21
export const A4_LONG_CM = 29.7

/**
 * Sort 4 freely-tapped points into [top-left, top-right, bottom-right, bottom-left]
 * by angle around their centroid (screen coords, y down ⇒ ascending angle is clockwise).
 */
export function sortCorners(pts: Vec2[]): [Vec2, Vec2, Vec2, Vec2] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const sorted = [...pts].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  )
  return sorted as [Vec2, Vec2, Vec2, Vec2]
}

/** Solve Ax = b (n×n) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row, i) => row[n] / M[i][i])
}

/**
 * Homography H (9 values, h8 = 1) mapping each src[i] to dst[i] via
 * u = (h0·x + h1·y + h2) / (h6·x + h7·y + 1), v = (h3·x + h4·y + h5) / (…).
 * Returns null for degenerate configurations (e.g. 3 collinear points).
 */
export function computeHomography(src: Vec2[], dst: Vec2[]): number[] | null {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solve(A, b)
  return h ? [...h, 1] : null
}

export function applyHomography(h: number[], p: Vec2): Vec2 {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  }
}

export type A4Mapping =
  | {
      ok: true
      /** Maps image px → page cm (origin top-left of page, y grows down). */
      homography: number[]
      /**
       * The reverse mapping, page cm → image px. Lets a point fixed on the
       * PAGE (the aim point) be recovered in a later photo of the same sheet,
       * whatever the framing and angle of that photo.
       */
      inverse: number[]
      pageWidthCm: number
      pageHeightCm: number
    }
  | { ok: false; reason: 'corners-too-close' | 'degenerate' }

/**
 * Build the px→cm mapping from 4 tapped page corners, assuming the page is A4.
 * Detects page orientation in the photo: if the horizontal edges are longer
 * than the vertical ones, the page lies landscape and the 29.7cm side is wide.
 */
export function a4MappingFromCorners(corners: Vec2[]): A4Mapping {
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      if (distancePx(corners[i], corners[j]) < 40) {
        return { ok: false, reason: 'corners-too-close' }
      }
    }
  }
  const [tl, tr, br, bl] = sortCorners(corners)
  const horizontal = (distancePx(tl, tr) + distancePx(bl, br)) / 2
  const vertical = (distancePx(tl, bl) + distancePx(tr, br)) / 2
  const pageWidthCm = horizontal > vertical ? A4_LONG_CM : A4_SHORT_CM
  const pageHeightCm = horizontal > vertical ? A4_SHORT_CM : A4_LONG_CM
  const pageCorners = [
    { x: 0, y: 0 },
    { x: pageWidthCm, y: 0 },
    { x: pageWidthCm, y: pageHeightCm },
    { x: 0, y: pageHeightCm },
  ]
  const imageCorners = [tl, tr, br, bl]
  const homography = computeHomography(imageCorners, pageCorners)
  // Solved from the same correspondences rather than inverted numerically —
  // same cost, and no error amplification from a near-singular matrix.
  const inverse = computeHomography(pageCorners, imageCorners)
  if (!homography || !inverse) return { ok: false, reason: 'degenerate' }
  return { ok: true, homography, inverse, pageWidthCm, pageHeightCm }
}
