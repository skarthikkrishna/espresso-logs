/**
 * AuthContext — M5 wired version (US-3.12 + US-1.8 + multi-household).
 *
 * Provides authentication state (access token + current user + memberships)
 * to the React tree via context. Uses auth.ts API client functions.
 *
 * The module-level access token in client.ts is kept in sync so that the
 * Axios request interceptor always injects the latest Bearer token.
 *
 * AC-103: Access token is stored ONLY in React state — never in
 *         localStorage, sessionStorage, or any JS-accessible persistent storage.
 *
 * Multi-household model:
 *   - memberships[] is derived from user.memberships (M5 /auth/me response).
 *   - activeHouseholdId tracks the current household context.
 *   - switchHousehold() updates the active context via POST /auth/switch-household.
 *   - Falls back gracefully to legacy single-household fields when backend
 *     has not yet migrated (memberships undefined).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { CurrentUser, HouseholdMembership } from '../types/entities'
import {
  setAccessToken as setModuleToken,
} from '../api/client'
import { refresh as refreshApi, getMe as getMeApi, logout as logoutApi, switchHousehold as switchHouseholdApi } from '../api/auth'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface AuthState {
  accessToken: string | null
  user: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
  memberships: HouseholdMembership[]
  activeHouseholdId: string | null
  activeMembership: HouseholdMembership | null
}

interface AuthContextValue extends AuthState {
  setAccessToken: (token: string | null) => void
  setUser: (user: CurrentUser | null) => void
  logout: () => void
  switchHousehold: (householdId: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = accessToken !== null

  // Derive memberships from user — supports both legacy and M5 response shapes.
  const memberships: HouseholdMembership[] = useMemo(() => {
    if (!user) return []
    if (user.memberships && user.memberships.length > 0) return user.memberships
    // Legacy fallback: synthesise a single-membership array from flat fields.
    if (user.household_id && user.role) {
      return [{
        household_id: user.household_id,
        household_name: 'Home',
        role: user.role,
        joined_at: '',
      }]
    }
    return []
  }, [user])

  // Active household: prefer user.active_household_id, else first membership.
  const activeHouseholdId: string | null = useMemo(() => {
    if (!user) return null
    if (user.active_household_id) return user.active_household_id
    return memberships[0]?.household_id ?? null
  }, [user, memberships])

  const activeMembership: HouseholdMembership | null = useMemo(() => {
    if (!activeHouseholdId) return null
    return memberships.find((m) => m.household_id === activeHouseholdId) ?? memberships[0] ?? null
  }, [memberships, activeHouseholdId])

  // -------------------------------------------------------------------------
  // On mount: attempt cookie-based token refresh, then hydrate user
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function attemptRefresh() {
      try {
        const { access_token } = await refreshApi()

        if (cancelled) return
        setAccessTokenState(access_token)
        setModuleToken(access_token)

        const userData = await getMeApi()

        if (!cancelled) {
          setUserState(userData)
        }
      } catch {
        if (!cancelled) {
          setAccessTokenState(null)
          setModuleToken(null)
          setUserState(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void attemptRefresh()

    return () => {
      cancelled = true
    }
  }, [])

  // -------------------------------------------------------------------------
  // Public setters
  // -------------------------------------------------------------------------
  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token)
    setModuleToken(token)
  }, [])

  const setUser = useCallback((u: CurrentUser | null) => {
    setUserState(u)
  }, [])

  // -------------------------------------------------------------------------
  // switchHousehold: POST to backend, then refresh user state
  // -------------------------------------------------------------------------
  const switchHousehold = useCallback(async (householdId: string) => {
    await switchHouseholdApi(householdId)
    const userData = await getMeApi()
    setUserState(userData)
  }, [])

  // -------------------------------------------------------------------------
  // logout: best-effort POST, then clear state
  // -------------------------------------------------------------------------
  const logout = useCallback(() => {
    void logoutApi().finally(() => {
      setAccessTokenState(null)
      setModuleToken(null)
      setUserState(null)
    })
  }, [])

  const value: AuthContextValue = {
    accessToken,
    user,
    isLoading,
    isAuthenticated,
    memberships,
    activeHouseholdId,
    activeMembership,
    setAccessToken,
    setUser,
    logout,
    switchHousehold,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
