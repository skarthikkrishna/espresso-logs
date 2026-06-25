/**
 * CatalogList tests — portal regression + immersive shell migration.
 *
 * T029 — Portal regression: FAB renders via ImmersiveFab (createPortal to body).
 * New tests: immersive shell structure, EntityCard grid, GSAP motion classes,
 * ToneToggle presence, empty state, search, and data-testid preservation.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any import of the mocked module
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

vi.mock('../api/catalog', () => ({
  listCatalog: vi.fn(),
}))

vi.mock('../components/AddBeanModal', () => ({ default: () => null }))
vi.mock('../components/LoadingSpinner', () => ({ default: () => null }))

import { listCatalog } from '../api/catalog'
import CatalogList from './CatalogList'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

const FIXTURE = [
  {
    catalog_id: 'cat-1',
    roaster: 'Test Roaster',
    bean_name: 'Test Bean',
    roast_level: 'Medium',
  },
  {
    catalog_id: 'cat-2',
    roaster: 'Other Roaster',
    bean_name: 'Other Bean',
    roast_level: 'Light',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCatalog).mockResolvedValue(FIXTURE)
})

describe('CatalogList — add action placement', () => {
  it('renders a contextual Add coffee CTA instead of a portalled FAB', async () => {
    const { container } = renderWithQuery(<CatalogList />)

    await screen.findByTestId('catalog-grid')
    expect(container.querySelector('.immersive-fab')).toBeNull()
    expect(container).toContainElement(screen.getByRole('button', { name: /add coffee/i }))
  })
})

describe('CatalogList — immersive shell structure', () => {
  it('renders motion-route-boundary data-testid on the shell wrapper', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    expect(screen.getByTestId('motion-route-boundary')).toBeInTheDocument()
  })

  it('renders catalog-section-heading data-testid', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-section-heading')
    expect(screen.getByTestId('catalog-section-heading')).toBeInTheDocument()
  })

  it('renders ToneToggle button', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    const toneBtn = screen.getByRole('button', { name: /switch to (light|dark) tone/i })
    expect(toneBtn).toBeInTheDocument()
  })
})

describe('CatalogList — EntityCard grid', () => {
  it('renders the catalog-grid with kaapi-motion-card class on each item', async () => {
    renderWithQuery(<CatalogList />)
    const grid = await screen.findByTestId('catalog-grid')
    expect(grid).toBeInTheDocument()
    const cards = grid.querySelectorAll('.kaapi-motion-card')
    expect(cards).toHaveLength(FIXTURE.length)
  })

  it('renders catalog-card data-testid on each EntityCard', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    const cards = screen.getAllByTestId('catalog-card')
    expect(cards).toHaveLength(FIXTURE.length)
  })

  it('renders bean name as entity-card title text', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    expect(screen.getByText('Test Bean')).toBeInTheDocument()
    expect(screen.getByText('Other Bean')).toBeInTheDocument()
  })

  it('renders roaster as entity-card eyebrow text', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    expect(screen.getByText('Test Roaster')).toBeInTheDocument()
    expect(screen.getByText('Other Roaster')).toBeInTheDocument()
  })

  it('renders RoastChip with canonical casing (not uppercased)', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')
    // Canonical casing: "Medium", not "MEDIUM"
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
  })
})

describe('CatalogList — search filter', () => {
  it('filters cards by roaster name', async () => {
    renderWithQuery(<CatalogList />)
    await screen.findByTestId('catalog-grid')

    const searchInput = screen.getByRole('textbox', { name: /search catalog/i })
    fireEvent.change(searchInput, { target: { value: 'Other Roaster' } })

    const cards = screen.getAllByTestId('catalog-card')
    expect(cards).toHaveLength(1)
    expect(screen.getByText('Other Bean')).toBeInTheDocument()
    expect(screen.queryByText('Test Bean')).not.toBeInTheDocument()
  })
})

describe('CatalogList — empty catalog', () => {
  it('shows fresh-household-empty-catalog testid when data is empty array', async () => {
    vi.mocked(listCatalog).mockResolvedValue([])
    renderWithQuery(<CatalogList />)
    const empty = await screen.findByTestId('fresh-household-empty-catalog')
    expect(empty).toBeInTheDocument()
  })
})
