import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { ZoomableStage } from '../components/ZoomableStage'
import { MarkerLayer } from '../components/MarkerLayer'
import { Magnifier } from '../components/Magnifier'
import { computePxPerCm, validateCalibration } from '../core/calibration'
import type { Vec2 } from '../core/types'

type Press = { image: Vec2; screen: Vec2 } | null

/** Manual two-point scale calibration — fallback for non-A4 targets. */
export function CalibrateScreen() {
  const navigate = useNavigate()
  const { photoUrl, photoSize, setCalibrationPoints } = useWizardStore()
  const [points, setPoints] = useState<Vec2[]>([])
  const [distanceCm, setDistanceCm] = useState(1)
  const [customCm, setCustomCm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [press, setPress] = useState<Press>(null)
  const [scale, setScale] = useState(1)

  if (!photoUrl || !photoSize) return <Navigate to="/target" replace />

  const onTap = (p: Vec2) => {
    setError(null)
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
  }

  const effectiveCm = customCm !== '' ? parseFloat(customCm) : distanceCm

  const confirmPoints = () => {
    const [a, b] = points
    const v = validateCalibration(a, b, effectiveCm)
    if (!v.ok) {
      setError(v.reason === 'points-too-close' ? he.calibrate.tooClose : he.calibrate.badDistance)
      return
    }
    setCalibrationPoints(a, b, effectiveCm, computePxPerCm(a, b, effectiveCm))
    navigate('/aim')
  }

  return (
    <div className="screen">
      <StepHeader title={he.calibrate.title} backTo="/corners" showProfile />
      <div style={{ padding: '10px 16px', borderBlockEnd: '2px solid var(--color-border)' }}>
        <strong>{he.calibrate.stepPoints}</strong>
        {error && <div style={{ color: 'var(--color-danger)', fontWeight: 700 }}>{error}</div>}
      </div>
      <div className="screen-body screen-body--flush" style={{ position: 'relative' }}>
        <ZoomableStage
          imageUrl={photoUrl}
          imageWidth={photoSize.width}
          imageHeight={photoSize.height}
          onTap={onTap}
          onPress={setPress}
          onScaleChange={setScale}
        >
          <MarkerLayer calibrationPoints={points} markerScale={1 / scale} />
        </ZoomableStage>
        {press && (
          <Magnifier
            imageUrl={photoUrl}
            imageWidth={photoSize.width}
            imageHeight={photoSize.height}
            imagePoint={press.image}
            screenPoint={press.screen}
          />
        )}
      </div>
      <div style={{ padding: '10px 16px' }} className="chips">
        <button
          type="button"
          className={`chip${customCm === '' && distanceCm === 1 ? ' chip--active' : ''}`}
          onClick={() => {
            setDistanceCm(1)
            setCustomCm('')
          }}
        >
          {he.calibrate.presetSquare}
        </button>
        <button
          type="button"
          className={`chip${customCm === '' && distanceCm === 10 ? ' chip--active' : ''}`}
          onClick={() => {
            setDistanceCm(10)
            setCustomCm('')
          }}
        >
          {he.calibrate.preset10}
        </button>
        <input
          type="number"
          inputMode="decimal"
          placeholder={he.calibrate.customCm}
          value={customCm}
          onChange={(e) => setCustomCm(e.target.value)}
          style={{
            width: 90,
            minHeight: 'var(--tap-min)',
            border: '2px solid var(--color-border)',
            borderRadius: 999,
            padding: '0 12px',
            fontSize: 'var(--text-base)',
          }}
        />
      </div>
      <div className="action-bar action-bar--row">
        <button
          type="button"
          className="big-button big-button--secondary"
          onClick={() => {
            setError(null)
            setPoints([])
          }}
        >
          {he.calibrate.redo}
        </button>
        <button
          type="button"
          className="cta-button"
          disabled={points.length !== 2}
          onClick={confirmPoints}
        >
          {he.calibrate.next}
        </button>
      </div>
    </div>
  )
}
