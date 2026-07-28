import type { AxisCorrection } from '../core/types'
import { he } from '../i18n/he'

const ARROWS: Record<string, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
}

const DIR_HE: Record<string, string> = {
  up: he.result.dirUp,
  down: he.result.dirDown,
  left: he.result.dirLeft,
  right: he.result.dirRight,
}

interface ClicksCardProps {
  axisLabel: string
  correction: AxisCorrection<string>
  instruction?: string
}

export function ClicksCard({ axisLabel, correction, instruction }: ClicksCardProps) {
  if (correction.direction === 'none') {
    return (
      <div className="clicks-card clicks-card--zeroed">
        <div className="axis-label">{axisLabel}</div>
        <div className="clicks-number" style={{ fontSize: 'var(--text-xl)' }}>
          ✓ {he.result.zeroed}
        </div>
      </div>
    )
  }
  return (
    <div className="clicks-card">
      <div className="axis-label">{axisLabel}</div>
      <div className="clicks-number">
        {correction.clicks}
        <span className="clicks-arrow"> {ARROWS[correction.direction]}</span>
      </div>
      <div className="clicks-dir">
        {he.result.clicks} {DIR_HE[correction.direction]}
      </div>
      {instruction && <div className="instruction">{instruction}</div>}
    </div>
  )
}
