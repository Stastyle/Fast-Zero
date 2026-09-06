import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useWizardStore } from '../../state/wizardStore'
import { a4MappingFromCorners, applyHomography } from '../homography'

beforeAll(() => {
  // jsdom ships no object-URL registry, and the store revokes the previous
  // photo URL whenever a round is replaced or reset.
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => {}, writable: true })
})

beforeEach(() => {
  useWizardStore.getState().resetWizard()
})

describe('wizard hit flow (add / exclude / undo / remove)', () => {
  it('adds hits in order', () => {
    const s = useWizardStore.getState()
    s.addHit({ x: 10, y: 10 })
    s.addHit({ x: 20, y: 20 })
    const hits = useWizardStore.getState().hits
    expect(hits).toHaveLength(2)
    expect(hits[0].posPx).toEqual({ x: 10, y: 10 })
    expect(hits.every((h) => !h.excluded)).toBe(true)
  })

  it('toggles exclusion on a specific hit', () => {
    const s = useWizardStore.getState()
    s.addHit({ x: 10, y: 10 })
    s.addHit({ x: 20, y: 20 })
    const first = useWizardStore.getState().hits[0]
    s.toggleExcluded(first.id)
    expect(useWizardStore.getState().hits[0].excluded).toBe(true)
    expect(useWizardStore.getState().hits[1].excluded).toBe(false)
    s.toggleExcluded(first.id)
    expect(useWizardStore.getState().hits[0].excluded).toBe(false)
  })

  it('undo removes only the last hit', () => {
    const s = useWizardStore.getState()
    s.addHit({ x: 1, y: 1 })
    s.addHit({ x: 2, y: 2 })
    s.undoLastHit()
    const hits = useWizardStore.getState().hits
    expect(hits).toHaveLength(1)
    expect(hits[0].posPx).toEqual({ x: 1, y: 1 })
  })

  it('removes a hit by id', () => {
    const s = useWizardStore.getState()
    s.addHit({ x: 1, y: 1 })
    s.addHit({ x: 2, y: 2 })
    const first = useWizardStore.getState().hits[0]
    s.removeHit(first.id)
    const hits = useWizardStore.getState().hits
    expect(hits).toHaveLength(1)
    expect(hits[0].posPx).toEqual({ x: 2, y: 2 })
  })

  it('a detected-page capture calibrates by homography, not by a fixed scale', () => {
    const m = a4MappingFromCorners([
      { x: 40, y: 30 },
      { x: 640, y: 30 },
      { x: 640, y: 878 },
      { x: 40, y: 878 },
    ])
    if (!m.ok) throw new Error('expected ok')
    const s = useWizardStore.getState()
    s.addHit({ x: 1, y: 1 })
    s.setPhotoWithPage('blob:page', 700, 920, m.homography, m.inverse)
    const state = useWizardStore.getState()
    expect(state.hits).toHaveLength(0)
    expect(state.calibration.homography).toEqual(m.homography)
    expect(state.calibration.pxPerCm).toBeNull()
    // A page FRACTION is meaningless once the crop follows the detected page.
    expect(state.aimFrac).toBeNull()
  })

  it('the aim point is remembered against the sheet and survives a reframed round', () => {
    const round1 = a4MappingFromCorners([
      { x: 40, y: 30 },
      { x: 640, y: 30 },
      { x: 640, y: 878 },
      { x: 40, y: 878 },
    ])
    // Second round: closer, shifted, and shot at an angle.
    const round2 = a4MappingFromCorners([
      { x: 90, y: 60 },
      { x: 880, y: 20 },
      { x: 910, y: 1180 },
      { x: 60, y: 1210 },
    ])
    if (!round1.ok || !round2.ok) throw new Error('expected ok')

    const s = useWizardStore.getState()
    s.setPhotoWithPage('blob:r1', 700, 920, round1.homography, round1.inverse)
    const aimPx = { x: 340, y: 454 }
    s.setAimPoint(aimPx)
    const onPage = useWizardStore.getState().aimPageCm!
    expect(onPage.x).toBeCloseTo(applyHomography(round1.homography, aimPx).x, 6)

    // Next round of the same session, on the same sheet.
    expect(useWizardStore.getState().nextRound()).toBe('/camera')
    s.setPhotoWithPage('blob:r2', 960, 1260, round2.homography, round2.inverse)
    expect(useWizardStore.getState().aimPageCm).toEqual(onPage)

    // Mapping it back into the new photo lands on the same spot on the sheet.
    const restored = applyHomography(round2.inverse, onPage)
    const backOnPage = applyHomography(round2.homography, restored)
    expect(backOnPage.x).toBeCloseTo(onPage.x, 5)
    expect(backOnPage.y).toBeCloseTo(onPage.y, 5)
  })

  it('schematic mode sets scale and aim point and clears hits', () => {
    const s = useWizardStore.getState()
    s.addHit({ x: 1, y: 1 })
    s.setSchematicMode(20, { x: 400, y: 400 })
    const state = useWizardStore.getState()
    expect(state.hits).toHaveLength(0)
    expect(state.calibration).toMatchObject({
      mode: 'schematic',
      pxPerCm: 20,
      aimPointPx: { x: 400, y: 400 },
    })
  })
})
