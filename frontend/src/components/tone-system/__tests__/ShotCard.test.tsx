import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { BrewLogEntry } from '../../../types/entities'
import { ToneProvider } from '../../../contexts/ToneContext'
import { ShotCard } from '../ShotCard'

const shot: BrewLogEntry = {
  shot_id: 'shot-1',
  date: '2025-07-29',
  bag_display: 'Test Roaster — Test Bean',
  image_path: '/static/catalog/test-bean.jpg',
  dose_in_g: 18,
  yield_out_g: 36,
  time_sec: 27,
  grind_setting: '4.5',
  shot_eligibility: 'Good Espresso',
  machine_name: 'Linea Mini',
  grinder_name: 'Niche Zero',
  basket_name: 'IMS',
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ToneProvider>
  )
}

describe('ShotCard', () => {
  it.each(['summary'] as const)('renders %s through the canonical summary content path', (variant) => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={shot} variant={variant} data-testid={variant} />
      </Wrapper>
    )

    const card = screen.getByTestId(variant)
    expect(card).toHaveClass('shot-card-summary')
    expect(container.querySelector('.shot-row')).toBeNull()
    expect(screen.queryByRole('img', { name: 'Test Roaster — Test Bean' })).toBeNull()
    expect(card).toHaveTextContent('2025-07-29')
    expect(container.querySelector('.entity-card-eyebrow')).toHaveTextContent('Test Roaster')
    expect(container.querySelector('.entity-card-date')).toHaveTextContent('2025-07-29')
    expect(container.querySelector('.entity-card-figure')).toBeNull()
    expect(card).toHaveClass('entity-card--no-media')
    expect(card).toHaveTextContent('Test Bean')
    expect(card).toHaveTextContent('Good Espresso')
    expect(card).toHaveTextContent('27s')
    expect(card).toHaveTextContent('1:2.0')
    expect(screen.queryByTestId('shot-yield-chip')).toBeNull()
    expect(container.querySelectorAll('.entity-card-chip-slot .kk-tc-chip, .entity-card-chip-slot .extraction-chip')).toHaveLength(3)
    expect(screen.getByTestId('shot-time-chip')).toHaveClass('extraction-chip')
    expect(screen.getByTestId('shot-ratio-chip')).toHaveClass('extraction-chip')
    expect(card).not.toHaveTextContent('18g')
    expect(card).not.toHaveTextContent('Grind 4.5')
    expect(container.querySelector('.kk-tc-metric-chip')).toBeNull()
    expect(card).not.toHaveTextContent('Linea Mini')
    expect(card).not.toHaveTextContent('IMS')
  })

  it('renders brew-log compact chips in canonical priority order without grinder or raw dose', () => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={{ ...shot, roast_level: 'Light' }} variant="list-card" data-testid="brew-card" />
      </Wrapper>
    )

    const chipTexts = Array.from(container.querySelectorAll('.entity-card-chip-slot .kk-tc-chip, .entity-card-chip-slot .extraction-chip'))
      .map((chip) => chip.textContent)
    expect(chipTexts).toEqual(['Good Espresso', '1:2.0', '27s', '36g', 'Sour', 'Light'])
    expect(screen.getByTestId('brew-card')).not.toHaveTextContent('4.5')
    expect(screen.getByTestId('brew-card')).not.toHaveTextContent('18g')
    expect(screen.getByTestId('brew-card')).not.toHaveTextContent('Niche Zero')
  })

  it('uses no media fallback for summaries when image_path is absent', () => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={{ ...shot, image_path: undefined }} variant="summary" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toBeNull()
  })

  it('can still render explicitly requested monogram media for approved placeholders', () => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={shot} variant="summary" media="monogram" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })
})
