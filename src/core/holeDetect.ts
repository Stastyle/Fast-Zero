import { boxBlur3, grayscale, otsuThreshold, type ImageDataLike } from './pageDetect'
import type { Vec2 } from './types'

/**
 * Bullet-hole candidate detection on a photographed zeroing page.
 *
 * Pure pixel-data functions (no DOM, no dependencies) — the caller downscales
 * the photo to a small canvas (~640px wide), passes its ImageData here, and
 * gets back SUGGESTED hole centers. Nothing here ever auto-adds hits; the UI
 * shows candidates as tentative markers the user must confirm.
 *
 * Approach — holes are small, dark, roughly round blobs on bright paper:
 *   1. grayscale + light 3×3 box blur (sensor noise)
 *   2. adaptive dark threshold: pixels must be clearly darker than the page
 *      (median brightness minus a margin) AND below the Otsu split
 *   3. 4-connected components of dark pixels
 *   4. filter: area bounded relative to the image (holes are small), blob must
 *      not touch the image border, must be roughly round (bbox extent +
 *      aspect), and must contrast strongly with its local background ring
 *   5. score, sort strongest-first, cap the list
 */

export interface HoleCandidate {
  /** Blob centroid in detection-image pixels. */
  center: Vec2
  /** Equivalent circle radius (px) from the blob area. */
  radius: number
  /** Heuristic 0..1 — how round and well-contrasted the blob is. */
  confidence: number
}

export interface HoleDetectOptions {
  /** Hard cap on returned candidates (strongest first). */
  maxCandidates?: number
  /** Blob area lower bound as a fraction of total pixels (abs floor of 4px applies). */
  minAreaFrac?: number
  /** Blob area upper bound as a fraction of total pixels — holes are small. */
  maxAreaFrac?: number
  /** Median page brightness required to even try (dark scenes are not a page). */
  minPageBrightness?: number
  /** Required gray gap between the local background ring and the blob. */
  minLocalContrast?: number
  /** Blob must fill at least this fraction of its bounding box (circle ≈ 0.78). */
  minExtent?: number
  /** Max bbox side ratio — rejects scratches / pen lines. */
  maxAspect?: number
}

const DEFAULTS: Required<HoleDetectOptions> = {
  maxCandidates: 15,
  minAreaFrac: 0.000015,
  maxAreaFrac: 0.004,
  minPageBrightness: 90,
  minLocalContrast: 35,
  minExtent: 0.45,
  maxAspect: 2.5,
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Median of a grayscale buffer via its 256-bin histogram. */
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
 * Detect small dark blobs (bullet-hole candidates) on a bright page.
 * Returns up to `maxCandidates` candidates sorted by confidence (desc);
 * an empty array when the scene does not look like a bright page or no
 * hole-like blob is present.
 */
export function detectHoles(image: ImageDataLike, opts: HoleDetectOptions = {}): HoleCandidate[] {
  const o = { ...DEFAULTS, ...opts }
  const w = image.width
  const h = image.height
  if (w < 32 || h < 32) return []
  const total = w * h

  const blur = boxBlur3(grayscale(image), w, h)

  // The page dominates the frame, so its brightness is the median gray.
  const pageLevel = medianGray(blur)
  if (pageLevel < o.minPageBrightness) return []

  // Adaptive dark threshold: clearly darker than the page. When the frame has
  // a substantial dark population (dark table around the page, big shadow),
  // tighten to the Otsu split — but ignore Otsu when the dark class is tiny
  // (a few holes), where its split point is statistically meaningless.
  const margin = Math.max(40, pageLevel * 0.22)
  let threshold = pageLevel - margin
  if (threshold <= 0) return []
  const otsu = otsuThreshold(blur)
  if (otsu < threshold) {
    let darkCount = 0
    for (let i = 0; i < blur.length; i++) if (blur[i] <= otsu) darkCount++
    if (darkCount >= 0.02 * total) threshold = otsu
  }

  const minArea = Math.max(4, Math.round(o.minAreaFrac * total))
  const maxArea = Math.round(o.maxAreaFrac * total)

  // 4-connected components of dark pixels (iterative flood fill).
  const labels = new Int32Array(total) // 0 = unvisited, >0 = component id
  const stack = new Int32Array(total)
  const candidates: HoleCandidate[] = []
  let nextLabel = 0

  for (let start = 0; start < total; start++) {
    if (blur[start] > threshold || labels[start] !== 0) continue
    const label = ++nextLabel
    let size = 0
    let sumX = 0
    let sumY = 0
    let sumGray = 0
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
      sumGray += blur[i]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && labels[i - 1] === 0 && blur[i - 1] <= threshold) {
        labels[i - 1] = label
        stack[top++] = i - 1
      }
      if (x < w - 1 && labels[i + 1] === 0 && blur[i + 1] <= threshold) {
        labels[i + 1] = label
        stack[top++] = i + 1
      }
      if (i >= w && labels[i - w] === 0 && blur[i - w] <= threshold) {
        labels[i - w] = label
        stack[top++] = i - w
      }
      if (i < total - w && labels[i + w] === 0 && blur[i + w] <= threshold) {
        labels[i + w] = label
        stack[top++] = i + w
      }
    }

    // --- Filters ---
    if (size < minArea || size > maxArea) continue
    // Border blobs are shadows / background bleeding in — never a hole.
    if (minX <= 0 || minY <= 0 || maxX >= w - 1 || maxY >= h - 1) continue
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    const aspect = Math.max(bw, bh) / Math.min(bw, bh)
    if (aspect > o.maxAspect) continue
    const extent = size / (bw * bh)
    if (extent < o.minExtent) continue

    // Local contrast: sample a rectangular ring around the blob; it should be
    // bright paper. Rejects dark texture inside larger dark structures.
    const pad = Math.max(3, Math.round(Math.max(bw, bh) / 2))
    const x0 = Math.max(0, minX - pad)
    const x1 = Math.min(w - 1, maxX + pad)
    const y0 = Math.max(0, minY - pad)
    const y1 = Math.min(h - 1, maxY + pad)
    let ringSum = 0
    let ringN = 0
    for (let x = x0; x <= x1; x++) {
      ringSum += blur[y0 * w + x] + blur[y1 * w + x]
      ringN += 2
    }
    for (let y = y0 + 1; y < y1; y++) {
      ringSum += blur[y * w + x0] + blur[y * w + x1]
      ringN += 2
    }
    if (ringN === 0) continue
    const contrast = ringSum / ringN - sumGray / size
    if (contrast < o.minLocalContrast) continue

    const extentScore = clamp01((extent - o.minExtent) / (0.78 - o.minExtent))
    const contrastScore = clamp01(contrast / 100)
    candidates.push({
      center: { x: sumX / size, y: sumY / size },
      radius: Math.sqrt(size / Math.PI),
      confidence: extentScore * (0.4 + 0.6 * contrastScore),
    })
  }

  candidates.sort((a, b) => b.confidence - a.confidence)
  return candidates.slice(0, o.maxCandidates)
}
