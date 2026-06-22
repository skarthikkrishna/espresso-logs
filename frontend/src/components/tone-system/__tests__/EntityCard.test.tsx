/**
 * EntityCard tests — glass card anatomy, GSAP class, accessibility.
 *
 * Principles verified: P7 (canonical chip casing not forced), P8 (interactive
 * states via CSS classes, not inline), P10 (single <a> for card semantics),
 * P12 (kaapi-motion-card default motionClassName).
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { EntityCard } from '../EntityCard'
import { RoastChip } from '../RoastChip'
import { ToneProvider } from '../../../contexts/ToneContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ToneProvider>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </ToneProvider>
  )
}

describe('EntityCard', () => {
  it('renders as a link pointing to href', () => {
    render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" />
      </Wrapper>
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/catalog/1')
  })

  it('renders the title text', () => {
    render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" />
      </Wrapper>
    )
    expect(screen.getByText('Test Bean')).toBeInTheDocument()
  })

  it('renders eyebrow text when provided', () => {
    render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" eyebrow="Test Roaster" />
      </Wrapper>
    )
    expect(screen.getByText('Test Roaster')).toBeInTheDocument()
  })

  it('renders chip slot content', () => {
    render(
      <Wrapper>
        <EntityCard
          href="/catalog/1"
          title="Test Bean"
          chip={<RoastChip level="Medium" />}
        />
      </Wrapper>
    )
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders the canonical date line below the title when provided', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" date={<time dateTime="2026-06-10">2026-06-10</time>} />
      </Wrapper>
    )

    expect(container.querySelector('.entity-card-title + .entity-card-date')).toHaveTextContent('2026-06-10')
  })

  it('applies default kaapi-motion-card class for GSAP stagger (P12)', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" />
      </Wrapper>
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('kaapi-motion-card')
  })

  it('accepts custom motionClassName overriding the default', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" motionClassName="custom-motion" />
      </Wrapper>
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('custom-motion')
    expect(link?.className).not.toContain('kaapi-motion-card')
  })

  it('applies entity-card class for glass styling', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" />
      </Wrapper>
    )
    expect(container.querySelector('.entity-card')).toBeInTheDocument()
  })

  it('renders img element when imageUrl is provided', () => {
    render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" imageUrl="/img/bean.jpg" />
      </Wrapper>
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/img/bean.jpg')
    expect(img).toHaveAttribute('alt', 'Test Bean')
  })

  it('forces monogram media when requested even if imageUrl is provided', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" imageUrl="/img/bean.jpg" media="monogram" />
      </Wrapper>
    )

    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.entity-card-monogram')).toHaveTextContent('TB')
  })

  it('renders full-figure monogram fill when imageUrl is absent', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" eyebrow="Test Roaster" />
      </Wrapper>
    )
    // No img element — monogram fill is used instead
    expect(screen.queryByRole('img')).toBeNull()
    // Full-figure monogram fill wrapper and letter are rendered
    expect(container.querySelector('.entity-card-monogram-fill')).toBeInTheDocument()
    expect(container.querySelector('.entity-card-monogram')).toBeInTheDocument()
  })

  it('derives monogram from title words, not from eyebrow', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Roaster Bean" eyebrow="Ready to brew" />
      </Wrapper>
    )
    // eyebrow "Ready to brew" → old buggy code gave "RE"; title "Roaster Bean" → "RB"
    expect(container.querySelector('.entity-card-monogram')?.textContent).toBe('RB')
  })

  it('splits on em-dash/en-dash for monogram — "Roaster — Bean" → "RB"', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title={"Roaster \u2014 Bean"} eyebrow="Ready to brew" />
      </Wrapper>
    )
    expect(container.querySelector('.entity-card-monogram')?.textContent).toBe('RB')
  })

  it('uses only the first two words for monogram', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Ethiopia Yirgacheffe Natural" />
      </Wrapper>
    )
    expect(container.querySelector('.entity-card-monogram')?.textContent).toBe('EY')
  })

  it('produces a single-letter monogram for a one-word title', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Monkeyman" />
      </Wrapper>
    )
    expect(container.querySelector('.entity-card-monogram')?.textContent).toBe('M')
  })

  it('forwards data-testid to the link element', () => {
    render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" data-testid="catalog-card" />
      </Wrapper>
    )
    expect(screen.getByTestId('catalog-card')).toBeInTheDocument()
  })

  it('accepts extra className', () => {
    const { container } = render(
      <Wrapper>
        <EntityCard href="/catalog/1" title="Test Bean" className="extra-class" />
      </Wrapper>
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('extra-class')
  })
})
