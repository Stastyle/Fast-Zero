export interface AxisMark {
  clicks: number
  /** direction the IMPACT must move; 'none' = this axis is zeroed */
  direction: 'up' | 'down' | 'left' | 'right' | 'none'
  /** which way to TURN the adjuster: clockwise or counter-clockwise */
  turn: 'cw' | 'ccw'
}

const GREEN = '#0a5c36'
const GREEN_EDGE = '#0f7a48'
const AMBER = '#d97706'
const INK = '#0d1b12'
const CAPTION = '#6e6e73'
const SLOT_DARK = '#111113'
const KNURL = '#141416'

type ArrowDir = Exclude<AxisMark['direction'], 'none'>

const DIR_VEC: Record<ArrowDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const rnd = (v: number): number => Math.round(v * 100) / 100

function clicksText(clicks: number): string {
  return clicks === 1 ? 'קליק אחד' : `${clicks} קליקים`
}

/** Bold filled impact arrow centered on (cx, cy), pointing toward dir. */
function ImpactArrow({ cx, cy, length, dir }: { cx: number; cy: number; length: number; dir: ArrowDir }) {
  const u = DIR_VEC[dir]
  const px = -u.y
  const py = u.x
  const shaftHalf = 5.5
  const headHalf = 12
  const headLen = 15
  const tipX = cx + (u.x * length) / 2
  const tipY = cy + (u.y * length) / 2
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
  return <polygon points={pts.map(([x, y]) => `${rnd(x)},${rnd(y)}`).join(' ')} fill={GREEN} />
}

function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/** ~270° amber rotation arc around a knob; cw arcs run clockwise on screen. */
function RotationArc({ cx, cy, r, turn }: { cx: number; cy: number; r: number; turn: 'cw' | 'ccw' }) {
  const start = -90
  const end = turn === 'cw' ? start + 270 : start - 270
  const sweep = turn === 'cw' ? 1 : 0
  const p0 = polar(cx, cy, r, start)
  const p1 = polar(cx, cy, r, end)
  const rad = (end * Math.PI) / 180
  const tx = turn === 'cw' ? -Math.sin(rad) : Math.sin(rad)
  const ty = turn === 'cw' ? Math.cos(rad) : -Math.cos(rad)
  const nx = -ty
  const ny = tx
  const head = [
    [p1.x + tx * 12, p1.y + ty * 12],
    [p1.x - tx * 1.5 + nx * 7, p1.y - ty * 1.5 + ny * 7],
    [p1.x - tx * 1.5 - nx * 7, p1.y - ty * 1.5 - ny * 7],
  ]
  return (
    <g>
      <path
        d={`M ${rnd(p0.x)} ${rnd(p0.y)} A ${r} ${r} 0 1 ${sweep} ${rnd(p1.x)} ${rnd(p1.y)}`}
        fill="none"
        stroke={AMBER}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <polygon points={head.map(([x, y]) => `${rnd(x)},${rnd(y)}`).join(' ')} fill={AMBER} />
    </g>
  )
}

/** Bold 'turn N clicks' label, RTL. */
function TurnLabel({ x, y, clicks }: { x: number; y: number; clicks: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      direction="rtl"
      fill={INK}
      fontFamily="inherit"
      fontSize={15.5}
      fontWeight={700}
    >
      {`סובב ${clicksText(clicks)}`}
    </text>
  )
}

function Caption({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      direction="rtl"
      fill={CAPTION}
      fontFamily="inherit"
      fontSize={12}
      fontWeight={600}
    >
      {children}
    </text>
  )
}

