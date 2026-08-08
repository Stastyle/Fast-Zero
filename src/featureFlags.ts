/**
 * Build-time feature flags.
 *
 * SHOW_SIGHT_AIM_GUIDE — the "איפה מכוונים בכוונת" card on the result screen:
 * a photo of the selected sight (SightDiagram + data/sightImages.ts) with
 * rotation arrows overlaid on the adjuster knobs. Temporarily hidden per
 * product decision (2026-08); all code and assets are kept intact.
 * To re-enable, flip this to `true` — nothing else is needed.
 */
export const SHOW_SIGHT_AIM_GUIDE = false
