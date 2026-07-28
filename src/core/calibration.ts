import { distancePx } from './geometry'
import type { Vec2 } from './types'

/** Two calibration taps closer than this (px) are almost certainly a mis-tap. */
export const MIN_CALIBRATION_PX = 40

export type CalibrationValidation =
  | { ok: true }
  | { ok: false; reason: 'points-too-close' | 'bad-distance' }

export function validateCalibration(
  a: Vec2,
  b: Vec2,
  realDistanceCm: number,
): CalibrationValidation {
  if (!Number.isFinite(realDistanceCm) || realDistanceCm <= 0) {
    return { ok: false, reason: 'bad-distance' }
  }
  if (distancePx(a, b) < MIN_CALIBRATION_PX) {
    return { ok: false, reason: 'points-too-close' }
  }
  return { ok: true }
}

/** Scale factor from two points a known real-world distance apart. */
export function computePxPerCm(a: Vec2, b: Vec2, realDistanceCm: number): number {
  return distancePx(a, b) / realDistanceCm
}
