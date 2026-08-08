import type { SightProfile } from '../core/types'

export interface AnchorPoint {
  /** Fraction of the image width (0 = start/right in RTL terms is NOT applied — plain left-based). */
  x: number
  /** Fraction of the image height. */
  y: number
}

export interface SightImageSpec {
  file: string
  /** Where the ELEVATION adjuster appears on the photo (fractions of width/height). */
  elevationAnchor: AnchorPoint
  /** Where the WINDAGE adjuster appears on the photo. */
  windageAnchor: AnchorPoint
}

/**
 * NOTE: the sight-image aim guide that consumes these specs (SightDiagram on
 * the result screen) is temporarily hidden per product decision — see
 * SHOW_SIGHT_AIM_GUIDE in src/featureFlags.ts. Keep this data current for
 * when it is re-enabled.
 *
 * Real sight photos live in public/sights/ under these exact names — replace
 * the shipped placeholders with actual photos to upgrade the app.
 * After replacing a photo, tune its anchors so the rotation arrows sit
 * exactly on the adjuster knobs: x/y are fractions of the image
 * (0,0 = top-left; 1,1 = bottom-right).
 */
const SPEC_BY_PROFILE_ID: Record<string, SightImageSpec> = {
  'mepro-reflex': {
    file: 'M5.jpg',
    elevationAnchor: { x: 0.5, y: 0.16 },
    windageAnchor: { x: 0.85, y: 0.5 },
  },
  'mepro-21': {
    file: 'M21.jpg',
    elevationAnchor: { x: 0.5, y: 0.16 },
    windageAnchor: { x: 0.85, y: 0.5 },
  },
  'm16a2-iron': {
    file: 'M16.jpg',
    elevationAnchor: { x: 0.25, y: 0.45 },
    windageAnchor: { x: 0.78, y: 0.45 },
  },
  'm4-iron': {
    file: 'M4.jpg',
    elevationAnchor: { x: 0.25, y: 0.45 },
    windageAnchor: { x: 0.78, y: 0.45 },
  },
  'tavor-iron': {
    file: 'TAVOR.jpg',
    elevationAnchor: { x: 0.25, y: 0.45 },
    windageAnchor: { x: 0.78, y: 0.45 },
  },
}

const FALLBACK: Record<SightProfile['kind'], string> = {
  reflex: 'mepro-reflex',
  iron: 'm16a2-iron',
}

export function sightImageSpec(profile: SightProfile): SightImageSpec {
  return SPEC_BY_PROFILE_ID[profile.id] ?? SPEC_BY_PROFILE_ID[FALLBACK[profile.kind]]
}

export function sightImageUrl(profile: SightProfile): string {
  return `${import.meta.env.BASE_URL}sights/${sightImageSpec(profile).file}`
}
