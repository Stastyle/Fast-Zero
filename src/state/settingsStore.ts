import { create } from 'zustand'

/**
 * User-facing detection toggles, persisted in localStorage so a shooter who
 * turns automatic detection off (e.g. it misbehaves in the range's lighting)
 * stays opted out across sessions.
 */
interface SettingsState {
  /** Live page-boundary overlay in the camera + corner pre-fill on fallback photos. */
  autoPageDetect: boolean
  /** Automatic bullet-hole marking when the hits screen opens. */
  autoHitDetect: boolean
  setAutoPageDetect: (on: boolean) => void
  setAutoHitDetect: (on: boolean) => void
}

const KEY = 'fastzero.settings'

interface PersistedSettings {
  autoPageDetect: boolean
  autoHitDetect: boolean
}

const DEFAULTS: PersistedSettings = { autoPageDetect: true, autoHitDetect: true }

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
  } catch {
    /* storage unavailable / corrupt — fall back to defaults */
  }
  return { ...DEFAULTS }
}

function persistSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable */
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSettings(),

  setAutoPageDetect: (on) => {
    set({ autoPageDetect: on })
    persistSettings({ autoPageDetect: on, autoHitDetect: get().autoHitDetect })
  },

  setAutoHitDetect: (on) => {
    set({ autoHitDetect: on })
    persistSettings({ autoPageDetect: get().autoPageDetect, autoHitDetect: on })
  },
}))
