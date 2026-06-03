/**
 * Login page tests — US-4.6 Wave 4
 *
 * Covers:
 *   - Form rendering
 *   - OAuth spinner interstitial (?oauth_success=1)
 *   - 401 / 429 error states
 *   - Submit-button disabled while in-flight
 *   - Register link navigation
 *   - Forgot-password static text (not a link/button)
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Hoisted mock references — must be declared before vi.mock factories
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn())
const mockCtxSetToken = vi.hoisted(() => vi.fn())
const mockSetUser = vi.hoisted(() => vi.fn())
const mockUseAuth = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  getMe: vi.fn(),
}))

vi.mock('../api/client', () => ({
  setAccessToken: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

import { getMe, login, refresh } from '../api/auth'
import Login from './Login'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

function makeAxiosError(status: number) {
  return Object.assign(new Error('Request failed with status ' + status), {
    isAxiosError: true,
    response: { status },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue({
    setAccessToken: mockCtxSetToken,
    setUser: mockSetUser,
    isAuthenticated: false,
    isLoading: false,
    memberships: [],
    user: null,
    accessToken: null,
    logout: vi.fn(),
  })
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  window.history.pushState({}, '', '/')
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Login page', () => {
  it('renders login form with username and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
  })

  it('shows oauth spinner when oauth_success=1 is in URL', () => {
    window.history.pushState({}, '', '/?oauth_success=1')
    vi.mocked(refresh).mockReturnValue(new Promise(() => {})) // never resolves
    renderLogin()
    // Spinner should be visible
    expect(screen.getByLabelText(/signing in/i)).toBeInTheDocument()
    // Login form inputs should not be rendered
    expect(screen.queryByLabelText(/^username$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
  })

  it('waits for AuthContext during oauth_success and does not start a second refresh (spec-035 T-03)', () => {
    mockUseAuth.mockReturnValue({
      setAccessToken: mockCtxSetToken,
      setUser: mockSetUser,
      isAuthenticated: false,
      isLoading: true,
      memberships: [],
      user: null,
      accessToken: null,
      logout: vi.fn(),
    })
    window.history.pushState({}, '', '/?oauth_success=1')

    renderLogin()

    expect(screen.getByLabelText(/signing in/i)).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates an already-authenticated oauth_success user without calling refresh (spec-035 T-03)', async () => {
    mockUseAuth.mockReturnValue({
      setAccessToken: mockCtxSetToken,
      setUser: mockSetUser,
      isAuthenticated: true,
      isLoading: false,
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' }],
      user: null,
      accessToken: 'existing-token',
      logout: vi.fn(),
    })
    vi.mocked(getMe).mockResolvedValueOnce({
      id: 'user-1',
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      picture_url: null,
      household_id: 'hh-1',
      active_household_id: 'hh-1',
      role: 'admin',
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' }],
    })
    window.history.pushState({}, '', '/?oauth_success=1')

    renderLogin()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(refresh).not.toHaveBeenCalled()
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'alice' }))
  })

  it('shows error message on 401 response', async () => {
    vi.mocked(login).mockRejectedValue(makeAxiosError(401))
    renderLogin()

    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'testpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password'),
    )
  })

  it('shows rate limit message on 429 response', async () => {
    vi.mocked(login).mockRejectedValue(makeAxiosError(429))
    renderLogin()

    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'testpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Too many failed attempts'),
    )
  })

  it('submit button is disabled while submitting', async () => {
    vi.mocked(login).mockReturnValue(new Promise(() => {})) // never resolves
    renderLogin()

    const btn = screen.getByRole('button', { name: /^sign in$/i })
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'testpassword' } })
    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())
  })

  it('navigates to register on link click', () => {
    renderLogin()
    const link = screen.getByRole('link', { name: /register/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('shows forgot password static text (not a link or button)', () => {
    renderLogin()
    const el = screen.getByText(/forgotten your password\? contact your household admin\./i)
    expect(el).toBeInTheDocument()
    expect(el.tagName).not.toBe('A')
    expect(el.tagName).not.toBe('BUTTON')
  })
})
