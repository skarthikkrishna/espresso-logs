import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { BrewLogPage } from '../api/brewLog'
import { brewLogListQueryKey } from '../api/queryKeys'
import type { BrewLogEntry } from '../types/entities'

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
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
  updateBrewLogEntry: vi.fn(),
  deleteBrewLogEntry: vi.fn(),
  generateBrewLogFeedback: vi.fn(),
  submitShot: vi.fn(),
}))

import { deleteBrewLogEntry, generateBrewLogFeedback, getBrewLogDetail, getBrewLogFeedback, updateBrewLogEntry } from '../api/brewLog'
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
  queryClient.setQueryData(brewLogListQueryKey(undefined, 1, 100), brewLogPage([shot]))
  return renderInContext(queryClient)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBrewLogDetail).mockResolvedValue(baseShot)
  vi.mocked(getBrewLogFeedback).mockResolvedValue({ ai_feedback: '' })
  vi.mocked(updateBrewLogEntry).mockResolvedValue(baseShot)
  vi.mocked(deleteBrewLogEntry).mockResolvedValue(undefined)
  vi.mocked(generateBrewLogFeedback).mockResolvedValue({ ai_feedback: 'Generated feedback' })
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
    queryClient.setQueryData(brewLogListQueryKey(undefined, 1, 100), brewLogPage([otherShot]))
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, bag_display: 'API Detail — Cache Miss' })

    renderInContext(queryClient)

    expect(await screen.findByText('API Detail — Cache Miss')).toBeInTheDocument()
    expect(getBrewLogDetail).toHaveBeenCalledWith('SHOT-001')
  })

  it('calls the detail API fallback when a brew-log cache entry is malformed', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData(brewLogListQueryKey(undefined, 1, 100), { items: 'not-an-array' })
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

describe('BrewLogDetail — historical corrections', () => {
  it('submits only changed typo-safe fields and preserves existing AI feedback', async () => {
    const shotWithFeedback = { ...baseShot, ai_feedback: 'Existing AI feedback' }
    vi.mocked(getBrewLogDetail).mockResolvedValue(shotWithFeedback)
    vi.mocked(updateBrewLogEntry).mockResolvedValue({
      ...shotWithFeedback,
      user_notes: 'Corrected typo',
    })

    renderInContext()

    fireEvent.click(await screen.findByRole('button', { name: /correct shot details/i }))
    expect(screen.queryByLabelText(/^dose/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/ai feedback/i)).not.toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: /save corrections/i })
    expect(saveButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Corrected typo' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(updateBrewLogEntry).toHaveBeenCalledWith('SHOT-001', { user_notes: 'Corrected typo' })
      expect(screen.getByText('Existing AI feedback')).toBeInTheDocument()
    })
  })

  it('cancels correction edits without saving', async () => {
    renderInContext()

    fireEvent.click(await screen.findByRole('button', { name: /correct shot details/i }))
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Discard me' } })
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(updateBrewLogEntry).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('Discard me')).not.toBeInTheDocument()
  })

  it('sends an explicit empty shot eligibility when the user clears eligibility', async () => {
    vi.mocked(updateBrewLogEntry).mockResolvedValue({
      ...baseShot,
      shot_eligibility: '',
    })

    renderInContext()

    fireEvent.click(await screen.findByRole('button', { name: /correct shot details/i }))
    fireEvent.change(screen.getByLabelText(/shot eligibility/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save corrections/i }))

    await waitFor(() => {
      expect(updateBrewLogEntry).toHaveBeenCalledWith('SHOT-001', { shot_eligibility: '' })
    })
  })
})

