import type { Vec2 } from './types'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Map an on-screen overlay rect to native video pixels for a video rendered
 * with object-fit: cover inside a container. Returns the source crop rect
 * to pass to drawImage.
 */
export function coverCropRect(
  container: Rect,
  videoWidth: number,
  videoHeight: number,
  overlay: Rect,
): Rect {
  const scale = Math.max(container.width / videoWidth, container.height / videoHeight)
  const offsetX = (videoWidth * scale - container.width) / 2
  const offsetY = (videoHeight * scale - container.height) / 2
  return {
    left: (overlay.left - container.left + offsetX) / scale,
    top: (overlay.top - container.top + offsetY) / scale,
    width: overlay.width / scale,
    height: overlay.height / scale,
  }
}

/**
 * Map points from native video pixels into the pixel space of a photo that
 * was drawn from `crop` (a source rect in video pixels) onto an
 * `outWidth`×`outHeight` canvas — i.e. video px → captured-photo px.
 *
 * Returns null when any point strays outside the crop by more than
 * `tolerance` × the output dimension: the detection then disagrees with the
 * on-screen frame the user aligned, and the caller should not trust it.
 * Points within the tolerance are returned as-is (possibly slightly outside
 * the photo bounds) — clamping would distort the quad's perspective.
 */
export function mapVideoPointsToCrop(
  points: Vec2[],
  crop: Rect,
  outWidth: number,
  outHeight: number,
  tolerance = 0.15,
): Vec2[] | null {
  if (!(crop.width > 0) || !(crop.height > 0)) return null
  const sx = outWidth / crop.width
  const sy = outHeight / crop.height
  const out: Vec2[] = []
  for (const p of points) {
    const x = (p.x - crop.left) * sx
    const y = (p.y - crop.top) * sy
    if (
      x < -tolerance * outWidth ||
      x > (1 + tolerance) * outWidth ||
      y < -tolerance * outHeight ||
      y > (1 + tolerance) * outHeight
    ) {
      return null
    }
    out.push({ x, y })
  }
  return out
}
