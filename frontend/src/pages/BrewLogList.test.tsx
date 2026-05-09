/**
 * T030 — Portal regression tests for BrewLogList
 *
 * Ensures the FAB (Add shot button) is rendered via createPortal to document.body,
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
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock('../api/brewLog', () => ({
  listBrewLog: vi.fn(),
  getBrewLogDetail: vi.fn(),
}))

import { listBrewLog } from '../api/brewLog'
import BrewLogList from './BrewLogList'

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
  vi.mocked(listBrewLog).mockResolvedValue([
    {
      shot_id: 'shot-1',
      date: '2025-07-29',
      bag_display: 'Test Roaster — Test Bean',
    },
  ])
})

describe('BrewLogList — portal regression', () => {
  it('FAB renders in document.body, not inside component container', async () => {
    const { container } = renderWithQuery(<BrewLogList />)

    const fab = await screen.findByRole('button', { name: /add shot/i })

    expect(fab).toBeInTheDocument()             // sanity: element exists
    expect(container).not.toContainElement(fab) // NOT inside component root
    expect(document.body).toContainElement(fab) // IS portalled to body
  })
})
