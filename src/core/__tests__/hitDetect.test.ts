import { describe, expect, it } from 'vitest'
import { detectHits } from '../hitDetect'
import type { ImageDataLike } from '../pageDetect'
import type { Vec2 } from '../types'

const W = 320
const H = 240

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

/** Bright "paper" frame with optional noise. */
function makePage(opts: { paper?: number; noise?: number; width?: number; height?: number } = {}): ImageDataLike {
  const width = opts.width ?? W
  const height = opts.height ?? H
  const paper = opts.paper ?? 235
  const noise = opts.noise ?? 0
  const rand = mulberry32(11)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = paper + (noise ? (rand() - 0.5) * 2 * noise : 0)
    const p = i * 4
    data[p] = data[p + 1] = data[p + 2] = Math.max(0, Math.min(255, Math.round(v)))
    data[p + 3] = 255
  }
  return { data, width, height }
}

/** Paint a filled dark disc (a bullet hole). */
function paintDisc(img: ImageDataLike, cx: number, cy: number, r: number, value = 20): void {
  for (let y = Math.max(0, cy - r); y <= Math.min(img.height - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(img.width - 1, cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        const p = (y * img.width + x) * 4
        img.data[p] = img.data[p + 1] = img.data[p + 2] = value
      }
    }
  }
}

/** Paint a filled dark axis-aligned rectangle. */
function paintRect(
  img: ImageDataLike,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value = 20,
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = (y * img.width + x) * 4
      img.data[p] = img.data[p + 1] = img.data[p + 2] = value
    }
  }
}

function closestDistance(hits: { center: Vec2 }[], p: Vec2): number {
  return Math.min(...hits.map((h) => Math.hypot(h.center.x - p.x, h.center.y - p.y)))
}

describe('detectHits', () => {
  it('finds a group of holes at their centers', () => {
    const img = makePage()
    const holes = [
      { x: 100, y: 80 },
      { x: 130, y: 95 },
      { x: 112, y: 120 },
      { x: 160, y: 70 },
    ]
    for (const c of holes) paintDisc(img, c.x, c.y, 5)
    const hits = detectHits(img)
    expect(hits).toHaveLength(4)
    for (const c of holes) expect(closestDistance(hits, c)).toBeLessThanOrEqual(2)
    for (const hit of hits) expect(hit.confidence).toBeGreaterThan(0.5)
  })

  it('survives sensor-like noise', () => {
    const img = makePage({ noise: 18 })
    paintDisc(img, 150, 110, 5)
    const hits = detectHits(img)
    expect(hits).toHaveLength(1)
    expect(closestDistance(hits, { x: 150, y: 110 })).toBeLessThanOrEqual(2)
  })

  it('ignores the large printed aiming shape', () => {
    const img = makePage()
    paintDisc(img, 160, 120, 45) // printed target blob — far above maxDiamFrac
    paintDisc(img, 60, 60, 5) // a real hole beside it
    const hits = detectHits(img)
    expect(hits).toHaveLength(1)
    expect(closestDistance(hits, { x: 60, y: 60 })).toBeLessThanOrEqual(2)
  })

  it('ignores thin printed lines (grid / border rules)', () => {
    const img = makePage()
    paintRect(img, 40, 100, 280, 102, 20) // long horizontal rule
    expect(detectHits(img)).toHaveLength(0)
  })

  it('ignores dark regions touching the frame border (shadows, background)', () => {
    const img = makePage()
    paintRect(img, 0, 0, 12, H - 1, 20) // background sliver along one edge
    expect(detectHits(img)).toHaveLength(0)
  })

  it('returns nothing for a clean page', () => {
    expect(detectHits(makePage({ noise: 10 }))).toHaveLength(0)
  })

  it('returns nothing when the photo is too dark to trust', () => {
    const img = makePage({ paper: 70 })
    paintDisc(img, 100, 100, 5, 5)
    expect(detectHits(img)).toHaveLength(0)
  })

  it('returns nothing for a tiny image', () => {
    expect(detectHits(makePage({ width: 16, height: 16 }))).toHaveLength(0)
  })

  it('caps the number of returned candidates', () => {
    const img = makePage()
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        paintDisc(img, 40 + col * 45, 40 + row * 40, 5)
      }
    }
    expect(detectHits(img).length).toBeLessThanOrEqual(20)
  })
})
