import { create } from 'zustand'
import type { SightProfile } from '../core/types'
import { DEFAULT_PROFILES } from '../data/defaultProfiles'
import { loadStore, saveStore } from '../data/storage'

interface ProfilesState {
  profiles: SightProfile[]
  lastUsedProfileId: string | null
  updateProfile: (id: string, patch: Partial<SightProfile>) => void
  addProfile: (profile: SightProfile) => void
  deleteProfile: (id: string) => void
  resetProfile: (id: string) => void
  setLastUsed: (id: string) => void
}

function materialize(): { profiles: SightProfile[]; lastUsedProfileId: string | null } {
  const store = loadStore()
  const builtIns = DEFAULT_PROFILES.map((p) => ({
    ...p,
    ...store.profileOverrides[p.id],
    id: p.id,
    builtIn: true,
  }))
  return {
    profiles: [...builtIns, ...store.customProfiles],
    lastUsedProfileId: store.lastUsedProfileId,
  }
}

export const useProfilesStore = create<ProfilesState>((set) => ({
  ...materialize(),

  updateProfile: (id, patch) => {
    const store = loadStore()
    if (DEFAULT_PROFILES.some((p) => p.id === id)) {
      store.profileOverrides[id] = { ...store.profileOverrides[id], ...patch }
    } else {
      store.customProfiles = store.customProfiles.map((p) =>
        p.id === id ? { ...p, ...patch, id } : p,
      )
    }
    saveStore(store)
    set(materialize())
  },

  addProfile: (profile) => {
    const store = loadStore()
    store.customProfiles = [...store.customProfiles, { ...profile, builtIn: false }]
    saveStore(store)
    set(materialize())
  },

  deleteProfile: (id) => {
    const store = loadStore()
    store.customProfiles = store.customProfiles.filter((p) => p.id !== id)
    if (store.lastUsedProfileId === id) store.lastUsedProfileId = null
    saveStore(store)
    set(materialize())
  },

  resetProfile: (id) => {
    const store = loadStore()
    delete store.profileOverrides[id]
    saveStore(store)
    set(materialize())
  },

  setLastUsed: (id) => {
    const store = loadStore()
    store.lastUsedProfileId = id
    saveStore(store)
    set(materialize())
  },
}))
