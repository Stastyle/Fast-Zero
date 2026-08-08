import { useEffect, useRef } from 'react'
import { he } from '../i18n/he'

interface ImageModalProps {
  src: string
  onClose: () => void
}

/** Full-screen viewer for the marked target photo. Tap anywhere or Escape to close. */
export function ImageModal({ src, onClose }: ImageModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="image-modal" onClick={onClose} role="dialog" aria-modal="true">
      <img src={src} alt="" />
      <button
        ref={closeRef}
        type="button"
        className="image-modal-close"
        aria-label={he.common.close}
        onClick={(e) => {
          // Close directly; stop bubbling so the wrapper's onClick doesn't fire twice.
          e.stopPropagation()
          onClose()
        }}
      >
        ✕
      </button>
    </div>
  )
}
