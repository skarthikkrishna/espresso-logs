/**
 * client.ts — shared Axios instance with Bearer token injection, setup-required
 * redirect handling, and silent 401 refresh.
 *
 * AC-102: On 401, attempt one silent token refresh before hard-redirecting
 *         to /login. The _retry flag prevents infinite loops.
 * AC-103: Access token stored only in module memory — never
 *         localStorage/sessionStorage.
 */

import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'

export const ACTIVE_HOUSEHOLD_STORAGE_KEY = 'espresso.activeHouseholdId'

// ---------------------------------------------------------------------------
// Module-level access token store (AC-103)
// ---------------------------------------------------------------------------

let _accessToken: string | null = null

export const getAccessToken = (): string | null => _accessToken

export const setAccessToken = (token: string | null): void => {
  _accessToken = token
}

export const getStoredActiveHouseholdId = (): string | null => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)
}

export const setStoredActiveHouseholdId = (householdId: string | null): void => {
  if (typeof window === 'undefined') return

  if (householdId) {
    window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, householdId)
    return
  }

  window.localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)
}

function navigateTo(path: string): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === path) return

  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function isSetupRequiredPayload(data: unknown): data is { setup_required: true } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'setup_required' in data &&
    data.setup_required === true
  )
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ---------------------------------------------------------------------------
// Request interceptor — inject Bearer header
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers['Authorization'] = `Bearer ${_accessToken}`
  }

  return config
})

// ---------------------------------------------------------------------------
// Response interceptor — setup-required redirect + silent 401 refresh
// ---------------------------------------------------------------------------

const SKIP_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

interface RefreshResponse {
  access_token: string
  token_type: string
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    if (error.response?.status === 503 && isSetupRequiredPayload(error.response.data)) {
      navigateTo('/welcome')
      return Promise.reject(error)
    }

    const originalRequest = error.config as RetryableConfig | undefined

    const shouldRetry =
      error.response?.status === 401 &&
      originalRequest != null &&
      !originalRequest._retry &&
      !SKIP_REFRESH_PATHS.includes(originalRequest.url ?? '')

    if (shouldRetry && originalRequest) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post<RefreshResponse>(
          '/auth/refresh',
          null,
          { withCredentials: true },
        )
        setAccessToken(data.access_token)
        originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`

        return apiClient(originalRequest)
      } catch {
        setAccessToken(null)
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)
