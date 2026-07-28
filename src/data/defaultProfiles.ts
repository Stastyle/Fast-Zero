import type { SightProfile } from '../core/types'

const ESTIMATED = 'ערך משוער — מומלץ לאמת מול הוראות הכוונת'

/**
 * Values built-in profiles shipped with in PAST versions. A user who opened
 * the edit screen and hit save froze the then-current values into their
 * override; when an update improves a default, the stale frozen copy would
 * mask it forever. Overrides matching a legacy value are dropped on load.
 */
export const LEGACY_DEFAULT_VALUES: Record<string, Partial<SightProfile>[]> = {
  'mepro-reflex': [
    { name: 'מפרו (רפלקס)' },
    { elevationCmPerClick: 0.7, windageCmPerClick: 0.7 },
    { notes: 'ערך משוער — מומלץ לאמת מול הוראות הכוונת' },
  ],
}

function stripMatching(
  override: Partial<SightProfile>,
  reference: Partial<SightProfile>,
): Partial<SightProfile> {
  const cleaned: Partial<SightProfile> = { ...override }
  for (const key of Object.keys(cleaned) as (keyof SightProfile)[]) {
    if (key in reference && JSON.stringify(cleaned[key]) === JSON.stringify(reference[key])) {
      delete cleaned[key]
    }
  }
  return cleaned
}

/**
 * Drop override fields identical to the CURRENT shipped default — storing them
 * is redundant and would freeze future default improvements. Safe to apply on
 * every save.
 */
export function stripRedundantOverride(
  id: string,
  override: Partial<SightProfile>,
): Partial<SightProfile> {
  const current = DEFAULT_PROFILES.find((p) => p.id === id)
  return current ? stripMatching(override, current) : override
}

/**
 * Drop override fields frozen from a LEGACY default (see LEGACY_DEFAULT_VALUES).
 * Destructive for a user who deliberately chose the old value — run ONCE as a
 * migration, not on every load.
 */
export function stripLegacyOverride(
  id: string,
  override: Partial<SightProfile>,
): Partial<SightProfile> {
  let cleaned = override
  for (const legacy of LEGACY_DEFAULT_VALUES[id] ?? []) {
    cleaned = stripMatching(cleaned, legacy)
  }
  return cleaned
}

/**
 * Shipped defaults. Click values without a sourced spec are seeded ESTIMATES —
 * the UI marks them as estimated and every field is user-editable.
 * Only user overrides are persisted, so updates can improve these.
 */
export const DEFAULT_PROFILES: SightProfile[] = [
  {
    id: 'mepro-reflex',
    name: 'מפרולייט M5',
    kind: 'reflex',
    builtIn: true,
    // Meprolight spec for the M5 / RDS PRO: 0.5 MOA per click ≈ 0.36cm at 25m
    elevationCmPerClick: 0.36,
    windageCmPerClick: 0.36,
    instructions: {
      up: 'סובב את בורג הגובה בכיוון UP',
      down: 'סובב את בורג הגובה נגד כיוון UP',
      left: 'סובב את בורג הצד בכיוון L',
      right: 'סובב את בורג הצד בכיוון R',
    },
    desiredImpactOffsetCm: { right: 0, up: 0 },
    notes: 'לפי מפרט היצרן: 0.5 MOA לקליק ≈ 0.36 ס״מ ב־25 מ׳',
  },
  {
    id: 'mepro-21',
    name: 'מפרו 21',
    kind: 'reflex',
    builtIn: true,
    elevationCmPerClick: 0.7,
    windageCmPerClick: 0.7,
    instructions: {
      up: 'סובב את בורג הגובה בכיוון UP',
      down: 'סובב את בורג הגובה נגד כיוון UP',
      left: 'סובב את בורג הצד בכיוון L',
      right: 'סובב את בורג הצד בכיוון R',
    },
    desiredImpactOffsetCm: { right: 0, up: 0 },
    notes: ESTIMATED,
  },
  {
    id: 'm16a2-iron',
    name: 'M16 כוונות ברזל',
    kind: 'iron',
    builtIn: true,
    elevationCmPerClick: 0.8,
    windageCmPerClick: 0.9,
    instructions: {
      up: 'הברג את חזית הכוונת פנימה (עם כיוון החץ)',
      down: 'הברג את חזית הכוונת החוצה (נגד כיוון החץ)',
      left: 'סובב את תוף הצד האחורי שמאלה',
      right: 'סובב את תוף הצד האחורי ימינה',
    },
    desiredImpactOffsetCm: { right: 0, up: 0 },
    notes: ESTIMATED,
  },
  {
    id: 'm4-iron',
    name: 'M4 כוונות ברזל',
    kind: 'iron',
    builtIn: true,
    elevationCmPerClick: 0.9,
    windageCmPerClick: 0.4,
    instructions: {
      up: 'הברג את חזית הכוונת פנימה (עם כיוון החץ)',
      down: 'הברג את חזית הכוונת החוצה (נגד כיוון החץ)',
      left: 'סובב את בורג הצד בכוונת האחורית שמאלה',
      right: 'סובב את בורג הצד בכוונת האחורית ימינה',
    },
    desiredImpactOffsetCm: { right: 0, up: 0 },
    notes: ESTIMATED,
  },
  {
    id: 'tavor-iron',
    name: 'תבור כוונות ברזל',
    kind: 'iron',
    builtIn: true,
    elevationCmPerClick: 1.0,
    windageCmPerClick: 1.0,
    instructions: {
      up: 'סובב את בורג הגובה בכיוון החץ למעלה',
      down: 'סובב את בורג הגובה נגד החץ',
      left: 'סובב את בורג הצד שמאלה',
      right: 'סובב את בורג הצד ימינה',
    },
    desiredImpactOffsetCm: { right: 0, up: 0 },
    notes: ESTIMATED,
  },
]
