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
