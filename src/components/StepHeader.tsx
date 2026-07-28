import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useWizardStore } from '../state/wizardStore'
import { useProfilesStore } from '../state/profilesStore'

interface StepHeaderProps {
  title: string
  backTo?: string
  /** Show the session's selected sight name as a badge (wizard screens). */
  showProfile?: boolean
}

export function StepHeader({ title, backTo, showProfile = false }: StepHeaderProps) {
  const navigate = useNavigate()
  const profileId = useWizardStore((s) => s.profileId)
  const profiles = useProfilesStore((s) => s.profiles)
  const profileName = showProfile
    ? (profiles.find((p) => p.id === profileId)?.name ?? null)
    : null

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
      {profileName && <span className="header-profile">{profileName}</span>}
    </header>
  )
}
