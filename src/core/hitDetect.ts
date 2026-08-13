import type { Vec2 } from './types'
import { boxBlur3, grayscale } from './pageDetect'
import type { ImageDataLike } from './pageDetect'

/**
 * Automatic bullet-hole detection on a captured zeroing page.
 *
 * Pure pixel-data functions (no DOM, no dependencies) so the algorithm is
 * unit-testable — same contract as pageDetect: the caller downscales the
 * photo to a small canvas (~480px wide), passes its ImageData here, and gets
 * back hole candidates in detection-image pixels.
 *
 * Approach — holes are small dark round blobs on bright paper:
 *   1. grayscale + light 3×3 box blur (sensor noise)
 *   2. paper level = median gray (the photo is cropped to the page, so paper
 *      dominates); dark mask = pixels well below it
 *   3. 4-connected dark components with size / aspect / roundness filters —
 *      rejects printed target graphics (too big), grid lines and text (too
 *      elongated / not round), and border shadows (touch the frame edge)
 *   4. confidence from roundness + darkness; sorted, capped
 *
 * Best-effort by design: holes inside the printed black aiming shape are
 * invisible to this signal, and the user always reviews the result.
 */

export interface DetectedHit {
  /** Hole center in detection-image pixels. */
  center: Vec2
  /** Approximate hole radius in detection-image pixels. */
  radius: number
  /** Heuristic 0..1 — how round and how dark the blob is. */
  confidence: number
}

export interface HitDetectOptions {
  /** Smallest hole diameter as a fraction of min(width, height). */
  minDiamFrac?: number
  /** Largest hole diameter as a fraction of min(width, height). */
  maxDiamFrac?: number
  /** A pixel is "dark" when this many gray levels below the paper median. */
  minDarkDelta?: number
  /** Below this paper median the photo is too dark to trust — return []. */
  minPaperLevel?: number
  /** Cap on returned candidates (most confident first). */
  maxHits?: number
}

const DEFAULTS: Required<HitDetectOptions> = {
  minDiamFrac: 0.01,
  maxDiamFrac: 0.08,
  minDarkDelta: 50,
  minPaperLevel: 110,
  maxHits: 20,
}

/** Elongated blobs (grid lines, digits, tears along a fold) are not holes. */
const MAX_ASPECT = 2.2
/** Bounding-box fill below this is a ring / L-shape / letter, not a disc. */
const MIN_BOX_FILL = 0.5
/** Bounding-box fill of a perfect disc (π/4) — the roundness reference. */
const DISC_FILL = Math.PI / 4

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Median gray level via the histogram (paper level on a page-cropped photo). */
function medianGray(gray: Uint8Array): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const half = gray.length / 2
  let acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= half) return v
  }
  return 255
}

/**
 * Detect bullet holes as small dark round blobs on the bright page.
 * Returns candidates in detection-image pixels, most confident first.
 */
export function detectHits(image: ImageDataLike, opts: HitDetectOptions = {}): DetectedHit[] {
  const { minDiamFrac, maxDiamFrac, minDarkDelta, minPaperLevel, maxHits } = {
    ...DEFAULTS,
    ...opts,
  }
  const w = image.width
  const h = image.height
  if (w < 32 || h < 32) return []

  const blur = boxBlur3(grayscale(image), w, h)
  const paper = medianGray(blur)
  if (paper < minPaperLevel) return []
  const threshold = paper - minDarkDelta

  const minDiam = minDiamFrac * Math.min(w, h)
  const maxDiam = maxDiamFrac * Math.min(w, h)

  // 4-connected dark components (iterative flood fill), stats per component.
  const labels = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  const results: DetectedHit[] = []
  let nextLabel = 0
  for (let start = 0; start < blur.length; start++) {
    if (blur[start] >= threshold || labels[start] !== 0) continue
    const label = ++nextLabel
    let size = 0
    let sumX = 0
    let sumY = 0
    let sumV = 0
    let minX = w
    let maxX = -1
    let minY = h
    let maxY = -1
    let top = 0
    stack[top++] = start
    labels[start] = label
    while (top > 0) {
      const i = stack[--top]
      const x = i % w
      const y = (i - x) / w
      size++
      sumX += x
      sumY += y
      sumV += blur[i]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && labels[i - 1] === 0 && blur[i - 1] < threshold) {
        labels[i - 1] = label
        stack[top++] = i - 1
      }
      if (x < w - 1 && labels[i + 1] === 0 && blur[i + 1] < threshold) {
        labels[i + 1] = label
        stack[top++] = i + 1
      }
      if (i >= w && labels[i - w] === 0 && blur[i - w] < threshold) {
        labels[i - w] = label
        stack[top++] = i - w
      }
      if (i < blur.length - w && labels[i + w] === 0 && blur[i + w] < threshold) {
        labels[i + w] = label
        stack[top++] = i + w
      }
    }

    // Border-touching dark regions are shadows or background slivers.
    if (minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1) continue
    if (size < 4) continue
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const diam = Math.max(bw, bh)
    if (diam < minDiam || diam > maxDiam) continue
    if (diam / Math.min(bw, bh) > MAX_ASPECT) continue
    const boxFill = size / (bw * bh)
    if (boxFill < MIN_BOX_FILL) continue

    const roundness = clamp01((boxFill - MIN_BOX_FILL) / (DISC_FILL - MIN_BOX_FILL))
    const darkness = clamp01((paper - sumV / size) / (2 * minDarkDelta))
    results.push({
      center: { x: sumX / size, y: sumY / size },
      radius: (bw + bh) / 4,
      confidence: roundness * (0.5 + 0.5 * darkness),
    })
  }

  results.sort((a, b) => b.confidence - a.confidence)
  return results.slice(0, maxHits)
}
