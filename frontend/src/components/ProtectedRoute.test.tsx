/**
 * ProtectedRoute tests — AC-102
 *
 * Covers (current behavior):
 *   - Loading: shows spinner while isLoading is true
 *   - Unauthenticated: redirects to /login via <Navigate replace>
 *   - Authenticated: renders <Outlet /> (protected children visible)
 *
 * Forward-looking role guard tests (requiredRole prop not yet implemented):
 *   - Marked with it.todo — CI-safe, documents expected future behavior.
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

function renderProtected(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
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
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false })

    renderProtected()

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false })

    renderProtected()

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('renders children/outlet when authenticated', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })

    renderProtected()

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('does not show spinner when auth check is complete', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: true })

    renderProtected()

    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Forward-looking role guard tests
  // requiredRole prop is not yet implemented on ProtectedRoute.
  // These are marked todo — CI-safe, preserved to guide future implementation.
  // ---------------------------------------------------------------------------

  it.todo('blocks member-role user from admin-only route (requiredRole="admin")')

  it.todo('allows admin user to access admin-only route (requiredRole="admin")')

  it.todo('allows member user to access member-scoped route (requiredRole="member")')

  it.todo('redirects to /unauthorized when user is authenticated but role is insufficient')

  it.todo('renders outlet when requiredRole matches active membership role')
})
