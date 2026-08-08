import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { ZoomableStage } from '../components/ZoomableStage'
import { MarkerLayer } from '../components/MarkerLayer'
import { Magnifier } from '../components/Magnifier'
import { computeMpiPx, distancePx, extremeSpreadCm, makeCmConverter } from '../core/geometry'
import { SCHEMATIC } from '../data/schematic'
import { detectHolesInPhoto } from './photoUtils'
import type { HoleCandidate } from '../core/holeDetect'
import type { Vec2 } from '../core/types'

type Press = { image: Vec2; screen: Vec2 } | null

/** Screen-space distance (px) under which a tap selects an existing marker instead of adding. */
const MARKER_TAP_RADIUS = 16

/** A suggestion this close (image px) to a marked hit is the same hole — hide it. */
const suggestionDedupePx = (s: HoleCandidate) => Math.max(18, s.radius * 2)

export function TapHitsScreen() {
  const navigate = useNavigate()
  const {
    photoUrl,
    photoSize,
    calibration,
    hits,
    addHit,
    toggleExcluded,
    removeHit,
    undoLastHit,
    profileId,
  } = useWizardStore()
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null)
  const [press, setPress] = useState<Press>(null)
  const [scale, setScale] = useState(1)
  /** Detected hole candidates (photo px). Suggestions only — never auto-added. */
  const [suggestions, setSuggestions] = useState<HoleCandidate[]>([])

  const isSchematic = calibration.mode === 'schematic'
  const imageUrl = isSchematic ? SCHEMATIC.url : photoUrl
  const size = isSchematic
    ? { width: SCHEMATIC.width, height: SCHEMATIC.height }
    : photoSize

  // Detect once per photo, async and best-effort. Schematic mode: nothing.
  useEffect(() => {
    setSuggestions([])
    if (isSchematic || !photoUrl || !photoSize) return
    let cancelled = false
    detectHolesInPhoto(photoUrl, photoSize).then((found) => {
      if (!cancelled) setSuggestions(found)
    })
    return () => {
      cancelled = true
    }
  }, [isSchematic, photoUrl, photoSize])

  if (!profileId) return <Navigate to="/profiles" replace />
  const toCm = makeCmConverter(calibration)
  if (!imageUrl || !size || !toCm || !calibration.aimPointPx) {
    return <Navigate to="/target" replace />
  }

  const mpi = computeMpiPx(hits)
  const included = hits.filter((h) => !h.excluded)
  const excluded = hits.length - included.length
  const selectedHit = hits.find((h) => h.id === selectedHitId) ?? null
  // Live group size — updates with every tap, not only after computing.
  const spreadCm =
    included.length > 1
      ? extremeSpreadCm(included.map((h) => toCm(h.posPx, calibration.aimPointPx!)))
      : null

  // Suggestions already covered by a marked hit disappear (same hole).
  const visibleSuggestions = suggestions.filter(
    (s) => !hits.some((h) => distancePx(h.posPx, s.center) < suggestionDedupePx(s)),
  )

  const onTap = (p: Vec2) => {
    // A tap near an existing marker selects it (inline actions below); otherwise adds a hit.
    const near = hits.find((h) => distancePx(h.posPx, p) * scale < MARKER_TAP_RADIUS)
    if (near) {
      setSelectedHitId(near.id === selectedHitId ? null : near.id)
      return
    }
    setSelectedHitId(null)
    // A tap on a suggested marker confirms it as a hit at the detected center.
    const suggested = visibleSuggestions.find(
      (s) => distancePx(s.center, p) * scale < Math.max(MARKER_TAP_RADIUS, s.radius * scale),
    )
    addHit(suggested ? suggested.center : p)
  }

  const confirmAllSuggestions = () => {
    visibleSuggestions.forEach((s) => addHit(s.center))
    setSuggestions([])
  }

  return (
    <div className="screen">
      <StepHeader title={he.hits.title} backTo={isSchematic ? '/target' : '/aim'} showProfile />
      <div className="screen-note">{he.hits.instruction}</div>
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
            suggestions={visibleSuggestions.map((s) => s.center)}
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
      </div>
      {/* Actions live in normal flow — nothing ever floats over the main button. */}
      <div className="action-bar">
        {visibleSuggestions.length > 0 && (
          <div className="action-row">
            <span className="action-row-label">
              {he.hits.suggestionsFound(visibleSuggestions.length)}
            </span>
            <button type="button" className="chip" onClick={confirmAllSuggestions}>
              {he.hits.confirmAllSuggestions}
            </button>
            <button type="button" className="chip" onClick={() => setSuggestions([])}>
              {he.hits.dismissSuggestions}
            </button>
          </div>
        )}
        {selectedHit ? (
          <div className="action-row">
            <span className="action-row-label">
              {he.hits.selectedHit(hits.indexOf(selectedHit) + 1)}
            </span>
            <button
              type="button"
              className="chip"
              onClick={() => {
                toggleExcluded(selectedHit.id)
                setSelectedHitId(null)
              }}
            >
              {selectedHit.excluded ? he.hits.include : he.hits.exclude}
            </button>
            <button
              type="button"
              className="chip chip--danger"
              onClick={() => {
                removeHit(selectedHit.id)
                setSelectedHitId(null)
              }}
            >
              {he.hits.remove}
            </button>
            <button type="button" className="chip" onClick={() => setSelectedHitId(null)}>
              {he.common.close}
            </button>
          </div>
        ) : (
          <div className="action-row">
            <span className="action-row-label">
              <strong>{he.hits.count(hits.length)}</strong>
              {excluded > 0 && ` · ${he.hits.excludedCount(excluded)}`}
              {spreadCm !== null && (
                <strong> · {he.result.spread(spreadCm.toFixed(1))}</strong>
              )}
              {included.length > 0 && included.length < 3 && (
                <span className="action-row-warning"> · {he.hits.fewHitsWarning}</span>
              )}
            </span>
            <button
              type="button"
              className="chip"
              disabled={hits.length === 0}
              onClick={() => {
                setSelectedHitId(null)
                undoLastHit()
              }}
            >
              ↶ {he.hits.undo}
            </button>
          </div>
        )}
        <button
          type="button"
          className="cta-button"
          disabled={included.length === 0}
          onClick={() => navigate('/result')}
        >
          {he.hits.compute}
        </button>
      </div>
    </div>
  )
}
