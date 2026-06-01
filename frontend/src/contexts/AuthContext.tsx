/**
 * AuthContext — M5 auth state, memberships, and server-backed active-household
 * coordination.
 *
 * Access tokens stay in React/module memory only. The active household is
 * loaded from /auth/me and persisted server-side via /auth/switch-household,
 * while localStorage only caches the last known household for display.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { listHardware } from '../api/hardware'
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
import { queryClient } from '../queryClient'

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

function resolveServerActiveHouseholdId(
  user: CurrentUser,
  memberships: Membership[],
): string | null {
  const candidates = [
    user.active_household_id,
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

function normalizeUser(incomingUser: CurrentUser): CurrentUser {
  const memberships = deriveMemberships(incomingUser)
  const activeHouseholdId = resolveServerActiveHouseholdId(incomingUser, memberships)
  const activeMembership = memberships.find(
    (membership) => membership.household_id === activeHouseholdId,
  )

  return {
    ...incomingUser,
    memberships,
    active_household_id: activeHouseholdId,
    household_id: activeMembership?.household_id ?? incomingUser.household_id ?? activeHouseholdId,
    role: activeMembership?.role ?? incomingUser.role ?? null,
  }
}

function upsertMembership(
  memberships: Membership[],
  nextMembership: Pick<Membership, 'household_id' | 'household_name' | 'role'>,
): Membership[] {
  const existingMembership = memberships.find(
    (membership) => membership.household_id === nextMembership.household_id,
  )

  if (!existingMembership) {
    return [
      ...memberships,
      {
        ...nextMembership,
        joined_at: '',
      },
    ]
  }

  return memberships.map((membership) =>
    membership.household_id === nextMembership.household_id
      ? {
          ...membership,
          household_name: nextMembership.household_name,
          role: nextMembership.role,
        }
      : membership,
  )
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

  const syncUserState = useCallback((incomingUser: CurrentUser | null) => {
    if (!incomingUser) {
      setUserState(null)
      setMemberships([])
      setActiveHouseholdId(null)
      setStoredActiveHouseholdId(null)
      return
    }

    const normalizedUser = normalizeUser(incomingUser)
    const nextMemberships = normalizedUser.memberships ?? []
    const nextActiveHouseholdId = normalizedUser.active_household_id ?? null

    setUserState(normalizedUser)
    setMemberships(nextMemberships)
    setActiveHouseholdId(nextActiveHouseholdId)
    setStoredActiveHouseholdId(nextActiveHouseholdId)
  }, [])

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
          queryClient.clear()
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

  useEffect(() => {
    if (isLoading || !isAuthenticated) return

    void queryClient.prefetchQuery({
      queryKey: ['hardware'],
      queryFn: listHardware,
    })
  }, [isAuthenticated, isLoading])

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
      const nextSelection = await switchHouseholdApi(householdId)
      const nextMemberships = upsertMembership(memberships, nextSelection)

      setMemberships(nextMemberships)
      setActiveHouseholdId(nextSelection.household_id)
      setStoredActiveHouseholdId(nextSelection.household_id)
      setUserState((currentUser) => {
        if (!currentUser) return currentUser

        return normalizeUser({
          ...currentUser,
          memberships: nextMemberships,
          active_household_id: nextSelection.household_id,
          household_id: nextSelection.household_id,
          role: nextSelection.role,
        })
      })
    },
    [memberships],
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
