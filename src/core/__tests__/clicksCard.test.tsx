import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ClicksCard } from '../../components/ClicksCard'

afterEach(cleanup)

describe('ClicksCard', () => {
  it('renders the click count, Hebrew direction, and instruction', () => {
    const { container } = render(
      <ClicksCard
        axisLabel="גובה"
        correction={{ clicks: 4, direction: 'up', residualCm: 0.1 }}
        instruction="סובב את בורג הגובה בכיוון UP"
      />,
    )
    const text = container.textContent!
    expect(text).toContain('גובה')
    expect(text).toContain('4')
    expect(text).toContain('↑')
    expect(text).toContain('קליקים למעלה')
    expect(text).toContain('סובב את בורג הגובה בכיוון UP')
  })

  it('renders the zeroed state when direction is none', () => {
    const { container } = render(
      <ClicksCard axisLabel="צד" correction={{ clicks: 0, direction: 'none', residualCm: 0.2 }} />,
    )
    const text = container.textContent!
    expect(text).toContain('צד')
    expect(text).toContain('מאופס')
    expect(text).not.toContain('קליקים')
  })
})