describe('BrewLogDetail — AI feedback generation', () => {
  it('calls the mutating feedback endpoint once, prevents duplicate clicks, and updates caches', async () => {
    let resolveFeedback!: (value: { ai_feedback: string }) => void
    vi.mocked(generateBrewLogFeedback).mockReturnValue(new Promise((resolve) => {
      resolveFeedback = resolve
    }))
    const { queryClient } = renderInContext()

    const button = await screen.findByRole('button', { name: /get ai feedback/i })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => {
      expect(generateBrewLogFeedback).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled()
    })

    resolveFeedback({ ai_feedback: 'Generated feedback' })

    expect(await screen.findByText('Generated feedback')).toBeInTheDocument()
    expect(queryClient.getQueryData(['brew-log-detail', 'SHOT-001', 'feedback'])).toEqual({
      ai_feedback: 'Generated feedback',
    })
    expect(queryClient.getQueryData(['brew-log-detail', 'SHOT-001'])).toMatchObject({
      ai_feedback: 'Generated feedback',
    })
  })

  it('keeps existing feedback visible while regeneration is pending', async () => {
    vi.mocked(getBrewLogDetail).mockResolvedValue({ ...baseShot, ai_feedback: 'Existing feedback' })
    let resolveFeedback!: (value: { ai_feedback: string }) => void
    vi.mocked(generateBrewLogFeedback).mockReturnValue(new Promise((resolve) => {
      resolveFeedback = resolve
    }))

    renderInContext()

    expect(await screen.findByText('Existing feedback')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /regenerate ai feedback/i }))

    expect(screen.getByText('Existing feedback')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled()

    resolveFeedback({ ai_feedback: 'Replacement feedback' })
    expect(await screen.findByText('Replacement feedback')).toBeInTheDocument()
  })

  it('shows an actionable error without hiding the no-feedback state on generation failure', async () => {
    vi.mocked(generateBrewLogFeedback).mockRejectedValue(new Error('provider failed'))

    renderInContext()

    fireEvent.click(await screen.findByRole('button', { name: /get ai feedback/i }))

    expect(await screen.findByText(/failed to generate ai feedback/i)).toBeInTheDocument()
    expect(screen.getByText(/no feedback available yet/i)).toBeInTheDocument()
  })
})

describe('BrewLogDetail — delete shot', () => {
  async function openDeleteDialog() {
    expect(await screen.findByText('Verve Coffee — Seabright')).toBeInTheDocument()
    const trigger = screen.getByTestId('delete-shot-trigger')
    trigger.focus()
    fireEvent.click(trigger)
    return screen.findByRole('dialog')
  }

  it('confirms deletion, invalidates list + dashboard caches, and navigates back to the list', async () => {
    const { queryClient } = renderWithPaginatedCache(baseShot)
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const dialog = await openDeleteDialog()
    expect(dialog).toHaveTextContent(/delete this shot/i)

    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(deleteBrewLogEntry).toHaveBeenCalledWith('SHOT-001')
      expect(navigateMock).toHaveBeenCalledWith('/brew-log')
    })

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(['brew-log']),
        expect.arrayContaining(['dashboard']),
      ]),
    )
  })

  it('Enter confirms deletion from within the dialog', async () => {
    renderWithPaginatedCache(baseShot)
    const dialog = await openDeleteDialog()

    fireEvent.keyDown(within(dialog).getByRole('button', { name: /^delete$/i }), { key: 'Enter' })

    await waitFor(() => {
      expect(deleteBrewLogEntry).toHaveBeenCalledWith('SHOT-001')
    })
  })

  it('Escape closes the dialog without deleting and restores focus to the trigger', async () => {
    renderWithPaginatedCache(baseShot)
    const dialog = await openDeleteDialog()

    fireEvent.keyDown(dialog, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(deleteBrewLogEntry).not.toHaveBeenCalled()
    expect(screen.getByTestId('delete-shot-trigger')).toHaveFocus()
  })

  it('Cancel closes the dialog without deleting', async () => {
    renderWithPaginatedCache(baseShot)
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    expect(deleteBrewLogEntry).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('disables the dialog actions and shows progress while the delete is in flight', async () => {
    vi.mocked(deleteBrewLogEntry).mockReturnValue(new Promise<undefined>(() => {}))
    renderWithPaginatedCache(baseShot)
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      const confirmButton = within(dialog).getByRole('button', { name: /deleting/i })
      expect(confirmButton).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: /^cancel$/i })).toBeDisabled()
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and surfaces an actionable error when deletion fails', async () => {
    vi.mocked(deleteBrewLogEntry).mockRejectedValue(new Error('server exploded'))
    renderWithPaginatedCache(baseShot)
    const dialog = await openDeleteDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    expect(await screen.findByText(/we could not delete this shot/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
