import { create } from 'zustand'
import type { CalibrationState, Hit, TargetMode, Vec2 } from '../core/types'

interface WizardState {
  profileId: string | null
  /** Object URL of the (downscaled) photo; null in schematic mode. */
  photoUrl: string | null
  photoSize: { width: number; height: number } | null
  calibration: CalibrationState
  hits: Hit[]

  selectProfile: (id: string) => void
  setPhoto: (url: string, width: number, height: number) => void
  setSchematicMode: (pxPerCm: number, aimPointPx: Vec2) => void
  setCalibrationPoints: (a: Vec2, b: Vec2, realDistanceCm: number, pxPerCm: number) => void
  setAimPoint: (p: Vec2) => void
  addHit: (posPx: Vec2) => void
  toggleExcluded: (id: string) => void
  removeHit: (id: string) => void
  undoLastHit: () => void
  clearHits: () => void
  resetWizard: () => void
}

const emptyCalibration = (mode: TargetMode): CalibrationState => ({
  mode,
  pointA: null,
  pointB: null,
  realDistanceCm: null,
  pxPerCm: null,
  aimPointPx: null,
})

let hitCounter = 0

export const useWizardStore = create<WizardState>((set) => ({
  profileId: null,
  photoUrl: null,
  photoSize: null,
  calibration: emptyCalibration('photo'),
  hits: [],

  selectProfile: (id) => set({ profileId: id }),

  setPhoto: (url, width, height) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      return {
        photoUrl: url,
        photoSize: { width, height },
        calibration: emptyCalibration('photo'),
        hits: [],
      }
    }),

  setSchematicMode: (pxPerCm, aimPointPx) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      return {
        photoUrl: null,
        photoSize: null,
        calibration: { ...emptyCalibration('schematic'), pxPerCm, aimPointPx },
        hits: [],
      }
    }),

  setCalibrationPoints: (a, b, realDistanceCm, pxPerCm) =>
    set((s) => ({
      calibration: { ...s.calibration, pointA: a, pointB: b, realDistanceCm, pxPerCm },
    })),

  setAimPoint: (p) => set((s) => ({ calibration: { ...s.calibration, aimPointPx: p } })),

  addHit: (posPx) =>
    set((s) => ({
      hits: [...s.hits, { id: `h${++hitCounter}`, posPx, excluded: false }],
    })),

  toggleExcluded: (id) =>
    set((s) => ({
      hits: s.hits.map((h) => (h.id === id ? { ...h, excluded: !h.excluded } : h)),
    })),

  removeHit: (id) => set((s) => ({ hits: s.hits.filter((h) => h.id !== id) })),

  undoLastHit: () => set((s) => ({ hits: s.hits.slice(0, -1) })),

  clearHits: () => set({ hits: [] }),

  resetWizard: () =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      return {
        profileId: null,
        photoUrl: null,
        photoSize: null,
        calibration: emptyCalibration('photo'),
        hits: [],
      }
    }),
}))
