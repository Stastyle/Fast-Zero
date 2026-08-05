import { detectPage } from '../core/pageDetect'
import type { Vec2 } from '../core/types'

const MAX_DIMENSION = 2048
const DETECT_WIDTH = 192

/**
 * Downscale to ≤2048px on the long edge (memory on old phones), return an
 * object URL. Also runs page-boundary detection on a small copy so the corners
 * screen can pre-fill the A4 corners (null when nothing page-like was found).
 */
export async function preparePhoto(
  file: File,
): Promise<{ url: string; width: number; height: number; pageCorners: Vec2[] | null }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const pageCorners = detectCornersInCanvas(canvas)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
  )
  return { url: URL.createObjectURL(blob), width, height, pageCorners }
}

/** Detect the page in a photo canvas; corners are returned in photo pixels. */
function detectCornersInCanvas(canvas: HTMLCanvasElement): Vec2[] | null {
  try {
    const dw = DETECT_WIDTH
    const dh = Math.max(16, Math.round((canvas.height / canvas.width) * dw))
    const small = document.createElement('canvas')
    small.width = dw
    small.height = dh
    const ctx = small.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, dw, dh)
    const detected = detectPage(ctx.getImageData(0, 0, dw, dh))
    if (!detected || detected.confidence < 0.5) return null
    const sx = canvas.width / dw
    const sy = canvas.height / dh
    return detected.corners.map((p) => ({ x: p.x * sx, y: p.y * sy }))
  } catch {
    // Detection is best-effort — never fail the photo flow over it.
    return null
  }
}
