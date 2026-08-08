import type {
  AxisCorrection,
  CmVec,
  Correction,
  ElevationDirection,
  SightProfile,
  WindageDirection,
} from './types'

function axisCorrection<D>(
  offsetCm: number,
  cmPerClick: number,
  positiveDir: D,
  negativeDir: D,
  noneDir: D,
): AxisCorrection<D> {
  // The correction moves the impact OPPOSITE to the offset.
  const neededCm = -offsetCm
  const clicks = Math.round(Math.abs(neededCm) / cmPerClick)
  if (clicks === 0) {
    return { clicks: 0, direction: noneDir, residualCm: Math.abs(neededCm) }
  }
  const direction = neededCm > 0 ? positiveDir : negativeDir
  const residualCm = Math.abs(Math.abs(neededCm) - clicks * cmPerClick)
  return { clicks, direction, residualCm }
}

/**
 * Compute click corrections from the MPI (relative to the aim point, in cm).
 * Direction semantics: the direction the IMPACT must move.
 */
export function computeCorrection(mpiCm: CmVec, profile: SightProfile): Correction {
  const offset: CmVec = {
    right: mpiCm.right - profile.desiredImpactOffsetCm.right,
    up: mpiCm.up - profile.desiredImpactOffsetCm.up,
  }
  return {
    elevation: axisCorrection<ElevationDirection>(
      offset.up,
      profile.elevationCmPerClick,
      'up',
      'down',
      'none',
    ),
    windage: axisCorrection<WindageDirection>(
      offset.right,
      profile.windageCmPerClick,
      'right',
      'left',
      'none',
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Correction confidence
 *
 * A correction computed from one or two shots (or from a scatter larger
 * than the offset itself) can send the user chasing noise. This block
 * estimates how trustworthy the computed offset is, so the UI can show
 * an honest signal — it informs, it never hides the clicks.
 *
 * Estimator: per-axis standard error of the MPI, SE = s/√n, where s is
 * the Bessel-corrected sample standard deviation of the included hits on
 * that axis. We deliberately use the direct estimator rather than the
 * extreme-spread approximation S/(2.5·√n): the app knows every hit
 * coordinate, so there is no reason to throw information away — the
 * extreme-spread formula exists for when only the group size is known.
 *
 * Classification per axis (deterministic, no randomness):
 *   n ≤ 2                    → low    (no meaningful spread estimate)
 *   |offset| ≥ 2·SE          → high   (offset clearly exceeds the noise;
 *                                      ~95% band excludes zero)
 *   |offset| ≥ 1·SE          → medium (offset probably real, but the
 *                                      dialed clicks may be off)
 *   otherwise the offset is statistically indistinguishable from zero —
 *   whether that is good news depends on how tightly the MPI is pinned:
 *   SE ≤ 0.75 cm             → high   (tight group ~on target: "no
 *                                      correction needed" is trustworthy)
 *   SE ≤ 1.5 cm              → medium
 *   else                     → low    (scattered group tells us little —
 *                                      shoot another group)
 * ------------------------------------------------------------------ */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface AxisConfidence {
  /** Standard error of the MPI on this axis, in cm. 0 when n < 2. */
  seCm: number
  level: ConfidenceLevel
}

export interface CorrectionConfidence {
  /** Number of (included) hits the estimate is based on. */
  n: number
  /** Vertical axis (CmVec.up). */
  elevation: AxisConfidence
  /** Horizontal axis (CmVec.right). */
  windage: AxisConfidence
  /** Worst of the two axes — drives the single UI indicator. */
  level: ConfidenceLevel
}

/** Fewer hits than this can never yield a usable spread estimate. */
const MIN_HITS_FOR_STATS = 3
/** MPI pinned this tightly (in cm) makes a "no offset" verdict trustworthy. */
const SE_ZEROED_HIGH_CM = 0.75
const SE_ZEROED_MEDIUM_CM = 1.5

const LEVEL_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 }

/** Bessel-corrected sample standard deviation. 0 for fewer than 2 values. */
function sampleSd(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const mean = values.reduce((a, v) => a + v, 0) / n
  const ss = values.reduce((a, v) => a + (v - mean) * (v - mean), 0)
  return Math.sqrt(ss / (n - 1))
}

function axisConfidence(values: number[], offsetCm: number): AxisConfidence {
  const n = values.length
  const seCm = n >= 2 ? sampleSd(values) / Math.sqrt(n) : 0
  if (n < MIN_HITS_FOR_STATS) return { seCm, level: 'low' }
  const abs = Math.abs(offsetCm)
  if (abs >= 2 * seCm) return { seCm, level: 'high' }
  if (abs >= seCm) return { seCm, level: 'medium' }
  // Offset within the noise — classify by how tightly the MPI is known.
  if (seCm <= SE_ZEROED_HIGH_CM) return { seCm, level: 'high' }
  if (seCm <= SE_ZEROED_MEDIUM_CM) return { seCm, level: 'medium' }
  return { seCm, level: 'low' }
}

/**
 * Estimate how trustworthy the computed correction is.
 *
 * @param hitsCm  included hits only, in cm relative to the aim point
 * @param offsetCm  MPI minus the desired impact point (same value the
 *                  correction is computed from)
 */
export function estimateConfidence(hitsCm: CmVec[], offsetCm: CmVec): CorrectionConfidence {
  const elevation = axisConfidence(
    hitsCm.map((h) => h.up),
    offsetCm.up,
  )
  const windage = axisConfidence(
    hitsCm.map((h) => h.right),
    offsetCm.right,
  )
  const level = LEVEL_RANK[elevation.level] <= LEVEL_RANK[windage.level]
    ? elevation.level
    : windage.level
  return { n: hitsCm.length, elevation, windage, level }
}

export interface CorrectionText {
  elevationText: string
  windageText: string
  doneText?: string
}

const DIRECTION_HE: Record<string, string> = {
  up: 'למעלה',
  down: 'למטה',
  left: 'שמאלה',
  right: 'ימינה',
}

export function formatCorrectionHe(c: Correction, profile: SightProfile): CorrectionText {
  const elevationText =
    c.elevation.direction === 'none'
      ? 'גובה: מאופס'
      : `${c.elevation.clicks} קליקים ${DIRECTION_HE[c.elevation.direction]} · ${profile.instructions[c.elevation.direction]}`
  const windageText =
    c.windage.direction === 'none'
      ? 'צד: מאופס'
      : `${c.windage.clicks} קליקים ${DIRECTION_HE[c.windage.direction]} · ${profile.instructions[c.windage.direction]}`
  const done = c.elevation.direction === 'none' && c.windage.direction === 'none'
  return done
    ? { elevationText, windageText, doneText: 'הנשק מאופס!' }
    : { elevationText, windageText }
}
