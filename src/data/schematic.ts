import type { Vec2 } from '../core/types'

/** The bundled schematic target: 40x40cm at 20px per cm, aim point at center. */
export const SCHEMATIC = {
  url: `${import.meta.env.BASE_URL}schematic-target.svg`,
  width: 800,
  height: 800,
  pxPerCm: 20,
  aimPoint: { x: 400, y: 400 } as Vec2,
}
