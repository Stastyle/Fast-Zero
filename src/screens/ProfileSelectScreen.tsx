import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { useProfilesStore } from '../state/profilesStore'
import { useWizardStore } from '../state/wizardStore'
import { StepHeader } from '../components/StepHeader'

export function ProfileSelectScreen() {
  const navigate = useNavigate()
  const { profiles, lastUsedProfileId, setLastUsed } = useProfilesStore()
  const selectProfile = useWizardStore((s) => s.selectProfile)

  const choose = (id: string) => {
    selectProfile(id)
    setLastUsed(id)
    navigate('/target')
  }

  return (
    <div className="screen">
      <StepHeader title={he.profiles.title} backTo="/" />
      <div className="screen-body">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`card${p.id === lastUsedProfileId ? ' card--selected' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <button
              type="button"
              className="card--tappable"
              style={{ flex: 1, border: 'none', background: 'none', padding: 0 }}
              onClick={() => choose(p.id)}
            >
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>{p.name}</div>
              <div className="hint">
                גובה: {p.elevationCmPerClick} ס״מ/קליק · צד: {p.windageCmPerClick} ס״מ/קליק{' '}
                {p.notes && <span className="badge">{he.profiles.estimated}</span>}
              </div>
            </button>
            <button
              type="button"
              className="back-button"
              aria-label={he.profiles.edit}
              onClick={() => navigate(`/profiles/${p.id}/edit`)}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="big-button big-button--secondary"
          onClick={() => navigate('/profiles/new')}
        >
          {he.profiles.addNew}
        </button>
      </div>
    </div>
  )
}
