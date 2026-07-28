import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { SCHEMATIC } from '../data/schematic'

const MAX_DIMENSION = 2048

/** Downscale to ≤2048px on the long edge (memory on old phones), return an object URL. */
async function preparePhoto(file: File): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
  )
  return { url: URL.createObjectURL(blob), width, height }
}

export function TargetInputScreen() {
  const navigate = useNavigate()
  const { setPhoto, setSchematicMode } = useWizardStore()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const { url, width, height } = await preparePhoto(file)
    setPhoto(url, width, height)
    navigate('/calibrate')
  }

  const useSchematic = () => {
    setSchematicMode(SCHEMATIC.pxPerCm, SCHEMATIC.aimPoint)
    navigate('/hits')
  }

  return (
    <div className="screen">
      <StepHeader title={he.target.title} backTo="/profiles" />
      <div className="screen-body">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className="big-button"
          style={{ minHeight: 96 }}
          onClick={() => cameraRef.current?.click()}
        >
          📷 {he.target.takePhoto}
        </button>
        <button
          type="button"
          className="big-button big-button--secondary"
          onClick={() => galleryRef.current?.click()}
        >
          {he.target.pickPhoto}
        </button>
        <button type="button" className="big-button big-button--secondary" onClick={useSchematic}>
          {he.target.schematic}
        </button>
        <p className="hint">💡 {he.target.tip}</p>
      </div>
    </div>
  )
}
