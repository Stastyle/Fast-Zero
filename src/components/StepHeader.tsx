import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'

interface StepHeaderProps {
  title: string
  backTo?: string
}

export function StepHeader({ title, backTo }: StepHeaderProps) {
  const navigate = useNavigate()
  return (
    <header className="step-header">
      {backTo !== undefined && (
        <button
          type="button"
          className="back-button"
          aria-label={he.common.back}
          onClick={() => navigate(backTo)}
        >
          →
        </button>
      )}
      <h1>{title}</h1>
    </header>
  )
}
