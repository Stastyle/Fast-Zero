import { Navigate, useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'
import { SCHEMATIC } from '../data/schematic'

export function TargetInputScreen() {
  const navigate = useNavigate()
  const { setSchematicMode, profileId } = useWizardStore()

  if (!profileId) return <Navigate to="/profiles" replace />

  const useSchematic = () => {
    setSchematicMode(SCHEMATIC.pxPerCm, SCHEMATIC.aimPoint)
    navigate('/hits')
  }

  return (
    <div className="screen">
      <StepHeader title={he.target.title} backTo="/profiles" showProfile />
      <div className="screen-body">
        <button
          type="button"
          className="big-button"
          style={{ minHeight: 96 }}
          onClick={() => navigate('/camera')}
        >
          📷 {he.target.takePhoto}
        </button>
        <button type="button" className="big-button big-button--secondary" onClick={useSchematic}>
          {he.target.schematic}
        </button>
        <p className="hint">💡 {he.target.tip}</p>
      </div>
    </div>
  )
}
