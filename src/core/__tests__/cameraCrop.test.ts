import { describe, expect, it } from 'vitest'
import { coverCropRect, mapVideoPointsToCrop } from '../cameraCrop'
import { a4MappingFromCorners, applyHomography } from '../homography'

describe('coverCropRect', () => {
  it('video wider than container (width overflows): crop is horizontally centered', () => {
    // container 400×800, video 1600×1200 → scale = max(0.25, 0.667) = 0.667
    // displayed video = 1067×800, offsetX = 333, offsetY = 0
    const container = { left: 0, top: 0, width: 400, height: 800 }
    const overlay = { left: 50, top: 100, width: 300, height: 424 }
    const crop = coverCropRect(container, 1600, 1200, overlay)
    expect(crop.left).toBeCloseTo((50 + 333.33) / 0.6667, 0)
    expect(crop.top).toBeCloseTo(100 / 0.6667, 0)
    expect(crop.width).toBeCloseTo(300 / 0.6667, 0)
    expect(crop.height).toBeCloseTo(424 / 0.6667, 0)
  })

  it('exact fit (same aspect): pure scaling, no offsets', () => {
    const container = { left: 0, top: 0, width: 400, height: 300 }
    const overlay = { left: 100, top: 75, width: 200, height: 150 }
    const crop = coverCropRect(container, 800, 600, overlay)
    expect(crop).toEqual({ left: 200, top: 150, width: 400, height: 300 })
  })

  it('overlay centered in container maps to a crop centered in the video', () => {
    const container = { left: 0, top: 0, width: 390, height: 700 }
    const overlay = { left: 95, top: 150, width: 200, height: 400 }
    const crop = coverCropRect(container, 2560, 1440, overlay)
    // crop center should equal video center on the x axis (overlay is centered)
    expect(crop.left + crop.width / 2).toBeCloseTo(2560 / 2, 0)
  })

  it('accounts for a container offset from the viewport origin', () => {
    const container = { left: 0, top: 120, width: 400, height: 300 }
    const overlay = { left: 100, top: 195, width: 200, height: 150 }
    const crop = coverCropRect(container, 800, 600, overlay)
    expect(crop).toEqual({ left: 200, top: 150, width: 400, height: 300 })
  })

  it('full-container overlay with same aspect returns the whole video', () => {
    const container = { left: 0, top: 0, width: 400, height: 300 }
    const overlay = { ...container }
    const crop = coverCropRect(container, 1600, 1200, overlay)
    expect(crop).toEqual({ left: 0, top: 0, width: 1600, height: 1200 })
  })
})

describe('mapVideoPointsToCrop (video px → captured-photo px)', () => {
  const crop = { left: 400, top: 200, width: 800, height: 1200 }

  it('applies the crop offset and per-axis output scale', () => {
    const out = mapVideoPointsToCrop(
      [
        { x: 400, y: 200 },
        { x: 1200, y: 1400 },
        { x: 800, y: 800 },
      ],
      crop,
      400,
      600,
    )
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 400, y: 600 },
      { x: 200, y: 300 },
    ])
  })

  it('is the identity for an origin crop rendered at native size', () => {
    const out = mapVideoPointsToCrop(
      [{ x: 123, y: 456 }],
      { left: 0, top: 0, width: 800, height: 1200 },
      800,
      1200,
    )
    expect(out).toEqual([{ x: 123, y: 456 }])
  })

  it('keeps points slightly outside the crop unclamped (within tolerance)', () => {
    // -40 px on an 800 px output is within the 15% tolerance (120 px) —
    // clamping would distort the quad, so the point passes through as-is.
    const out = mapVideoPointsToCrop([{ x: 360, y: 140 }], crop, 800, 1200)
    expect(out).toEqual([{ x: -40, y: -60 }])
  })

  it('returns null when any point strays beyond the tolerance', () => {
    // x maps to -400, far outside 15% of the 800 px output.
    expect(mapVideoPointsToCrop([{ x: 0, y: 600 }], crop, 800, 1200)).toBeNull()
    // beyond the far edge too
    expect(mapVideoPointsToCrop([{ x: 1400, y: 600 }], crop, 800, 1200)).toBeNull()
  })

  it('returns null for a degenerate crop', () => {
    expect(
      mapVideoPointsToCrop([{ x: 0, y: 0 }], { left: 0, top: 0, width: 0, height: 100 }, 100, 100),
    ).toBeNull()
  })

  it('detected tilted page maps into a perspective-correct A4 homography', () => {
    // Phone tilted ~15°: the far (bottom) edge of the page images narrower.
    const crop2 = { left: 100, top: 100, width: 600, height: 860 }
    const videoCorners = [
      { x: 140, y: 130 }, // tl
      { x: 660, y: 130 }, // tr
      { x: 620, y: 930 }, // br
      { x: 180, y: 930 }, // bl
    ]
    const mapped = mapVideoPointsToCrop(videoCorners, crop2, 600, 860)
    expect(mapped).not.toBeNull()
    const mapping = a4MappingFromCorners(mapped!)
    expect(mapping.ok).toBe(true)
    if (!mapping.ok) return
    // Portrait page: 21 cm wide, 29.7 cm tall.
    expect(mapping.pageWidthCm).toBeCloseTo(21)
    expect(mapping.pageHeightCm).toBeCloseTo(29.7)
    // The detected corners land exactly on the page corners in cm space.
    const tl = applyHomography(mapping.homography, mapped![0])
    const br = applyHomography(mapping.homography, mapped![2])
    expect(tl.x).toBeCloseTo(0)
    expect(tl.y).toBeCloseTo(0)
    expect(br.x).toBeCloseTo(21)
    expect(br.y).toBeCloseTo(29.7)
  })
})
