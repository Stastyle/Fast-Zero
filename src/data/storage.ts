import type { Session, SightProfile } from '../core/types'

const KEY = 'fastzero.store'
const CORRUPT_KEY = 'fastzero.store.corrupt'
export const MAX_SESSIONS = 200
/** Newest sessions that keep their embedded target image (localStorage budget). */
export const MAX_SESSION_IMAGES = 20

export interface StoreV1 {
  schemaVersion: 1
  customProfiles: SightProfile[]
  /** Edits to built-in profiles, keyed by profile id. */
  profileOverrides: Record<string, Partial<SightProfile>>
  lastUsedProfileId: string | null
  sessions: Session[]
}

export function defaultStore(): StoreV1 {
  return {
    schemaVersion: 1,
    customProfiles: [],
    profileOverrides: {},
    lastUsedProfileId: null,
    sessions: [],
  }
}

/** Migration chain: migrations[n] upgrades a version-n store to n+1. Empty at v1. */
const migrations: Record<number, (old: unknown) => unknown> = {}

function migrate(raw: unknown): StoreV1 {
  let store = raw as { schemaVersion?: number }
  while (
    typeof store?.schemaVersion === 'number' &&
    store.schemaVersion < 1 &&
    migrations[store.schemaVersion]
  ) {
    store = migrations[store.schemaVersion](store) as { schemaVersion?: number }
  }
  return store as StoreV1
}

function isValidStore(s: unknown): s is StoreV1 {
  if (typeof s !== 'object' || s === null) return false
  const store = s as Partial<StoreV1>
  return (
    store.schemaVersion === 1 &&
    Array.isArray(store.customProfiles) &&
    typeof store.profileOverrides === 'object' &&
    store.profileOverrides !== null &&
    Array.isArray(store.sessions)
  )
}

export function loadStore(): StoreV1 {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return defaultStore()
  }
  if (raw === null) return defaultStore()
  try {
    const parsed = JSON.parse(raw)
    const migrated = migrate(parsed)
    if (!isValidStore(migrated)) throw new Error('invalid store shape')
    return migrated
  } catch {
    // Remove the bad key FIRST (removeItem cannot hit quota), then best-effort
    // back up the corrupt payload — the backup write may exceed quota when the
    // payload is large, and must not block the cleanup.
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable */
    }
    try {
      localStorage.setItem(CORRUPT_KEY, raw)
    } catch {
      /* no room for a backup — cleanup already done */
    }
    return defaultStore()
  }
}

function stripOldImages(sessions: Session[], keepImages: number): Session[] {
  const cutoff = sessions.length - keepImages
  return sessions.map((s, i) => {
    if (i >= cutoff || s.imageDataUrl === undefined) return s
    const { imageDataUrl: _dropped, ...rest } = s
    return rest
  })
}

/** Persist the store. Returns false when nothing could be written (quota/unavailable). */
export function saveStore(store: StoreV1): boolean {
  const sessions = store.sessions.slice(-MAX_SESSIONS)
  // On quota pressure degrade gradually: keep fewer images before dropping all.
  for (const keepImages of [MAX_SESSION_IMAGES, 10, 5, 0]) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ ...store, sessions: stripOldImages(sessions, keepImages) }),
      )
      return true
    } catch {
      /* quota or unavailable — try a smaller payload */
    }
  }
  return false
}
