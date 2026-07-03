/**
 * ShotRow tests — compact glass link row, tone-aware, motion class.
 *
 * Principles verified: P1 (token-based styling), P8 (hover intensify via CSS),
 * P10 (single <a> for semantic link), P12 (kaapi-motion-card class default).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ToneProvider } from '../../../contexts/ToneContext'
import { ShotRow, ShotRowSkeleton } from '../ShotRow'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </ToneProvider>
  )
}

describe('ShotRow', () => {
  it('renders as a link pointing to href', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/brew-log/shot-1')
  })

  it('renders the bag name', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    expect(screen.getByText('Ethiopia Sidamo')).toBeInTheDocument()
  })

  it('renders the date', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    expect(screen.getByText('2025-07-29')).toBeInTheDocument()
  })

  it('renders dose→yield chip when doseYield is provided', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" doseYield="18g → 36g" />
      </Wrapper>
    )
    expect(screen.getByText('18g → 36g')).toBeInTheDocument()
  })

  it('does not render the chip when doseYield is absent', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    expect(screen.queryByText(/g → /)).toBeNull()
  })

  it('applies shot-row class for glass styling', () => {
    const { container } = render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    expect(container.querySelector('.shot-row')).toBeInTheDocument()
  })

  it('applies kaapi-motion-card class for GSAP stagger (P12)', () => {
    const { container } = render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" />
      </Wrapper>
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('kaapi-motion-card')
  })

  it('forwards data-testid to the link element', () => {
    render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="Ethiopia Sidamo" date="2025-07-29" data-testid="shot-row-1" />
      </Wrapper>
    )
    expect(screen.getByTestId('shot-row-1')).toBeInTheDocument()
  })

  it('forwards extra className', () => {
    const { container } = render(
      <Wrapper>
        <ShotRow href="/brew-log/shot-1" bagName="x" date="x" className="extra-class" />
      </Wrapper>
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('extra-class')
  })
})

describe('ShotRowSkeleton', () => {
  it('renders with shot-row and shot-row--skeleton classes', () => {
    const { container } = render(
      <Wrapper>
        <ShotRowSkeleton />
      </Wrapper>
    )
    const el = container.querySelector('.shot-row--skeleton')
    expect(el).toBeInTheDocument()
    expect(el?.className).toContain('shot-row')
  })

  it('is aria-hidden', () => {
    const { container } = render(
      <Wrapper>
        <ShotRowSkeleton />
      </Wrapper>
    )
    const el = container.querySelector('.shot-row--skeleton')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })
})
