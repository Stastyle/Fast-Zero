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
 *   3. lighting guard: if the bright class is itself bimodal (paper AND a
 *      sun-lit table/wall crossed the base threshold), a second-stage Otsu
 *      inside the bright class separates paper from lit background — the
 *      stricter threshold is tried first so the background never gets
 *      counted as part of the page
 *   4. largest 4-connected bright component
 *   5. seed corners via the diagonal-extremes method (min/max of x+y and x−y)
 *   6. refine each side by a trimmed least-squares fit over the component's
 *      boundary pixels, then intersect adjacent sides for sub-pixel corners —
 *      the seed is a max-based estimator that a single stray bright pixel can
 *      drag a long way; the fit averages over hundreds of edge pixels
 *   7. validate: area, side lengths, convexity, corner angles, opposite-side
 *      ratio, A4-like aspect, and how well the component fills its corner quad
 *      (rejects blobs / circles / L-shapes / page-merged-with-background)
 *
 * IMPORTANT for callers rendering a live overlay: pass ImageData of the region
 * the user actually SEES. A preview drawn with object-fit: cover hides a large
 * part of the sensor frame, and bright objects hidden there merge with the page
 * and blow the quad outward for no reason visible on screen.
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

/** ISO A4 long/short side ratio — the shape prior every candidate must satisfy. */
const A4_ASPECT = 297 / 210

/**
 * How far the observed width/height ratio may stray from A4 (or its
 * reciprocal). Tilting the camera foreshortens one axis — 1.45 still admits
 * roughly a 45° tilt, while rejecting the wide, skewed quads produced when the
 * page merges with a lit table or a second sheet.
 */
const A4_ASPECT_TOLERANCE = 1.45

/** Opposite sides of a page seen in perspective stay comparable in length. */
const MIN_OPPOSITE_SIDE_RATIO = 0.6

/** A projected rectangle keeps its corners well away from degenerate angles. */
const MIN_CORNER_ANGLE_DEG = 55
const MAX_CORNER_ANGLE_DEG = 125

/**
 * Per-side RMS fit residual (as a fraction of the mean side length) at which
 * the straightness term of the confidence reaches zero. Sensor noise on a real
 * edge lands near 0.01; a staircase edge from a merged region lands far higher.
 */
const EDGE_RESIDUAL_SCALE = 0.08

/** Refined corners further than this (× mean side) from their seed mean the fit ran away. */
const MAX_CORNER_DRIFT_FRAC = 0.3

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

/** 256-bin histogram of a grayscale buffer. */
function histogramOf(gray: Uint8Array): Uint32Array {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  return hist
}

/** Otsu's threshold restricted to histogram bins lo..hi (maximises inter-class variance). */
function otsuOfRange(hist: Uint32Array, lo: number, hi: number): number {
  let total = 0
  let sumAll = 0
  for (let v = lo; v <= hi; v++) {
    total += hist[v]
    sumAll += v * hist[v]
  }
  let sumBelow = 0
  let countBelow = 0
  let best = (lo + hi) >> 1
  let bestVariance = -1
  for (let t = lo; t <= hi; t++) {
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

/** Otsu's threshold over a 256-bin histogram (maximises inter-class variance). */
export function otsuThreshold(gray: Uint8Array): number {
  return otsuOfRange(histogramOf(gray), 0, 255)
}

/**
 * Second-stage Otsu inside the bright class only. Returns the stricter
 * threshold and the gray-level gap between its two sub-classes — a large gap
 * means the "bright" pixels are really two surfaces (paper + lit background).
 */
function brightClassSplit(
  hist: Uint32Array,
  base: number,
): { threshold: number; gap: number } | null {
  if (base >= 254) return null
  const t = otsuOfRange(hist, base + 1, 255)
  if (t <= base || t >= 255) return null
  let loSum = 0
  let loN = 0
  let hiSum = 0
  let hiN = 0
  for (let v = base + 1; v <= 255; v++) {
    if (v > t) {
      hiSum += v * hist[v]
      hiN += hist[v]
    } else {
      loSum += v * hist[v]
      loN += hist[v]
    }
  }
  if (loN === 0 || hiN === 0) return null
  return { threshold: t, gap: hiSum / hiN - loSum / loN }
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

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y)

/** A line as a point on it plus a unit direction. */
interface Line {
  c: Vec2
  d: Vec2
}

/**
 * Total-least-squares line through the points (principal axis of their
 * covariance) — unlike y-on-x regression this handles vertical sides.
 */
function fitLine(pts: Vec2[]): Line | null {
  const n = pts.length
  if (n < 2) return null
  let mx = 0
  let my = 0
  for (const p of pts) {
    mx += p.x
    my += p.y
  }
  mx /= n
  my /= n
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of pts) {
    const dx = p.x - mx
    const dy = p.y - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx + syy < 1e-9) return null
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return { c: { x: mx, y: my }, d: { x: Math.cos(theta), y: Math.sin(theta) } }
}

/** Perpendicular distance from a point to a line. */
function lineResidual(line: Line, p: Vec2): number {
  return Math.abs((p.x - line.c.x) * line.d.y - (p.y - line.c.y) * line.d.x)
}

/** Intersection of two lines, or null when they are (near) parallel. */
function intersectLines(a: Line, b: Line): Vec2 | null {
  const den = a.d.x * b.d.y - a.d.y * b.d.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((b.c.x - a.c.x) * b.d.y - (b.c.y - a.c.y) * b.d.x) / den
  return { x: a.c.x + t * a.d.x, y: a.c.y + t * a.d.y }
}

/** Value at the given quantile of an unsorted numeric array. */
function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}

