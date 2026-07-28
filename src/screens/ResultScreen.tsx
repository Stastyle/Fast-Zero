import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { useProfilesStore } from '../state/profilesStore'
import { StepHeader } from '../components/StepHeader'
import { ClicksCard } from '../components/ClicksCard'
import { SightDiagram } from '../components/SightDiagram'
import { ImageModal } from '../components/ImageModal'
import { computeMpiPx, extremeSpreadCm, makeCmConverter } from '../core/geometry'
import { computeCorrection } from '../core/zeroing'
import { appendSession } from '../data/sessions'
import { renderMarkedImage } from '../data/markedImage'
import { SCHEMATIC } from '../data/schematic'
import type { Session } from '../core/types'

export function ResultScreen() {
  const navigate = useNavigate()
  const { profileId, calibration, hits, clearHits, photoUrl, photoSize } = useWizardStore()
  const profiles = useProfilesStore((s) => s.profiles)
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [markedImage, setMarkedImage] = useState<string | null>(null)
  // 'pending' while the composite renders — saving is held back so a fast tap
  // on the save button cannot persist the session without its photo.
  const [imageState, setImageState] = useState<'pending' | 'done' | 'failed'>('pending')
  const [showPhoto, setShowPhoto] = useState(false)

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

  // Composite the marked target once: shown in the viewer and stored with the session.
  const isSchematic = calibration.mode === 'schematic'
  const sourceUrl = isSchematic ? SCHEMATIC.url : photoUrl
  const sourceSize = isSchematic ? { width: SCHEMATIC.width, height: SCHEMATIC.height } : photoSize
  useEffect(() => {
    if (!ready || !sourceUrl || !sourceSize) {
      setImageState('failed')
      return
    }
    let cancelled = false
    setImageState('pending')
    renderMarkedImage({
      imageUrl: sourceUrl,
      imageWidth: sourceSize.width,
      imageHeight: sourceSize.height,
      hits,
      aimPoint: calibration.aimPointPx,
      mpi: mpiPx,
      maxDimension: 800,
      quality: 0.7,
    })
      .then((url) => {
        if (cancelled) return
        setMarkedImage(url)
        setImageState('done')
      })
      .catch(() => {
        // photo viewing/saving is an extra — the numbers still stand
        if (!cancelled) setImageState('failed')
      })
    return () => {
      cancelled = true
    }
  }, [ready, sourceUrl])

  // Never bounce silently: name what is missing and offer a way back.
  if (!ready || !result) {
    const missing: string[] = []
    if (!profile) missing.push(he.result.missingProfile)
    if (!toCm) missing.push(he.result.missingScale)
    if (!calibration.aimPointPx) missing.push(he.result.missingAim)
    if (!mpiPx) missing.push(he.result.missingHits)
    return (
      <div className="screen">
        <StepHeader title={he.result.title} backTo="/hits" />
        <div className="screen-body">
          <div className="card">
            <p style={{ fontWeight: 800, marginBlockEnd: 8 }}>{he.result.cannotCompute}</p>
            <ul style={{ paddingInlineStart: 22 }}>
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <button type="button" className="cta-button" onClick={() => navigate('/target')}>
            {he.result.restartTarget}
          </button>
        </div>
      </div>
    )
  }

  /** Persist once; returns whether the session is (now) saved. */
  const persist = (): boolean => {
    if (saved) return true
    setSaveFailed(false)
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
      spreadCm: result.spreadCm,
      correction: result.correction,
      ...(markedImage ? { imageDataUrl: markedImage } : {}),
    }
    const ok = appendSession(session)
    if (ok) setSaved(true)
    else setSaveFailed(true)
    return ok
  }

  // Both actions save first, then roll straight into the next shooting round.
  const saveAndNextRound = () => {
    if (!persist()) return
    clearHits()
    navigate('/hits')
  }

  const { correction } = result
  const allZeroed =
    correction.elevation.direction === 'none' && correction.windage.direction === 'none'

  return (
    <div className="screen">
      <StepHeader title={he.result.title} backTo="/hits" />
      <div className="screen-body">
        {allZeroed && <div className="zeroed-banner">🎯 {he.result.allZeroed}</div>}
        <div className="clicks-grid">
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
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, marginBlockEnd: 6 }}>{he.result.diagramTitle}</div>
          <SightDiagram profile={profile} correction={correction} />
        </div>
        <div className="card">
          <div>{he.result.offset(result.offsetCm.right, result.offsetCm.up)}</div>
          {result.includedCount > 1 && <div>{he.result.spread(result.spreadCm.toFixed(1))}</div>}
        </div>
        {markedImage && (
          <button
            type="button"
            className="big-button big-button--secondary"
            onClick={() => setShowPhoto(true)}
          >
            🖼 {he.result.showPhoto}
          </button>
        )}
        <button
          type="button"
          className="big-button"
          disabled={imageState === 'pending'}
          onClick={saveAndNextRound}
        >
          {imageState === 'pending' ? he.result.saving : he.result.save}
        </button>
        {saveFailed && (
          <p style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{he.result.saveFailed}</p>
        )}
        <button
          type="button"
          className="big-button big-button--secondary"
          disabled={imageState === 'pending'}
          onClick={saveAndNextRound}
        >
          {he.result.again}
        </button>
      </div>
      {showPhoto && markedImage && (
        <ImageModal src={markedImage} onClose={() => setShowPhoto(false)} />
      )}
    </div>
  )
}
