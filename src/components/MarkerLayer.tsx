import type { Hit, Vec2 } from '../core/types'

interface MarkerLayerProps {
  hits?: Hit[]
  aimPoint?: Vec2 | null
  mpi?: Vec2 | null
  calibrationPoints?: Vec2[]
  /** Inverse of the current stage scale, so markers keep a constant screen size. */
  markerScale?: number
}

export function MarkerLayer({
  hits = [],
  aimPoint,
  mpi,
  calibrationPoints = [],
  markerScale = 1,
}: MarkerLayerProps) {
  const style = (p: Vec2) => ({
    left: p.x,
    top: p.y,
    transform: `translate(-50%, -50%) scale(${markerScale})`,
  })

  return (
    <>
      {calibrationPoints.map((p, i) => (
        <div key={`cal${i}`} className="marker marker--cal" style={style(p)} />
      ))}
      {aimPoint && (
        <div className="marker marker--aim" style={style(aimPoint)}>
          ✛
        </div>
      )}
      {hits.map((h, i) => (
        <div
          key={h.id}
          className={`marker marker--hit${h.excluded ? ' marker--excluded' : ''}`}
          style={style(h.posPx)}
        >
          {i + 1}
        </div>
      ))}
      {mpi && (
        <div className="marker marker--mpi" style={style(mpi)}>
          ✕
        </div>
      )}
    </>
  )
}
