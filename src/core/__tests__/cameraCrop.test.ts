import { describe, expect, it } from 'vitest'
import { coverCropRect } from '../cameraCrop'

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
