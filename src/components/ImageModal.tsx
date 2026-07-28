import { he } from '../i18n/he'

interface ImageModalProps {
  src: string
  onClose: () => void
}

/** Full-screen viewer for the marked target photo. Tap anywhere to close. */
export function ImageModal({ src, onClose }: ImageModalProps) {
  return (
    <div className="image-modal" onClick={onClose} role="dialog" aria-modal="true">
      <img src={src} alt="" />
      <button type="button" className="image-modal-close" aria-label={he.common.close}>
        ✕
      </button>
    </div>
  )
}
