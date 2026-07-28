import type { Correction, SightKind } from '../core/types'

const ACCENT = '#0a5c36'
const NEUTRAL = '#888888'
const FG = '#111111'
const BODY_FILL = '#e5e5e5'
const RAIL_FILL = '#444444'

type ArrowDir = 'up' | 'down' | 'left' | 'right'

const DIR_VEC: Record<ArrowDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Bold filled arrow as a single polygon. (tipX, tipY) is the arrow tip. */
function arrowPoints(tipX: number, tipY: number, length: number, dir: ArrowDir): string {
  const u = DIR_VEC[dir]
  const px = -u.y
  const py = u.x
  const shaftHalf = 6
  const headHalf = 13
  const headLen = 16
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
  return pts.map(([x, y]) => `${x},${y}`).join(' ')
}

function clicksLabel(clicks: number): string {
  return clicks === 1 ? 'קליק אחד' : `${clicks} קליקים`
}

function ZeroCheck({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x - 22} ${y} L ${x - 6} ${y + 18} L ${x + 26} ${y - 22}`}
      fill="none"
      stroke={ACCENT}
      strokeWidth={8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function HeText({
  x,
  y,
  children,
  anchor = 'middle',
  size = 15,
  bold = false,
}: {
  x: number
  y: number
  children: string
  anchor?: 'start' | 'middle' | 'end'
  size?: number
  bold?: boolean
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      direction="rtl"
      fill={FG}
      fontFamily="inherit"
      fontSize={size}
      fontWeight={bold ? 700 : 400}
    >
      {children}
    </text>
  )
}

/** Picatinny rail segment with notches. */
function Rail({ x, y, width }: { x: number; y: number; width: number }) {
  const notches = []
  for (let nx = x + 6; nx + 11 <= x + width - 6; nx += 20) {
    notches.push(<rect key={nx} x={nx} y={y - 8} width={11} height={8} fill={RAIL_FILL} />)
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={10} fill={RAIL_FILL} />
      {notches}
    </g>
  )
}

function ReflexDiagram({ correction }: { correction: Correction }) {
  const elDir = correction.elevation.direction
  const wnDir = correction.windage.direction
  const elActive = elDir !== 'none'
  const wnActive = wnDir !== 'none'
  const zeroed = !elActive && !wnActive
  return (
    <svg
      viewBox="0 0 360 220"
      width="100%"
      role="img"
      aria-label="תרשים כוונת רפלקס"
      style={{ direction: 'rtl', height: 'auto', display: 'block' }}
    >
      {/* Picatinny rail */}
      <Rail x={30} y={162} width={230} />
      {/* Sight body (side profile) */}
      <rect x={90} y={122} width={135} height={40} rx={4} fill={BODY_FILL} stroke={FG} strokeWidth={2} />
      {/* Angled lens window frame + glass */}
      <polygon points="100,122 112,52 178,46 186,122" fill={BODY_FILL} stroke={FG} strokeWidth={2} />
      <polygon points="112,116 121,62 170,58 176,116" fill="#eef6ff" stroke={FG} strokeWidth={2} />
      {/* Red dot */}
      <circle cx={145} cy={88} r={4} fill="#d81b1b" />
      {/* Elevation adjuster screw — on top of the body */}
      <rect
        x={192}
        y={108}
        width={26}
        height={14}
        rx={3}
        fill={elActive ? ACCENT : NEUTRAL}
        stroke={FG}
        strokeWidth={2}
      />
      <line x1={198} y1={115} x2={212} y2={115} stroke={FG} strokeWidth={2} />
      <HeText x={205} y={102} bold={elActive}>
        גובה
      </HeText>
      {/* Windage adjuster screw — on the rear face */}
      <rect
        x={225}
        y={132}
        width={14}
        height={20}
        rx={3}
        fill={wnActive ? ACCENT : NEUTRAL}
        stroke={FG}
        strokeWidth={2}
      />
      <line x1={232} y1={137} x2={232} y2={147} stroke={FG} strokeWidth={2} />
      <HeText x={252} y={129} bold={wnActive}>
        צד
      </HeText>
      {/* Impact-direction arrows */}
      {elActive && (
        <g>
          <polygon
            points={arrowPoints(300, elDir === 'up' ? 38 : 100, 62, elDir === 'up' ? 'up' : 'down')}
            fill={ACCENT}
          />
          <HeText x={300} y={126} bold>
            {clicksLabel(correction.elevation.clicks)}
          </HeText>
        </g>
      )}
      {wnActive && (
        <g>
          <polygon
            points={arrowPoints(wnDir === 'left' ? 268 : 348, 162, 80, wnDir === 'left' ? 'left' : 'right')}
            fill={ACCENT}
          />
          <HeText x={308} y={196} bold>
            {clicksLabel(correction.windage.clicks)}
          </HeText>
        </g>
      )}
      {zeroed && <ZeroCheck x={306} y={80} />}
    </svg>
  )
}

function IronDiagram({ correction }: { correction: Correction }) {
  const elDir = correction.elevation.direction
  const wnDir = correction.windage.direction
  const elActive = elDir !== 'none'
  const wnActive = wnDir !== 'none'
  const zeroed = !elActive && !wnActive
  return (
    <svg
      viewBox="0 0 360 220"
      width="100%"
      role="img"
      aria-label="תרשים כוונות מכניות"
      style={{ direction: 'rtl', height: 'auto', display: 'block' }}
    >
      {/* ——— Front sight: post between protective ears ——— */}
      <g>
        <rect x={25} y={145} width={130} height={18} rx={3} fill={BODY_FILL} stroke={FG} strokeWidth={2} />
        <polygon points="33,145 33,88 57,58 67,68 45,94 45,145" fill={BODY_FILL} stroke={FG} strokeWidth={2} />
        <polygon points="147,145 147,88 123,58 113,68 135,94 135,145" fill={BODY_FILL} stroke={FG} strokeWidth={2} />
        {/* Adjustable front post */}
        <rect
          x={84}
          y={76}
          width={12}
          height={69}
          fill={elActive ? ACCENT : NEUTRAL}
          stroke={FG}
          strokeWidth={2}
        />
        <HeText x={90} y={186} bold={elActive}>
          חזית — גובה
        </HeText>
        {elActive && (
          <g>
            <polygon
              points={arrowPoints(168, elDir === 'up' ? 38 : 100, 62, elDir === 'up' ? 'up' : 'down')}
              fill={ACCENT}
            />
            <HeText x={168} y={28} bold>
              {clicksLabel(correction.elevation.clicks)}
            </HeText>
          </g>
        )}
      </g>
      {/* ——— Rear sight: aperture with windage drum ——— */}
      <g>
        <rect x={200} y={145} width={140} height={18} rx={3} fill={BODY_FILL} stroke={FG} strokeWidth={2} />
        <rect x={238} y={70} width={58} height={76} rx={6} fill={BODY_FILL} stroke={FG} strokeWidth={2} />
        {/* Aperture */}
        <circle cx={267} cy={102} r={13} fill="#ffffff" stroke={FG} strokeWidth={4} />
        {/* Windage drum (knurled knob on the side) */}
        <rect
          x={298}
          y={92}
          width={26}
          height={22}
          rx={3}
          fill={wnActive ? ACCENT : NEUTRAL}
          stroke={FG}
          strokeWidth={2}
        />
        <line x1={305} y1={96} x2={305} y2={110} stroke={FG} strokeWidth={2} />
        <line x1={311} y1={96} x2={311} y2={110} stroke={FG} strokeWidth={2} />
        <line x1={317} y1={96} x2={317} y2={110} stroke={FG} strokeWidth={2} />
        <HeText x={270} y={186} bold={wnActive}>
          אחורית — צד
        </HeText>
        {wnActive && (
          <g>
            <polygon
              points={arrowPoints(wnDir === 'left' ? 230 : 310, 52, 80, wnDir === 'left' ? 'left' : 'right')}
              fill={ACCENT}
            />
            <HeText x={270} y={30} bold>
              {clicksLabel(correction.windage.clicks)}
            </HeText>
          </g>
        )}
      </g>
      {zeroed && <ZeroCheck x={180} y={40} />}
    </svg>
  )
}

/**
 * Pure illustration of the sight, marking where the adjusters are and which
 * way the point of impact must move. Knob-turning instructions live in the
 * profile's Hebrew text — here only impact-direction arrows are drawn.
 */
export function SightDiagram({
  kind,
  correction,
}: {
  kind: SightKind
  correction: Correction
}): JSX.Element | null {
  if (kind === 'reflex') return <ReflexDiagram correction={correction} />
  if (kind === 'iron') return <IronDiagram correction={correction} />
  return null
}
