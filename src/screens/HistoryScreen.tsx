import { useState } from 'react'
import { he } from '../i18n/he'
import { clearSessions, deleteSession, listSessions } from '../data/sessions'
import { StepHeader } from '../components/StepHeader'
import { ImageModal } from '../components/ImageModal'
import { buildExportHtml, downloadHtml } from '../data/exportHtml'
import { summarizeCorrectionHe } from './historyUtils'

export function HistoryScreen() {
  const [sessions, setSessions] = useState(listSessions)
  const [openImage, setOpenImage] = useState<string | null>(null)

  const remove = (id: string) => {
    deleteSession(id)
    setSessions(listSessions())
  }

  const clearAll = () => {
    if (window.confirm(he.history.clearConfirm)) {
      clearSessions()
      setSessions([])
    }
  }

  const exportAll = () => {
    downloadHtml(he.history.exportFilename, buildExportHtml(sessions, new Date().toISOString()))
  }

  return (
    <div className="screen">
      <StepHeader title={he.history.title} backTo="/" />
      <div className="screen-body">
        <p className="hint">{he.history.localOnly}</p>
        {sessions.length === 0 && <p>{he.history.empty}</p>}
        {sessions.length > 0 && (
          <button type="button" className="big-button big-button--secondary" onClick={exportAll}>
            ⬇ {he.history.export}
          </button>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="card history-item">
            <div className="date">
              {new Date(s.createdAt).toLocaleString('he-IL', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}{' '}
              · {s.profileSnapshot.name} · {he.history.hits(s.hitCount)}
              {s.excludedCount > 0 && ` (${he.hits.excludedCount(s.excludedCount)})`}
            </div>
            <div className="summary">{summarizeCorrectionHe(s.correction)}</div>
            <div className="hint">
              {he.result.offset(s.offsetCm.right, s.offsetCm.up)}
            </div>
            {s.imageDataUrl && (
              <button
                type="button"
                className="history-thumb-button"
                onClick={() => setOpenImage(s.imageDataUrl!)}
              >
                <img className="history-thumb" src={s.imageDataUrl} alt="תמונת המטרה" />
              </button>
            )}
            <button
              type="button"
              className="chip"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => remove(s.id)}
            >
              {he.history.delete}
            </button>
          </div>
        ))}
        {sessions.length > 0 && (
          <button type="button" className="big-button big-button--danger" onClick={clearAll}>
            {he.history.clearAll}
          </button>
        )}
      </div>
      {openImage && <ImageModal src={openImage} onClose={() => setOpenImage(null)} />}
    </div>
  )
}
