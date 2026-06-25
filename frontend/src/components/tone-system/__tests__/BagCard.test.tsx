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
  it('renders the card variant through EntityCard without Home media', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={bag} variant="card" />
      </Wrapper>
    )

    expect(container.querySelector('.entity-card.bag-card-compact')).toBeInTheDocument()
    expect(container.querySelector('.entity-card-eyebrow')).toHaveTextContent('Test Roaster')
    expect(container.querySelector('.entity-card-title')).toHaveTextContent('Test Bean')
    expect(container.querySelector('.entity-card-date')).toHaveTextContent('2d ago')
    expect(screen.queryByRole('img', { name: 'Test Roaster — Test Bean' })).toBeNull()
    expect(container.querySelector('.entity-card-figure')).toBeNull()
    expect(container.querySelector('.kk-tc-metric-chip')).toBeNull()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.queryByText('18g → 36g')).not.toBeInTheDocument()
    expect(screen.queryByText('TR')).not.toBeInTheDocument()
  })

  it('uses no monogram fallback when image_path is absent', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={{ ...bag, image_path: '' }} variant="card" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toBeNull()
  })

  it('can still render explicitly requested monogram media for approved placeholders', () => {
    const { container } = render(
      <Wrapper>
        <BagCard bag={bag} variant="card" media="monogram" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TR')
  })

  it('renders the row variant as one flat bag row with metadata and roast on separate rows', () => {
    const { container } = render(
      <Wrapper>
        <BagCard
          bag={{
            ...bag,
            roast_date: '2026-06-01',
            status: 'Active',
            catalog_id: 'cat-1',
          }}
          variant="row"
          action={<button type="button">Finish bag</button>}
        />
      </Wrapper>
    )

    expect(container.querySelector('.bag-card-row')).toBeInTheDocument()
    expect(container.querySelector('.bag-card-row .entity-card')).toBeNull()
    expect(container.querySelector('.bag-card-row__meta')).toHaveTextContent('2026-06-01')
    expect(screen.getByTestId('bag-status')).toHaveTextContent('Active')
    expect(container.querySelector('.bag-card-row__chip-line')).toHaveTextContent('Medium')
    expect(screen.getByRole('button', { name: 'Finish bag' })).toBeInTheDocument()
  })
})
