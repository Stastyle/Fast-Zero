import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { useSettingsStore } from '../state/settingsStore'
import { StepHeader } from '../components/StepHeader'
import {
  A4_LONG_CM,
  A4_SHORT_CM,
  a4MappingFromCorners,
  applyHomography,
} from '../core/homography'
import { coverCropRect, quadCropRect, visibleSourceRect } from '../core/cameraCrop'
import { detectPage, QuadSmoother } from '../core/pageDetect'
import type { Vec2 } from '../core/types'
import { preparePhoto } from './photoUtils'

type CameraState = 'starting' | 'live' | 'error'
type PageOrientation = 'portrait' | 'landscape'

/** Width of the downscaled frame the detector runs on (CPU stays negligible). */
const DETECT_WIDTH = 224
/** ~6–7 detections per second — plenty for a hand-held preview. */
const DETECT_INTERVAL_MS = 150
/** Below this the overlay hides rather than showing a shaky guess. */
const MIN_OVERLAY_CONFIDENCE = 0.35
/**
 * At or above this the detected quad drives the measurement directly: the photo
 * is cropped to the page and the px→cm mapping is the homography built from
 * these corners, so neither alignment nor camera angle affects the result.
 * Below it the same corners only PRE-FILL the corner-marking screen — a shaky
 * guess must never silently become the scale.
 */
const AUTO_PAGE_CONFIDENCE = 0.6
/** Long edge of the captured photo, matching the native-camera path. */
const MAX_CAPTURE_DIMENSION = 2048

interface Detection {
  /** Page corners in native VIDEO pixels, ordered [tl, tr, br, bl]. */
  corners: Vec2[]
  confidence: number
}

