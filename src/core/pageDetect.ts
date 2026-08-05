import type { Vec2 } from './types'

/**
 * Live zeroing-page boundary detection.
 *
 * Pure pixel-data functions (no DOM, no dependencies) so the algorithm is
 * unit-testable. The caller downscales a video frame to a small canvas
 * (~160–240px wide), passes its ImageData here, and gets back the page
 * quadrilateral in detection-image pixels.
 *
 * Approach — the zeroing page is bright white paper against a darker
 * background, so brightness is the primary signal:
 *   1. grayscale + light 3×3 box blur (sensor noise)
 *   2. Otsu threshold → bright/dark mask; reject low-contrast scenes
 *   3. largest 4-connected bright component
 *   4. corners via the diagonal-extremes method (min/max of x+y and x−y)
 *   5. validate: area, side lengths, and how well the component fills its
 *      corner quad (rejects blobs / circles / L-shapes)
 */

/** Minimal ImageData shape (RGBA byte order), constructible in tests without a DOM. */
export interface ImageDataLike {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

export interface DetectedQuad {
  /** Page corners in detection-image pixels, ordered [tl, tr, br, bl]. */
  corners: [Vec2, Vec2, Vec2, Vec2]
  /** Heuristic 0..1 — how quad-like and well-separated the bright region is. */
  confidence: number
}

export interface DetectOptions {
  /** Bright region must cover at least this fraction of the frame. */
  minAreaFrac?: number
  /** Minimum gray-level gap between the bright and dark classes (0–255). */
  minContrast?: number
  /** Component must fill at least this fraction of its corner quad. */
  minFillRatio?: number
}

const DEFAULTS: Required<DetectOptions> = {
  minAreaFrac: 0.08,
  minContrast: 30,
  minFillRatio: 0.65,
}

/** Region may exceed its corner quad a little (aliasing), but a circle (π/2 ≈ 1.57) must fail. */
const MAX_FILL_RATIO = 1.35

/** RGBA → luminance (integer Rec.601 approximation), 0–255. */
export function grayscale(image: ImageDataLike): Uint8Array {
  const { data, width, height } = image
  const out = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (77 * data[p] + 150 * data[p + 1] + 29 * data[p + 2]) >> 8
  }
  return out
}

/** Separable 3×3 box blur with clamped edges. */
export function boxBlur3(gray: Uint8Array, width: number, height: number): Uint8Array {
  const tmp = new Uint8Array(gray.length)
  const out = new Uint8Array(gray.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const l = gray[row + Math.max(0, x - 1)]
      const c = gray[row + x]
      const r = gray[row + Math.min(width - 1, x + 1)]
      tmp[row + x] = (l + c + r) / 3
    }
  }
  for (let y = 0; y < height; y++) {
    const up = Math.max(0, y - 1) * width
    const mid = y * width
    const down = Math.min(height - 1, y + 1) * width
    for (let x = 0; x < width; x++) {
      out[mid + x] = (tmp[up + x] + tmp[mid + x] + tmp[down + x]) / 3
    }
  }
  return out
}

/** Otsu's threshold over a 256-bin histogram (maximises inter-class variance). */
export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  let sumAll = 0
  for (let v = 0; v < 256; v++) sumAll += v * hist[v]
  let sumBelow = 0
  let countBelow = 0
  let best = 127
  let bestVariance = -1
  for (let t = 0; t < 256; t++) {
    countBelow += hist[t]
    if (countBelow === 0) continue
    const countAbove = total - countBelow
    if (countAbove === 0) break
    sumBelow += t * hist[t]
    const meanBelow = sumBelow / countBelow
    const meanAbove = (sumAll - sumBelow) / countAbove
    const variance = countBelow * countAbove * (meanBelow - meanAbove) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }
  return best
}

