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
  it.each(['summary', 'row', 'list-card'] as const)('renders %s through the canonical summary content path', (variant) => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={shot} variant={variant} data-testid={variant} />
      </Wrapper>
    )

    const card = screen.getByTestId(variant)
    expect(card).toHaveClass('shot-card-summary')
    expect(container.querySelector('.shot-row')).toBeNull()
    expect(screen.getByRole('img', { name: 'Test Roaster — Test Bean' })).toHaveAttribute('src', '/static/catalog/test-bean.jpg')
    expect(card).toHaveTextContent('2025-07-29')
    expect(container.querySelector('.entity-card-eyebrow')).toHaveTextContent('Test Roaster')
    expect(container.querySelector('.entity-card-date')).toHaveTextContent('2025-07-29')
    expect(container.querySelector('.entity-card-body + .entity-card-figure')).toBeInTheDocument()
    expect(container.querySelector('.kk-tc-metric-chip')).toHaveTextContent('18g → 36g')
    expect(card).toHaveTextContent('Test Bean')
    expect(card).toHaveTextContent('Good Espresso')
    expect(card).toHaveTextContent('18g → 36g')
    expect(card).toHaveTextContent('27s')
    expect(card).toHaveTextContent('Grind 4.5')
    expect(card).not.toHaveTextContent('Linea Mini')
    expect(card).not.toHaveTextContent('Niche Zero')
    expect(card).not.toHaveTextContent('IMS')
  })

  it('uses a monogram fallback for summaries when image_path is absent', () => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={{ ...shot, image_path: undefined }} variant="summary" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })

  it('allows Dashboard to force summary media to monogram even when image_path exists', () => {
    const { container } = render(
      <Wrapper>
        <ShotCard shot={shot} variant="summary" media="monogram" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })
})
