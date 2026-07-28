import type { Session } from '../core/types'
import { loadStore, saveStore } from './storage'

export function listSessions(): Session[] {
  return [...loadStore().sessions].reverse()
}

/** Returns false when the session could not be persisted (storage full/unavailable). */
export function appendSession(session: Session): boolean {
  const store = loadStore()
  store.sessions = [...store.sessions, session]
  return saveStore(store)
}

export function deleteSession(id: string): void {
  const store = loadStore()
  store.sessions = store.sessions.filter((s) => s.id !== id)
  saveStore(store)
}

export function clearSessions(): void {
  const store = loadStore()
  store.sessions = []
  saveStore(store)
}

export function lastSession(): Session | null {
  const sessions = loadStore().sessions
  return sessions.length ? sessions[sessions.length - 1] : null
}
