import { describe, expect, it } from 'vitest'
import { coverCropRect, quadCropRect, visibleSourceRect } from '../cameraCrop'

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

describe('visibleSourceRect', () => {
  it('a landscape sensor frame in a portrait preview hides most of its width', () => {
    // 2560×1440 in a 390×700 preview: scale = max(0.152, 0.486) = 0.486
    const visible = visibleSourceRect({ left: 0, top: 120, width: 390, height: 700 }, 2560, 1440)
    expect(visible.top).toBe(0)
    expect(visible.height).toBe(1440)
    // Only ~31% of the frame's width is on screen — the rest is what used to
    // feed the detector and pull the page quad off-screen.
    expect(visible.width / 2560).toBeLessThan(0.35)
    // Symmetric: the hidden margins are equal on both sides.
    expect(visible.left).toBeCloseTo((2560 - visible.width) / 2, 6)
  })

  it('same aspect ratio: the whole frame is visible', () => {
    const visible = visibleSourceRect({ left: 0, top: 0, width: 400, height: 300 }, 1600, 1200)
    expect(visible).toEqual({ left: 0, top: 0, width: 1600, height: 1200 })
  })

  it('a portrait sensor frame in a landscape preview hides height instead', () => {
    const visible = visibleSourceRect({ left: 0, top: 0, width: 800, height: 400 }, 1080, 1920)
    expect(visible.left).toBe(0)
    expect(visible.width).toBe(1080)
    expect(visible.height).toBeCloseTo(540, 6)
  })
})

describe('quadCropRect', () => {
  const quad = [
    { x: 200, y: 100 },
    { x: 400, y: 120 },
    { x: 390, y: 400 },
    { x: 210, y: 380 },
  ]

  it('encloses every corner with a margin', () => {
    const crop = quadCropRect(quad, 1000, 800, 0.1)
    expect(crop.left).toBeLessThan(200)
    expect(crop.top).toBeLessThan(100)
    expect(crop.left + crop.width).toBeGreaterThan(400)
    expect(crop.top + crop.height).toBeGreaterThan(400)
  })

  it('clamps to the video frame instead of running off it', () => {
    const crop = quadCropRect(
      [
        { x: 2, y: 3 },
        { x: 998, y: 5 },
        { x: 996, y: 795 },
        { x: 4, y: 790 },
      ],
      1000,
      800,
      0.2,
    )
    expect(crop.left).toBe(0)
    expect(crop.top).toBe(0)
    expect(crop.left + crop.width).toBeLessThanOrEqual(1000)
    expect(crop.top + crop.height).toBeLessThanOrEqual(800)
  })

  it('zero margin returns the tight bounding box', () => {
    const crop = quadCropRect(quad, 1000, 800, 0)
    expect(crop).toEqual({ left: 200, top: 100, width: 200, height: 300 })
  })
})
