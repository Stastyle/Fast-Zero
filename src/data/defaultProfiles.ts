import type { SightProfile } from '../core/types'

const ESTIMATED = 'ערך משוער — מומלץ לאמת מול הוראות הכוונת'

/**
 * Shipped defaults. Click values are seeded ESTIMATES, not gospel —
 * the UI marks them as estimated and every field is user-editable.
 * Only user overrides are persisted, so updates can improve these.
 */
export const DEFAULT_PROFILES: SightProfile[] = [
  {
    id: 'mepro-reflex',
    name: 'מפרולייט M5',
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
