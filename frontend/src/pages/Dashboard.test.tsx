/**
 * T031 — Portal regression tests for Dashboard
 *
 * Ensures the FAB (Add shot button) is rendered via createPortal to document.body,
 * preventing backdrop-filter on #main-content from breaking fixed positioning.
 */

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any import of the mocked module
// ---------------------------------------------------------------------------

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../api/dashboard', () => ({
  getDashboard: vi.fn(),
}))

vi.mock('../api/brewLog', () => ({
  listBrewLog: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ activeHouseholdId: 'hh-1' }),
  useHouseholdQueryScope: () => 'hh-1',
}))

import { getDashboard } from '../api/dashboard'
import { listBrewLog } from '../api/brewLog'
import Dashboard from './Dashboard'

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
  navigateMock.mockClear()
  vi.mocked(getDashboard).mockResolvedValue([
    {
      bag_id: 'bag-1',
      display_name: 'Test Roaster — Test Bean',
      roast_level: 'Medium',
    },
  ])
  vi.mocked(listBrewLog).mockResolvedValue({
    items: [
      {
        shot_id: 'shot-1',
        date: '2025-07-29',
        bag_display: 'Test Roaster — Test Bean',
      },
    ],
    page: 1,
    per_page: 100,
    total_count: 1,
    has_next: false,
    sync_alert: false,
  })
})

describe('Dashboard — portal regression', () => {
  it('FAB renders in document.body, not inside component container', async () => {
    const { container } = renderWithQuery(<Dashboard />)

    const fab = await screen.findByTestId('dashboard-fab')

    expect(fab).toHaveAccessibleName(/log a shot/i) // contract hook targets the mobile FAB, not in-flow CTAs
    expect(fab).toBeInTheDocument()             // sanity: element exists
    expect(container).not.toContainElement(fab) // NOT inside component root
    expect(document.body).toContainElement(fab) // IS portalled to body
  })

  it('navigates active bag cards to Add Brew with a reload-safe bag_id query param', async () => {
    renderWithQuery(<Dashboard />)

    const [activeBagCardText] = await screen.findAllByText('Test Roaster — Test Bean')
    fireEvent.click(activeBagCardText)

    expect(navigateMock).toHaveBeenCalledWith('/brew-log/add?bag_id=bag-1')
  })
})
