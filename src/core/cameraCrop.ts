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
