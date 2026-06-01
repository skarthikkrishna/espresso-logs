/**
 * Welcome onboarding wizard tests.
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())
const mockApiPost = vi.hoisted(() => vi.fn())
const mockGetMe = vi.hoisted(() => vi.fn())
const mockSetUser = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

vi.mock('../api/client', () => ({
  apiClient: {
    post: mockApiPost,
  },
}))

vi.mock('../api/auth', () => ({
  getMe: mockGetMe,
}))

import ProtectedRoute from '../components/ProtectedRoute'
import Welcome from './Welcome'

function buildAuthState(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: true,
    isLoading: false,
    memberships: [],
    activeMembership: null,
    setUser: mockSetUser,
    logout: mockLogout,
    ...overrides,
  }
}

function renderWelcome(initialPath = '/welcome') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<div data-testid="login-page">login page</div>} />
        <Route path="/" element={<div data-testid="dashboard-page">dashboard page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderProtectedRoute(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div data-testid="protected-page">protected page</div>} />
          <Route path="/household/new" element={<div data-testid="household-new-page">household new page</div>} />
        </Route>
        <Route path="/welcome" element={<div data-testid="welcome-page">welcome page</div>} />
        <Route path="/login" element={<div data-testid="login-page">login page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function goToCreateStep() {
  fireEvent.click(screen.getByRole('button', { name: 'Create my household' }))
}

function goToInviteStep() {
  fireEvent.click(screen.getByRole('button', { name: 'I have an invitation' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthState())
})

describe('Welcome onboarding wizard', () => {
  it('shows onboarding wizard when user has no memberships', () => {
    renderWelcome()

    expect(screen.getByRole('heading', { name: 'Welcome to Coffee Tracker' })).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument()
  })

  it('redirects to dashboard when user already has memberships', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' }],
        activeMembership: { household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' },
      }),
    )

    renderWelcome()

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('Step 1 shows welcome heading and create/invite options', () => {
    renderWelcome()

    expect(screen.getByRole('heading', { name: 'Welcome to Coffee Tracker' })).toBeInTheDocument()
    expect(
      screen.getByText(
        "Coffee Tracker is a household app. You'll need to either create a new household or accept an invitation from a friend.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create my household' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I have an invitation' })).toBeInTheDocument()
  })

  it('clicking Create my household shows household creation form', () => {
    renderWelcome()

    goToCreateStep()

    expect(screen.getByRole('heading', { name: 'Create your household' })).toBeInTheDocument()
    expect(screen.getByLabelText('Household name')).toBeInTheDocument()
  })

  it('clicking I have an invitation shows invite instructions', () => {
    renderWelcome()

    goToInviteStep()

    expect(screen.getByRole('heading', { name: 'Join with an invitation' })).toBeInTheDocument()
    expect(screen.getByText(/Ask a household admin to share an invitation link with you\./)).toBeInTheDocument()
  })

  it('Step 2a: empty name shows validation error and does not submit', async () => {
    renderWelcome()
    goToCreateStep()

    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Household name is required'),
    )
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('Step 2a: name over 64 chars shows validation error and does not submit', async () => {
    renderWelcome()
    goToCreateStep()

    fireEvent.change(screen.getByLabelText('Household name'), {
      target: { value: 'a'.repeat(65) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Name must be 64 characters or less'),
    )
    expect(mockApiPost).not.toHaveBeenCalled()
  })

  it('Step 2a: valid name creates household and navigates to dashboard', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { id: 'hh-9' } })
    mockGetMe.mockResolvedValueOnce({
      id: 'user-1',
      memberships: [{ household_id: 'hh-9', household_name: 'Home', role: 'admin', joined_at: '' }],
    })

    renderWelcome()
    goToCreateStep()

    fireEvent.change(screen.getByLabelText('Household name'), { target: { value: 'Home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }))

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith('/households', { name: 'Home' }))
    expect(mockGetMe).toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('Step 2a: no skip button is present', () => {
    renderWelcome()
    goToCreateStep()

    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/skip/i)).not.toBeInTheDocument()
  })

  it('Step 2b: no token entry field is visible', () => {
    renderWelcome()
    goToInviteStep()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('Step 2b: back link returns to create step', () => {
    renderWelcome()
    goToInviteStep()

    fireEvent.click(screen.getByRole('button', { name: '← Create a new household instead' }))

    expect(screen.getByRole('heading', { name: 'Create your household' })).toBeInTheDocument()
  })

  it('all visible text uses sentence case', () => {
    renderWelcome()

    expect(screen.getByRole('heading', { name: 'Welcome to Coffee Tracker' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create my household' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I have an invitation' })).toBeInTheDocument()
    expect(screen.queryByText('Create My Household')).not.toBeInTheDocument()
    expect(screen.queryByText('I Have an Invitation')).not.toBeInTheDocument()
  })

  it('no user or household IDs are visible on any step', () => {
    mockUseAuth.mockReturnValue(
      buildAuthState({
        user: { id: 'user-123', active_household_id: 'household-456' },
      }),
    )

    renderWelcome()
    expect(screen.queryByText('user-123')).not.toBeInTheDocument()
    expect(screen.queryByText('household-456')).not.toBeInTheDocument()

    goToCreateStep()
    expect(screen.queryByText('user-123')).not.toBeInTheDocument()
    expect(screen.queryByText('household-456')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    goToInviteStep()
    expect(screen.queryByText('user-123')).not.toBeInTheDocument()
    expect(screen.queryByText('household-456')).not.toBeInTheDocument()
  })
})

describe('ProtectedRoute zero-membership guard', () => {
  it('ProtectedRoute redirects to /welcome when user has no memberships', () => {
    mockUseAuth.mockReturnValue(buildAuthState())

    renderProtectedRoute('/')

    expect(screen.getByTestId('welcome-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument()
  })

  it('ProtectedRoute allows /household/new for zero-membership user', () => {
    mockUseAuth.mockReturnValue(buildAuthState())

    renderProtectedRoute('/household/new')

    expect(screen.getByTestId('household-new-page')).toBeInTheDocument()
    expect(screen.queryByTestId('welcome-page')).not.toBeInTheDocument()
  })
})
