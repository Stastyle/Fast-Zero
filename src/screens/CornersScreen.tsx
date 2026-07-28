import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { ZoomableStage } from '../components/ZoomableStage'
import { MarkerLayer } from '../components/MarkerLayer'
import { Magnifier } from '../components/Magnifier'
import { a4MappingFromCorners } from '../core/homography'
import type { Vec2 } from '../core/types'

type Press = { image: Vec2; screen: Vec2 } | null

/** Fallback scale flow: tap the 4 corners of the A4 page in the photo. */
export function CornersScreen() {
  const navigate = useNavigate()
  const { photoUrl, photoSize, setHomography } = useWizardStore()
  const [corners, setCorners] = useState<Vec2[]>([])
  const [error, setError] = useState<string | null>(null)
  const [press, setPress] = useState<Press>(null)
  const [scale, setScale] = useState(1)

  if (!photoUrl || !photoSize) return <Navigate to="/target" replace />

  const onTap = (p: Vec2) => {
    setError(null)
    setCorners((prev) => (prev.length >= 4 ? prev : [...prev, p]))
  }

  const confirm = () => {
    const mapping = a4MappingFromCorners(corners)
    if (!mapping.ok) {
      setError(he.corners.invalid)
      return
    }
    setHomography(mapping.homography)
    navigate('/aim')
  }

  return (
    <div className="screen">
      <StepHeader title={he.corners.title} backTo="/camera" />
      <div style={{ padding: '10px 16px', borderBlockEnd: '2px solid var(--color-border)' }}>
        <strong>{he.corners.instruction}</strong>
        <div className="hint">{he.corners.count(corners.length)}</div>
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
          <MarkerLayer calibrationPoints={corners} markerScale={1 / scale} />
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
      <div style={{ padding: '6px 16px' }}>
        <button
          type="button"
          className="chip"
          onClick={() => navigate('/calibrate')}
        >
          {he.corners.manual}
        </button>
      </div>
      <div className="bottom-bar">
        <button
          type="button"
          className="big-button big-button--secondary"
          style={{ flex: 1 }}
          disabled={corners.length === 0}
          onClick={() => {
            setError(null)
            setCorners((prev) => prev.slice(0, -1))
          }}
        >
          {he.corners.undo}
        </button>
        <button
          type="button"
          className="big-button"
          style={{ flex: 2 }}
          disabled={corners.length !== 4}
          onClick={confirm}
        >
          {he.corners.next}
        </button>
      </div>
    </div>
  )
}
