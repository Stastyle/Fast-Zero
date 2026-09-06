/** Image-pixel coordinates. y grows DOWN (screen convention). */
export interface Vec2 {
  x: number
  y: number
}

/** Physical centimeters relative to an origin. `up` grows UP (real-world convention). */
export interface CmVec {
  right: number
  up: number
}

export type SightKind = 'reflex' | 'iron'

export interface SightProfile {
  id: string
  name: string
  kind: SightKind
  builtIn: boolean
  /** cm of impact movement per click, at 25m */
  elevationCmPerClick: number
  /** cm of impact movement per click, at 25m */
  windageCmPerClick: number
  /**
   * Hebrew knob-action instruction per correction direction.
   * The direction key is the direction the IMPACT must move; the text says
   * what to physically do (handles inverted front-post semantics etc.).
   */
  instructions: {
    up: string
    down: string
    left: string
    right: string
  }
  /**
   * Desired impact point relative to the aim point at 25m.
   * {right:0, up:0} means impact should land exactly on the aim point.
   */
  desiredImpactOffsetCm: CmVec
  /**
   * Which way to physically TURN the adjuster to move the impact in each
   * direction. Drives the rotation arrows on the sight illustration.
   */
  turns?: {
    up: 'cw' | 'ccw'
    down: 'cw' | 'ccw'
    left: 'cw' | 'ccw'
    right: 'cw' | 'ccw'
  }
  notes?: string
}

export interface Hit {
  id: string
  /** Position in image-pixel space (or schematic unit space). */
  posPx: Vec2
  /** Flier — excluded from MPI computation. */
  excluded: boolean
}

export type TargetMode = 'photo' | 'schematic'

export interface CalibrationState {
  mode: TargetMode
  pointA: Vec2 | null
  pointB: Vec2 | null
  realDistanceCm: number | null
  pxPerCm: number | null
  /** px→page-cm homography from A4 corner detection/marking; when set it wins over pxPerCm. */
  homography: number[] | null
  /** The reverse mapping, page cm→px. Restores a sheet-fixed aim point in a new photo. */
  inverseHomography: number[] | null
  aimPointPx: Vec2 | null
}

export type ElevationDirection = 'up' | 'down' | 'none'
export type WindageDirection = 'left' | 'right' | 'none'

export interface AxisCorrection<D> {
  clicks: number
  direction: D
  /** Leftover offset (cm) that the rounded click count does not correct. */
  residualCm: number
}

export interface Correction {
  elevation: AxisCorrection<ElevationDirection>
  windage: AxisCorrection<WindageDirection>
}

export interface Session {
  id: string
  createdAt: string
  profileId: string
  /** Snapshot at save time — profile edits must not rewrite history. */
  profileSnapshot: Pick<
    SightProfile,
    'name' | 'elevationCmPerClick' | 'windageCmPerClick' | 'desiredImpactOffsetCm'
  >
  hitCount: number
  excludedCount: number
  /** Included hits relative to the aim point, in cm. Photos are never stored. */
  hitsCm: CmVec[]
  /** Mean point of impact relative to the aim point. */
  mpiCm: CmVec
  /** MPI minus desired impact point. */
  offsetCm: CmVec
  /** Largest distance between two included hits ("group size"), in cm. */
  spreadCm?: number
  correction: Correction
  notes?: string
  /** JPEG data URL of the marked target photo. Stripped from older sessions to bound storage. */
  imageDataUrl?: string
}
