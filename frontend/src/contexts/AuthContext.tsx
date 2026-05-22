/**
 * AuthContext — M5 auth state, memberships, and active-household coordination.
 *
 * Access tokens stay in React/module memory only. Household context is stored
 * separately so the API client can inject X-Household-Id on every request.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { CurrentUser, Membership } from '../types/entities'
import {
  getStoredActiveHouseholdId,
  setAccessToken as setModuleToken,
  setStoredActiveHouseholdId,
} from '../api/client'
import {
  getMe as getMeApi,
  logout as logoutApi,
  refresh as refreshApi,
  switchHousehold as switchHouseholdApi,
} from '../api/auth'

interface AuthState {
  accessToken: string | null
  user: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
  memberships: Membership[]
  activeHouseholdId: string | null
  activeMembership: Membership | null
}

interface AuthContextValue extends AuthState {
  setAccessToken: (token: string | null) => void
  setUser: (user: CurrentUser | null) => void
  logout: () => void
  switchHousehold: (householdId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: React.ReactNode
}

function deriveMemberships(user: CurrentUser | null): Membership[] {
  if (!user) return []

  if (Array.isArray(user.memberships) && user.memberships.length > 0) {
    return user.memberships
  }

  if (user.household_id && user.role) {
    return [
      {
        household_id: user.household_id,
        household_name: 'Household',
        role: user.role,
        joined_at: user.created_at ?? '',
      },
    ]
  }

  return []
}

function resolveActiveHouseholdId(
  user: CurrentUser,
  memberships: Membership[],
  preferredHouseholdId?: string | null,
): string | null {
  const candidates = [
    preferredHouseholdId,
    user.active_household_id,
    getStoredActiveHouseholdId(),
    user.household_id,
    memberships[0]?.household_id ?? null,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (memberships.some((membership) => membership.household_id === candidate)) {
      return candidate
    }
  }

  return null
}

function normalizeUser(
  incomingUser: CurrentUser,
  preferredHouseholdId?: string | null,
): CurrentUser {
  const memberships = deriveMemberships(incomingUser)
  const activeHouseholdId = resolveActiveHouseholdId(
    incomingUser,
    memberships,
    preferredHouseholdId,
  )
  const activeMembership = memberships.find(
    (membership) => membership.household_id === activeHouseholdId,
  )

  return {
    ...incomingUser,
    memberships,
    active_household_id: activeHouseholdId,
    household_id: incomingUser.household_id ?? activeHouseholdId,
    role: incomingUser.role ?? activeMembership?.role ?? null,
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(
    () => getStoredActiveHouseholdId(),
  )
  const [isLoading, setIsLoading] = useState(true)

  const isAuthenticated = accessToken !== null

  const syncUserState = useCallback(
    (incomingUser: CurrentUser | null, preferredHouseholdId?: string | null) => {
      if (!incomingUser) {
        setUserState(null)
        setMemberships([])
        setActiveHouseholdId(null)
        setStoredActiveHouseholdId(null)
        return
      }

      const normalizedUser = normalizeUser(incomingUser, preferredHouseholdId)
      const nextMemberships = normalizedUser.memberships ?? []
      const nextActiveHouseholdId = normalizedUser.active_household_id ?? null

      setUserState(normalizedUser)
      setMemberships(nextMemberships)
      setActiveHouseholdId(nextActiveHouseholdId)
      setStoredActiveHouseholdId(nextActiveHouseholdId)
    },
    [],
  )

  const activeMembership: Membership | null = useMemo(() => {
    if (!activeHouseholdId) return null
    return memberships.find((membership) => membership.household_id === activeHouseholdId) ?? null
  }, [activeHouseholdId, memberships])

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
          syncUserState(userData)
        }
      } catch {
        if (!cancelled) {
          setAccessTokenState(null)
          setModuleToken(null)
          syncUserState(null)
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
  }, [syncUserState])

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token)
    setModuleToken(token)
  }, [])

  const setUser = useCallback(
    (incomingUser: CurrentUser | null) => {
      syncUserState(incomingUser)
    },
    [syncUserState],
  )

  const switchHousehold = useCallback(
    async (householdId: string) => {
      await switchHouseholdApi(householdId)
      const userData = await getMeApi()
      syncUserState(userData, householdId)
    },
    [syncUserState],
  )

  const logout = useCallback(() => {
    void logoutApi().finally(() => {
      setAccessTokenState(null)
      setModuleToken(null)
      syncUserState(null)
    })
  }, [syncUserState])

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
