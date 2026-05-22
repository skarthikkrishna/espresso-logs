/**
 * apiClient interceptor tests — AC-102, AC-103
 *
 * Covers:
 *   - Request interceptor: injects Bearer Authorization header when token is set
 *   - 401 retry: silent token refresh → retry original request → success
 *   - 401 refresh failure: clears module token, redirects window to /login
 *   - SKIP_REFRESH_PATHS: auth endpoints (login, register, refresh, logout)
 *     receive 401 without triggering the silent refresh loop
 *   - _retry flag prevents infinite retry loops
 */

import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  apiClient,
  getAccessToken,
  setAccessToken,
} from './client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal AxiosError with status and config set — simulates adapter rejection. */
function make401Error(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    data: { detail: 'Unauthorized' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  }
  return new AxiosError(
    'Request failed with status code 401',
    'ERR_BAD_REQUEST',
    config,
    null,
    response,
  )
}

/** Minimal successful adapter response. */
function makeOkResponse<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

// ---------------------------------------------------------------------------
// Save / restore adapter and window.location between tests
// ---------------------------------------------------------------------------

let originalAdapter: typeof apiClient.defaults.adapter
let originalLocation: Location
let originalLocalStorage: Storage
const storageState = new Map<string, string>()

const localStorageMock: Storage = {
  get length() {
    return storageState.size
  },
  clear() {
    storageState.clear()
  },
  getItem(key: string) {
    return storageState.get(key) ?? null
  },
  key(index: number) {
    return Array.from(storageState.keys())[index] ?? null
  },
  removeItem(key: string) {
    storageState.delete(key)
  },
  setItem(key: string, value: string) {
    storageState.set(key, value)
  },
}

beforeAll(() => {
  originalAdapter = apiClient.defaults.adapter
  originalLocation = window.location
  originalLocalStorage = window.localStorage
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  })
})

beforeEach(() => {
  setAccessToken(null)
  storageState.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  window.history.pushState({}, '', '/')
})

afterAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apiClient', () => {
  describe('request interceptor — Bearer token injection', () => {
    it('injects X-Household-Id header when active household is stored', async () => {
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-123')

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.['X-Household-Id']).toBe('hh-123')
    })

    it('injects Authorization header when access token is set', async () => {
      setAccessToken('my-access-token')

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.['Authorization']).toBe('Bearer my-access-token')
    })

    it('does not inject Authorization header when token is null', async () => {
      setAccessToken(null)

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.['Authorization']).toBeUndefined()
    })
  })

  describe('response interceptor — 401 silent refresh (AC-102)', () => {
    it('retries request after 401 using refresh token', async () => {
      let callCount = 0

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        if (callCount === 1) {
          throw make401Error(config)
        }
        return makeOkResponse({ result: 'retried' }, config)
      }

      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { access_token: 'refreshed-token', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      })

      const response = await apiClient.get('/api/protected')

      expect(axios.post).toHaveBeenCalledWith('/auth/refresh', null, { withCredentials: true })
      expect(getAccessToken()).toBe('refreshed-token')
      expect(callCount).toBe(2)
      expect(response.data).toEqual({ result: 'retried' })
    })

    it('clears module token and redirects to /login when refresh fails', async () => {
      setAccessToken('old-token')

      // jsdom's window.location doesn't fully process href assignments as navigation.
      // Replace with a plain writable mock so we can capture the assigned value.
      const locationMock = { href: 'http://localhost/' }
      Object.defineProperty(window, 'location', { configurable: true, writable: true, value: locationMock })

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw make401Error(config)
      }

      vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('refresh failed'))

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      expect(getAccessToken()).toBeNull()
      expect(locationMock.href).toBe('/login')
    })

    it('does not attempt refresh for /auth/login 401 (skip path)', async () => {
      let callCount = 0

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        throw make401Error(config)
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy()

      expect(callCount).toBe(1)
      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not attempt refresh for /auth/register 401 (skip path)', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw make401Error(config)
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/register', {})).rejects.toBeTruthy()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not attempt refresh for /auth/refresh 401 (skip path)', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw make401Error(config)
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/refresh')).rejects.toBeTruthy()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not retry more than once (_retry flag prevents loop)', async () => {
      let callCount = 0

      // Both original call and retry return 401
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        throw make401Error(config)
      }

      // Refresh succeeds — but the retry itself also 401s
      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { access_token: 'tok', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      })

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      // Original (1) + one retry (2) — no further attempts
      expect(callCount).toBe(2)
      // Refresh only called once
      expect(axios.post).toHaveBeenCalledTimes(1)
    })
  })
})
