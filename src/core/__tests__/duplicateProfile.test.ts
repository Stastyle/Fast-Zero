import { describe, expect, it } from 'vitest'
import { COPY_SUFFIX, DEFAULT_PROFILES, duplicateProfile } from '../../data/defaultProfiles'
import type { SightProfile } from '../types'

describe('duplicateProfile', () => {
  const m5 = DEFAULT_PROFILES.find((p) => p.id === 'mepro-reflex')!

  it('copies all zeroing values and clears builtIn', () => {
    const copy = duplicateProfile(m5)
    expect(copy.builtIn).toBe(false)
    expect(copy.kind).toBe(m5.kind)
    expect(copy.elevationCmPerClick).toBe(m5.elevationCmPerClick)
    expect(copy.windageCmPerClick).toBe(m5.windageCmPerClick)
    expect(copy.instructions).toEqual(m5.instructions)
    expect(copy.desiredImpactOffsetCm).toEqual(m5.desiredImpactOffsetCm)
  })

  it('suffixes the name and carries no id', () => {
    const copy = duplicateProfile(m5)
    expect(copy.name).toBe(`${m5.name}${COPY_SUFFIX}`)
    expect('id' in copy).toBe(false)
  })

  it('drops notes so spec/estimate badges do not survive edits', () => {
    expect(m5.notes).toBeTruthy()
    expect(duplicateProfile(m5).notes).toBeUndefined()
  })

  it('deep-copies nested objects so editing the copy never mutates the source', () => {
    const source: SightProfile = {
      ...m5,
      turns: { up: 'cw', down: 'ccw', left: 'ccw', right: 'cw' },
    }
    const copy = duplicateProfile(source)
    copy.instructions.up = 'שונה'
    copy.desiredImpactOffsetCm.up = 5
    copy.turns!.up = 'ccw'
    expect(source.instructions.up).toBe(m5.instructions.up)
    expect(source.desiredImpactOffsetCm.up).toBe(m5.desiredImpactOffsetCm.up)
    expect(source.turns!.up).toBe('cw')
  })

  it('preserves turns when the source defines them, omits when absent', () => {
    expect(duplicateProfile(m5).turns).toBeUndefined()
    const withTurns: SightProfile = {
      ...m5,
      turns: { up: 'cw', down: 'ccw', left: 'ccw', right: 'cw' },
    }
    expect(duplicateProfile(withTurns).turns).toEqual(withTurns.turns)
  })
})
