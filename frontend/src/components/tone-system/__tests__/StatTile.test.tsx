/**
 * StatTile tests — glass mini-tile, tone-aware, dual-tone coherence.
 *
 * Principles verified: P1 (token-based styling), P2 (single glass surface),
 * P12 (reusable for any summary page).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ToneProvider } from '../../../contexts/ToneContext'
import { StatTile, StatTileSkeleton } from '../StatTile'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToneProvider>{children}</ToneProvider>
}

describe('StatTile', () => {
  it('renders the value', () => {
    render(
      <Wrapper>
        <StatTile value={42} label="Active bags" />
      </Wrapper>
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders the label', () => {
    render(
      <Wrapper>
        <StatTile value={0} label="Active bags" />
      </Wrapper>
    )
    expect(screen.getByText('Active bags')).toBeInTheDocument()
  })

  it('renders a string value', () => {
    render(
      <Wrapper>
        <StatTile value="—" label="Recent" />
      </Wrapper>
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('applies stat-tile class for glass styling', () => {
    const { container } = render(
      <Wrapper>
        <StatTile value={5} label="Households" />
      </Wrapper>
    )
    expect(container.querySelector('.stat-tile')).toBeInTheDocument()
  })

  it('applies stat-tile__value class to the value element', () => {
    const { container } = render(
      <Wrapper>
        <StatTile value={5} label="Households" />
      </Wrapper>
    )
    expect(container.querySelector('.stat-tile__value')).toBeInTheDocument()
  })

  it('applies stat-tile__label class to the label element', () => {
    const { container } = render(
      <Wrapper>
        <StatTile value={5} label="Households" />
      </Wrapper>
    )
    expect(container.querySelector('.stat-tile__label')).toBeInTheDocument()
  })

  it('forwards extra className', () => {
    const { container } = render(
      <Wrapper>
        <StatTile value={1} label="x" className="extra-class" />
      </Wrapper>
    )
    const tile = container.querySelector('.stat-tile')
    expect(tile?.className).toContain('extra-class')
  })

  it('value parent contains the label text (household count test pattern)', () => {
    render(
      <Wrapper>
        <StatTile value={2} label="Household" />
      </Wrapper>
    )
    const label = screen.getByText('Household')
    const tile = label.parentElement as HTMLElement
    expect(tile).toHaveTextContent('2')
  })
})

describe('StatTileSkeleton', () => {
  it('renders with stat-tile and stat-tile--skeleton classes', () => {
    const { container } = render(
      <Wrapper>
        <StatTileSkeleton />
      </Wrapper>
    )
    const el = container.querySelector('.stat-tile--skeleton')
    expect(el).toBeInTheDocument()
    expect(el?.className).toContain('stat-tile')
  })

  it('is aria-hidden', () => {
    const { container } = render(
      <Wrapper>
        <StatTileSkeleton />
      </Wrapper>
    )
    const el = container.querySelector('.stat-tile--skeleton')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })
})