/** Boundary pixels of one labelled component (4-neighbourhood; image edges count). */
function boundaryOf(labels: Int32Array, w: number, h: number, label: number): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== label) continue
    const x = i % w
    const y = (i - x) / w
    if (
      x === 0 ||
      y === 0 ||
      x === w - 1 ||
      y === h - 1 ||
      labels[i - 1] !== label ||
      labels[i + 1] !== label ||
      labels[i - w] !== label ||
      labels[i + w] !== label
    ) {
      out.push({ x, y })
    }
  }
  return out
}

/**
 * Refine a seed quad by fitting a line to each side's boundary pixels and
 * intersecting adjacent sides. Returns sub-pixel corners plus the mean RMS fit
 * residual (as a fraction of the mean side length) — a straightness measure
 * that separates a real page edge from the staircase of a merged region.
 */
function refineQuad(
  boundary: Vec2[],
  seed: Vec2[],
): { corners: [Vec2, Vec2, Vec2, Vec2]; residual: number } | null {
  const sideLen = seed.map((p, i) => dist(p, seed[(i + 1) % 4]))
  const meanSide = (sideLen[0] + sideLen[1] + sideLen[2] + sideLen[3]) / 4
  if (meanSide < 4) return null
  // Wide enough to capture the true edge when the seed is a pixel or two off,
  // narrow enough not to swallow the opposite side of a thin page.
  const band = Math.max(2, Math.min(12, 0.07 * meanSide))
  const lines: Line[] = []
  let residualSum = 0

  for (let i = 0; i < 4; i++) {
    const a = seed[i]
    const b = seed[(i + 1) % 4]
    const len = sideLen[i]
    if (len < 1) return null
    const ux = (b.x - a.x) / len
    const uy = (b.y - a.y) / len
    // Skip the ends: rounded/clipped corners would bend the fit.
    const tMin = 0.08 * len
    const tMax = 0.92 * len
    const near: Vec2[] = []
    for (const p of boundary) {
      const dx = p.x - a.x
      const dy = p.y - a.y
      const t = dx * ux + dy * uy
      if (t < tMin || t > tMax) continue
      if (Math.abs(dx * -uy + dy * ux) > band) continue
      near.push(p)
    }
    if (near.length < 8) return null

    let line = fitLine(near)
    if (!line) return null
    // One trimming pass: drop the worst quarter (glare bleed, a nicked corner,
    // the odd bright speck) and refit on what is left.
    const first = line
    const residuals = near.map((p) => lineResidual(first, p))
    const cutoff = quantile(residuals, 0.75)
    const kept = near.filter((_, k) => residuals[k] <= cutoff)
    if (kept.length >= 8) {
      const refit = fitLine(kept)
      if (refit) line = refit
    }
    const scoring = kept.length >= 8 ? kept : near
    const fitted = line
    let sq = 0
    for (const p of scoring) sq += lineResidual(fitted, p) ** 2
    residualSum += Math.sqrt(sq / scoring.length) / meanSide
    lines.push(line)
  }

  const corners: Vec2[] = []
  for (let i = 0; i < 4; i++) {
    // Corner i is where the side arriving at it meets the side leaving it.
    const p = intersectLines(lines[(i + 3) % 4], lines[i])
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null
    if (dist(p, seed[i]) > MAX_CORNER_DRIFT_FRAC * meanSide) return null
    corners.push(p)
  }
  return {
    corners: corners as [Vec2, Vec2, Vec2, Vec2],
    residual: residualSum / 4,
  }
}

/**
 * Shape prior: the quad must look like an A4 sheet seen from a plausible
 * angle. Rejects the wide, skewed quads that come out of a page merged with a
 * lit table, a second sheet, or a window.
 */
