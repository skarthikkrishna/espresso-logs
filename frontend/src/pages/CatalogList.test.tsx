/**
 * T029 — Portal regression tests for CatalogList
 *
 * Ensures the FAB (Add bean button) is rendered via createPortal to document.body,
 * preventing backdrop-filter on #main-content from breaking fixed positioning.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(listCatalog).mockResolvedValue([
    {
      catalog_id: 'cat-1',
      roaster: 'Test Roaster',
      bean_name: 'Test Bean',
      roast_level: 'Medium',
    },
  ])
})

describe('CatalogList — portal regression', () => {
  it('FAB renders in document.body, not inside component container', async () => {
    const { container } = renderWithQuery(<CatalogList />)

    const fab = await screen.findByRole('button', { name: /add bean/i })

    expect(fab).toBeInTheDocument()             // sanity: element exists
    expect(container).not.toContainElement(fab) // NOT inside component root
    expect(document.body).toContainElement(fab) // IS portalled to body
  })
})
