import type { Correction } from '../core/types'
import { he } from '../i18n/he'

const DIR_HE: Record<string, string> = {
  up: he.result.dirUp,
  down: he.result.dirDown,
  left: he.result.dirLeft,
  right: he.result.dirRight,
}

/** Short one-line summary, e.g. "4 קליקים למעלה · 2 קליקים שמאלה". */
export function summarizeCorrectionHe(c: Correction): string {
  const parts: string[] = []
  if (c.elevation.direction !== 'none') {
    parts.push(`${c.elevation.clicks} ${he.result.clicks} ${DIR_HE[c.elevation.direction]}`)
  }
  if (c.windage.direction !== 'none') {
    parts.push(`${c.windage.clicks} ${he.result.clicks} ${DIR_HE[c.windage.direction]}`)
  }
  return parts.length ? parts.join(' · ') : he.result.allZeroed
}
