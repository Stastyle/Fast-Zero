import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { he } from '../i18n/he'

type ToastKind = 'offlineReady' | 'needRefresh'

/** Guard: React 18 StrictMode re-runs effects in dev; register the SW once. */
let swRegistered = false

/**
 * Bottom-of-screen PWA status toast (RTL, dismissible):
 * - offlineReady → «מותקן — עובד ללא אינטרנט», auto-hides after ~4s.
 * - needRefresh → «גרסה חדשה זמינה» with a רענן button that activates the
 *   waiting service worker and reloads (updateSW(true)).
 */
export function PwaToast() {
  const [toast, setToast] = useState<ToastKind | null>(null)
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (swRegistered) return
    swRegistered = true
    updateSWRef.current = registerSW({
      onOfflineReady() {
        setToast('offlineReady')
      },
      onNeedRefresh() {
        setToast('needRefresh')
      },
    })
  }, [])

  useEffect(() => {
    if (toast !== 'offlineReady') return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  if (toast === null) return null

  return (
    <div className="pwa-toast" role="status">
      <span className="pwa-toast-text">
        {toast === 'offlineReady' ? he.home.offlineReady : he.pwa.updateAvailable}
      </span>
      {toast === 'needRefresh' && (
        <button
          type="button"
          className="pwa-toast-refresh"
          onClick={() => updateSWRef.current?.(true)}
        >
          {he.pwa.refresh}
        </button>
      )}
      <button
        type="button"
        className="pwa-toast-close"
        aria-label={he.common.close}
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  )
}
