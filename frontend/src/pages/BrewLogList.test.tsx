/**
 * T030 — Portal regression tests for BrewLogList
 *
 * Ensures the FAB (Add shot button) is rendered via createPortal to document.body,
 * preventing backdrop-filter on #main-content from breaking fixed positioning.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { brewLogListQueryKey } from '../api/queryKeys'

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
  brewLogDetailQueryKey: (id: string) => ['brew-log-detail', id] as const,
  listBrewLog: vi.fn(),
  getBrewLogDetail: vi.fn(),
}))

import { getBrewLogDetail, listBrewLog } from '../api/brewLog'
import BrewLogList from './BrewLogList'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return {
    queryClient,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
      </MemoryRouter>
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
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
  vi.mocked(getBrewLogDetail).mockResolvedValue({
    shot_id: 'shot-1',
    date: '2025-07-29',
    bag_display: 'Test Roaster — Test Bean',
    roast_level: 'Light',
  })
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

describe('BrewLogList — detail prefetch cache key', () => {
  it('prefetches shot detail under a dedicated key that does not collide with paginated list keys', async () => {
    const { queryClient } = renderWithQuery(<BrewLogList />)

    const entry = await screen.findByTestId('brew-log-entry')
    fireEvent.mouseEnter(entry)

    await waitFor(() => {
      expect(getBrewLogDetail).toHaveBeenCalledWith('shot-1')
      expect(queryClient.getQueryState(['brew-log-detail', 'shot-1'])).toBeDefined()
    })
    expect(queryClient.getQueryState(['brew-log', 'shot-1'])).toBeUndefined()
    expect(queryClient.getQueryState(brewLogListQueryKey(undefined, 1, 100))).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Pagination controls — AC #2
// ---------------------------------------------------------------------------

describe('BrewLogList — pagination controls', () => {
  it('Previous button is disabled on page 1', async () => {
    // Intent: navigating back past the first page must be blocked so users
    // cannot request negative offsets or page 0.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Roaster — Test Bean')

    const prev = screen.getByRole('button', { name: /previous/i })
    expect(prev).toBeDisabled()
  })

  it('Next button is disabled when has_next is false', async () => {
    // Intent: when the API signals no more pages, the Next control must be
    // inert so clicking it cannot trigger a spurious out-of-range page fetch.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Roaster — Test Bean')

    const next = screen.getByRole('button', { name: /next/i })
    expect(next).toBeDisabled()
  })

  it('Next button is enabled when has_next is true', async () => {
    // Intent: when more pages exist, the Next control must be interactive
    // so users can reach later history.
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [{ shot_id: 'shot-1', date: '2025-07-29', bag_display: 'Roaster — Bean' }],
      page: 1,
      per_page: 100,
      total_count: 200,
      has_next: true,
      sync_alert: false,
    })
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Roaster — Bean')

    const next = screen.getByRole('button', { name: /next/i })
    expect(next).not.toBeDisabled()
  })

  it('pagination nav has accessible label', async () => {
    // Intent: screen readers must be able to identify the pagination region;
    // removing aria-label from <nav> would break this assertion.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Roaster — Test Bean')

    expect(screen.getByRole('navigation', { name: /brew log pagination/i })).toBeInTheDocument()
  })

  it('active page indicator has aria-current="page"', async () => {
    // Intent: assistive technologies rely on aria-current to announce the
    // current page; removing the attribute would silently break accessibility.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Roaster — Test Bean')

    const pageIndicator = screen.getByText('1')
    expect(pageIndicator).toHaveAttribute('aria-current', 'page')
  })
})

// ---------------------------------------------------------------------------
// Sync-gap alert banner — AC #5
// ---------------------------------------------------------------------------

describe('BrewLogList — sync-gap alert banner', () => {
  it('shows alert banner when sync_alert is true', async () => {
    // Intent: if the operator has flagged a Sheets↔Postgres drift, the user
    // must see a warning — silently removing the sync_alert field or the
    // conditional render would cause this test to fail.
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [{ shot_id: 'shot-1', date: '2025-07-29', bag_display: 'Roaster — Bean' }],
      page: 1,
      per_page: 100,
      total_count: 1,
      has_next: false,
      sync_alert: true,
    })
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Roaster — Bean')

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/incomplete/i)
  })

  it('does not show alert banner when sync_alert is false', async () => {
    // Intent: the alert must only appear when the operator explicitly flags drift;
    // it must not appear on every page load.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Roaster — Test Bean')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('alert banner is dismissible', async () => {
    // Intent: once the user has seen the warning they must be able to dismiss
    // it so it does not obstruct the list on every subsequent interaction.
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [{ shot_id: 'shot-1', date: '2025-07-29', bag_display: 'Roaster — Bean' }],
      page: 1,
      per_page: 100,
      total_count: 1,
      has_next: false,
      sync_alert: true,
    })
    renderWithQuery(<BrewLogList />)
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: /✕/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
