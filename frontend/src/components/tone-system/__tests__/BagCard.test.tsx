import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { DashboardBag } from '../../../types/entities'
import { ToneProvider } from '../../../contexts/ToneContext'
import { BagCard } from '../BagCard'

const bag: DashboardBag = {
  bag_id: 'bag-1',
  display_name: 'Test Roaster — Test Bean',
  image_path: '/static/catalog/test-bean.jpg',
  roast_level: 'Medium',
  days_since_last_shot: 2,
  last_shot: {
    dose_in_g: 18,
    yield_out_g: 36,
  },
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ToneProvider>
  )
}

describe('BagCard', () => {
  it('renders the card variant through EntityCard and catalog media', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={bag} variant="card" />
      </Wrapper>
    )

    expect(container.querySelector('.entity-card.bag-card-compact')).toBeInTheDocument()
    expect(container.querySelector('.entity-card-eyebrow')).toHaveTextContent('Test Roaster')
    expect(container.querySelector('.entity-card-title')).toHaveTextContent('Test Bean')
    expect(container.querySelector('.entity-card-date')).toHaveTextContent('2d ago')
    const img = screen.getByRole('img', { name: 'Test Roaster — Test Bean' })
    expect(img).toHaveAttribute('src', '/static/catalog/test-bean.jpg')
    expect(container.querySelector('.kk-tc-metric-chip')).toHaveTextContent('18g → 36g')
    expect(screen.queryByText('TR')).not.toBeInTheDocument()
  })

  it('uses EntityCard monogram fallback only when image_path is absent', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={{ ...bag, image_path: '' }} variant="card" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })

  it('allows Dashboard to force monogram media without removing catalog image support', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={bag} variant="card" media="monogram" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })
})
