import type { Hit, Vec2 } from '../core/types'

export interface MarkedImageOptions {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  hits: Hit[]
  aimPoint: Vec2 | null
  mpi: Vec2 | null
  /** Output long edge is scaled down to at most this. Never upscales. Default 1000. */
  maxDimension?: number
  /** JPEG quality (0–1). Default 0.75. */
  quality?: number
}

const HIT_COLOR = '#d81b1b'
const EXCLUDED_COLOR = '#888888'
const AIM_COLOR = '#0a5c36'
const MPI_COLOR = '#0a58ca'
const HALO_COLOR = '#ffffff'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

/** Ring + 1-based index label for a single hit, matching the live MarkerLayer look. */
function drawHit(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  label: string,
  r: number,
  excluded: boolean,
): void {
  ctx.save()
  ctx.strokeStyle = excluded ? EXCLUDED_COLOR : HIT_COLOR
  ctx.lineWidth = r / 4
  if (excluded) ctx.setLineDash([r / 2, r / 2])
  ctx.beginPath()
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Index above-right of the ring: white halo under the fill for legibility.
  const labelX = center.x + r * 1.2
  const labelY = center.y - r * 1.2
  ctx.font = `bold ${Math.round(r * 1.5)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (!excluded) {
    ctx.strokeStyle = HALO_COLOR
    ctx.lineWidth = Math.max(2, r / 3)
    ctx.strokeText(label, labelX, labelY)
  }
  ctx.fillStyle = excluded ? EXCLUDED_COLOR : HIT_COLOR
  ctx.fillText(label, labelX, labelY)
  ctx.restore()
}

/** Green crosshair with an open center gap: two perpendicular lines of total length 3r. */
function drawAim(ctx: CanvasRenderingContext2D, p: Vec2, r: number): void {
  const outer = r * 1.5
  const gap = r * 0.4
  ctx.save()
  ctx.strokeStyle = AIM_COLOR
  ctx.lineWidth = r / 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(p.x - outer, p.y)
  ctx.lineTo(p.x - gap, p.y)
  ctx.moveTo(p.x + gap, p.y)
  ctx.lineTo(p.x + outer, p.y)
  ctx.moveTo(p.x, p.y - outer)
  ctx.lineTo(p.x, p.y - gap)
  ctx.moveTo(p.x, p.y + gap)
  ctx.lineTo(p.x, p.y + outer)
  ctx.stroke()
  ctx.restore()
}

/** Blue X: two diagonals, each of total length 2.5r. */
function drawMpi(ctx: CanvasRenderingContext2D, p: Vec2, r: number): void {
  const half = (r * 2.5) / 2 / Math.SQRT2
  ctx.save()
  ctx.strokeStyle = MPI_COLOR
  ctx.lineWidth = r / 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(p.x - half, p.y - half)
  ctx.lineTo(p.x + half, p.y + half)
  ctx.moveTo(p.x - half, p.y + half)
  ctx.lineTo(p.x + half, p.y - half)
  ctx.stroke()
  ctx.restore()
}

/**
 * Composite the target photo with its shot markers into a JPEG data URL.
 *
 * Loads `imageUrl` (blob: object URL or same-origin path — neither taints the
 * canvas), scales the long edge down to `maxDimension` (never up), draws the
 * image full-frame, then overlays — in order — excluded hits (dashed gray),
 * included hits (red ring + 1-based index with white halo), the aim point
 * (green crosshair), and the MPI (blue X). Marker coordinates are given in
 * original image pixels and are scaled to the output automatically.
 *
 * Used by the result-screen viewer, history storage, and the HTML export.
 *
 * @returns a `data:image/jpeg` URL of the composited image.
 * @throws if the image fails to load or a 2d context is unavailable.
 */
export async function renderMarkedImage(opts: MarkedImageOptions): Promise<string> {
  const { imageUrl, imageWidth, imageHeight, hits, aimPoint, mpi } = opts
  const maxDimension = opts.maxDimension ?? 1000
  const quality = opts.quality ?? 0.75

  const img = await loadImage(imageUrl)

  const longEdge = Math.max(imageWidth, imageHeight)
  const outputScale = Math.min(1, maxDimension / longEdge)
  const outputWidth = Math.max(1, Math.round(imageWidth * outputScale))
  const outputHeight = Math.max(1, Math.round(imageHeight * outputScale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2d context unavailable')

  ctx.drawImage(img, 0, 0, outputWidth, outputHeight)

  const scaled = (p: Vec2): Vec2 => ({ x: p.x * outputScale, y: p.y * outputScale })
  const r = clamp(Math.max(outputWidth, outputHeight) * 0.018, 8, 24)

  for (const [i, hit] of hits.entries()) {
    if (hit.excluded) drawHit(ctx, scaled(hit.posPx), String(i + 1), r, true)
  }
  for (const [i, hit] of hits.entries()) {
    if (!hit.excluded) drawHit(ctx, scaled(hit.posPx), String(i + 1), r, false)
  }
  if (aimPoint) drawAim(ctx, scaled(aimPoint), r)
  if (mpi) drawMpi(ctx, scaled(mpi), r)

  return canvas.toDataURL('image/jpeg', quality)
}
