/**
 * AuthContext tests — AC-103 (no localStorage), AC-102 (unauthenticated path)
 *
 * Covers:
 *   - Successful auth bootstrap: refresh + getMe → authenticated state populated
 *   - Failed bootstrap: state cleared, isAuthenticated = false
 *   - logout: calls logoutApi, clears state and module token (not localStorage)
 *   - setAccessToken: updates React state and syncs module token
 *   - setUser: populates user state
 *
 * AC-103: Token is stored only in React/module state — never localStorage.
 *         Tests verify no setItem call with a token-related key.
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

// ---------------------------------------------------------------------------
// Hoisted mock references (must precede vi.mock factory calls)
// ---------------------------------------------------------------------------

const mockRefresh = vi.hoisted(() => vi.fn())
const mockGetMe = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn())
const mockSwitchHousehold = vi.hoisted(() => vi.fn())
const mockSetModuleToken = vi.hoisted(() => vi.fn())

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../api/auth', () => ({
  refresh: mockRefresh,
  getMe: mockGetMe,
  logout: mockLogout,
  switchHousehold: mockSwitchHousehold,
}))

vi.mock('../api/client', () => ({
  setAccessToken: mockSetModuleToken,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  email: 'alice@example.com',
  picture_url: null,
  household_id: 'hh-1',
  role: 'admin' as const,
}

// ---------------------------------------------------------------------------
// Consumer components for assertions
// ---------------------------------------------------------------------------

/** Renders current auth state as testable text nodes */
function AuthConsumer() {
  const { isLoading, isAuthenticated, accessToken, user } = useAuth()

  if (isLoading) return <div data-testid="loading">loading</div>

  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="token">{accessToken ?? 'null'}</div>
      <div data-testid="username">{user?.username ?? 'null'}</div>
    </div>
  )
}

/** Renders auth action buttons */
function AuthActions() {
  const { setAccessToken, setUser, logout } = useAuth()
  return (
    <div>
      <button onClick={() => setAccessToken('manual-token')}>set-token</button>
      <button onClick={() => setUser(mockUser)}>set-user</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function renderWithProvider(children: React.ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>)
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

describe('AuthContext', () => {
  describe('bootstrap / hydration', () => {
    it('populates authenticated state after successful refresh + getMe', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      renderWithProvider(<AuthConsumer />)

      // Initial render should show the loading state
      expect(screen.getByTestId('loading')).toBeInTheDocument()

      // After async bootstrap completes
      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      expect(screen.getByTestId('token')).toHaveTextContent('tok-abc')
      expect(screen.getByTestId('username')).toHaveTextContent('alice')

      // Module-level token must be synced (AC-103 — not localStorage)
      expect(mockSetModuleToken).toHaveBeenCalledWith('tok-abc')
    })

    it('renders children once bootstrap completes', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-xyz', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      renderWithProvider(<div data-testid="child">hello</div>)

      await waitFor(() => expect(screen.getByTestId('child')).toBeInTheDocument())
    })

    it('clears state and isAuthenticated=false when refresh fails', async () => {
      mockRefresh.mockRejectedValueOnce(new Error('no cookie'))

      renderWithProvider(<AuthConsumer />)

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false'),
      )

      expect(screen.getByTestId('token')).toHaveTextContent('null')
      expect(screen.getByTestId('username')).toHaveTextContent('null')

      // Module token must be cleared — not localStorage (AC-103)
      expect(mockSetModuleToken).toHaveBeenCalledWith(null)
    })

    it('clears state when getMe fails after a successful refresh', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockRejectedValueOnce(new Error('me failed'))

      renderWithProvider(<AuthConsumer />)

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false'),
      )

      expect(mockSetModuleToken).toHaveBeenCalledWith(null)
    })

    it('does not write access token to localStorage (AC-103)', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-secret', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      const lsSpy = vi.spyOn(Storage.prototype, 'setItem')

      renderWithProvider(<AuthConsumer />)

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      // No localStorage writes with a token-related key
      const tokenWrite = lsSpy.mock.calls.find(([key]) =>
        /token|access/i.test(String(key)),
      )
      expect(tokenWrite).toBeUndefined()
    })
  })

  describe('logout', () => {
    it('clears auth state and module token after logout', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)
      mockLogout.mockResolvedValueOnce(undefined)

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      act(() => {
        screen.getByRole('button', { name: 'logout' }).click()
      })

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false'),
      )

      expect(screen.getByTestId('token')).toHaveTextContent('null')
      expect(screen.getByTestId('username')).toHaveTextContent('null')

      // Module token must be cleared on logout (AC-103 — not localStorage)
      expect(mockSetModuleToken).toHaveBeenCalledWith(null)
      expect(mockLogout).toHaveBeenCalled()
    })

    it('clears state even when logoutApi call fails', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)
      mockLogout.mockRejectedValueOnce(new Error('network error'))

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      act(() => {
        screen.getByRole('button', { name: 'logout' }).click()
      })

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false'),
      )

      // State cleared regardless of API failure
      expect(screen.getByTestId('token')).toHaveTextContent('null')
    })
  })

  describe('setAccessToken / setUser', () => {
    it('setAccessToken updates React state and syncs module token', async () => {
      // Start unauthenticated
      mockRefresh.mockRejectedValueOnce(new Error('no cookie'))

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false'),
      )

      act(() => {
        screen.getByRole('button', { name: 'set-token' }).click()
      })

      await waitFor(() =>
        expect(screen.getByTestId('token')).toHaveTextContent('manual-token'),
      )

      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      // Module token synced (AC-103 — not localStorage)
      expect(mockSetModuleToken).toHaveBeenLastCalledWith('manual-token')
    })

    it('setUser populates user state', async () => {
      mockRefresh.mockRejectedValueOnce(new Error('no cookie'))

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('username')).toHaveTextContent('null'),
      )

      act(() => {
        screen.getByRole('button', { name: 'set-user' }).click()
      })

      await waitFor(() =>
        expect(screen.getByTestId('username')).toHaveTextContent('alice'),
      )
    })
  })
})
