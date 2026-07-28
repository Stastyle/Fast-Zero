import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { ZoomableStage } from '../components/ZoomableStage'
import { MarkerLayer } from '../components/MarkerLayer'
import { Magnifier } from '../components/Magnifier'
import { makeCmConverter } from '../core/geometry'
import type { Vec2 } from '../core/types'

type Press = { image: Vec2; screen: Vec2 } | null

/** Tap the point you were aiming at. Reached after any scale source (camera crop, corners, manual). */
export function AimPointScreen() {
  const navigate = useNavigate()
  const { photoUrl, photoSize, calibration, setAimPoint } = useWizardStore()
  const [aim, setAim] = useState<Vec2 | null>(null)
  const [press, setPress] = useState<Press>(null)
  const [scale, setScale] = useState(1)

  // Same validity rule as the result computation — a zero/NaN scale must not
  // pass silently here only to dead-end at the result screen.
  const hasScale = makeCmConverter(calibration) !== null
  if (!photoUrl || !photoSize || !hasScale) return <Navigate to="/target" replace />

  return (
    <div className="screen">
      <StepHeader title={he.aim.title} backTo="/camera" />
      <div style={{ padding: '10px 16px', borderBlockEnd: '2px solid var(--color-border)' }}>
        <strong>{he.aim.instruction}</strong>
      </div>
      <div className="screen-body screen-body--flush" style={{ position: 'relative' }}>
        <ZoomableStage
          imageUrl={photoUrl}
          imageWidth={photoSize.width}
          imageHeight={photoSize.height}
          onTap={setAim}
          onPress={setPress}
          onScaleChange={setScale}
        >
          <MarkerLayer aimPoint={aim} markerScale={1 / scale} />
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
      <div className="bottom-bar">
        <button
          type="button"
          className="big-button big-button--secondary"
          style={{ flex: 1 }}
          disabled={!aim}
          onClick={() => setAim(null)}
        >
          {he.aim.redo}
        </button>
        <button
          type="button"
          className="big-button"
          style={{ flex: 2 }}
          disabled={!aim}
          onClick={() => {
            setAimPoint(aim!)
            navigate('/hits')
          }}
        >
          {he.aim.next}
        </button>
      </div>
    </div>
  )
}
