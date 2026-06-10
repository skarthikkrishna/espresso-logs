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
import axios from 'axios'
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
import { householdKeys, isHouseholdScopedQueryKey } from '../api/queryKeys'
import { queryClient } from '../queryClient'

// eslint-disable-next-line react-refresh/only-export-components
export const AUTH_STATES = {
  LOADING: 'LOADING',
  AUTHENTICATED: 'AUTHENTICATED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
} as const

export type AuthState = (typeof AUTH_STATES)[keyof typeof AUTH_STATES]

interface AuthContextState {
  authState: AuthState
  accessToken: string | null
  user: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
  memberships: Membership[]
  activeHouseholdId: string | null
  activeMembership: Membership | null
}

interface AuthContextValue extends AuthContextState {
  attemptRefresh: () => Promise<void>
  setAccessToken: (token: string | null) => void
  setUser: (user: CurrentUser | null) => void
  logout: () => void
  switchHousehold: (householdId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: React.ReactNode
}

const MAX_REFRESH_ATTEMPTS = 3
const REFRESH_RETRY_BACKOFF_MS = 500

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

function isRetryableRefreshError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  if (!error.response) return true

  const status = error.response.status
  if (status === 401 || status === 429) return false

  return status >= 500 && status <= 599
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
  const [authState, setAuthState] = useState<AuthState>(AUTH_STATES.LOADING)
  const [accessToken, setAccessTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<CurrentUser | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(
    () => getStoredActiveHouseholdId(),
  )

  const isLoading = authState === AUTH_STATES.LOADING
  const isAuthenticated = authState === AUTH_STATES.AUTHENTICATED

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

  const clearAuthSession = useCallback(() => {
    queryClient.clear()
    setAccessTokenState(null)
    setModuleToken(null)
    syncUserState(null)
    setAuthState(AUTH_STATES.UNAUTHENTICATED)
  }, [syncUserState])

  const runRefresh = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt++) {
        try {
          const { access_token } = await refreshApi()
          if (isCancelled()) return

          setAccessTokenState(access_token)
          setModuleToken(access_token)

          try {
            const userData = await getMeApi()
            if (isCancelled()) return

            syncUserState(userData)
            setAuthState(AUTH_STATES.AUTHENTICATED)
          } catch {
            if (!isCancelled()) {
              clearAuthSession()
            }
          }

          return
        } catch (error) {
          if (isCancelled()) return

          if (!isRetryableRefreshError(error) || attempt === MAX_REFRESH_ATTEMPTS) {
            clearAuthSession()
            return
          }

          await delay(REFRESH_RETRY_BACKOFF_MS)
          if (isCancelled()) return
        }
      }
    },
    [clearAuthSession, syncUserState],
  )

  const attemptRefresh = useCallback(async () => {
    setAuthState((current) =>
      current === AUTH_STATES.AUTHENTICATED ? current : AUTH_STATES.LOADING,
    )
    await runRefresh()
  }, [runRefresh])

  useEffect(() => {
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runRefresh(() => cancelled)

    return () => {
      cancelled = true
    }
  }, [runRefresh])

  useEffect(() => {
    if (isLoading || !isAuthenticated || !activeHouseholdId) return

    void queryClient.prefetchQuery({
      queryKey: householdKeys.hardware(activeHouseholdId),
      queryFn: listHardware,
    })
  }, [activeHouseholdId, isAuthenticated, isLoading])

  const setAccessToken = useCallback(
    (token: string | null) => {
      setAccessTokenState(token)
      setModuleToken(token)
      setAuthState(token ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.UNAUTHENTICATED)

      if (!token) {
        syncUserState(null)
      }
    },
    [syncUserState],
  )

  const setUser = useCallback(
    (incomingUser: CurrentUser | null) => {
      syncUserState(incomingUser)
    },
    [syncUserState],
  )

  const switchHousehold = useCallback(
    async (householdId: string) => {
      const previousHouseholdId = activeHouseholdId
      await queryClient.cancelQueries({
        predicate: (query) => isHouseholdScopedQueryKey(query.queryKey),
      })
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

      if (previousHouseholdId && previousHouseholdId !== nextSelection.household_id) {
        queryClient.removeQueries({
          predicate: (query) => isHouseholdScopedQueryKey(query.queryKey, previousHouseholdId),
        })
      }
      await queryClient.invalidateQueries({
        predicate: (query) => isHouseholdScopedQueryKey(query.queryKey, nextSelection.household_id),
      })
    },
    [activeHouseholdId, memberships],
  )

  const logout = useCallback(() => {
    void logoutApi().finally(() => {
      clearAuthSession()
    })
  }, [clearAuthSession])

  const value: AuthContextValue = {
    authState,
    accessToken,
    user,
    isLoading,
    isAuthenticated,
    memberships,
    activeHouseholdId,
    activeMembership,
    attemptRefresh,
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

// Query-only components can be rendered in isolated tests without the full auth
// provider; production routes still receive the active household from AuthContext.
// eslint-disable-next-line react-refresh/only-export-components
export function useHouseholdQueryScope(): string | undefined {
  return useContext(AuthContext)?.activeHouseholdId ?? undefined
}
