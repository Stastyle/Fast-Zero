import type { Correction, SightProfile } from '../core/types'
import { he } from '../i18n/he'
import { turnsFor } from '../data/defaultProfiles'
import { sightImageUrl } from '../data/sightImages'

const IMPACT_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

const DIR_HE: Record<string, string> = {
  up: 'למעלה',
  down: 'למטה',
  left: 'שמאלה',
  right: 'ימינה',
}

/**
 * Photo of the selected sight (placeholder until real photos are dropped into
 * public/sights/) with a per-axis legend: which way to turn, how many clicks,
 * and where the impact moves.
 */
export function SightDiagram({
  profile,
  correction,
}: {
  profile: SightProfile
  correction: Correction
}) {
  const turns = turnsFor(profile)
  const rows: Array<{ axis: string; clicks: number; turn: 'cw' | 'ccw'; dir: string }> = []
  if (correction.elevation.direction !== 'none') {
    rows.push({
      axis: he.result.elevation,
      clicks: correction.elevation.clicks,
      turn: turns[correction.elevation.direction],
      dir: correction.elevation.direction,
    })
  }
  if (correction.windage.direction !== 'none') {
    rows.push({
      axis: he.result.windage,
      clicks: correction.windage.clicks,
      turn: turns[correction.windage.direction],
      dir: correction.windage.direction,
    })
  }

  return (
    <div className="sight-guide">
      <img className="sight-photo" src={sightImageUrl(profile)} alt={profile.name} />
      {rows.length === 0 ? (
        <div className="sight-guide-row sight-guide-row--zeroed">✓ {he.result.allZeroed}</div>
      ) : (
        rows.map((r) => (
          <div key={r.axis} className="sight-guide-row">
            <span className="sight-guide-axis">{r.axis}</span>
            <span className="sight-guide-turn">{r.turn === 'cw' ? '↻' : '↺'}</span>
            <span>
              {he.result.turnClicks(r.clicks)} · {he.result.impactMoves} {DIR_HE[r.dir]}{' '}
              {IMPACT_ARROW[r.dir]}
            </span>
          </div>
        ))
      )}
    </div>
  )
}
