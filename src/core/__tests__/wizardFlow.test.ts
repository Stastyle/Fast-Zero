import { beforeEach, describe, expect, it } from 'vitest'
import { useWizardStore } from '../../state/wizardStore'

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
