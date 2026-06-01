/**
 * ProtectedRoute tests — auth and role-based route protection.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Hoisted mock references
// ---------------------------------------------------------------------------

const mockUseAuth = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mock
// ---------------------------------------------------------------------------

vi.mock('../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}))

import ProtectedRoute from './ProtectedRoute'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderProtected(initialPath = '/', requiredRole?: 'admin' | 'member') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute requiredRole={requiredRole} />}>
          <Route path="/" element={<div data-testid="protected-content">secret</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is bootstrapping', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false, activeMembership: null, memberships: [] })

    renderProtected()

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, activeMembership: null, memberships: [] })

    renderProtected()

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children/outlet when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      activeMembership: { role: 'member' },
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'member', joined_at: '' }],
    })

    renderProtected()

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('does not show spinner when auth check is complete', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      activeMembership: { role: 'member' },
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'member', joined_at: '' }],
    })

    renderProtected()

    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
  })

  it('blocks member-role user from admin-only route', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      activeMembership: { role: 'member' },
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'member', joined_at: '' }],
    })

    renderProtected('/', 'admin')

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('allows admin user to access admin-only route', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      activeMembership: { role: 'admin' },
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'admin', joined_at: '' }],
    })

    renderProtected('/', 'admin')

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('allows member user to access member-scoped route', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      activeMembership: { role: 'member' },
      memberships: [{ household_id: 'hh-1', household_name: 'Home', role: 'member', joined_at: '' }],
    })

    renderProtected('/', 'member')

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })
})
