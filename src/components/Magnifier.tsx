import type { Vec2 } from '../core/types'

interface MagnifierProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  /** Point being pressed, in image pixels. */
  imagePoint: Vec2
  /** Pointer position relative to the stage container. */
  screenPoint: Vec2
  zoom?: number
}

const SIZE = 120

/** Loupe shown above the finger so the fingertip doesn't hide the bullet hole. */
export function Magnifier({
  imageUrl,
  imageWidth,
  imageHeight,
  imagePoint,
  screenPoint,
  zoom = 3,
}: MagnifierProps) {
  return (
    <div
      className="magnifier"
      style={{
        left: screenPoint.x - SIZE / 2,
        top: screenPoint.y - SIZE - 40,
        backgroundImage: `url(${imageUrl})`,
        backgroundColor: '#fff',
        backgroundSize: `${imageWidth * zoom}px ${imageHeight * zoom}px`,
        backgroundPosition: `${SIZE / 2 - imagePoint.x * zoom}px ${SIZE / 2 - imagePoint.y * zoom}px`,
      }}
    />
  )
}
