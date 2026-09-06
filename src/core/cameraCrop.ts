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
 * The part of the video frame the viewer actually sees, in native video pixels.
 *
 * object-fit: cover scales the frame to fill the container and throws the
 * overflow away — with a 16:9 sensor frame in a portrait container that is well
 * over half the frame's width. Anything analysed outside this rect is invisible
 * to the user, so a detector must be fed this region and nothing more.
 */
export function visibleSourceRect(container: Rect, videoWidth: number, videoHeight: number): Rect {
  return coverCropRect(container, videoWidth, videoHeight, container)
}

interface Point {
  x: number
  y: number
}

/**
 * Axis-aligned crop enclosing a detected page quad, grown by `marginFrac` of
 * its own size (keeps the page edges off the photo border, where hit marking
 * and corner adjustment get awkward) and clamped to the video frame.
 */
export function quadCropRect(
  corners: Point[],
  videoWidth: number,
  videoHeight: number,
  marginFrac = 0.05,
): Rect {
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const mx = (maxX - minX) * marginFrac
  const my = (maxY - minY) * marginFrac
  const left = Math.max(0, Math.floor(minX - mx))
  const top = Math.max(0, Math.floor(minY - my))
  return {
    left,
    top,
    width: Math.min(videoWidth, Math.ceil(maxX + mx)) - left,
    height: Math.min(videoHeight, Math.ceil(maxY + my)) - top,
  }
}
