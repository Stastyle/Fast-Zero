import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { A4_LONG_CM, A4_SHORT_CM } from '../core/homography'
import { coverCropRect } from '../core/cameraCrop'
import { preparePhoto } from './photoUtils'

type CameraState = 'starting' | 'live' | 'error'
type PageOrientation = 'portrait' | 'landscape'

export function CameraCaptureScreen() {
  const navigate = useNavigate()
  const { setPhoto, setPhotoWithScale, profileId } = useWizardStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fallbackRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CameraState>('starting')
  const [orientation, setOrientation] = useState<PageOrientation>('portrait')

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
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        // The crop equals the A4 page; its width is the page's real width.
        const pageWidthCm = orientation === 'landscape' ? A4_LONG_CM : A4_SHORT_CM
        const pxPerCm = canvas.width / pageWidthCm
        setPhotoWithScale(URL.createObjectURL(blob), canvas.width, canvas.height, pxPerCm)
        navigate('/aim')
      },
      'image/jpeg',
      0.9,
    )
  }

  // No in-app camera (old iOS / permission denied): fall back to the native
  // camera app; scale then comes from tapping the page corners.
  const onFallbackFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const { url, width, height } = await preparePhoto(file)
      setPhoto(url, width, height)
      navigate('/corners')
    } catch {
      setState('error')
    }
  }

  if (!profileId) return <Navigate to="/profiles" replace />

  return (
    <div className="screen">
      <StepHeader title={he.camera.title} backTo="/target" />
      {state !== 'error' ? (
        <>
          <div className={`camera-stage camera-stage--${orientation}`}>
            <video ref={videoRef} playsInline muted autoPlay />
            <div ref={frameRef} className={`a4-frame a4-frame--${orientation}`} />
            <div className="camera-hint">{he.camera.align}</div>
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
            <button
              type="button"
              className={`shutter-button shutter-button--${orientation}`}
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