/** Slotted screw head. */
function Screw({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="url(#isa-knob)" stroke="#151517" strokeWidth={1} />
      <line
        x1={x - r * 0.62}
        y1={y + r * 0.36}
        x2={x + r * 0.62}
        y2={y - r * 0.36}
        stroke={SLOT_DARK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </g>
  )
}

/** Shared picatinny/receiver rail strip with cross slots and a clamp bolt. */
function RailStrip() {
  const slots = []
  for (let x = 30; x + 9 <= 396; x += 26) {
    slots.push(<rect key={x} x={x} y={210} width={9} height={12} fill={SLOT_DARK} />)
  }
  return (
    <g>
      <rect x={16} y={210} width={388} height={12} fill="url(#isa-rail)" />
      <line x1={16} y1={210.8} x2={404} y2={210.8} stroke="#6e6e73" strokeWidth={1} />
      {slots}
      <rect x={24} y={222} width={372} height={14} rx={3} fill="#2c2c2e" stroke="#1c1c1e" strokeWidth={1} />
      <line x1={30} y1={224} x2={390} y2={224} stroke="#48484a" strokeWidth={0.8} />
      <Screw x={60} y={229} r={6.5} />
      <Screw x={352} y={229} r={5} />
    </g>
  )
}

/** A2-style front sight tower with adjustable post and detent collar (elevation). */
function FrontTower({ active }: { active: boolean }) {
  const knurl = []
  for (let x = 301; x <= 322; x += 3) {
    knurl.push(<line key={x} x1={x} y1={99} x2={x} y2={108} stroke={KNURL} strokeWidth={1} />)
  }
  return (
    <g>
      {/* barrel + gas block hint */}
      <rect x={368} y={194} width={36} height={12} rx={3} fill="url(#isa-barrel)" stroke="#151517" strokeWidth={1} />
      <rect x={256} y={190} width={112} height={20} rx={4} fill="url(#isa-barrel)" stroke="#151517" strokeWidth={1} />
      <line x1={260} y1={193} x2={364} y2={193} stroke="#6e6e73" strokeWidth={0.8} />
      {/* tower body with sloped legs */}
      <polygon points="266,192 293,102 331,102 358,192" fill="url(#isa-tower)" stroke="#6e6e73" strokeWidth={1} />
      <line x1={277} y1={188} x2={300} y2={110} stroke="#1c1c1e" strokeWidth={1.2} />
      <line x1={347} y1={188} x2={324} y2={110} stroke="#1c1c1e" strokeWidth={1.2} />
      <line x1={270} y1={180} x2={354} y2={180} stroke="#1c1c1e" strokeWidth={1} />
      <Screw x={282} y={186} r={4} />
      <Screw x={342} y={186} r={4} />
      {/* top platform and protective ears */}
      <rect x={291} y={98} width={42} height={8} rx={2} fill="#2c2c2e" stroke="#1c1c1e" strokeWidth={1} />
      <rect x={289} y={54} width={11} height={52} rx={5} fill="url(#isa-tower)" stroke="#6e6e73" strokeWidth={1} />
      <rect x={324} y={54} width={11} height={52} rx={5} fill="url(#isa-tower)" stroke="#6e6e73" strokeWidth={1} />
      {/* round post */}
      <rect x={308.5} y={62} width={7} height={36} fill="#151517" />
      <line x1={310} y1={64} x2={310} y2={96} stroke="#48484a" strokeWidth={1} />
      {/* knurled detent collar — the elevation adjuster */}
      <rect x={299} y={97} width={26} height={13} fill="url(#isa-collar)" />
      {knurl}
      <ellipse cx={312} cy={110} rx={13} ry={3} fill="#1c1c1e" />
      <ellipse
        cx={312}
        cy={97}
        rx={13}
        ry={3.5}
        fill={active ? GREEN : '#3a3a3c'}
        stroke={active ? GREEN_EDGE : '#6e6e73'}
        strokeWidth={1}
      />
      {/* 4-notch detent marks on the collar's top face */}
      <rect x={297.5} y={96} width={3} height={2.4} rx={0.8} fill={KNURL} />
      <rect x={323.5} y={96} width={3} height={2.4} rx={0.8} fill={KNURL} />
      <rect x={310.6} y={99.3} width={2.8} height={2.2} rx={0.8} fill={KNURL} />
      <rect x={310.6} y={92.5} width={2.8} height={2.2} rx={0.8} fill={KNURL} />
      {active && <ellipse cx={312} cy={97} rx={15} ry={5} fill="none" stroke={GREEN} strokeWidth={2} />}
    </g>
  )
}

/** Rear aperture sight with peep disc, flip-leaf hint and knurled windage knob. */
function RearSight({ active }: { active: boolean }) {
  const knurl = []
  for (let a = 0; a < 360; a += 18) {
    const p1 = polar(138, 178, 16.5, a)
    const p2 = polar(138, 178, 21, a)
    knurl.push(
      <line
        key={a}
        x1={rnd(p1.x)}
        y1={rnd(p1.y)}
        x2={rnd(p2.x)}
        y2={rnd(p2.y)}
        stroke={KNURL}
        strokeWidth={1.3}
      />
    )
  }
  return (
    <g>
      {/* folded second aperture leaf (two-position L flip hint) */}
      <g transform="rotate(-55 66 132)">
        <rect x={62} y={102} width={12} height={32} rx={5} fill="#232325" stroke="#151517" strokeWidth={1} />
      </g>
      {/* housing */}
      <rect x={36} y={146} width={132} height={64} rx={7} fill="url(#isa-body)" stroke="#6e6e73" strokeWidth={1} />
      <line x1={42} y1={158} x2={162} y2={158} stroke="#1c1c1e" strokeWidth={1} />
      <line x1={42} y1={198} x2={110} y2={198} stroke="#1c1c1e" strokeWidth={1} />
      <Screw x={52} y={168} r={3.5} />
      <Screw x={52} y={190} r={3.5} />
      {/* stem, hinge pin and peep aperture disc */}
      <rect x={70} y={122} width={16} height={26} fill="#2c2c2e" stroke="#1c1c1e" strokeWidth={1} />
      <circle cx={78} cy={126} r={3} fill="#48484a" stroke="#151517" strokeWidth={1} />
      <circle cx={78} cy={100} r={27} fill="url(#isa-ring)" stroke="#6e6e73" strokeWidth={1.2} />
      <circle cx={78} cy={100} r={19} fill="#1c1c1e" />
      <circle cx={78} cy={100} r={10} fill="#3a3a3c" />
      <circle cx={78} cy={100} r={4.5} fill="#0a0a0b" />
      {/* knurled windage knob (face-on) with slot and index marks */}
      <line x1={138} y1={150} x2={138} y2={154.5} stroke="#8e8e93" strokeWidth={1.5} />
      <line x1={138} y1={201.5} x2={138} y2={206} stroke="#8e8e93" strokeWidth={1.5} />
      <line x1={110} y1={178} x2={114.5} y2={178} stroke="#8e8e93" strokeWidth={1.5} />
      <line x1={161.5} y1={178} x2={166} y2={178} stroke="#8e8e93" strokeWidth={1.5} />
      <circle
        cx={138}
        cy={178}
        r={21}
        fill="url(#isa-knob)"
        stroke={active ? GREEN : '#151517'}
        strokeWidth={active ? 3 : 1.5}
      />
      {knurl}
      <circle cx={138} cy={178} r={12} fill={active ? GREEN : '#2c2c2e'} stroke={active ? GREEN_EDGE : '#151517'} strokeWidth={1} />
      <rect x={129} y={176} width={18} height={4} rx={2} fill="#101012" />
    </g>
  )
}

export function IronSightArt({ elevation, windage }: { elevation: AxisMark; windage: AxisMark }): JSX.Element {
  const elActive = elevation.direction !== 'none'
  const wnActive = windage.direction !== 'none'
  const zeroed = !elActive && !wnActive
  return (
    <svg
      viewBox="0 0 420 260"
      width="100%"
      style={{ display: 'block', height: 'auto' }}
      role="img"
      aria-label="איור כוונות מכניות — חזית ואחורית"
    >
      <defs>
        <linearGradient id="isa-rail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48484a" />
          <stop offset="0.35" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="isa-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3a3c" />
          <stop offset="0.5" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="isa-tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48484a" />
          <stop offset="0.45" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="isa-barrel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6e6e73" />
          <stop offset="0.25" stopColor="#48484a" />
          <stop offset="0.6" stopColor="#2c2c2e" />
          <stop offset="1" stopColor="#151517" />
        </linearGradient>
        <linearGradient id="isa-knob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6e6e73" />
          <stop offset="0.5" stopColor="#3a3a3c" />
          <stop offset="1" stopColor="#232325" />
        </linearGradient>
        <linearGradient id="isa-collar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c1c1e" />
          <stop offset="0.5" stopColor="#5a5a5f" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
        <linearGradient id="isa-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#48484a" />
          <stop offset="1" stopColor="#1c1c1e" />
        </linearGradient>
      </defs>
      <RailStrip />
      {/* RIGHT half — A2 front sight tower (elevation) */}
      <FrontTower active={elActive} />
      {/* LEFT half — rear aperture sight (windage) */}
      <RearSight active={wnActive} />
      {elActive && (
        <g>
          <RotationArc cx={312} cy={97} r={25} turn={elevation.turn} />
          <ImpactArrow cx={388} cy={44} length={56} dir={elevation.direction as ArrowDir} />
          <TurnLabel x={306} y={34} clicks={elevation.clicks} />
        </g>
      )}
      {wnActive && (
        <g>
          <RotationArc cx={138} cy={178} r={30} turn={windage.turn} />
          <ImpactArrow cx={100} cy={36} length={105} dir={windage.direction as ArrowDir} />
          <TurnLabel x={142} y={138} clicks={windage.clicks} />
        </g>
      )}
      {zeroed && (
        <path
          d="M 172 108 L 202 140 L 254 76"
          fill="none"
          stroke={GREEN}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <Caption x={312} y={254}>{'חזית — גובה'}</Caption>
      <Caption x={102} y={254}>{'אחורית — צד'}</Caption>
    </svg>
  )
}
