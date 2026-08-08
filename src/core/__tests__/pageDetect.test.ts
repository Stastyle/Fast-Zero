import { describe, expect, it } from 'vitest'
import {
  boxBlur3,
  detectPage,
  grayscale,
  otsuThreshold,
  paperChannel,
  QuadSmoother,
  type DetectedQuad,
  type ImageDataLike,
} from '../pageDetect'
import type { Vec2 } from '../types'

const W = 160
const H = 120

/** Deterministic pseudo-random (tests must not flake). */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Is p inside the convex polygon (corners in clockwise order, y down)? */
function insideConvex(p: Vec2, poly: Vec2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (cross < 0) return false
  }
  return true
}

type RGB = [number, number, number]

/**
 * Synthesize an RGBA frame: background, optional convex quad, optional second
 * convex region (distractor / dim page margin), mild noise. Colors are gray
 * levels (`bg`/`fg`) or full RGB triples (`bgColor`/`fgColor`).
 */
function makeImage(opts: {
  quad?: Vec2[]
  bg?: number
  fg?: number
  bgColor?: RGB
  fgColor?: RGB
  extra?: Vec2[]
  extraColor?: RGB
  noise?: number
  width?: number
  height?: number
}): ImageDataLike {
  const width = opts.width ?? W
  const height = opts.height ?? H
  const bgColor: RGB = opts.bgColor ?? [opts.bg ?? 40, opts.bg ?? 40, opts.bg ?? 40]
  const fgColor: RGB = opts.fgColor ?? [opts.fg ?? 235, opts.fg ?? 235, opts.fg ?? 235]
  const noise = opts.noise ?? 0
  const rand = mulberry32(7)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let color = bgColor
      if (opts.quad && insideConvex({ x, y }, opts.quad)) color = fgColor
      else if (opts.extra && insideConvex({ x, y }, opts.extra)) color = opts.extraColor ?? fgColor
      const n = noise ? (rand() - 0.5) * 2 * noise : 0
      const i = (y * width + x) * 4
      data[i] = Math.max(0, Math.min(255, Math.round(color[0] + n)))
      data[i + 1] = Math.max(0, Math.min(255, Math.round(color[1] + n)))
      data[i + 2] = Math.max(0, Math.min(255, Math.round(color[2] + n)))
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

function expectCornersClose(actual: DetectedQuad['corners'], expected: Vec2[], tol: number) {
  for (let i = 0; i < 4; i++) {
    expect(Math.hypot(actual[i].x - expected[i].x, actual[i].y - expected[i].y)).toBeLessThanOrEqual(
      tol,
    )
  }
}

describe('grayscale / boxBlur3 / otsuThreshold', () => {
  it('grayscale maps white and black correctly', () => {
    const img = makeImage({ bg: 0 })
    const g = grayscale(img)
    expect(g[0]).toBe(0)
    const white = makeImage({ bg: 255 })
    expect(grayscale(white)[0]).toBe(255)
  })

  it('paperChannel scores white and yellow paper equally high, blue low', () => {
    const white = makeImage({ bg: 255 })
    expect(paperChannel(white)[0]).toBe(255)
    const yellow = makeImage({ bgColor: [240, 240, 60] })
    expect(paperChannel(yellow)[0]).toBe(240)
    const blue = makeImage({ bgColor: [0, 0, 255] })
    expect(paperChannel(blue)[0]).toBe(0)
  })

  it('boxBlur3 preserves a uniform image', () => {
    const g = new Uint8Array(W * H).fill(100)
    const b = boxBlur3(g, W, H)
    expect(b[0]).toBe(100)
    expect(b[(H - 1) * W + (W - 1)]).toBe(100)
  })

  it('otsuThreshold separates a bimodal histogram', () => {
    const g = new Uint8Array(1000)
    g.fill(30, 0, 500)
    g.fill(220, 500)
    const t = otsuThreshold(g)
    expect(t).toBeGreaterThanOrEqual(30)
    expect(t).toBeLessThan(220)
  })
})

describe('detectPage', () => {
  it('finds an axis-aligned bright rectangle within tolerance', () => {
    const quad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const result = detectPage(makeImage({ quad }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 4)
    expect(result!.confidence).toBeGreaterThan(0.7)
  })

  it('finds a perspective-skewed page (trapezoid) within tolerance', () => {
    const quad = [
      { x: 45, y: 25 },
      { x: 118, y: 32 },
      { x: 132, y: 98 },
      { x: 32, y: 92 },
    ]
    const result = detectPage(makeImage({ quad }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 5)
    expect(result!.confidence).toBeGreaterThan(0.5)
  })

  it('survives sensor-like noise', () => {
    const quad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const result = detectPage(makeImage({ quad, noise: 18 }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 5)
  })

  it('finds a yellow page on a dark background with white-like confidence', () => {
    const quad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const result = detectPage(makeImage({ quad, fgColor: [240, 240, 60] }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 4)
    expect(result!.confidence).toBeGreaterThan(0.7)
  })

  it('finds a yellow page on a bright blue-ish background (bright in luma, dark in paper channel)', () => {
    // Background luma ≈ 195 vs page luma ≈ 207 — a luma pipeline sees almost
    // no contrast. The paper channel sees 185 vs 227 and separates cleanly.
    const quad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const result = detectPage(
      makeImage({ quad, fgColor: [230, 225, 60], bgColor: [175, 195, 255] }),
    )
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 5)
    expect(result!.confidence).toBeGreaterThan(0.5)
  })

  it('prefers the centered page over a larger off-center bright distractor', () => {
    const quad = [
      { x: 45, y: 30 },
      { x: 115, y: 30 },
      { x: 115, y: 90 },
      { x: 45, y: 90 },
    ]
    // Bright wall strip at the left edge, larger than the page (39×120 = 4680
    // px vs 70×60 = 4200 px) — the old "largest component" rule locked onto it.
    const extra = [
      { x: 0, y: 0 },
      { x: 38, y: 0 },
      { x: 38, y: 119 },
      { x: 0, y: 119 },
    ]
    const result = detectPage(makeImage({ quad, extra }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 4)
  })

  it('recovers a dim page margin that falls just below the Otsu split (threshold slack)', () => {
    // Bright-ish background pushes the Otsu split up to the dim strip level,
    // so the single-threshold pass cuts the left quarter of the page off. The
    // slack pass (Otsu − 12) keeps the full page.
    const fullQuad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const core = [
      { x: 55, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 55, y: 100 },
    ]
    const dimStrip = [
      { x: 30, y: 20 },
      { x: 55, y: 20 },
      { x: 55, y: 100 },
      { x: 30, y: 100 },
    ]
    // Otsu lands at 164 here — the 160 strip is dark to the plain pass
    // (detects tl.x ≈ 55) but bright to the slack pass at 164 − 12 = 152.
    const image = makeImage({ quad: core, fg: 220, extra: dimStrip, extraColor: [160, 160, 160], bg: 120 })
    const result = detectPage(image)
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, fullQuad, 5)
  })

  it('detects a low-contrast dim scene at the default guard but not at the old stricter one', () => {
    // Documents the minContrast 30 → 20 retune: a ~28-level separation is a
    // real (dim indoor) page, rejected by the old guard.
    const quad = [
      { x: 30, y: 20 },
      { x: 130, y: 20 },
      { x: 130, y: 100 },
      { x: 30, y: 100 },
    ]
    const image = makeImage({ quad, bg: 90, fg: 118 })
    const result = detectPage(image)
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 4)
    expect(detectPage(image, { minContrast: 30 })).toBeNull()
  })

  it('returns null for a uniform dark frame (no page)', () => {
    expect(detectPage(makeImage({ bg: 35 }))).toBeNull()
  })

  it('returns null for a uniform bright frame (page fills everything / wall)', () => {
    expect(detectPage(makeImage({ bg: 220, noise: 6 }))).toBeNull()
  })

  it('returns null for a bright region that is too small', () => {
    const quad = [
      { x: 70, y: 50 },
      { x: 90, y: 50 },
      { x: 90, y: 66 },
      { x: 70, y: 66 },
    ]
    expect(detectPage(makeImage({ quad }))).toBeNull()
  })

  it('returns null for a bright circle (not a quadrilateral)', () => {
    const data = makeImage({})
    const bytes = data.data
    const cx = 80
    const cy = 60
    const r = 42
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
          const i = (y * W + x) * 4
          bytes[i] = bytes[i + 1] = bytes[i + 2] = 235
        }
      }
    }
    expect(detectPage(data)).toBeNull()
  })

  it('returns null for a tiny image', () => {
    expect(detectPage(makeImage({ width: 8, height: 8, bg: 200 }))).toBeNull()
  })
})

