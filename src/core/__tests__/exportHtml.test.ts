import { describe, expect, it } from 'vitest'
import { buildExportHtml } from '../../data/exportHtml'
import type { Session } from '../types'

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 's1',
  createdAt: '2026-07-01T10:30:00.000Z',
  profileId: 'mepro-reflex',
  profileSnapshot: {
    name: 'מפרו <script>alert(1)</script>',
    elevationCmPerClick: 0.7,
    windageCmPerClick: 0.7,
    desiredImpactOffsetCm: { right: 0, up: 0 },
  },
  hitCount: 4,
  excludedCount: 1,
  hitsCm: [{ right: 1.2, up: -2.5 }],
  mpiCm: { right: 1.2, up: -2.5 },
  offsetCm: { right: 1.24, up: -2.51 },
  correction: {
    elevation: { clicks: 4, direction: 'up', residualCm: 0 },
    windage: { clicks: 2, direction: 'left', residualCm: 0.1 },
  },
  ...overrides,
})

const exportedAt = '2026-07-28T08:00:00.000Z'

describe('buildExportHtml', () => {
  it('produces an RTL Hebrew html document', () => {
    const html = buildExportHtml([makeSession()], exportedAt)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('dir="rtl"')
    expect(html).toContain('lang="he"')
    expect(html).toContain('איפוס מהיר — היסטוריית איפוסים')
  })

  it('escapes the profile name', () => {
    const html = buildExportHtml([makeSession()], exportedAt)
    expect(html).not.toContain('<script>')
    expect(html).toContain('מפרו &lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('renders the clicks summary per axis', () => {
    const html = buildExportHtml([makeSession()], exportedAt)
    expect(html).toContain('4 קליקים למעלה · 2 קליקים שמאלה')
  })

  it('renders מאופס when both directions are none', () => {
    const zeroed = makeSession({
      correction: {
        elevation: { clicks: 0, direction: 'none', residualCm: 0 },
        windage: { clicks: 0, direction: 'none', residualCm: 0 },
      },
    })
    const html = buildExportHtml([zeroed], exportedAt)
    expect(html).toContain('מאופס')
    expect(html).not.toContain('קליקים למעלה')
    expect(html).not.toContain('קליקים שמאלה')
  })

  it('renders offsets and hit counts', () => {
    const html = buildExportHtml([makeSession()], exportedAt)
    expect(html).toContain('סטייה: 1.2 ס"מ ימינה · 2.5 ס"מ למטה')
    expect(html).toContain('4 פגיעות (1 מוחרגות)')
  })

  it('includes an img when imageDataUrl is present', () => {
    const withImage = makeSession({ imageDataUrl: 'data:image/jpeg;base64,AAAA' })
    const html = buildExportHtml([withImage], exportedAt)
    expect(html).toContain('<img')
    expect(html).toContain('data:image/jpeg;base64,AAAA')
  })

  it('omits img when imageDataUrl is absent', () => {
    const html = buildExportHtml([makeSession()], exportedAt)
    expect(html).not.toContain('<img')
  })

  it('escapes notes', () => {
    const noted = makeSession({ notes: 'רוח צד <img src=x onerror=alert(1)> & "מרכאות"' })
    const html = buildExportHtml([noted], exportedAt)
    expect(html).not.toContain('<img')
    expect(html).toContain('רוח צד &lt;img src=x onerror=alert(1)&gt; &amp; &quot;מרכאות&quot;')
  })
})
