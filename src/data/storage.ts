import type { Session, SightProfile } from '../core/types'

const KEY = 'fastzero.store'
const CORRUPT_KEY = 'fastzero.store.corrupt'
export const MAX_SESSIONS = 200

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
    // Preserve the corrupt payload for possible recovery, then start fresh.
    try {
      localStorage.setItem(CORRUPT_KEY, raw)
      localStorage.removeItem(KEY)
    } catch {
      /* storage unavailable — nothing more to do */
    }
    return defaultStore()
  }
}

export function saveStore(store: StoreV1): void {
  const capped: StoreV1 =
    store.sessions.length > MAX_SESSIONS
      ? { ...store, sessions: store.sessions.slice(-MAX_SESSIONS) }
      : store
  try {
    localStorage.setItem(KEY, JSON.stringify(capped))
  } catch {
    /* quota exceeded or storage unavailable — history is best-effort */
  }
}
