/**
 * Register page tests — US-4.6 Wave 4
 *
 * Covers:
 *   - Form rendering (all four fields)
 *   - Client-side blur validation (username too short, password too short,
 *     password mismatch)
 *   - 409 server error (username taken)
 *   - Submit-button disabled while in-flight
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const mockNavigate = vi.hoisted(() => vi.fn())
const mockCtxSetToken = vi.hoisted(() => vi.fn())
const mockSetUser = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../api/auth', () => ({
  register: vi.fn(),
  getMe: vi.fn(),
}))

vi.mock('../api/client', () => ({
  setAccessToken: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    setAccessToken: mockCtxSetToken,
    setUser: mockSetUser,
    isAuthenticated: false,
    isLoading: false,
    user: null,
    accessToken: null,
    logout: vi.fn(),
  }),
}))

import { register } from '../api/auth'
import Register from './Register'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )
}

function makeAxiosError(status: number) {
  return Object.assign(new Error('Request failed with status ' + status), {
    isAxiosError: true,
    response: { status },
  })
}

/** Fill all fields with valid data that passes client-side validation. */
function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^username$/i), {
    target: { value: 'validuser' },
  })
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'ValidPassword123!' },
  })
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'ValidPassword123!' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Register page', () => {
  it('renders register form with all four fields', () => {
    renderRegister()
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
  })

  it('shows username too short error on blur', async () => {
    renderRegister()
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'ab' } })
    fireEvent.blur(screen.getByLabelText(/^username$/i))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Username must be at least 3 characters',
      ),
    )
  })

  it('shows password too short error on blur', async () => {
    renderRegister()
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } })
    fireEvent.blur(screen.getByLabelText(/^password$/i))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Password must be at least 12 characters',
      ),
    )
  })

  it('shows password mismatch error on blur', async () => {
    renderRegister()
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'ValidPassword123!' },
    })
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: 'DifferentPassword!' },
    })
    fireEvent.blur(screen.getByLabelText(/confirm password/i))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match'),
    )
  })

  it('shows username taken error on 409 response', async () => {
    vi.mocked(register).mockRejectedValue(makeAxiosError(409))
    renderRegister()

    fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Username already taken. Please choose another.',
      ),
    )
  })

  it('submit button is disabled while submitting', async () => {
    vi.mocked(register).mockReturnValue(new Promise(() => {})) // never resolves
    renderRegister()

    fillValidForm()
    const btn = screen.getByRole('button', { name: /create account/i })
    fireEvent.click(btn)

    await waitFor(() => expect(btn).toBeDisabled())
  })
})