export function CameraCaptureScreen() {
  const navigate = useNavigate()
  const {
    setPhoto,
    setPhotoWithScale,
    setPhotoWithPage,
    setAimPoint,
    aimFrac,
    aimPageCm,
    profileId,
  } = useWizardStore()
  const { autoPageDetect, autoHitDetect, setAutoPageDetect, setAutoHitDetect } =
    useSettingsStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CameraState>('starting')
  const [orientation, setOrientation] = useState<PageOrientation>('portrait')
  /** Detected page quad in on-screen (container) pixels, or null → no overlay. */
  const [pageQuad, setPageQuad] = useState<Vec2[] | null>(null)
  /** True while the detection is good enough to measure from (drives the overlay colour). */
  const [pageLocked, setPageLocked] = useState(false)
  /** Latest detection in video pixels — what `capture` measures from. */
  const detectionRef = useRef<Detection | null>(null)

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

  // Live page-boundary detection: a few times per second, downscale the part of
  // the video the user can SEE, find the bright A4 quad, and keep it both in
  // screen pixels (overlay) and in video pixels (capture). Interval (not rAF)
  // keeps CPU bounded; QuadSmoother removes both jitter and single-frame flicker.
  //
  // Feeding the detector the whole sensor frame was a bug: the preview is
  // object-fit: cover, so most of a 16:9 frame's width never reaches the
  // screen. Bright things hidden out there merged with the page and dragged the
  // quad off-screen, with nothing visible to explain it.
  useEffect(() => {
    if (state !== 'live' || !autoPageDetect) return
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const smoother = new QuadSmoother()
    const clear = () => {
      setPageQuad(null)
      setPageLocked(false)
      detectionRef.current = null
    }
    const tick = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      const rect = video.getBoundingClientRect()
      if (!vw || !vh || rect.width === 0 || rect.height === 0) return
      const visible = visibleSourceRect(rect, vw, vh)
      const dw = DETECT_WIDTH
      // The detection canvas mirrors the CONTAINER's aspect, because that is
      // the shape of the region being sampled.
      const dh = Math.max(16, Math.round((rect.height / rect.width) * dw))
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw
        canvas.height = dh
      }
      let detected
      try {
        ctx.drawImage(
          video,
          visible.left,
          visible.top,
          visible.width,
          visible.height,
          0,
          0,
          dw,
          dh,
        )
        detected = detectPage(ctx.getImageData(0, 0, dw, dh))
      } catch {
        detected = null // e.g. video not ready yet
      }
      const quad = smoother.push(detected)
      if (!quad || quad.confidence < MIN_OVERLAY_CONFIDENCE) {
        clear()
        return
      }
      // Detection px → screen px. The sampled region IS the container, so this
      // is a plain scale — a corner can no longer land outside the preview.
      const sx = rect.width / dw
      const sy = rect.height / dh
      setPageQuad(quad.corners.map((p) => ({ x: p.x * sx, y: p.y * sy })))
      setPageLocked(quad.confidence >= AUTO_PAGE_CONFIDENCE)
      // Detection px → video px, for the capture crop and the homography.
      detectionRef.current = {
        corners: quad.corners.map((p) => ({
          x: visible.left + (p.x * visible.width) / dw,
          y: visible.top + (p.y * visible.height) / dh,
        })),
        confidence: quad.confidence,
      }
    }
    const id = window.setInterval(tick, DETECT_INTERVAL_MS)
    return () => {
      window.clearInterval(id)
      clear()
    }
  }, [state, autoPageDetect])

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

  /**
   * Preferred capture: crop to the DETECTED page and derive the px→cm mapping
   * from its corners. The scale then comes from where the sheet actually is,
   * not from the assumption that it was aligned to the on-screen frame, and the
   * homography also removes the perspective error of an off-axis shot.
   * Returns false when there is nothing trustworthy to measure from.
   */
  const captureFromDetectedPage = (video: HTMLVideoElement, detection: Detection): boolean => {
    const vw = video.videoWidth
    const vh = video.videoHeight
    const crop = quadCropRect(detection.corners, vw, vh)
    if (!(crop.width >= 50) || !(crop.height >= 50)) return false

    const shrink = Math.min(1, MAX_CAPTURE_DIMENSION / Math.max(crop.width, crop.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(crop.width * shrink)
    canvas.height = Math.round(crop.height * shrink)
    // Corners expressed in the cropped photo's own pixels.
    const corners = detection.corners.map((p) => ({
      x: (p.x - crop.left) * shrink,
      y: (p.y - crop.top) * shrink,
    }))
    const mapping = a4MappingFromCorners(corners)
    if (!mapping.ok) return false

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
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        if (detection.confidence < AUTO_PAGE_CONFIDENCE) {
          // Good enough to propose, not good enough to measure from unseen.
          setPhoto(url, canvas.width, canvas.height, corners)
          navigate('/corners')
          return
        }
        setPhotoWithPage(url, canvas.width, canvas.height, mapping.homography, mapping.inverse)
        // The aim point is remembered against the SHEET, so it survives a new
        // framing, distance or angle — map it back into this photo and skip
        // straight to hit marking.
        const aim = aimPageCm ? applyHomography(mapping.inverse, aimPageCm) : null
        if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) {
          setAimPoint(aim)
          navigate('/hits')
        } else {
          navigate('/aim')
        }
      },
      'image/jpeg',
      0.9,
    )
    return true
  }

  const capture = () => {
    const video = videoRef.current
    const frame = frameRef.current
    if (!video || !frame || video.videoWidth === 0) return

    const detection = detectionRef.current
    if (autoPageDetect && detection && captureFromDetectedPage(video, detection)) return

    // Nothing detected (feature off, or the page was not found): fall back to
    // the fixed frame, which assumes the user aligned the sheet to it.
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
    canvas.toBlob(
      (blob) => {
        if (!blob) return
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
      const { url, width, height, pageCorners } = await preparePhoto(file, autoPageDetect)
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
          {/* Top-level switch: on, the detected page sets the scale; off, the
              capture uses the on-screen frame's bounds and nothing else. */}
          <div className="camera-toolbar">
            <label className="detect-checkbox">
              <input
                type="checkbox"
                checked={autoPageDetect}
                onChange={(e) => setAutoPageDetect(e.target.checked)}
              />
              {he.camera.autoPageDetect}
            </label>
          </div>
          <div className="camera-stage">
            <video ref={videoRef} playsInline muted autoPlay />
            {pageQuad && (
              <svg
                className={`page-detect-overlay${pageLocked ? ' page-detect-overlay--locked' : ''}`}
                aria-hidden="true"
              >
                <polygon points={pageQuad.map((p) => `${p.x},${p.y}`).join(' ')} />
              </svg>
            )}
            <div
              ref={frameRef}
              className={`a4-frame a4-frame--${orientation}${pageLocked ? ' a4-frame--idle' : ''}`}
            />
            <div className="camera-hint">
              {pageLocked ? he.camera.pageLocked : he.camera.align}
              <small>{pageLocked ? he.camera.pageLockedHint : he.camera.volumeHint}</small>
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
          <div className="detect-settings">
            <label className="detect-checkbox">
              <input
                type="checkbox"
                checked={autoHitDetect}
                onChange={(e) => setAutoHitDetect(e.target.checked)}
              />
              {he.camera.autoHitDetect}
            </label>
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
