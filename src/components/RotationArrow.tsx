/**
 * Circular rotation arrow (≈270° arc with an arrowhead), amber on a white
 * halo so it reads on any photo. `turn` sets the sweep direction on screen.
 */
export function RotationArrow({ turn, size = 56 }: { turn: 'cw' | 'ccw'; size?: number }) {
  // One path drawn clockwise; the ccw variant is a horizontal mirror.
  const arc = 'M 24 6 A 18 18 0 1 1 6 24'
  const head = 'M 24 6 L 15 1 M 24 6 L 20 15'
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      style={turn === 'ccw' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <g fill="none" strokeLinecap="round">
        <path d={arc} stroke="#ffffff" strokeWidth={9} />
        <path d={head} stroke="#ffffff" strokeWidth={9} />
        <path d={arc} stroke="#d97706" strokeWidth={5} />
        <path d={head} stroke="#d97706" strokeWidth={5} />
      </g>
    </svg>
  )
}
