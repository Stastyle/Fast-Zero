import { create } from 'zustand'
import { applyHomography } from '../core/homography'
import type { CalibrationState, Hit, TargetMode, Vec2 } from '../core/types'

type RoundTargetMode = 'camera' | 'schematic' | 'corners'

interface WizardState {
  profileId: string | null
  /** Object URL of the (downscaled) photo; null in schematic mode. */
  photoUrl: string | null
  photoSize: { width: number; height: number } | null
  /** Auto-detected A4 page corners (photo px) to pre-fill the corners screen. */
  detectedCorners: Vec2[] | null
  calibration: CalibrationState
  hits: Hit[]
  /**
   * Aim point as a FRACTION of the captured page. Valid across rounds on the
   * legacy frame-crop camera path, where every capture is cropped to the same
   * aligned A4 page.
   */
  aimFrac: { x: number; y: number } | null
  /**
   * Aim point in PAGE CENTIMETRES (origin: page top-left, y down). Valid across
   * rounds whenever the round has a homography, because it names a point on the
   * physical sheet rather than a position in one particular photo — so framing,
   * distance and camera angle may all change between rounds.
   */
  aimPageCm: { x: number; y: number } | null
  lastTargetMode: RoundTargetMode | null

  selectProfile: (id: string) => void
  setPhoto: (url: string, width: number, height: number, detectedCorners?: Vec2[] | null) => void
  /** Camera-frame capture: the crop bounds are the A4 page, so the scale is known. */
  setPhotoWithScale: (url: string, width: number, height: number, pxPerCm: number) => void
  /**
   * Auto-detected page capture: the photo comes with a perspective-correct
   * px→cm mapping built from the detected page corners, so the sheet need not
   * be aligned to the on-screen frame.
   */
  setPhotoWithPage: (
    url: string,
    width: number,
    height: number,
    homography: number[],
    inverse: number[],
  ) => void
  setSchematicMode: (pxPerCm: number, aimPointPx: Vec2) => void
  setCalibrationPoints: (a: Vec2, b: Vec2, realDistanceCm: number, pxPerCm: number) => void
  /** A4 corner marking: perspective-correct px→cm mapping (and its reverse). */
  setHomography: (h: number[], inverse?: number[]) => void
  setAimPoint: (p: Vec2) => void
  addHit: (posPx: Vec2) => void
  /** Batch insert (automatic hit detection) — one store update for all hits. */
  addHits: (positions: Vec2[]) => void
  toggleExcluded: (id: string) => void
  removeHit: (id: string) => void
  undoLastHit: () => void
  clearHits: () => void
  /**
   * Start the next round of the SAME zeroing session: keep the profile and
   * (on the camera path) the aim point; clear the photo and hits.
   * Returns the route the flow should continue at.
   */
  nextRound: () => '/hits' | '/camera'
  resetWizard: () => void
}

const emptyCalibration = (mode: TargetMode): CalibrationState => ({
  mode,
  pointA: null,
  pointB: null,
  realDistanceCm: null,
  pxPerCm: null,
  homography: null,
  inverseHomography: null,
  aimPointPx: null,
})

let hitCounter = 0

const PROFILE_KEY = 'fastzero.wizard.profileId'
const ROUND_KEY = 'fastzero.wizard.round'

/** Survive mid-flow page reloads (mobile browsers evict backgrounded PWAs). */
function loadPersistedProfileId(): string | null {
  try {
    return sessionStorage.getItem(PROFILE_KEY)
  } catch {
    return null
  }
}

function persistProfileId(id: string | null): void {
  try {
    if (id === null) sessionStorage.removeItem(PROFILE_KEY)
    else sessionStorage.setItem(PROFILE_KEY, id)
  } catch {
    /* storage unavailable */
  }
}

interface PersistedRound {
  aimFrac: { x: number; y: number } | null
  aimPageCm: { x: number; y: number } | null
  lastTargetMode: RoundTargetMode | null
}

function loadPersistedRound(): PersistedRound {
  try {
    const raw = sessionStorage.getItem(ROUND_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedRound>
      return {
        aimFrac: parsed.aimFrac ?? null,
        aimPageCm: parsed.aimPageCm ?? null,
        lastTargetMode: parsed.lastTargetMode ?? null,
      }
    }
  } catch {
    /* fall through */
  }
  return { aimFrac: null, aimPageCm: null, lastTargetMode: null }
}

function persistRound(round: PersistedRound): void {
  try {
    sessionStorage.setItem(ROUND_KEY, JSON.stringify(round))
  } catch {
    /* storage unavailable */
  }
}

