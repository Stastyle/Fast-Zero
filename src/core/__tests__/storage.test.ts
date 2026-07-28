import { beforeEach, describe, expect, it } from 'vitest'
import { defaultStore, loadStore, MAX_SESSIONS, saveStore, type StoreV1 } from '../../data/storage'
import type { Session } from '../types'

const fakeSession = (id: string): Session => ({
  id,
  createdAt: '2026-01-01T00:00:00.000Z',
  profileId: 'mepro-reflex',
  profileSnapshot: {
    name: 'מפרו',
    elevationCmPerClick: 0.7,
    windageCmPerClick: 0.7,
    desiredImpactOffsetCm: { right: 0, up: 0 },
  },
  hitCount: 3,
  excludedCount: 0,
  hitsCm: [{ right: 1, up: -2 }],
  mpiCm: { right: 1, up: -2 },
  offsetCm: { right: 1, up: -2 },
  correction: {
    elevation: { clicks: 3, direction: 'up', residualCm: 0 },
    windage: { clicks: 1, direction: 'left', residualCm: 0.3 },
  },
})

beforeEach(() => {
  localStorage.clear()
})

describe('storage', () => {
  it('returns a fresh default store when nothing is saved', () => {
    expect(loadStore()).toEqual(defaultStore())
  })

  it('round-trips a store', () => {
    const store: StoreV1 = {
      ...defaultStore(),
      lastUsedProfileId: 'm4-iron',
      sessions: [fakeSession('a')],
      profileOverrides: { 'mepro-reflex': { elevationCmPerClick: 0.5 } },
    }
    saveStore(store)
    expect(loadStore()).toEqual(store)
  })

  it('recovers from corrupt JSON by backing it up and returning defaults', () => {
    localStorage.setItem('fastzero.store', '{not json!!')
    expect(loadStore()).toEqual(defaultStore())
    expect(localStorage.getItem('fastzero.store.corrupt')).toBe('{not json!!')
    expect(localStorage.getItem('fastzero.store')).toBeNull()
  })

  it('recovers from valid JSON with a wrong shape', () => {
    localStorage.setItem('fastzero.store', JSON.stringify({ schemaVersion: 1, sessions: 'nope' }))
    expect(loadStore()).toEqual(defaultStore())
  })

  it('evicts oldest sessions beyond the cap', () => {
    const sessions = Array.from({ length: MAX_SESSIONS + 10 }, (_, i) => fakeSession(`s${i}`))
    saveStore({ ...defaultStore(), sessions })
    const loaded = loadStore()
    expect(loaded.sessions).toHaveLength(MAX_SESSIONS)
    expect(loaded.sessions[0].id).toBe('s10')
    expect(loaded.sessions.at(-1)!.id).toBe(`s${MAX_SESSIONS + 9}`)
  })
})
