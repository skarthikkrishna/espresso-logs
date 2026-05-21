/**
 * AuthContext — M5 wired version (US-3.12 + US-1.8).
 *
 * Provides authentication state (access token + current user) to the React
 * tree via context. Uses auth.ts API client functions (no direct fetch calls).
 *
 * The module-level access token in client.ts is kept in sync so that the
 * Axios request interceptor always injects the latest Bearer token.
 *
 * AC-103: Access token is stored ONLY in React state — never in
 *         localStorage, sessionStorage, or any JS-accessible persistent storage.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { CurrentUser } from '../types/entities'
import {
  setAccessToken as setModuleToken,
} from '../api/client'
import { refresh as refreshApi, getMe as getMeApi, logout as logoutApi } from '../api/auth'

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