function isPageShaped(corners: Vec2[]): boolean {
  // Convexity — every turn must go the same way.
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = corners[i]
    const b = corners[(i + 1) % 4]
    const c = corners[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) return false
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }

  // Corner angles well away from degenerate.
  for (let i = 0; i < 4; i++) {
    const prev = corners[(i + 3) % 4]
    const cur = corners[i]
    const next = corners[(i + 1) % 4]
    const ax = prev.x - cur.x
    const ay = prev.y - cur.y
    const bx = next.x - cur.x
    const by = next.y - cur.y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) return false
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))
    const angle = (Math.acos(cos) * 180) / Math.PI
    if (angle < MIN_CORNER_ANGLE_DEG || angle > MAX_CORNER_ANGLE_DEG) return false
  }

  const [tl, tr, br, bl] = corners
  const top = dist(tl, tr)
  const bottom = dist(bl, br)
  const left = dist(tl, bl)
  const right = dist(tr, br)
  if (Math.min(top, bottom) / Math.max(top, bottom) < MIN_OPPOSITE_SIDE_RATIO) return false
  if (Math.min(left, right) / Math.max(left, right) < MIN_OPPOSITE_SIDE_RATIO) return false

  // A4-like aspect, in either orientation.
  const aspect = (top + bottom) / (left + right)
  const target = aspect >= 1 ? A4_ASPECT : 1 / A4_ASPECT
  const off = Math.max(aspect / target, target / aspect)
  return off <= A4_ASPECT_TOLERANCE
}

/**
 * Minimum gray-level gap between the two bright sub-classes for the scene to
 * count as "paper + lit background". Sensor noise after the blur splits at a
 * few gray levels; a genuinely lit table/wall sits 40+ below the paper.
 */
const BRIGHT_SPLIT_MIN_GAP = 25

/**
 * Detect the page as the dominant bright quadrilateral.
 * Returns corners in detection-image pixels, or null when nothing page-like
 * is present with enough confidence.
 */
export function detectPage(image: ImageDataLike, opts: DetectOptions = {}): DetectedQuad | null {
  const resolved = { ...DEFAULTS, ...opts }
  const w = image.width
  const h = image.height
  if (w < 16 || h < 16) return null

  const blur = boxBlur3(grayscale(image), w, h)
  const hist = histogramOf(blur)
  const base = otsuOfRange(hist, 0, 255)

  // Uneven lighting: a sun-lit table/wall can cross the base threshold and
  // 4-connect with the paper, so the merged region "becomes the page". When
  // the bright class is genuinely bimodal, the stricter second-stage
  // threshold isolates the paper — prefer it whenever it yields a valid quad.
  const split = brightClassSplit(hist, base)
  if (split && split.gap >= BRIGHT_SPLIT_MIN_GAP) {
    const strict = quadAtThreshold(blur, w, h, split.threshold, resolved)
    if (strict) return strict
  }
  const atBase = quadAtThreshold(blur, w, h, base, resolved)
  if (atBase) return atBase
  // Neither extreme separated the page: one intermediate cut often does, e.g.
  // a shadow gradient across the sheet itself.
  if (split) {
    const mid = Math.round((base + split.threshold) / 2)
    if (mid > base && mid < split.threshold) {
      return quadAtThreshold(blur, w, h, mid, resolved)
    }
  }
  return null
}

/** One full detection pass (mask → component → corners → validation) at a fixed threshold. */
function quadAtThreshold(
  blur: Uint8Array,
  w: number,
  h: number,
  threshold: number,
  { minAreaFrac, minContrast, minFillRatio }: Required<DetectOptions>,
): DetectedQuad | null {
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

  const seed: [Vec2, Vec2, Vec2, Vec2] = [tl, tr, br, bl]

  // Degenerate quads: every side must have real length.
  const minSide = 0.08 * Math.min(w, h)
  for (let i = 0; i < 4; i++) {
    const a = seed[i]
    const b = seed[(i + 1) % 4]
    if (Math.hypot(a.x - b.x, a.y - b.y) < minSide) return null
  }

  // Sub-pixel corners from the component's actual edges. The seed above is a
  // max over the component, so one stray bright pixel moves a corner by its
  // full offset; the per-side fit averages that away.
  const refined = refineQuad(boundaryOf(labels, w, h, bestLabel), seed)
  if (!refined) return null
  const corners = refined.corners

  if (!isPageShaped(corners)) return null

  // Fill ratio: a genuine (convex) page fills its corner quad almost fully;
  // arbitrary blobs do not.
  const area = quadArea(corners)
  if (area < 1) return null
  const fillRatio = bestSize / area
  if (fillRatio < minFillRatio || fillRatio > MAX_FILL_RATIO) return null

  const fillScore = clamp01((Math.min(fillRatio, 1) - minFillRatio) / (0.95 - minFillRatio))
  const contrastScore = clamp01(contrast / 80)
  const straightScore = clamp01(1 - refined.residual / EDGE_RESIDUAL_SCALE)
  const confidence = fillScore * (0.5 + 0.5 * contrastScore) * (0.4 + 0.6 * straightScore)
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