export const useWizardStore = create<WizardState>((set, get) => ({
  profileId: loadPersistedProfileId(),
  photoUrl: null,
  photoSize: null,
  detectedCorners: null,
  calibration: emptyCalibration('photo'),
  hits: [],
  ...loadPersistedRound(),

  selectProfile: (id) => {
    persistProfileId(id)
    set({ profileId: id })
  },

  setPhoto: (url, width, height, detectedCorners) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      return {
        photoUrl: url,
        photoSize: { width, height },
        detectedCorners: detectedCorners ?? null,
        calibration: emptyCalibration('photo'),
        hits: [],
      }
    }),

  setPhotoWithScale: (url, width, height, pxPerCm) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      persistRound({ aimFrac: s.aimFrac, aimPageCm: s.aimPageCm, lastTargetMode: 'camera' })
      return {
        photoUrl: url,
        photoSize: { width, height },
        detectedCorners: null,
        calibration: { ...emptyCalibration('photo'), pxPerCm },
        hits: [],
        lastTargetMode: 'camera' as const,
      }
    }),

  setPhotoWithPage: (url, width, height, homography, inverse) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      persistRound({ aimFrac: null, aimPageCm: s.aimPageCm, lastTargetMode: 'camera' })
      return {
        photoUrl: url,
        photoSize: { width, height },
        detectedCorners: null,
        calibration: { ...emptyCalibration('photo'), homography, inverseHomography: inverse },
        hits: [],
        // The crop follows the detected page, not a fixed frame, so a page
        // FRACTION from an earlier round no longer names the same point;
        // aimPageCm carries the aim across rounds instead.
        aimFrac: null,
        lastTargetMode: 'camera' as const,
      }
    }),

  setSchematicMode: (pxPerCm, aimPointPx) =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      persistRound({ aimFrac: null, aimPageCm: null, lastTargetMode: 'schematic' })
      return {
        photoUrl: null,
        photoSize: null,
        detectedCorners: null,
        calibration: { ...emptyCalibration('schematic'), pxPerCm, aimPointPx },
        hits: [],
        aimFrac: null,
        aimPageCm: null,
        lastTargetMode: 'schematic' as const,
      }
    }),

  setCalibrationPoints: (a, b, realDistanceCm, pxPerCm) =>
    set((s) => ({
      calibration: { ...s.calibration, pointA: a, pointB: b, realDistanceCm, pxPerCm },
    })),

  setHomography: (h, inverse) =>
    set((s) => {
      // Corner marking means the photo was NOT frame-aligned — a page-fraction
      // aim point from a previous round would not be valid here.
      persistRound({ aimFrac: null, aimPageCm: s.aimPageCm, lastTargetMode: 'corners' })
      return {
        calibration: { ...s.calibration, homography: h, inverseHomography: inverse ?? null },
        aimFrac: null,
        lastTargetMode: 'corners' as const,
      }
    }),

  setAimPoint: (p) =>
    set((s) => {
      // On the frame-aligned camera path, remember the aim as a page fraction
      // so following rounds skip the aim step entirely.
      const frameAligned =
        s.lastTargetMode === 'camera' && s.calibration.homography === null && s.photoSize !== null
      const aimFrac = frameAligned
        ? { x: p.x / s.photoSize!.width, y: p.y / s.photoSize!.height }
        : s.aimFrac
      // With a homography the aim can be pinned to the SHEET, which survives a
      // change of framing, distance or angle between rounds.
      const aimPageCm = s.calibration.homography
        ? applyHomography(s.calibration.homography, p)
        : s.aimPageCm
      persistRound({ aimFrac, aimPageCm, lastTargetMode: s.lastTargetMode })
      return { calibration: { ...s.calibration, aimPointPx: p }, aimFrac, aimPageCm }
    }),

  addHit: (posPx) =>
    set((s) => ({
      hits: [...s.hits, { id: `h${++hitCounter}`, posPx, excluded: false }],
    })),

  addHits: (positions) =>
    set((s) => ({
      hits: [
        ...s.hits,
        ...positions.map((posPx) => ({ id: `h${++hitCounter}`, posPx, excluded: false })),
      ],
    })),

  toggleExcluded: (id) =>
    set((s) => ({
      hits: s.hits.map((h) => (h.id === id ? { ...h, excluded: !h.excluded } : h)),
    })),

  removeHit: (id) => set((s) => ({ hits: s.hits.filter((h) => h.id !== id) })),

  undoLastHit: () => set((s) => ({ hits: s.hits.slice(0, -1) })),

  clearHits: () => set({ hits: [] }),

  nextRound: () => {
    const s = get()
    if (s.lastTargetMode === 'schematic') {
      // Schematic target and its fixed aim stay — just clear the hits.
      set({ hits: [] })
      return '/hits'
    }
    // Camera/corners: a fresh photo is needed; profile and (camera) aim stay.
    set((prev) => {
      if (prev.photoUrl) URL.revokeObjectURL(prev.photoUrl)
      return {
        photoUrl: null,
        photoSize: null,
        detectedCorners: null,
        calibration: emptyCalibration('photo'),
        hits: [],
      }
    })
    return '/camera'
  },

  resetWizard: () =>
    set((s) => {
      if (s.photoUrl) URL.revokeObjectURL(s.photoUrl)
      persistProfileId(null)
      persistRound({ aimFrac: null, aimPageCm: null, lastTargetMode: null })
      return {
        profileId: null,
        photoUrl: null,
        photoSize: null,
        detectedCorners: null,
        calibration: emptyCalibration('photo'),
        hits: [],
        aimFrac: null,
        aimPageCm: null,
        lastTargetMode: null,
      }
    }),
}))
