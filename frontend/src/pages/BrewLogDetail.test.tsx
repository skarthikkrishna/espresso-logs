import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { BrewLogPage } from '../api/brewLog'
import type { BrewLogEntry } from '../types/entities'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'SHOT-001' }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

vi.mock('../api/brewLog', () => ({
  brewLogDetailQueryKey: (id: string) => ['brew-log-detail', id] as const,
  brewLogFeedbackQueryKey: (id: string) => ['brew-log-detail', id, 'feedback'] as const,
  listBrewLog: vi.fn(),
  getBrewLogDetail: vi.fn(),
  getBrewLogFeedback: vi.fn(),
  submitShot: vi.fn(),
}))

import { getBrewLogDetail, getBrewLogFeedback } from '../api/brewLog'
import BrewLogDetail from './BrewLogDetail'

const baseShot: BrewLogEntry = {
  shot_id: 'SHOT-001',
  date: '2025-01-15',
  bag_display: 'Verve Coffee — Seabright',
  roast_level: 'Light',
  dose_in_g: 18,
  yield_out_g: 36,
  time_sec: 27,
  grind_setting: '4.5',
  storage_method: 'Freezer',
  machine_name: 'Breville Barista Express',
  grinder_name: 'Niche Zero',
  basket_name: 'IMS 20g',
  user_notes: 'First shot of the bag',
  ai_feedback: '',
  shot_eligibility: 'Good Espresso',
  taste_summary: 'Sweet & Balanced',
}

const otherShot: BrewLogEntry = {
  ...baseShot,
  shot_id: 'SHOT-999',
  bag_display: 'Other Roaster — Other Bean',
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function brewLogPage(items: BrewLogEntry[]): BrewLogPage {
  return {
    items,
    page: 1,
    per_page: 100,
    total_count: items.length,
    has_next: false,
    sync_alert: false,
  }
}

function renderInContext(queryClient = makeQueryClient()) {
  return {
    queryClient,
    ...render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <BrewLogDetail />
        </QueryClientProvider>
      </MemoryRouter>
    ),
  }
}

function renderWithPaginatedCache(shot: BrewLogEntry = baseShot) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(['brew-log', 1, 100], brewLogPage([shot]))
  return renderInContext(queryClient)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBrewLogDetail).mockResolvedValue(baseShot)
  vi.mocked(getBrewLogFeedback).mockResolvedValue({ ai_feedback: '' })
})

describe('BrewLogDetail — cache contract and fallback', () => {
  it('uses BrewLogPage.items from paginated brew-log caches as initial detail data', () => {
    vi.mocked(getBrewLogDetail).mockReturnValue(new Promise<BrewLogEntry>(() => {}))

    renderWithPaginatedCache({ ...baseShot, bag_display: 'Cached Roaster — Cached Bean' })

    expect(screen.getByText('Cached Roaster — Cached Bean')).toBeInTheDocument()
    expect(screen.getByTestId('brew-log-detail')).toBeInTheDocument()
  })

  it('does not read legacy [\'brew-log\'] array cache data as BrewLogEntry[]', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData(['brew-log'], [{ ...baseShot, bag_display: 'Stale Array — Wrong Shape' }])
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, bag_display: 'API Detail — Correct Shape' })

    renderInContext(queryClient)

    expect(await screen.findByText('API Detail — Correct Shape')).toBeInTheDocument()
    expect(screen.queryByText('Stale Array — Wrong Shape')).not.toBeInTheDocument()
    expect(getBrewLogDetail).toHaveBeenCalledWith('SHOT-001')
  })

  it('calls the detail API fallback when no paginated cache is available', async () => {
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, bag_display: 'API Detail — No Cache' })

    renderInContext()

    expect(await screen.findByText('API Detail — No Cache')).toBeInTheDocument()
    expect(getBrewLogDetail).toHaveBeenCalledWith('SHOT-001')
  })

  it('calls the detail API fallback when paginated cache misses the route shot_id', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData(['brew-log', 1, 100], brewLogPage([otherShot]))
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, bag_display: 'API Detail — Cache Miss' })

    renderInContext(queryClient)

    expect(await screen.findByText('API Detail — Cache Miss')).toBeInTheDocument()
    expect(getBrewLogDetail).toHaveBeenCalledWith('SHOT-001')
  })

  it('calls the detail API fallback when a brew-log cache entry is malformed', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData(['brew-log', 1, 100], { items: 'not-an-array' })
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, bag_display: 'API Detail — Malformed Cache' })

    renderInContext(queryClient)

    expect(await screen.findByText('API Detail — Malformed Cache')).toBeInTheDocument()
    expect(getBrewLogDetail).toHaveBeenCalledWith('SHOT-001')
  })

  it('uses the dedicated detail query key instead of colliding with paginated list keys', async () => {
    const { queryClient } = renderInContext()

    expect(await screen.findByText('Verve Coffee — Seabright')).toBeInTheDocument()
    expect(queryClient.getQueryState(['brew-log-detail', 'SHOT-001'])).toBeDefined()
    expect(queryClient.getQueryState(['brew-log', 'SHOT-001'])).toBeUndefined()
  })
})

describe('BrewLogDetail — detail presentation anchors', () => {
  it('renders eligibility badge in header', () => {
    renderWithPaginatedCache(baseShot)

    const badge = screen.getByTestId('eligibility-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Good Espresso')
  })

  it('renders taste summary row in parameters section', () => {
    renderWithPaginatedCache(baseShot)

    const tasteDt = screen.getByTestId('taste-summary-row')
    expect(tasteDt).toBeInTheDocument()
    expect(tasteDt).toHaveTextContent('Taste')
    expect(screen.getByText('Sweet & Balanced')).toBeInTheDocument()
  })

  it('renders notes section when user_notes is present', () => {
    renderWithPaginatedCache({ ...baseShot, user_notes: 'First shot of the bag' })

    expect(screen.getByTestId('notes-section')).toBeInTheDocument()
    expect(screen.getByText('First shot of the bag')).toBeInTheDocument()
  })

  it('hides notes section when user_notes is empty', () => {
    renderWithPaginatedCache({ ...baseShot, user_notes: '' })

    expect(screen.queryByTestId('notes-section')).toBeNull()
  })

  it('eligibility badge absent when shot_eligibility is undefined', () => {
    const { shot_eligibility: _omit, ...shotWithout } = baseShot

    renderWithPaginatedCache(shotWithout as BrewLogEntry)

    expect(screen.queryByTestId('eligibility-badge')).toBeNull()
  })

  it('taste summary row absent when taste_summary is undefined', () => {
    const { taste_summary: _omit, ...shotWithout } = baseShot

    renderWithPaginatedCache(shotWithout as BrewLogEntry)

    expect(screen.queryByTestId('taste-summary-row')).toBeNull()
  })
})
