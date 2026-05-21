/**
 * AuthContext — Wave 1 scaffold (US-1.8)
 *
 * Provides authentication state (access token + current user) to the React
 * tree via context.  Full auth.ts wiring is added in Wave 3 (US-3.10).
 * For now all network calls use `fetch` directly.
 *
 * AC-103: Access token is stored ONLY in React state — never in
 *         localStorage, sessionStorage, or any JS-accessible storage.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { CurrentUser } from '../types/entities'

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface AuthState {
  accessToken: string | null
  user: CurrentUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  setAccessToken: (token: string | null) => void
  setUser: (user: CurrentUser | null) => void
  logout: () => void
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

  // -------------------------------------------------------------------------
  // On mount: attempt cookie-based token refresh, then hydrate user
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function attemptRefresh() {
      try {
        const refreshRes = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })

        if (!refreshRes.ok) {
          if (!cancelled) {
            setAccessTokenState(null)
            setUserState(null)
          }
          return
        }

        const refreshData = (await refreshRes.json()) as { access_token: string }
        const token = refreshData.access_token

        if (cancelled) return
        setAccessTokenState(token)

        // Hydrate user
        const meRes = await fetch('/auth/me', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!cancelled) {
          if (meRes.ok) {
            const userData = (await meRes.json()) as CurrentUser
            setUserState(userData)
          } else {
            setUserState(null)
          }
        }
      } catch {
        if (!cancelled) {
          setAccessTokenState(null)
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
  }, [])

  const setUser = useCallback((u: CurrentUser | null) => {
    setUserState(u)
  }, [])

  // -------------------------------------------------------------------------
  // logout: best-effort POST, then clear state
  // -------------------------------------------------------------------------
  const logout = useCallback(() => {
    void fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      setAccessTokenState(null)
      setUserState(null)
    })
  }, [])

  const value: AuthContextValue = {
    accessToken,
    user,
    isLoading,
    isAuthenticated,
    setAccessToken,
    setUser,
    logout,
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
