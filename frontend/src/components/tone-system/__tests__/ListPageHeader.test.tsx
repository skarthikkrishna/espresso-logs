/**
 * ListPageHeader tests — eyebrow, title, section rendering + testId forwarding.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ListPageHeader } from '../ListPageHeader'
import { ToneProvider } from '../../../contexts/ToneContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ToneProvider>{children}</ToneProvider>
}

describe('ListPageHeader', () => {
  it('renders the title as an h1', () => {
    render(
      <Wrapper>
        <ListPageHeader title="Catalog" />
      </Wrapper>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument()
  })

  it('renders eyebrow text when provided', () => {
    render(
      <Wrapper>
        <ListPageHeader title="Catalog" eyebrow="BEANS / INVENTORY" />
      </Wrapper>
    )
    expect(screen.getByText('BEANS / INVENTORY')).toBeInTheDocument()
  })

  it('renders section text when provided', () => {
    render(
      <Wrapper>
        <ListPageHeader title="Catalog" section="COFFEE LIBRARY" />
      </Wrapper>
    )
    expect(screen.getByText('COFFEE LIBRARY')).toBeInTheDocument()
  })

  it('does not render eyebrow element when omitted', () => {
    const { container } = render(
      <Wrapper>
        <ListPageHeader title="Catalog" />
      </Wrapper>
    )
    expect(container.querySelector('.list-page-header-eyebrow')).toBeNull()
  })

  it('does not render section element when omitted', () => {
    const { container } = render(
      <Wrapper>
        <ListPageHeader title="Catalog" />
      </Wrapper>
    )
    expect(container.querySelector('.list-page-header-section')).toBeNull()
  })

  it('forwards sectionTestId to the section element', () => {
    render(
      <Wrapper>
        <ListPageHeader
          title="Catalog"
          section="BEANS / INVENTORY"
          sectionTestId="catalog-section-heading"
        />
      </Wrapper>
    )
    expect(screen.getByTestId('catalog-section-heading')).toBeInTheDocument()
    expect(screen.getByTestId('catalog-section-heading').textContent).toBe('BEANS / INVENTORY')
  })

  it('renders the standard 2-line form (title + section, no eyebrow)', () => {
    const { container } = render(
      <Wrapper>
        <ListPageHeader title="Catalog" section="BEANS / INVENTORY" />
      </Wrapper>
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Catalog' })).toBeInTheDocument()
    expect(screen.getByText('BEANS / INVENTORY')).toBeInTheDocument()
    expect(container.querySelector('.list-page-header-eyebrow')).toBeNull()
  })

  it('applies list-page-header class to the header element', () => {
    const { container } = render(
      <Wrapper>
        <ListPageHeader title="Catalog" />
      </Wrapper>
    )
    expect(container.querySelector('.list-page-header')).toBeInTheDocument()
  })

  it('applies extra className alongside list-page-header', () => {
    const { container } = render(
      <Wrapper>
        <ListPageHeader title="Catalog" className="extra-class" />
      </Wrapper>
    )
    const header = container.querySelector('.list-page-header') as HTMLElement
    expect(header.className).toContain('extra-class')
  })
})
