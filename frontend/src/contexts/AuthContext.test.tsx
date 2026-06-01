/**
 * AuthContext tests — AC-103 (no localStorage token writes), bootstrap from
 * /auth/me, and server-backed household switching.
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const mockRefresh = vi.hoisted(() => vi.fn())
const mockGetMe = vi.hoisted(() => vi.fn())
const mockLogout = vi.hoisted(() => vi.fn())
const mockSwitchHousehold = vi.hoisted(() => vi.fn())
const mockSetModuleToken = vi.hoisted(() => vi.fn())
const mockGetStoredActiveHouseholdId = vi.hoisted(() => vi.fn())
const mockSetStoredActiveHouseholdId = vi.hoisted(() => vi.fn())

vi.mock('../api/auth', () => ({
  refresh: mockRefresh,
  getMe: mockGetMe,
  logout: mockLogout,
  switchHousehold: mockSwitchHousehold,
}))

vi.mock('../api/client', () => ({
  getStoredActiveHouseholdId: mockGetStoredActiveHouseholdId,
  setAccessToken: mockSetModuleToken,
  setStoredActiveHouseholdId: mockSetStoredActiveHouseholdId,
}))

const mockUser = {
  id: 'user-1',
  username: 'alice',
  display_name: 'Alice',
  email: 'alice@example.com',
  picture_url: null,
  household_id: 'hh-1',
  role: 'admin' as const,
  memberships: [
    {
      household_id: 'hh-1',
      household_name: 'Home',
      role: 'admin' as const,
      joined_at: '2024-01-01T00:00:00Z',
    },
    {
      household_id: 'hh-2',
      household_name: 'Office',
      role: 'member' as const,
      joined_at: '2024-02-01T00:00:00Z',
    },
    {
      household_id: 'hh-3',
      household_name: 'Travel',
      role: 'member' as const,
      joined_at: '2024-03-01T00:00:00Z',
    },
  ],
  active_household_id: 'hh-1',
}

const mockZeroMembershipUser = {
  id: 'user-2',
  username: 'bob',
  display_name: 'Bob',
  email: 'bob@example.com',
  picture_url: null,
  household_id: null,
  role: null,
  memberships: [],
  active_household_id: null,
}

function AuthConsumer() {
  const {
    isLoading,
    isAuthenticated,
    accessToken,
    user,
    memberships,
    activeHouseholdId,
    activeMembership,
  } = useAuth()

  if (isLoading) return <div data-testid="loading">loading</div>

  return (
    <div>
      <div data-testid="authenticated">{String(isAuthenticated)}</div>
      <div data-testid="token">{accessToken ?? 'null'}</div>
      <div data-testid="username">{user?.username ?? 'null'}</div>
      <div data-testid="memberships">{memberships.length}</div>
      <div data-testid="active-household">{activeHouseholdId ?? 'null'}</div>
      <div data-testid="active-household-name">{activeMembership?.household_name ?? 'null'}</div>
      <div data-testid="active-role">{activeMembership?.role ?? 'null'}</div>
    </div>
  )
}

function AuthActions() {
  const { setAccessToken, setUser, logout, switchHousehold } = useAuth()
  return (
    <div>
      <button onClick={() => setAccessToken('manual-token')}>set-token</button>
      <button onClick={() => setUser(mockUser)}>set-user</button>
      <button onClick={() => { void switchHousehold('hh-2') }}>switch-household</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function LocationConsumer() {
  const location = useLocation()
  return <div data-testid="location-path">{location.pathname}</div>
}

function renderWithProvider(children: React.ReactNode, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetStoredActiveHouseholdId.mockReturnValue(null)
})

describe('AuthContext', () => {
  describe('bootstrap / hydration', () => {
    it('populates authenticated state after successful refresh + getMe', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      renderWithProvider(<AuthConsumer />)

      expect(screen.getByTestId('loading')).toBeInTheDocument()

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      expect(screen.getByTestId('token')).toHaveTextContent('tok-abc')
      expect(screen.getByTestId('username')).toHaveTextContent('alice')
      expect(screen.getByTestId('memberships')).toHaveTextContent('3')
      expect(screen.getByTestId('active-household')).toHaveTextContent('hh-1')

      expect(mockSetModuleToken).toHaveBeenCalledWith('tok-abc')
      expect(mockSetStoredActiveHouseholdId).toHaveBeenCalledWith('hh-1')
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

    it('loads the active household from /auth/me instead of the localStorage cache', async () => {
      mockGetStoredActiveHouseholdId.mockReturnValue('hh-2')
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      renderWithProvider(<AuthConsumer />)

      await waitFor(() =>
        expect(screen.getByTestId('active-household')).toHaveTextContent('hh-1'),
      )

      expect(screen.getByTestId('active-household')).not.toHaveTextContent('hh-2')
      expect(mockSetStoredActiveHouseholdId).toHaveBeenCalledWith('hh-1')
    })

    it('does not write access token to localStorage (AC-103)', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-secret', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)

      const lsSpy = vi.spyOn(Storage.prototype, 'setItem')

      renderWithProvider(<AuthConsumer />)

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )

      const tokenWrite = lsSpy.mock.calls.find(([key]) =>
        /token|access/i.test(String(key)),
      )
      expect(tokenWrite).toBeUndefined()
    })

    it('redirects authenticated zero-membership users to /welcome', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-zero', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockZeroMembershipUser)

      renderWithProvider(
        <>
          <AuthConsumer />
          <LocationConsumer />
        </>,
      )

      await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent('/welcome'))
      expect(screen.getByTestId('memberships')).toHaveTextContent('0')
      expect(mockSetStoredActiveHouseholdId).toHaveBeenCalledWith(null)
    })

    it('does not redirect zero-membership users away from invite routes', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-zero', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockZeroMembershipUser)

      renderWithProvider(
        <>
          <AuthConsumer />
          <LocationConsumer />
        </>,
        ['/invite/accept'],
      )

      await waitFor(() =>
        expect(screen.getByTestId('authenticated')).toHaveTextContent('true'),
      )
      expect(screen.getByTestId('location-path')).toHaveTextContent('/invite/accept')
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
      expect(mockSetModuleToken).toHaveBeenCalledWith(null)
      expect(mockLogout).toHaveBeenCalled()
    })

    it('calls logoutApi during logout sequence', async () => {
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

      await waitFor(() => expect(mockLogout).toHaveBeenCalled())
    })
  })

  describe('setAccessToken / setUser / switchHousehold', () => {
    it('setAccessToken updates React state and syncs module token', async () => {
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
      expect(screen.getByTestId('memberships')).toHaveTextContent('3')
    })

    it('switchHousehold calls POST /auth/switch-household with the selected household', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)
      mockSwitchHousehold.mockResolvedValueOnce({
        household_id: 'hh-2',
        household_name: 'Office',
        role: 'member',
      })

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('active-household')).toHaveTextContent('hh-1'),
      )

      act(() => {
        screen.getByRole('button', { name: 'switch-household' }).click()
      })

      await waitFor(() => expect(mockSwitchHousehold).toHaveBeenCalledWith('hh-2'))
      expect(mockGetMe).toHaveBeenCalledTimes(1)
    })

    it('switchHousehold updates the active household from the server response', async () => {
      mockRefresh.mockResolvedValueOnce({ access_token: 'tok-abc', token_type: 'bearer' })
      mockGetMe.mockResolvedValueOnce(mockUser)
      mockSwitchHousehold.mockResolvedValueOnce({
        household_id: 'hh-3',
        household_name: 'Travel',
        role: 'member',
      })

      renderWithProvider(
        <>
          <AuthConsumer />
          <AuthActions />
        </>,
      )

      await waitFor(() =>
        expect(screen.getByTestId('active-household')).toHaveTextContent('hh-1'),
      )

      act(() => {
        screen.getByRole('button', { name: 'switch-household' }).click()
      })

      await waitFor(() =>
        expect(screen.getByTestId('active-household')).toHaveTextContent('hh-3'),
      )
      expect(screen.getByTestId('active-household-name')).toHaveTextContent('Travel')
      expect(screen.getByTestId('active-role')).toHaveTextContent('member')
      expect(mockSetStoredActiveHouseholdId).toHaveBeenLastCalledWith('hh-3')
    })
  })
})
