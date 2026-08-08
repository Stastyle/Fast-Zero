import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { A4_LONG_CM, A4_SHORT_CM, a4MappingFromCorners } from '../core/homography'
import { coverCropRect, mapVideoPointsToCrop } from '../core/cameraCrop'
import { detectPage, QuadSmoother, type DetectedQuad } from '../core/pageDetect'
import type { Vec2 } from '../core/types'
import { preparePhoto } from './photoUtils'

type CameraState = 'starting' | 'live' | 'error'
type PageOrientation = 'portrait' | 'landscape'

/** Width of the downscaled frame the detector runs on (CPU stays negligible). */
const DETECT_WIDTH = 192
/** ~6–7 detections per second — plenty for a hand-held preview. */
const DETECT_INTERVAL_MS = 150
/** Below this the overlay hides rather than showing a shaky guess. */
const MIN_OVERLAY_CONFIDENCE = 0.35
/**
 * Below this the capture ignores the detection and falls back to the flat
 * frame scale — a homography from a shaky quad is worse than no homography.
 */
const MIN_CAPTURE_CONFIDENCE = 0.5

export function CameraCaptureScreen() {
  const navigate = useNavigate()
  const { setPhoto, setPhotoWithScale, setPhotoWithCorners, setAimPoint, aimFrac, profileId } =
    useWizardStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CameraState>('starting')
  const [orientation, setOrientation] = useState<PageOrientation>('portrait')
  /** Detected page quad in on-screen (container) pixels, or null → no overlay. */
  const [pageQuad, setPageQuad] = useState<Vec2[] | null>(null)
  /** Smoothed quad in native VIDEO pixels — read at capture time for the homography. */
  const videoQuadRef = useRef<DetectedQuad | null>(null)

  useEffect(() => {
    // The guard below redirects away without a profile — never prompt for
    // camera permission on a screen the user will not see.
    if (!profileId) return
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setState('live')
      } catch {
        if (!cancelled) setState('error')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [profileId])

  // Live page-boundary detection: a few times per second, downscale the video
  // frame, find the bright A4 quad and map it to on-screen pixels for the
  // overlay. Interval (not rAF) keeps CPU bounded; QuadSmoother removes both
  // jitter and single-frame flicker.
  useEffect(() => {
    if (state !== 'live') return
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const smoother = new QuadSmoother()
    const tick = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return
      const dw = DETECT_WIDTH
      const dh = Math.max(16, Math.round((vh / vw) * dw))
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw
        canvas.height = dh
      }
      let detected
      try {
        ctx.drawImage(video, 0, 0, dw, dh)
        detected = detectPage(ctx.getImageData(0, 0, dw, dh))
      } catch {
        detected = null // e.g. video not ready yet
      }
      const quad = smoother.push(detected)
      if (!quad || quad.confidence < MIN_OVERLAY_CONFIDENCE) {
        videoQuadRef.current = null
        setPageQuad(null)
        return
      }
      // detection px → video px: kept in a ref so capture() can build a
      // perspective-correct homography from the page's real corners.
      const videoCorners = quad.corners.map((p) => ({
        x: (p.x * vw) / dw,
        y: (p.y * vh) / dh,
      })) as DetectedQuad['corners']
      videoQuadRef.current = { corners: videoCorners, confidence: quad.confidence }
      // video px → displayed px (video uses object-fit: cover, same geometry
      // coverCropRect inverts for the capture crop).
      const rect = video.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        setPageQuad(null)
        return
      }
      const scale = Math.max(rect.width / vw, rect.height / vh)
      const offsetX = (vw * scale - rect.width) / 2
      const offsetY = (vh * scale - rect.height) / 2
      setPageQuad(
        videoCorners.map((p) => ({
          x: p.x * scale - offsetX,
          y: p.y * scale - offsetY,
        })),
      )
    }
    const id = window.setInterval(tick, DETECT_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      videoQuadRef.current = null
      setPageQuad(null)
    }
  }, [state])

  // Hardware volume keys reach the page only on some Android devices and
  // Bluetooth camera remotes (which emit volume/enter key events); iOS never
  // delivers them to web content. Best-effort — the on-screen shutter is primary.
  const captureRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (state !== 'live') return
    const onKey = (e: KeyboardEvent) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        captureRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const capture = () => {
    const video = videoRef.current
    const frame = frameRef.current
    if (!video || !frame || video.videoWidth === 0) return

    // Map the on-screen A4 frame rect into native video pixels
    // (video fills its container with object-fit: cover).
    const containerRect = video.getBoundingClientRect()
    const frameRect = frame.getBoundingClientRect()
    const crop = coverCropRect(containerRect, video.videoWidth, video.videoHeight, frameRect)
    // A degenerate crop (e.g. zero-height frame) would sail through the flow
    // and only break at the final computation — treat it as a camera failure.
    if (!(crop.width >= 50) || !(crop.height >= 50)) {
      setState('error')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(crop.width)
    canvas.height = Math.round(crop.height)
    canvas
      .getContext('2d')!
      .drawImage(
        video,
        crop.left,
        crop.top,
        crop.width,
        crop.height,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    // Perspective correction: with a confident live page detection, take the
    // page's REAL corners (not the frame rect) into photo pixels and calibrate
    // via homography — a tilted phone no longer distorts the vertical cm.
    // Falls back silently to the flat frame scale when detection is absent,
    // shaky, or disagrees with the frame the user aligned.
    const quad = videoQuadRef.current
    let photoCorners: Vec2[] | null = null
    if (quad && quad.confidence >= MIN_CAPTURE_CONFIDENCE) {
      const mapped = mapVideoPointsToCrop(quad.corners, crop, canvas.width, canvas.height)
      if (mapped && a4MappingFromCorners(mapped).ok) photoCorners = mapped
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        if (photoCorners) {
          // Homography path: confirm/adjust the detected corners first; the
          // corners screen applies the remembered aim point after confirming.
          setPhotoWithCorners(URL.createObjectURL(blob), canvas.width, canvas.height, photoCorners)
          navigate('/corners')
          return
        }
        // The crop equals the A4 page; its width is the page's real width.
        const pageWidthCm = orientation === 'landscape' ? A4_LONG_CM : A4_SHORT_CM
        const pxPerCm = canvas.width / pageWidthCm
        setPhotoWithScale(URL.createObjectURL(blob), canvas.width, canvas.height, pxPerCm)
        // Same session, same sheet, same frame: the aim point from the previous
        // round is a page fraction — apply it and go straight to hit marking.
        if (aimFrac) {
          setAimPoint({ x: aimFrac.x * canvas.width, y: aimFrac.y * canvas.height })
          navigate('/hits')
        } else {
          navigate('/aim')
        }
      },
      'image/jpeg',
      0.9,
    )
  }

  captureRef.current = capture

  // No in-app camera (old iOS / permission denied): fall back to the native
  // camera app; scale then comes from tapping the page corners.
  const onFallbackFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { url, width, height, pageCorners } = await preparePhoto(file)
      // Detected page corners pre-fill the corners screen (user can adjust).
      setPhoto(url, width, height, pageCorners)
      navigate('/corners')
    } catch {
      setState('error')
    }
  }

  if (!profileId) return <Navigate to="/profiles" replace />

  return (
    <div className="screen">
      <StepHeader title={he.camera.title} backTo="/target" showProfile />
      {state !== 'error' ? (
        <>
          <div className="camera-stage">
            <video ref={videoRef} playsInline muted autoPlay />
            {pageQuad && (
              <svg className="page-detect-overlay" aria-hidden="true">
                <polygon points={pageQuad.map((p) => `${p.x},${p.y}`).join(' ')} />
              </svg>
            )}
            <div ref={frameRef} className={`a4-frame a4-frame--${orientation}`} />
            <div className="camera-hint">
              {he.camera.align}
              <small>{he.camera.volumeHint}</small>
            </div>
            {state === 'starting' && <div className="camera-starting">{he.camera.starting}</div>}
            <div className="camera-toggle">
              <button
                type="button"
                className={`chip${orientation === 'portrait' ? ' chip--active' : ''}`}
                onClick={() => setOrientation('portrait')}
              >
                {he.camera.portrait}
              </button>
              <button
                type="button"
                className={`chip${orientation === 'landscape' ? ' chip--active' : ''}`}
                onClick={() => setOrientation('landscape')}
              >
                {he.camera.landscape}
              </button>
            </div>
          </div>
          <div className="shutter-bar">
            <button
              type="button"
              className="shutter-button"
              aria-label={he.camera.capture}
              disabled={state !== 'live'}
              onClick={capture}
            />
          </div>
        </>
      ) : (
        <div className="screen-body">
          <p style={{ fontWeight: 700 }}>{he.camera.error}</p>
          <input
            ref={fallbackRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onFallbackFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="big-button"
            onClick={() => fallbackRef.current?.click()}
          >
            {he.camera.fallback}
          </button>
        </div>
      )}
    </div>
  )
}
