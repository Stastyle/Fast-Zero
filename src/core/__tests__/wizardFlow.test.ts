import { beforeEach, describe, expect, it } from 'vitest'
import { useWizardStore } from '../../state/wizardStore'

// jsdom lacks object-URL support; the store revokes replaced photo URLs.
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {}
}

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

describe('live camera homography path (aligned capture with detected corners)', () => {
  const identityH = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  const corners = [
    { x: 10, y: 12 },
    { x: 790, y: 8 },
    { x: 780, y: 1120 },
    { x: 20, y: 1125 },
  ]

  it('setPhotoWithCorners keeps the aim fraction from a previous camera round', () => {
    const s = useWizardStore.getState()
    s.setPhotoWithScale('blob:round1', 800, 1130, 38)
    s.setAimPoint({ x: 400, y: 565 })
    expect(useWizardStore.getState().aimFrac).toEqual({ x: 0.5, y: 0.5 })
    expect(useWizardStore.getState().nextRound()).toBe('/camera')

    s.setPhotoWithCorners('blob:round2', 800, 1130, corners)
    const state = useWizardStore.getState()
    expect(state.aimFrac).toEqual({ x: 0.5, y: 0.5 })
    expect(state.detectedCorners).toEqual(corners)
    expect(state.lastTargetMode).toBe('camera')
    expect(state.calibration.pxPerCm).toBeNull()
    expect(state.hits).toHaveLength(0)
  })

  it('setHomography on an aligned photo preserves the aim and stays in camera mode', () => {
    const s = useWizardStore.getState()
    s.setPhotoWithScale('blob:round1', 800, 1130, 38)
    s.setAimPoint({ x: 200, y: 226 })
    s.nextRound()
    s.setPhotoWithCorners('blob:round2', 800, 1130, corners)
    s.setHomography(identityH)
    const state = useWizardStore.getState()
    expect(state.calibration.homography).toEqual(identityH)
    expect(state.aimFrac).toEqual({ x: 0.25, y: 0.2 })
    expect(state.lastTargetMode).toBe('camera')
    // Round continuity: the next round returns to the camera with the aim kept.
    expect(state.nextRound()).toBe('/camera')
    const after = useWizardStore.getState()
    expect(after.aimFrac).toEqual({ x: 0.25, y: 0.2 })
    expect(after.photoUrl).toBeNull()
    expect(after.detectedCorners).toBeNull()
  })

  it('setAimPoint stores the page fraction on the aligned path even with a homography', () => {
    const s = useWizardStore.getState()
    s.setPhotoWithCorners('blob:round1', 800, 1130, corners)
    s.setHomography(identityH)
    s.setAimPoint({ x: 200, y: 226 })
    expect(useWizardStore.getState().aimFrac).toEqual({ x: 0.25, y: 0.2 })
  })

  it('setHomography on a free (fallback) photo clears the aim and switches to corners mode', () => {
    const s = useWizardStore.getState()
    s.setPhotoWithScale('blob:round1', 800, 1130, 38)
    s.setAimPoint({ x: 400, y: 565 })
    s.nextRound()
    // Native-camera fallback: the photo is NOT frame-aligned.
    s.setPhoto('blob:free', 1000, 1400, corners)
    s.setHomography(identityH)
    const state = useWizardStore.getState()
    expect(state.aimFrac).toBeNull()
    expect(state.lastTargetMode).toBe('corners')
  })
})
