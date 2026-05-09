/**
 * T031 — Unit tests for BrewLogDetail
 *
 * 6 test cases covering the three new data-testid anchors added in the
 * bugfix/compass-layout-dup-guard branch:
 *   1. eligibility-badge renders with correct text
 *   2. taste-summary-row renders in Shot parameters
 *   3. notes-section renders when user_notes is present
 *   4. notes-section is absent when user_notes is empty
 *   5. eligibility-badge absent when shot_eligibility is undefined
 *   6. taste-summary-row absent when taste_summary is undefined
 *
 * Strategy: pre-seed the QueryClient cache with ['brew-log'] list data so the
 * component's initialData selector resolves synchronously — no async loading.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { BrewLogEntry } from '../types/entities'

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any import of the mocked module
// ---------------------------------------------------------------------------

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
  listBrewLog: vi.fn(),
  getBrewLogDetail: vi.fn(),
  getBrewLogFeedback: vi.fn(),
  submitShot: vi.fn(),
}))

import { getBrewLogDetail, getBrewLogFeedback } from '../api/brewLog'
import BrewLogDetail from './BrewLogDetail'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a QueryClient pre-seeded with ['brew-log'] list data so the
 * component's initialData selector resolves without a network call.
 */
function makeQueryClient(shots: BrewLogEntry[]): QueryClient {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  qc.setQueryData(['brew-log'], shots)
  return qc
}

function renderInContext(shot: BrewLogEntry) {
  const queryClient = makeQueryClient([shot])
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <BrewLogDetail />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // getBrewLogDetail should never be called in these tests (initialData resolves)
  // but provide a safe fallback in case
  vi.mocked(getBrewLogDetail).mockResolvedValue(baseShot)
  vi.mocked(getBrewLogFeedback).mockResolvedValue({ ai_feedback: '' })
})

// ===========================================================================
// Tests
// ===========================================================================

describe('BrewLogDetail — new data-testid anchors', () => {

  // ── Test 1: eligibility badge renders with correct text ──────────────────
  it('renders eligibility badge in header', () => {
    renderInContext(baseShot)

    const badge = screen.getByTestId('eligibility-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Good Espresso')
  })

  // ── Test 2: taste summary row renders in Shot parameters section ──────────
  it('renders taste summary row in parameters section', () => {
    renderInContext(baseShot)

    const tasteDt = screen.getByTestId('taste-summary-row')
    expect(tasteDt).toBeInTheDocument()
    expect(tasteDt).toHaveTextContent('Taste')

    // The value "Sweet & Balanced" must be visible somewhere on the page
    expect(screen.getByText('Sweet & Balanced')).toBeInTheDocument()
  })

  // ── Test 3: notes section renders when user_notes is present ─────────────
  it('renders notes section when user_notes is present', () => {
    renderInContext({ ...baseShot, user_notes: 'First shot of the bag' })

    expect(screen.getByTestId('notes-section')).toBeInTheDocument()
    expect(screen.getByText('First shot of the bag')).toBeInTheDocument()
  })

  // ── Test 4: notes section absent when user_notes is empty ────────────────
  it('hides notes section when user_notes is empty', () => {
    renderInContext({ ...baseShot, user_notes: '' })

    expect(screen.queryByTestId('notes-section')).toBeNull()
  })

  // ── Test 5: eligibility badge absent when shot_eligibility is undefined ───
  it('eligibility badge absent when shot_eligibility is undefined', () => {
    const { shot_eligibility: _omit, ...shotWithout } = baseShot
    renderInContext(shotWithout as BrewLogEntry)

    expect(screen.queryByTestId('eligibility-badge')).toBeNull()
  })

  // ── Test 6: taste summary row absent when taste_summary is undefined ──────
  it('taste summary row absent when taste_summary is undefined', () => {
    const { taste_summary: _omit, ...shotWithout } = baseShot
    renderInContext(shotWithout as BrewLogEntry)

    expect(screen.queryByTestId('taste-summary-row')).toBeNull()
  })

})
