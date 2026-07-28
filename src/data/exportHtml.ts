import type { Correction, Session } from '../core/types'

const directionHe: Record<string, string> = {
  up: 'למעלה',
  down: 'למטה',
  left: 'שמאלה',
  right: 'ימינה',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatHeDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function clicksSummary(correction: Correction): string {
  const parts: string[] = []
  if (correction.elevation.direction !== 'none') {
    parts.push(`${correction.elevation.clicks} קליקים ${directionHe[correction.elevation.direction]}`)
  }
  if (correction.windage.direction !== 'none') {
    parts.push(`${correction.windage.clicks} קליקים ${directionHe[correction.windage.direction]}`)
  }
  return parts.length ? parts.join(' · ') : 'מאופס'
}

function sessionCard(session: Session): string {
  const snapshot = session.profileSnapshot
  const hits =
    session.excludedCount > 0
      ? `${session.hitCount} פגיעות (${session.excludedCount} מוחרגות)`
      : `${session.hitCount} פגיעות`
  const image = session.imageDataUrl
    ? `<img class="target" src="${escapeHtml(session.imageDataUrl)}" alt="תמונת מטרה מסומנת">`
    : ''
  const notes = session.notes
    ? `<p class="notes">${escapeHtml(session.notes)}</p>`
    : ''
  return `<article class="card">
  <header class="card-header">
    <span class="date">${escapeHtml(formatHeDateTime(session.createdAt))}</span>
    <span class="profile">${escapeHtml(snapshot.name)}</span>
  </header>
  <p class="clicks">${clicksSummary(session.correction)}</p>
  <p class="meta">סטייה: ${session.offsetCm.right.toFixed(1)} ס"מ ימינה · ${session.offsetCm.up.toFixed(1)} ס"מ למעלה</p>
  <p class="meta">${hits} · קליק גובה ${snapshot.elevationCmPerClick} ס"מ · קליק רוחב ${snapshot.windageCmPerClick} ס"מ</p>
  ${notes}${image}
</article>`
}

export function buildExportHtml(sessions: Session[], exportedAtIso: string): string {
  const cards = sessions.length
    ? sessions.map(sessionCard).join('\n')
    : '<p class="empty">אין איפוסים שמורים</p>'
  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>איפוס מהיר — היסטוריית איפוסים</title>
<style>
* { box-sizing: border-box }
body {
  margin: 0 auto;
  padding: 24px 16px;
  max-width: 720px;
  background: #ffffff;
  color: #111111;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 18px;
  line-height: 1.5;
}
h1 { margin: 0 0 4px; font-size: 28px }
.subtitle { margin: 0 0 24px; font-size: 18px; color: #333333 }
.card {
  border: 2px solid #111111;
  border-radius: 12px;
  padding: 16px;
  margin: 0 0 16px;
  background: #ffffff;
}
.card-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  font-weight: 700;
  margin: 0 0 8px;
}
.clicks { margin: 0 0 8px; font-size: 22px; font-weight: 700 }
.meta { margin: 0 0 4px }
.notes { margin: 8px 0 0; white-space: pre-wrap; border-top: 1px solid #111111; padding-top: 8px }
.empty { font-size: 20px }
img.target {
  display: block;
  max-width: 100%;
  margin-top: 12px;
  border: 2px solid #111111;
  border-radius: 8px;
}
@media print {
  body { padding: 0 }
  .card { break-inside: avoid; page-break-inside: avoid }
}
</style>
</head>
<body>
<h1>איפוס מהיר — היסטוריית איפוסים</h1>
<p class="subtitle">יוצא: ${escapeHtml(formatHeDateTime(exportedAtIso))}</p>
${cards}
</body>
</html>
`
}

export function downloadHtml(filename: string, html: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
