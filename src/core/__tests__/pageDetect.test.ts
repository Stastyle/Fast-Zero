import { describe, expect, it } from 'vitest'
import {
  boxBlur3,
  detectPage,
  grayscale,
  otsuThreshold,
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

/** Synthesize an RGBA frame: dark background, optional bright convex quad, mild noise. */
function makeImage(opts: {
  quad?: Vec2[]
  bg?: number
  fg?: number
  noise?: number
  width?: number
  height?: number
}): ImageDataLike {
  const width = opts.width ?? W
  const height = opts.height ?? H
  const bg = opts.bg ?? 40
  const fg = opts.fg ?? 235
  const noise = opts.noise ?? 0
  const rand = mulberry32(7)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bright = opts.quad && insideConvex({ x, y }, opts.quad)
      const v = (bright ? fg : bg) + (noise ? (rand() - 0.5) * 2 * noise : 0)
      const i = (y * width + x) * 4
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, Math.round(v)))
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

  it('excludes a sun-lit background strip that merges with the page at a single threshold', () => {
    // Page on the right, moderately bright lit surface (170) filling the same
    // rows to its left — 4-connected to the page and above the base Otsu
    // threshold, so a single-threshold detector returns the merged (wrong,
    // wider) rectangle. The second-stage threshold must isolate the paper.
    const quad = [
      { x: 60, y: 20 },
      { x: 150, y: 20 },
      { x: 150, y: 100 },
      { x: 60, y: 100 },
    ]
    const img = makeImage({ quad })
    const bytes = img.data
    for (let y = 20; y <= 100; y++) {
      for (let x = 0; x < 60; x++) {
        const i = (y * W + x) * 4
        bytes[i] = bytes[i + 1] = bytes[i + 2] = 170
      }
    }
    const result = detectPage(img)
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 5)
  })

  it('locates an A4-proportioned page to within a pixel and a half', () => {
    // 60×85 ≈ the 21:29.7 ratio the detector now expects. The per-side line fit
    // averages over ~150 edge pixels, so corners land far inside one pixel of
    // the detection grid — which is what the px→cm mapping is built from.
    const quad = [
      { x: 50, y: 15 },
      { x: 110, y: 15 },
      { x: 110, y: 100 },
      { x: 50, y: 100 },
    ]
    const result = detectPage(makeImage({ quad, noise: 10 }))
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 1.5)
    // High enough for the camera screen to measure from it without asking.
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('a bright nick at a corner no longer drags that corner out', () => {
    // A glare bridge or a scrap of paper touching the sheet becomes part of the
    // component. Diagonal extremes hand the corner straight to the intruder;
    // the trimmed per-side fit outvotes it with the real edge pixels.
    const quad = [
      { x: 30, y: 25 },
      { x: 130, y: 25 },
      { x: 130, y: 105 },
      { x: 30, y: 105 },
    ]
    const img = makeImage({ quad })
    const bytes = img.data
    for (let y = 19; y <= 24; y++) {
      for (let x = 130; x <= 135; x++) {
        const i = (y * W + x) * 4
        bytes[i] = bytes[i + 1] = bytes[i + 2] = 235
      }
    }
    const result = detectPage(img)
    expect(result).not.toBeNull()
    // The nick's tip sits 7px away on the diagonal; the corner must stay put.
    expect(Math.hypot(result!.corners[1].x - 130, result!.corners[1].y - 25)).toBeLessThan(2)
  })

  it('rejects a bright region whose shape is nothing like a sheet of A4', () => {
    // Page fully merged with an equally bright lit surface: there is no second
    // threshold that separates them, so the only safe answer is "no page".
    const quad = [
      { x: 20, y: 40 },
      { x: 150, y: 40 },
      { x: 150, y: 85 },
      { x: 20, y: 85 },
    ]
    expect(detectPage(makeImage({ quad }))).toBeNull()
  })

  it('finds the page next to a lit region even when the merged shape is not a quad', () => {
    // The lit strip spans only part of the page's rows → the merged component
    // is L-shaped and fails validation outright at the base threshold.
    const quad = [
      { x: 60, y: 20 },
      { x: 150, y: 20 },
      { x: 150, y: 100 },
      { x: 60, y: 100 },
    ]
    const img = makeImage({ quad })
    const bytes = img.data
    for (let y = 55; y <= 100; y++) {
      for (let x = 0; x < 60; x++) {
        const i = (y * W + x) * 4
        bytes[i] = bytes[i + 1] = bytes[i + 2] = 175
      }
    }
    const result = detectPage(img)
    expect(result).not.toBeNull()
    expectCornersClose(result!.corners, quad, 5)
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