/** Signed shoelace area (positive for [tl,tr,br,bl] order in y-down coords). */
function quadArea(pts: Vec2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Detect the page as the dominant bright quadrilateral.
 * Returns corners in detection-image pixels, or null when nothing page-like
 * is present with enough confidence.
 */
export function detectPage(image: ImageDataLike, opts: DetectOptions = {}): DetectedQuad | null {
  const { minAreaFrac, minContrast, minFillRatio } = { ...DEFAULTS, ...opts }
  const w = image.width
  const h = image.height
  if (w < 16 || h < 16) return null

  const blur = boxBlur3(grayscale(image), w, h)
  const threshold = otsuThreshold(blur)

  // Contrast guard: a uniform scene (all sky, all table) still yields an Otsu
  // split, but the two class means sit close together — reject it.
  let loSum = 0
  let loN = 0
  let hiSum = 0
  let hiN = 0
  for (let i = 0; i < blur.length; i++) {
    if (blur[i] > threshold) {
      hiSum += blur[i]
      hiN++
    } else {
      loSum += blur[i]
      loN++
    }
  }
  if (hiN === 0 || loN === 0) return null
  const contrast = hiSum / hiN - loSum / loN
  if (contrast < minContrast) return null

  // Largest 4-connected bright component (iterative flood fill).
  const labels = new Int32Array(w * h) // 0 = unvisited/dark, >0 = component id
  const stack = new Int32Array(w * h)
  let bestLabel = 0
  let bestSize = 0
  let nextLabel = 0
  for (let start = 0; start < blur.length; start++) {
    if (blur[start] <= threshold || labels[start] !== 0) continue
    const label = ++nextLabel
    let size = 0
    let top = 0
    stack[top++] = start
    labels[start] = label
    while (top > 0) {
      const i = stack[--top]
      size++
      const x = i % w
      if (x > 0 && labels[i - 1] === 0 && blur[i - 1] > threshold) {
        labels[i - 1] = label
        stack[top++] = i - 1
      }
      if (x < w - 1 && labels[i + 1] === 0 && blur[i + 1] > threshold) {
        labels[i + 1] = label
        stack[top++] = i + 1
      }
      if (i >= w && labels[i - w] === 0 && blur[i - w] > threshold) {
        labels[i - w] = label
        stack[top++] = i - w
      }
      if (i < blur.length - w && labels[i + w] === 0 && blur[i + w] > threshold) {
        labels[i + w] = label
        stack[top++] = i + w
      }
    }
    if (size > bestSize) {
      bestSize = size
      bestLabel = label
    }
  }
  if (bestSize < minAreaFrac * w * h) return null

  // Corner extraction: diagonal extremes of the component. Robust for the
  // roughly frame-aligned page (rotations well below 45°).
  let tlScore = Infinity
  let brScore = -Infinity
  let trScore = -Infinity
  let blScore = Infinity
  let tl: Vec2 = { x: 0, y: 0 }
  let br: Vec2 = { x: 0, y: 0 }
  let tr: Vec2 = { x: 0, y: 0 }
  let bl: Vec2 = { x: 0, y: 0 }
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== bestLabel) continue
    const x = i % w
    const y = (i - x) / w
    const sum = x + y
    const diff = x - y
    if (sum < tlScore) {
      tlScore = sum
      tl = { x, y }
    }
    if (sum > brScore) {
      brScore = sum
      br = { x, y }
    }
    if (diff > trScore) {
      trScore = diff
      tr = { x, y }
    }
    if (diff < blScore) {
      blScore = diff
      bl = { x, y }
    }
  }

  const corners: [Vec2, Vec2, Vec2, Vec2] = [tl, tr, br, bl]

  // Degenerate quads: every side must have real length.
  const minSide = 0.08 * Math.min(w, h)
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    if (Math.hypot(a.x - b.x, a.y - b.y) < minSide) return null
  }

  // Fill ratio: a genuine (convex) page fills its corner quad almost fully;
  // arbitrary blobs do not.
  const area = quadArea(corners)
  if (area < 1) return null
  const fillRatio = bestSize / area
  if (fillRatio < minFillRatio || fillRatio > MAX_FILL_RATIO) return null

  const fillScore = clamp01((Math.min(fillRatio, 1) - minFillRatio) / (0.95 - minFillRatio))
  const contrastScore = clamp01(contrast / 80)
  const confidence = fillScore * (0.5 + 0.5 * contrastScore)
  return { corners, confidence }
}

export interface SmootherOptions {
  /** Consecutive detections required before the quad is shown. */
  showAfter?: number
  /** Consecutive misses tolerated before the quad is hidden. */
  hideAfter?: number
  /** Exponential smoothing weight of the newest detection (0..1]. */
  alpha?: number
  /** Corner jump beyond this fraction of the quad diagonal restarts smoothing. */
  jumpFrac?: number
}

/**
 * Temporal smoothing + hysteresis so the overlay neither flickers on brief
 * misses nor jitters with per-frame noise. Pure state machine — feed it one
 * detection result per tick, render whatever it returns.
 */
export class QuadSmoother {
  private readonly showAfter: number
  private readonly hideAfter: number
  private readonly alpha: number
  private readonly jumpFrac: number
  private smoothed: DetectedQuad | null = null
  private hits = 0
  private misses = 0

  constructor(opts: SmootherOptions = {}) {
    this.showAfter = opts.showAfter ?? 2
    this.hideAfter = opts.hideAfter ?? 3
    this.alpha = opts.alpha ?? 0.45
    this.jumpFrac = opts.jumpFrac ?? 0.3
  }

  push(quad: DetectedQuad | null): DetectedQuad | null {
    if (quad) {
      this.misses = 0
      const prev = this.smoothed
      if (prev && this.maxJump(prev, quad) <= this.jumpFrac * this.diagonal(prev)) {
        const a = this.alpha
        this.smoothed = {
          corners: prev.corners.map((p, i) => ({
            x: p.x + (quad.corners[i].x - p.x) * a,
            y: p.y + (quad.corners[i].y - p.y) * a,
          })) as DetectedQuad['corners'],
          confidence: quad.confidence,
        }
        this.hits++
      } else {
        // New or teleported quad: restart both smoothing and the show gate.
        this.smoothed = quad
        this.hits = 1
      }
    } else {
      this.misses++
      if (this.misses >= this.hideAfter) {
        this.smoothed = null
        this.hits = 0
      }
      // Below hideAfter: keep returning the last quad (no flicker).
    }
    return this.hits >= this.showAfter ? this.smoothed : null
  }

  reset(): void {
    this.smoothed = null
    this.hits = 0
    this.misses = 0
  }

  private diagonal(q: DetectedQuad): number {
    const [tl, , br] = q.corners
    return Math.hypot(br.x - tl.x, br.y - tl.y) || 1
  }

  private maxJump(a: DetectedQuad, b: DetectedQuad): number {
    let m = 0
    for (let i = 0; i < 4; i++) {
      m = Math.max(
        m,
        Math.hypot(a.corners[i].x - b.corners[i].x, a.corners[i].y - b.corners[i].y),
      )
    }
    return m
  }
}