describe('QuadSmoother', () => {
  const quadAt = (dx: number, confidence = 0.9): DetectedQuad => ({
    corners: [
      { x: 10 + dx, y: 10 },
      { x: 110 + dx, y: 10 },
      { x: 110 + dx, y: 90 },
      { x: 10 + dx, y: 90 },
    ],
    confidence,
  })

  it('shows only after consecutive detections (no single-frame flash)', () => {
    const s = new QuadSmoother({ showAfter: 2, hideAfter: 3 })
    expect(s.push(quadAt(0))).toBeNull()
    expect(s.push(quadAt(1))).not.toBeNull()
  })

  it('holds the last quad over brief misses, hides after hideAfter misses', () => {
    const s = new QuadSmoother({ showAfter: 2, hideAfter: 3 })
    s.push(quadAt(0))
    s.push(quadAt(0))
    expect(s.push(null)).not.toBeNull()
    expect(s.push(null)).not.toBeNull()
    expect(s.push(null)).toBeNull()
    // After hiding, a single new detection must not instantly re-show.
    expect(s.push(quadAt(0))).toBeNull()
  })

  it('smooths corners toward new detections', () => {
    const s = new QuadSmoother({ showAfter: 1, alpha: 0.5 })
    s.push(quadAt(0))
    const out = s.push(quadAt(10))!
    expect(out.corners[0].x).toBeCloseTo(15, 5)
  })

  it('a teleporting quad restarts the show gate', () => {
    const s = new QuadSmoother({ showAfter: 2, jumpFrac: 0.2 })
    s.push(quadAt(0))
    s.push(quadAt(0))
    expect(s.push(quadAt(0))).not.toBeNull()
    // Jump far beyond jumpFrac × diagonal: treated as a new candidate.
    expect(s.push(quadAt(500))).toBeNull()
  })

  it('reset clears all state', () => {
    const s = new QuadSmoother({ showAfter: 1 })
    s.push(quadAt(0))
    s.reset()
    expect(s.push(null)).toBeNull()
  })
})
