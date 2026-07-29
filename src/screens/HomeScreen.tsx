import { useNavigate } from 'react-router-dom'
import { he } from '../i18n/he'
import { lastSession } from '../data/sessions'
import { useWizardStore } from '../state/wizardStore'
import { summarizeCorrectionHe } from './historyUtils'

export function HomeScreen() {
  const navigate = useNavigate()
  const resetWizard = useWizardStore((s) => s.resetWizard)
  const last = lastSession()

  return (
    <div className="screen">
      <img
        className="app-logo"
        src={`${import.meta.env.BASE_URL}logo.jpg`}
        alt={he.appName}
      />
      <p className="tagline" style={{ textAlign: 'center', padding: '8px 16px 0' }}>
        {he.home.tagline}
      </p>
      <div className="screen-body">
        <button
          type="button"
          className="cta-button"
          style={{ minHeight: 88 }}
          onClick={() => {
            resetWizard()
            navigate('/profiles')
          }}
        >
          {he.home.newZero}
        </button>
        <button
          type="button"
          className="big-button big-button--secondary"
          onClick={() => navigate('/history')}
        >
          {he.home.history}
        </button>
        {last && (
          <div className="card history-item">
            <div className="date">
              {he.home.lastSession} · {new Date(last.createdAt).toLocaleDateString('he-IL')} ·{' '}
              {last.profileSnapshot.name}
            </div>
            <div className="summary">{summarizeCorrectionHe(last.correction)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
