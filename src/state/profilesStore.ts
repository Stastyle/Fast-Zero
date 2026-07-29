import { create } from 'zustand'
import type { SightProfile } from '../core/types'
import {
  DEFAULT_PROFILES,
  stripLegacyOverride,
  stripRedundantOverride,
} from '../data/defaultProfiles'
import { loadStore, saveStore } from '../data/storage'

// Bumped when LEGACY_DEFAULT_VALUES grows so the (idempotent) cleanup re-runs.
const LEGACY_CLEANUP_KEY = 'fastzero.migration.legacy-overrides-3'

/**
 * One-time cleanup: drop override fields frozen from old shipped defaults
 * (e.g. the profile name from before the Meprolight M5 rename).
 */
function cleanupLegacyOverridesOnce(): void {
  try {
    if (localStorage.getItem(LEGACY_CLEANUP_KEY)) return
  } catch {
    return
  }
  const store = loadStore()
  for (const [id, override] of Object.entries(store.profileOverrides)) {
    const cleaned = stripLegacyOverride(id, override)
    if (Object.keys(cleaned).length === 0) delete store.profileOverrides[id]
    else store.profileOverrides[id] = cleaned
  }
  saveStore(store)
  try {
    localStorage.setItem(LEGACY_CLEANUP_KEY, new Date().toISOString())
  } catch {
    /* best effort */
  }
}

cleanupLegacyOverridesOnce()

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
      const merged = stripRedundantOverride(id, { ...store.profileOverrides[id], ...patch })
      if (Object.keys(merged).length === 0) delete store.profileOverrides[id]
      else store.profileOverrides[id] = merged
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
