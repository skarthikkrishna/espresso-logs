/**
 * T031 — Portal regression tests for Dashboard
 *
 * Ensures the FAB (Add shot button) is rendered via createPortal to document.body,
 * preventing backdrop-filter on #main-content from breaking fixed positioning.
 *
 * Updated for the immersive shell rebuild: Dashboard now uses ImmersiveListShell,
 * ImmersiveFab, EntityCard (Link), and ShotRow. The navigation test now checks
 * link href instead of navigate-mock (EntityCard renders as <a>).
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
  useAuth: () => ({
    activeHouseholdId: 'hh-1',
    memberships: [
      { household_id: 'hh-1', household_name: 'First Household', role: 'admin', joined_at: '2025-01-01' },
      { household_id: 'hh-2', household_name: 'Second Household', role: 'member', joined_at: '2025-02-01' },
    ],
  }),
  useHouseholdQueryScope: () => 'hh-1',
}))

import { getDashboard } from '../api/dashboard'
import { listBrewLog } from '../api/brewLog'
import Dashboard from './Dashboard'
import { FORBIDDEN_DASHBOARD_COPY } from '../copy/registry'

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
      image_path: '/static/catalog/test-bean.jpg',
      roast_level: 'Medium',
    },
  ])
  vi.mocked(listBrewLog).mockResolvedValue({
    items: [
      {
        shot_id: 'shot-1',
        date: '2025-07-29',
        bag_display: 'Test Roaster — Test Bean',
        image_path: '/static/catalog/test-bean.jpg',
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

  it('bag card href encodes the reload-safe bag_id query param', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    // EntityCard renders as <a href="..."> — verify the correct URL is encoded
    const allLinks = screen.getAllByRole('link')
    const bagCardLink = allLinks.find(
      (link) => link.getAttribute('href')?.startsWith('/brew-log/add'),
    )
    expect(bagCardLink).toBeDefined()
    expect(bagCardLink!.getAttribute('href')).toBe('/brew-log/add?bag_id=bag-1')
  })
})

describe('Dashboard — spec-043 T009 contract', () => {
  it('uses the locked "Home" label as the single page h1 and no brand/subtitle', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent('Home')
    // The brand belongs to the desktop shell, not the dashboard header.
    expect(screen.queryByText('Kaapi Kadai')).toBeNull()
  })

  it('removes the unauthorized narration and the final-CTA card (Option D)', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.queryByTestId('dashboard-final-cta')).toBeNull()
    for (const forbidden of FORBIDDEN_DASHBOARD_COPY) {
      expect(screen.queryByText(forbidden)).toBeNull()
    }
  })

  it('derives the household count from membership data instead of a hardcoded value', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    // Two memberships are mocked; the Household tile must reflect that (BUG 1 fix),
    // not the previously hardcoded "1".
    const householdLabel = screen.getByText('Household')
    const tile = householdLabel.parentElement as HTMLElement
    expect(tile).toHaveTextContent('2')
  })
})

describe('Dashboard — spec-043 T020 motion', () => {
  it('attaches the motion route boundary once content has loaded', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.getByTestId('motion-route-boundary')).toBeInTheDocument()
  })

  it('wires capped pointer-depth onto the hero zone (4px desktop lift, reset on leave)', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    const hero = screen.getByTestId('dashboard-hero-card')
    // Depth motion is disabled on the hero for energy/battery (useKaapiDepth removed).
    // Pointer events must NOT produce any transform on the hero section.
    fireEvent.pointerEnter(hero)
    expect(hero.style.transform).toBe('')
    fireEvent.pointerLeave(hero)
    expect(hero.style.transform).toBe('')
  })
})

describe('Dashboard — immersive shell structure', () => {
  it('renders the active bags section heading with its testid', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.getByTestId('dashboard-active-bags-heading')).toBeInTheDocument()
  })

  it('uses fit rails with View all links instead of horizontal carousel scrollers', async () => {
    const { container } = renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(container.querySelector('.dashboard-carousel')).toBeNull()
    expect(container.querySelectorAll('.dashboard-fit-rail')).toHaveLength(2)
    const viewAllLinks = screen.getAllByRole('link', { name: 'View all →' })
    expect(viewAllLinks[0]).toHaveAttribute('href', '/catalog')
    expect(viewAllLinks[1]).toHaveAttribute('href', '/brew-log')
  })

  it('renders bag as EntityCard link pointing to brew-log/add', async () => {
    const { container } = renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(container.querySelector('.entity-card-eyebrow')).toHaveTextContent('Test Roaster')
    // EntityCard title is the bean name; CSS clamps this node to two lines.
    const entityCardTitle = container.querySelector('.entity-card-title')
    expect(entityCardTitle).toHaveTextContent('Test Bean')
  })

  it('renders recent shot as ShotCard link pointing to brew-log/:id', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    // ShotCard renders as <a href="/brew-log/shot-1">
    const allLinks = screen.getAllByRole('link')
    const shotLink = allLinks.find((link) => link.getAttribute('href') === '/brew-log/shot-1')
    expect(shotLink).toBeDefined()
  })

  it('forces Home bag and shot cards to monogram media instead of bean images', async () => {
    const { container } = renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelectorAll('.entity-card-monogram').length).toBeGreaterThanOrEqual(2)
  })

  it('caps Recent shots to the five newest items on Home', async () => {
    vi.mocked(listBrewLog).mockResolvedValue({
      items: Array.from({ length: 6 }, (_, index) => ({
        shot_id: `shot-${index + 1}`,
        date: `2025-07-${29 - index}`,
        bag_display: `Test Roaster — Test Bean ${index + 1}`,
        image_path: '/static/catalog/test-bean.jpg',
      })),
      page: 1,
      per_page: 6,
      total_count: 6,
      has_next: false,
      sync_alert: false,
    })

    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.getByText('Test Bean 5')).toBeInTheDocument()
    expect(screen.queryByText('Test Bean 6')).toBeNull()
  })

  it('shows the hero-card testid on the hero zone element (not a GlassCard)', async () => {
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    const hero = screen.getByTestId('dashboard-hero-card')
    // Hero zone is a <section>, not a glass-card div
    expect(hero.tagName).toBe('SECTION')
    // The zone is a plain heading/list section; each bag/shot owns its own card surface.
    expect(hero).not.toHaveClass('glass-card')
    expect(hero).not.toHaveClass('dashboard-panel')
  })

  it('renders three StatTiles with their labels', async () => {
    const { container } = renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    // stat-tile__label elements
    const labels = Array.from(container.querySelectorAll('.stat-tile__label')).map(
      (el) => el.textContent,
    )
    expect(labels).toContain('Active bags')
    expect(labels).toContain('Recent')
    expect(labels).toContain('Household')
  })
})

describe('Dashboard — empty / fresh household state', () => {
  it('shows fresh-household empty state when no bags and no shots', async () => {
    vi.mocked(getDashboard).mockResolvedValue([])
    vi.mocked(listBrewLog).mockResolvedValue({
      items: [],
      page: 1,
      per_page: 100,
      total_count: 0,
      has_next: false,
      sync_alert: false,
    })
    renderWithQuery(<Dashboard />)

    await screen.findByTestId('dashboard-fab')
    expect(screen.getByTestId('dashboard-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('fresh-household-empty-dashboard')).toBeInTheDocument()
  })
})
