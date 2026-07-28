import type { Correction, SightProfile } from '../core/types'
import { he } from '../i18n/he'
import { turnsFor } from '../data/defaultProfiles'
import { sightImageSpec, sightImageUrl } from '../data/sightImages'
import { RotationArrow } from './RotationArrow'

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
 * Photo of the selected sight with rotation arrows OVERLAID on the adjuster
 * locations (per-image anchors in sightImages.ts) plus a click-count badge,
 * and a compact per-axis legend underneath.
 */
export function SightDiagram({
  profile,
  correction,
}: {
  profile: SightProfile
  correction: Correction
}) {
  const turns = turnsFor(profile)
  const spec = sightImageSpec(profile)

  const overlays: Array<{
    key: string
    anchor: { x: number; y: number }
    turn: 'cw' | 'ccw'
    clicks: number
  }> = []
  const rows: Array<{ axis: string; clicks: number; turn: 'cw' | 'ccw'; dir: string }> = []

  if (correction.elevation.direction !== 'none') {
    const turn = turns[correction.elevation.direction]
    overlays.push({
      key: 'elevation',
      anchor: spec.elevationAnchor,
      turn,
      clicks: correction.elevation.clicks,
    })
    rows.push({
      axis: he.result.elevation,
      clicks: correction.elevation.clicks,
      turn,
      dir: correction.elevation.direction,
    })
  }
  if (correction.windage.direction !== 'none') {
    const turn = turns[correction.windage.direction]
    overlays.push({
      key: 'windage',
      anchor: spec.windageAnchor,
      turn,
      clicks: correction.windage.clicks,
    })
    rows.push({
      axis: he.result.windage,
      clicks: correction.windage.clicks,
      turn,
      dir: correction.windage.direction,
    })
  }

  return (
    <div className="sight-guide">
      <div className="sight-photo-wrap">
        <img className="sight-photo" src={sightImageUrl(profile)} alt={profile.name} />
        {overlays.map((o) => (
          <div
            key={o.key}
            className="sight-anchor"
            style={{ left: `${o.anchor.x * 100}%`, top: `${o.anchor.y * 100}%` }}
          >
            <RotationArrow turn={o.turn} />
            <span className="sight-anchor-clicks">{o.clicks}</span>
          </div>
        ))}
      </div>
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
