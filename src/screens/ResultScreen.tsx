import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { useProfilesStore } from '../state/profilesStore'
import { StepHeader } from '../components/StepHeader'
import { ClicksCard } from '../components/ClicksCard'
import { computeMpiPx, extremeSpreadCm, makeCmConverter } from '../core/geometry'
import { computeCorrection } from '../core/zeroing'
import { appendSession } from '../data/sessions'
import type { Session } from '../core/types'

export function ResultScreen() {
  const navigate = useNavigate()
  const { profileId, calibration, hits, clearHits } = useWizardStore()
  const profiles = useProfilesStore((s) => s.profiles)
  const [saved, setSaved] = useState(false)

  const profile = profiles.find((p) => p.id === profileId) ?? null
  const mpiPx = computeMpiPx(hits)
  const toCm = makeCmConverter(calibration)
  const ready = profile && mpiPx && toCm && calibration.aimPointPx

  const result = useMemo(() => {
    if (!ready) return null
    const { aimPointPx } = calibration
    const included = hits.filter((h) => !h.excluded)
    const hitsCm = included.map((h) => toCm!(h.posPx, aimPointPx!))
    const mpiCm = toCm!(mpiPx!, aimPointPx!)
    const correction = computeCorrection(mpiCm, profile!)
    const offsetCm = {
      right: mpiCm.right - profile!.desiredImpactOffsetCm.right,
      up: mpiCm.up - profile!.desiredImpactOffsetCm.up,
    }
    const spreadCm = extremeSpreadCm(hitsCm)
    return { hitsCm, mpiCm, offsetCm, correction, spreadCm, includedCount: included.length }
  }, [ready, hits, calibration, mpiPx, profile])

  if (!ready || !result) return <Navigate to="/hits" replace />

  const save = () => {
    const session: Session = {
      id: `s-${Date.now()}`,
      createdAt: new Date().toISOString(),
      profileId: profile.id,
      profileSnapshot: {
        name: profile.name,
        elevationCmPerClick: profile.elevationCmPerClick,
        windageCmPerClick: profile.windageCmPerClick,
        desiredImpactOffsetCm: profile.desiredImpactOffsetCm,
      },
      hitCount: hits.length,
      excludedCount: hits.length - result.includedCount,
      hitsCm: result.hitsCm,
      mpiCm: result.mpiCm,
      offsetCm: result.offsetCm,
      correction: result.correction,
    }
    appendSession(session)
    setSaved(true)
  }

  const { correction } = result
  const allZeroed =
    correction.elevation.direction === 'none' && correction.windage.direction === 'none'

  return (
    <div className="screen">
      <StepHeader title={he.result.title} backTo="/hits" />
      <div className="screen-body">
        {allZeroed && <div className="zeroed-banner">🎯 {he.result.allZeroed}</div>}
        <ClicksCard
          axisLabel={he.result.elevation}
          correction={correction.elevation}
          instruction={
            correction.elevation.direction !== 'none'
              ? profile.instructions[correction.elevation.direction]
              : undefined
          }
        />
        <ClicksCard
          axisLabel={he.result.windage}
          correction={correction.windage}
          instruction={
            correction.windage.direction !== 'none'
              ? profile.instructions[correction.windage.direction]
              : undefined
          }
        />
        <div className="card">
          <div>{he.result.offset(result.offsetCm.right.toFixed(1), result.offsetCm.up.toFixed(1))}</div>
          {result.includedCount > 1 && <div>{he.result.spread(result.spreadCm.toFixed(1))}</div>}
        </div>
        <button type="button" className="big-button" disabled={saved} onClick={save}>
          {saved ? `✓ ${he.result.saved}` : he.result.save}
        </button>
        <button
          type="button"
          className="big-button big-button--secondary"
          onClick={() => {
            clearHits()
            navigate('/hits')
          }}
        >
          {he.result.again}
        </button>
      </div>
    </div>
  )
}
