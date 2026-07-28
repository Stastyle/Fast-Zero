import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { ZoomableStage } from '../components/ZoomableStage'
import { MarkerLayer } from '../components/MarkerLayer'
import { Magnifier } from '../components/Magnifier'
import { computeMpiPx, distancePx } from '../core/geometry'
import { SCHEMATIC } from '../data/schematic'
import type { Vec2 } from '../core/types'

type Press = { image: Vec2; screen: Vec2 } | null

/** Screen-space distance (px) under which a tap selects an existing marker instead of adding. */
const MARKER_TAP_RADIUS = 16

export function TapHitsScreen() {
  const navigate = useNavigate()
  const { photoUrl, photoSize, calibration, hits, addHit, toggleExcluded, removeHit, undoLastHit } =
    useWizardStore()
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null)
  const [press, setPress] = useState<Press>(null)
  const [scale, setScale] = useState(1)

  const isSchematic = calibration.mode === 'schematic'
  const imageUrl = isSchematic ? SCHEMATIC.url : photoUrl
  const size = isSchematic
    ? { width: SCHEMATIC.width, height: SCHEMATIC.height }
    : photoSize

  const hasScale = calibration.pxPerCm !== null || calibration.homography !== null
  if (!imageUrl || !size || !hasScale || !calibration.aimPointPx) {
    return <Navigate to="/target" replace />
  }

  const mpi = computeMpiPx(hits)
  const included = hits.filter((h) => !h.excluded)
  const excluded = hits.length - included.length
  const selectedHit = hits.find((h) => h.id === selectedHitId) ?? null

  const onTap = (p: Vec2) => {
    // A tap near an existing marker selects it (exclude/remove popover); otherwise adds a hit.
    const near = hits.find((h) => distancePx(h.posPx, p) * scale < MARKER_TAP_RADIUS)
    if (near) {
      setSelectedHitId(near.id === selectedHitId ? null : near.id)
    } else {
      setSelectedHitId(null)
      addHit(p)
    }
  }

  return (
    <div className="screen">
      <StepHeader title={he.hits.title} backTo={isSchematic ? '/target' : '/aim'} />
      <div style={{ padding: '8px 16px', borderBlockEnd: '2px solid var(--color-border)' }}>
        <span className="hint">{he.hits.instruction}</span>
      </div>
      <div className="screen-body screen-body--flush" style={{ position: 'relative' }}>
        <ZoomableStage
          imageUrl={imageUrl}
          imageWidth={size.width}
          imageHeight={size.height}
          onTap={onTap}
          onPress={setPress}
          onScaleChange={setScale}
        >
          <MarkerLayer
            hits={hits}
            aimPoint={calibration.aimPointPx}
            mpi={mpi}
            markerScale={1 / scale}
          />
        </ZoomableStage>
        {press && (
          <Magnifier
            imageUrl={imageUrl}
            imageWidth={size.width}
            imageHeight={size.height}
            imagePoint={press.image}
            screenPoint={press.screen}
          />
        )}
        {selectedHit && (
          <div className="hit-popover">
            <button
              type="button"
              className="big-button big-button--secondary"
              style={{ flex: 1 }}
              onClick={() => {
                toggleExcluded(selectedHit.id)
                setSelectedHitId(null)
              }}
            >
              {selectedHit.excluded ? he.hits.include : he.hits.exclude}
            </button>
            <button
              type="button"
              className="big-button big-button--danger"
              style={{ flex: 1 }}
              onClick={() => {
                removeHit(selectedHit.id)
                setSelectedHitId(null)
              }}
            >
              {he.hits.remove}
            </button>
          </div>
        )}
      </div>
      <div className="bottom-bar">
        <div style={{ flex: 1, fontWeight: 700 }}>
          {he.hits.count(hits.length)}
          {excluded > 0 && (
            <span className="hint"> · {he.hits.excludedCount(excluded)}</span>
          )}
          {included.length > 0 && included.length < 3 && (
            <div className="hint" style={{ color: 'var(--color-warn)' }}>
              {he.hits.fewHitsWarning}
            </div>
          )}
        </div>
        <button
          type="button"
          className="big-button big-button--secondary"
          style={{ width: 'auto' }}
          disabled={hits.length === 0}
          onClick={() => {
            setSelectedHitId(null)
            undoLastHit()
          }}
        >
          {he.hits.undo}
        </button>
        <button
          type="button"
          className="big-button"
          style={{ width: 'auto', flex: 1 }}
          disabled={included.length === 0}
          onClick={() => navigate('/result')}
        >
          {he.hits.compute}
        </button>
      </div>
    </div>
  )
}
