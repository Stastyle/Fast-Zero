import { describe, expect, it } from 'vitest'
import { detectHoles, type HoleCandidate } from '../holeDetect'
import type { ImageDataLike } from '../pageDetect'
import type { Vec2 } from '../types'

const W = 320
const H = 240

interface Dot {
  x: number
  y: number
  r: number
  /** Gray value of the dot (default near-black). */
  v?: number
}

interface DarkRect {
  x: number
  y: number
  w: number
  h: number
  v?: number
}

/** Synthesize an RGBA frame: bright page, optional dark dots / rectangles. */
function makePage(opts: {
  page?: number
  dots?: Dot[]
  rects?: DarkRect[]
  width?: number
  height?: number
}): ImageDataLike {
  const width = opts.width ?? W
  const height = opts.height ?? H
  const page = opts.page ?? 230
  const data = new Uint8ClampedArray(width * height * 4)
  const put = (x: number, y: number, v: number) => {
    const i = (y * width + x) * 4
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = 255
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) put(x, y, page)
  }
  for (const rect of opts.rects ?? []) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) put(x, y, rect.v ?? 20)
      }
    }
  }
  for (const dot of opts.dots ?? []) {
    for (let y = Math.floor(dot.y - dot.r); y <= Math.ceil(dot.y + dot.r); y++) {
      for (let x = Math.floor(dot.x - dot.r); x <= Math.ceil(dot.x + dot.r); x++) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue
        if ((x - dot.x) ** 2 + (y - dot.y) ** 2 <= dot.r * dot.r) put(x, y, dot.v ?? 20)
      }
    }
  }
  return { data, width, height }
}

function expectCenterNear(found: HoleCandidate[], p: Vec2, tol: number) {
  const best = found.reduce(
    (min, c) => Math.min(min, Math.hypot(c.center.x - p.x, c.center.y - p.y)),
    Infinity,
  )
  expect(best).toBeLessThanOrEqual(tol)
}

describe('detectHoles', () => {
  it('finds N dark dots on a bright page, centers within tolerance', () => {
    const dots: Dot[] = [
      { x: 80.5, y: 60.5, r: 4 },
      { x: 200, y: 90, r: 5 },
      { x: 140, y: 170, r: 3 },
    ]
    const found = detectHoles(makePage({ dots }))
    expect(found).toHaveLength(3)
    for (const d of dots) expectCenterNear(found, d, 1.5)
    for (const c of found) {
      expect(c.radius).toBeGreaterThan(1.5)
      expect(c.radius).toBeLessThan(10)
      expect(c.confidence).toBeGreaterThan(0)
      expect(c.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('is sorted strongest-first: a crisp dark dot outranks a faint one', () => {
    const strong = { x: 80, y: 60, r: 5, v: 15 }
    const faint = { x: 220, y: 160, r: 5, v: 155 }
    const found = detectHoles(makePage({ dots: [faint, strong] }))
    expect(found).toHaveLength(2)
    expect(Math.hypot(found[0].center.x - strong.x, found[0].center.y - strong.y)).toBeLessThan(2)
    expect(found[0].confidence).toBeGreaterThan(found[1].confidence)
  })

  it('returns nothing on a clean page', () => {
    expect(detectHoles(makePage({}))).toHaveLength(0)
  })

  it('returns nothing on a uniform dark frame (not a page)', () => {
    expect(detectHoles(makePage({ page: 45 }))).toHaveLength(0)
  })

  it('rejects a large dark region (shadow / margin), keeps real dots', () => {
    const image = makePage({
      rects: [{ x: 60, y: 50, w: 70, h: 70 }],
      dots: [{ x: 240, y: 180, r: 4 }],
    })
    const found = detectHoles(image)
    expect(found).toHaveLength(1)
    expectCenterNear(found, { x: 240, y: 180 }, 1.5)
  })

  it('rejects an elongated dark streak (pen line / scratch)', () => {
    const found = detectHoles(makePage({ rects: [{ x: 100, y: 120, w: 48, h: 3 }] }))
    expect(found).toHaveLength(0)
  })

  it('excludes blobs touching the image border', () => {
    const found = detectHoles(
      makePage({
        dots: [
          { x: 2, y: 120, r: 4 }, // clipped by the left edge
          { x: 160, y: 1, r: 4 }, // clipped by the top edge
          { x: 160, y: 120, r: 4 }, // fully interior — the only keeper
        ],
      }),
    )
    expect(found).toHaveLength(1)
    expectCenterNear(found, { x: 160, y: 120 }, 1.5)
  })

  it('caps the candidate list at maxCandidates', () => {
    const dots: Dot[] = []
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        dots.push({ x: 40 + col * 55, y: 40 + row * 50, r: 4 })
      }
    }
    expect(dots).toHaveLength(20)
    const found = detectHoles(makePage({ dots }))
    expect(found).toHaveLength(15)
    const fewer = detectHoles(makePage({ dots }), { maxCandidates: 5 })
    expect(fewer).toHaveLength(5)
  })

  it('returns nothing for a tiny image', () => {
    expect(detectHoles(makePage({ width: 16, height: 16 }))).toHaveLength(0)
  })

  it('is deterministic', () => {
    const image = makePage({ dots: [{ x: 100, y: 100, r: 4 }] })
    const a = detectHoles(image)
    const b = detectHoles(image)
    expect(a).toEqual(b)
  })
})
