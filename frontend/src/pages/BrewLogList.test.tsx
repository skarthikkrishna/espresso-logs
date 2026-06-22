/**
 * T030 — Portal regression tests for BrewLogList
 *
 * Ensures the FAB (Add shot button) is rendered via createPortal to document.body,
 * preventing backdrop-filter on #main-content from breaking fixed positioning.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { brewLogListQueryKey } from '../api/queryKeys'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any import of the mocked module
// ---------------------------------------------------------------------------

const routerState = vi.hoisted(() => ({ search: new URLSearchParams() }))
const setSearchParamsMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [routerState.search, setSearchParamsMock] as const,
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
  routerState.search = new URLSearchParams()
  setSearchParamsMock.mockClear()
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

    const fab = await screen.findByRole('button', { name: /log a shot/i })

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

describe('BrewLogList — canonical state cards preserve fetch states', () => {
  it('renders the loading state as a live busy ToneStateCard with row skeletons', () => {
    // Intent: the canonical migration must keep loading announced to assistive
    // tech and must preserve row-shaped skeletons; a spinner-only replacement
    // or non-live generic render would fail this.
    vi.mocked(listBrewLog).mockReturnValue(new Promise(() => {}))
    const { container } = renderWithQuery(<BrewLogList />)

    const loading = screen.getByRole('status')
    expect(loading).toHaveAttribute('data-state', 'loading')
    expect(loading).toHaveAttribute('aria-busy', 'true')
    expect(loading).toHaveTextContent('Loading brew log')
    expect(container.querySelectorAll('.shot-row--skeleton')).toHaveLength(3)
  })

  it('renders fetch failures as an assertive error card with retry action', async () => {
    // Intent: a failed list fetch must remain visible, assertive, and
    // recoverable after the canonical ToneStateCard swap.
    vi.mocked(listBrewLog).mockRejectedValueOnce(new Error('network down'))
    renderWithQuery(<BrewLogList />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('data-state', 'error')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(alert).toHaveTextContent('Failed to load brew log.')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(listBrewLog).toHaveBeenCalledTimes(2)
    })
  })

  it('renders an empty fresh household state without pagination chrome', async () => {
    // Intent: an empty household is a valid data state, not an error; the
    // migration must keep the fresh-household empty copy/action and avoid
    // showing irrelevant pagination controls.
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [],
      page: 1,
      per_page: 100,
      total_count: 0,
      has_next: false,
      sync_alert: false,
    })
    renderWithQuery(<BrewLogList />)

    const emptyState = await screen.findByTestId('fresh-household-empty-brew-log')
    expect(emptyState).toHaveTextContent('No shots logged yet.')
    expect(within(emptyState).getByRole('button', { name: /log a shot/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
  })

  it('fetches the requested page and renders returned shots through canonical shot cards', async () => {
    // Intent: list migration must preserve paged data fetching and render the
    // returned shot identity, not a static/presence-only placeholder.
    routerState.search = new URLSearchParams('page=2')
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [{ shot_id: 'shot-2', date: '2025-07-30', bag_display: 'Second Roaster — Bean' }],
      page: 2,
      per_page: 100,
      total_count: 200,
      has_next: false,
      sync_alert: false,
    })
    renderWithQuery(<BrewLogList />)

    const entry = await screen.findByTestId('brew-log-entry')
    expect(listBrewLog).toHaveBeenCalledWith(2, 100)
    expect(entry).toHaveTextContent('Second Roaster')
    expect(entry).toHaveTextContent('Bean')
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
  })
})
// ---------------------------------------------------------------------------
// Pagination controls — AC #2 (shared Pagination primitive)
// ---------------------------------------------------------------------------

describe('BrewLogList — pagination controls', () => {
  const multiPage = {
    items: [{ shot_id: 'shot-1', date: '2025-07-29', bag_display: 'Roaster — Bean' }],
    page: 1,
    per_page: 100,
    total_count: 200, // 2 pages at 100/page
    has_next: true,
    sync_alert: false,
  }

  it('renders no pagination chrome when there is only a single page', async () => {
    // Intent: a one-page history shows no Previous/Next controls — the shared
    // Pagination primitive returns null at pageCount <= 1. Re-adding always-on
    // controls (or miscomputing pageCount) would fail this.
    renderWithQuery(<BrewLogList />) // default beforeEach data: total_count = 1
    await screen.findByText('Test Bean')

    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('Previous button is disabled on page 1', async () => {
    // Intent: navigating back past the first page must be blocked so users
    // cannot request negative offsets or page 0.
    vi.mocked(listBrewLog).mockResolvedValue(multiPage)
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Bean')

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled()
  })

  it('Next button is disabled on the last page', async () => {
    // Intent: on the final page the Next control must be inert so clicking it
    // cannot trigger a spurious out-of-range page fetch.
    routerState.search = new URLSearchParams('page=2')
    vi.mocked(listBrewLog).mockResolvedValue({ ...multiPage, page: 2, has_next: false })
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Bean')

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled()
  })

  it('Next button is enabled when more pages exist', async () => {
    // Intent: when more pages exist, the Next control must be interactive
    // so users can reach later history.
    vi.mocked(listBrewLog).mockResolvedValue(multiPage)
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Bean')

    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
  })

  it('pagination nav has an accessible label', async () => {
    // Intent: screen readers must be able to identify the pagination region;
    // removing the nav aria-label would break this assertion.
    vi.mocked(listBrewLog).mockResolvedValue(multiPage)
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Bean')

    expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument()
  })

  it('active page indicator has aria-current="page"', async () => {
    // Intent: assistive technologies rely on aria-current to announce the
    // current page; removing the attribute would silently break accessibility.
    vi.mocked(listBrewLog).mockResolvedValue(multiPage)
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Bean')

    const current = screen.getByRole('button', { name: '1' })
    expect(current).toHaveAttribute('aria-current', 'page')
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
    await screen.findByText('Bean')

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/incomplete/i)
  })

  it('does not show alert banner when sync_alert is false', async () => {
    // Intent: the alert must only appear when the operator explicitly flags drift;
    // it must not appear on every page load.
    renderWithQuery(<BrewLogList />)
    await screen.findByText('Test Bean')

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
