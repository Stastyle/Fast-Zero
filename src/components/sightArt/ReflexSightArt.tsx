export interface AxisMark {
  clicks: number
  /** direction the IMPACT must move; 'none' = this axis is zeroed */
  direction: 'up' | 'down' | 'left' | 'right' | 'none'
  /** which way to TURN the adjuster: clockwise or counter-clockwise */
  turn: 'cw' | 'ccw'
}

type ImpactDir = 'up' | 'down' | 'left' | 'right'

const GREEN = '#0a5c36'
const AMBER = '#d97706'
const INK = '#0d1b12'
const OUTLINE = '#0f0f10'
const ENGRAVE = '#c7c7cc'

const DIR_VEC: Record<ImpactDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

function clicksLabel(clicks: number): string {
  return clicks === 1 ? 'סובב קליק אחד' : `סובב ${clicks} קליקים`
}

/** Bold filled impact arrow as a single polygon. (tipX, tipY) is the arrow tip. */
function impactArrowPoints(tipX: number, tipY: number, length: number, dir: ImpactDir): string {
  const u = DIR_VEC[dir]
  const px = -u.y
  const py = u.x
  const shaftHalf = 6
  const headHalf = 14
  const headLen = 18
  const tailX = tipX - u.x * length
  const tailY = tipY - u.y * length
  const baseX = tipX - u.x * headLen
  const baseY = tipY - u.y * headLen
  const pts: Array<[number, number]> = [
    [tailX - px * shaftHalf, tailY - py * shaftHalf],
    [baseX - px * shaftHalf, baseY - py * shaftHalf],
    [baseX - px * headHalf, baseY - py * headHalf],
    [tipX, tipY],
    [baseX + px * headHalf, baseY + py * headHalf],
    [baseX + px * shaftHalf, baseY + py * shaftHalf],
    [tailX + px * shaftHalf, tailY + py * shaftHalf],
  ]
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

/**
 * ~270° rotation arc wrapped around a knob, with a tangent arrowhead.
 * `gapAt` is the screen angle (deg, y-down) of the 90° gap centre.
 * cw arcs run clockwise ON SCREEN; ccw the opposite way.
 */
function RotationArrow({
  cx,
  cy,
  r,
  turn,
  gapAt,
}: {
  cx: number
  cy: number
  r: number
  turn: 'cw' | 'ccw'
  gapAt: number
}) {
  const start = turn === 'cw' ? gapAt + 45 : gapAt - 45
  const end = turn === 'cw' ? gapAt - 45 : gapAt + 45
  const sweep = turn === 'cw' ? 1 : 0
  const [sx, sy] = polar(cx, cy, r, start)
  const [ex, ey] = polar(cx, cy, r, end)
  const rad = (end * Math.PI) / 180
  const tx = turn === 'cw' ? -Math.sin(rad) : Math.sin(rad)
  const ty = turn === 'cw' ? Math.cos(rad) : -Math.cos(rad)
  const px = -ty
  const py = tx
  const head = 12
  const half = 7.5
  const tip: [number, number] = [ex + tx * head, ey + ty * head]
  const points = [
    tip,
    [ex + px * half, ey + py * half],
    [ex - px * half, ey - py * half],
  ]
    .map((p) => p.map((n) => n.toFixed(1)).join(','))
    .join(' ')
  return (
    <g>
      <path
        d={`M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 1 ${sweep} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
        fill="none"
        stroke={AMBER}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <polygon points={points} fill={AMBER} />
    </g>
  )
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i + Math.PI / 6
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

function HexScrew({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="url(#rsaSteel)" stroke={OUTLINE} strokeWidth={1.2} />
      <polygon points={hexPoints(cx, cy, r * 0.55)} fill="#151517" />
    </g>
  )
}

/** Knurling texture: short repeated vertical lines. */
function knurl(x1: number, x2: number, step: number, y1: number, y2: number, stroke: string) {
  const lines: JSX.Element[] = []
  for (let x = x1; x <= x2; x += step) {
    lines.push(<line key={x} x1={x} y1={y1} x2={x} y2={y2} stroke={stroke} strokeWidth={1.2} />)
  }
  return lines
}

function HeText({
  x,
  y,
  children,
  size = 16,
  fill = INK,
  weight = 700,
}: {
  x: number
  y: number
  children: string
  size?: number
  fill?: string
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      direction="rtl"
      fill={fill}
      fontFamily="inherit"
      fontSize={size}
      fontWeight={weight}
    >
      {children}
    </text>
  )
}

/**
 * Meprolight M5 / RDS-style military reflex sight, side profile (muzzle to
 * the LEFT), with the relevant adjuster turret highlighted, a curved amber
 * turn-direction arrow around it and a bold green impact-direction arrow.
 */
export function ReflexSightArt({
  elevation,
  windage,
}: {
  elevation: AxisMark
  windage: AxisMark
}): JSX.Element {
  const elActive = elevation.direction !== 'none'
  const wnActive = windage.direction !== 'none'
  const zeroed = !elActive && !wnActive
  const elDir: ImpactDir = elevation.direction === 'down' ? 'down' : 'up'
  const wnDir: ImpactDir = windage.direction === 'right' ? 'right' : 'left'
  const knurlInk = '#1c1c1e'
  const knurlGreen = '#063d24'
  return (
    <svg
      viewBox="0 0 420 260"
      width="100%"
      role="img"
      aria-label="איור כוונת רפלקס צבאית מהצד עם סימון כפתורי הכיוונון"
      style={{ display: 'block', height: 'auto' }}
    >
      <defs>
        <linearGradient id="rsaBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3c" />
          <stop offset="0.45" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="rsaHood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48484a" />
          <stop offset="0.5" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="rsaRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3c" />
          <stop offset="1" stopColor="#151517" />
        </linearGradient>
        <linearGradient id="rsaSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e6e73" />
          <stop offset="1" stopColor="#3a3a3c" />
        </linearGradient>
        <linearGradient id="rsaGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12824e" />
          <stop offset="1" stopColor="#0a5c36" />
        </linearGradient>
        <linearGradient id="rsaGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d6e9f7" />
          <stop offset="0.45" stopColor="#b7d4e8" />
          <stop offset="1" stopColor="#8fb3cd" />
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={208} cy={213} rx={152} ry={6} fill="#000000" opacity={0.12} />

      {/* ——— Picatinny rail base ——— */}
      <polygon points="64,184 352,184 344,192 72,192" fill="#3a3a3c" stroke={OUTLINE} strokeWidth={1} />
      <rect x={72} y={190} width={272} height={18} rx={2} fill="url(#rsaRail)" stroke={OUTLINE} strokeWidth={1.5} />
      {/* Cross-slots */}
      <rect x={98} y={190} width={12} height={18} fill="#0e0e10" />
      <rect x={152} y={190} width={12} height={18} fill="#0e0e10" />
      <rect x={206} y={190} width={12} height={18} fill="#0e0e10" />
      <rect x={260} y={190} width={12} height={18} fill="#0e0e10" />
      {/* Side clamp bolt */}
      <circle cx={316} cy={199} r={8.5} fill="url(#rsaSteel)" stroke={OUTLINE} strokeWidth={1.5} />
      <polygon points={hexPoints(316, 199, 4.8)} fill="#151517" />

      {/* ——— Mount plate ——— */}
      <rect x={94} y={174} width={224} height={12} rx={2} fill="#2c2c2e" stroke={OUTLINE} strokeWidth={1.2} />

      {/* ——— Armored housing (side profile, muzzle left) ——— */}
      <rect x={88} y={104} width={222} height={74} rx={8} fill="url(#rsaBody)" stroke={OUTLINE} strokeWidth={1.5} />
      <line x1={96} y1={107} x2={304} y2={107} stroke="#6e6e73" strokeWidth={1.2} opacity={0.5} />
      {/* Panel lines */}
      <line x1={206} y1={110} x2={206} y2={174} stroke="#151517" strokeWidth={1.5} />
      <line x1={207.5} y1={110} x2={207.5} y2={174} stroke="#4a4a4e" strokeWidth={1} opacity={0.4} />
      <line x1={214} y1={152} x2={302} y2={152} stroke="#151517" strokeWidth={1.2} opacity={0.8} />
      {/* Body hex screws */}
      <HexScrew cx={216} cy={166} r={4} />
      <HexScrew cx={298} cy={166} r={4} />

      {/* ——— Protective hood + objective window ——— */}
      <rect x={84} y={54} width={116} height={126} rx={10} fill="url(#rsaHood)" stroke={OUTLINE} strokeWidth={1.5} />
      <line x1={86.5} y1={62} x2={86.5} y2={172} stroke="#6e6e73" strokeWidth={1.2} opacity={0.5} />
      <rect x={96} y={66} width={92} height={90} rx={6} fill="#151517" />
      <rect x={101} y={71} width={82} height={80} rx={4} fill="url(#rsaGlass)" />
      {/* Reflection streaks */}
      <polygon points="112,71 128,71 112,151 100,151" fill="#ffffff" opacity={0.28} />
      <polygon points="136,71 142,71 128,151 124,151" fill="#ffffff" opacity={0.14} />
      {/* Red dot */}
      <circle cx={142} cy={108} r={9} fill="#ff2d2d" opacity={0.25} />
      <circle cx={142} cy={108} r={4.5} fill="#ff2d2d" />
      {/* Hood screws */}
      <HexScrew cx={91.5} cy={61} r={3.5} />
      <HexScrew cx={192.5} cy={61} r={3.5} />

      {/* ——— Battery compartment bulge (rear) ——— */}
      <rect x={266} y={86} width={48} height={32} rx={12} fill="url(#rsaHood)" stroke={OUTLINE} strokeWidth={1.5} />
      <circle cx={302} cy={102} r={8} fill="url(#rsaSteel)" stroke={OUTLINE} strokeWidth={1.5} />
      <line x1={297} y1={97} x2={307} y2={107} stroke={OUTLINE} strokeWidth={2} />

      {/* ——— Elevation turret (top) ——— */}
      <rect x={210} y={96} width={44} height={10} rx={2} fill="#2c2c2e" stroke={OUTLINE} strokeWidth={1.2} />
      <rect
        x={214}
        y={74}
        width={36}
        height={24}
        rx={3}
        fill={elActive ? 'url(#rsaGreen)' : 'url(#rsaSteel)'}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      {knurl(218, 246, 4, 77, 95, elActive ? knurlGreen : knurlInk)}
      <rect
        x={211}
        y={68}
        width={42}
        height={9}
        rx={3}
        fill={elActive ? 'url(#rsaGreen)' : 'url(#rsaSteel)'}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      <line x1={222} y1={72.5} x2={242} y2={72.5} stroke={OUTLINE} strokeWidth={2.5} />
      <HeText x={232} y={122} size={12} fill={ENGRAVE} weight={600}>
        גובה
      </HeText>

      {/* ——— Windage turret (rear face) ——— */}
      <rect x={306} y={126} width={10} height={28} rx={2} fill="#2c2c2e" stroke={OUTLINE} strokeWidth={1.2} />
      <rect
        x={314}
        y={130}
        width={22}
        height={20}
        rx={3}
        fill={wnActive ? 'url(#rsaGreen)' : 'url(#rsaSteel)'}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      {knurl(318, 332, 3.5, 133, 147, wnActive ? knurlGreen : knurlInk)}
      <rect
        x={334}
        y={128}
        width={8}
        height={24}
        rx={3}
        fill={wnActive ? 'url(#rsaGreen)' : 'url(#rsaSteel)'}
        stroke={OUTLINE}
        strokeWidth={1.5}
      />
      <line x1={338} y1={134} x2={338} y2={146} stroke={OUTLINE} strokeWidth={2} />
      <HeText x={294} y={145} size={12} fill={ENGRAVE} weight={600}>
        צד
      </HeText>

      {/* ——— Elevation markup ——— */}
      {elActive && (
        <g>
          <RotationArrow cx={232} cy={84} r={30} turn={elevation.turn} gapAt={90} />
          <polygon
            points={impactArrowPoints(46, elDir === 'up' ? 26 : 98, 72, elDir)}
            fill={GREEN}
          />
          <HeText x={238} y={36}>{clicksLabel(elevation.clicks)}</HeText>
        </g>
      )}

      {/* ——— Windage markup ——— */}
      {wnActive && (
        <g>
          <RotationArrow cx={328} cy={140} r={24} turn={windage.turn} gapAt={180} />
          <polygon
            points={impactArrowPoints(wnDir === 'left' ? 116 : 244, 228, 104, wnDir)}
            fill={GREEN}
          />
          <HeText x={330} y={248}>{clicksLabel(windage.clicks)}</HeText>
        </g>
      )}

      {/* ——— Zeroed ——— */}
      {zeroed && (
        <path
          d="M 348 116 L 370 140 L 410 86"
          fill="none"
          stroke={GREEN}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
