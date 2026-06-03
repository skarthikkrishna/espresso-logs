/**
 * apiClient interceptor tests — AC-102, AC-103, and setup-required redirects.
 */

import axios, { AxiosError } from 'axios'
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  apiClient,
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from './client'

function makeError<TData>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: TData,
  statusText = 'Request failed',
): AxiosError<TData> {
  const response: AxiosResponse<TData> = {
    data,
    status,
    statusText,
    headers: {},
    config,
  }

  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    config,
    null,
    response,
  )
}

function makeOkResponse<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

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
  window.sessionStorage.clear()
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

describe('apiClient', () => {
  describe('request interceptor — Bearer token injection', () => {
    it('never injects X-Household-Id even when an active household is cached', async () => {
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-123')

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.['X-Household-Id']).toBeUndefined()
    })

    it('injects Authorization header when access token is set', async () => {
      setAccessToken('my-access-token')

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.Authorization).toBe('Bearer my-access-token')
    })

    it('does not inject Authorization header when token is null', async () => {
      setAccessToken(null)

      let capturedConfig: InternalAxiosRequestConfig | undefined

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedConfig = config
        return makeOkResponse({}, config)
      }

      await apiClient.get('/api/test')

      expect(capturedConfig?.headers?.Authorization).toBeUndefined()
    })
  })

  describe('response interceptor — redirects and silent refresh', () => {
    it('redirects to /welcome when the API returns setup_required=true', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw makeError(config, 503, {
          detail: 'Initial setup required',
          setup_required: true,
        }, 'Service Unavailable')
      }

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      expect(window.location.pathname).toBe('/welcome')
    })

    it('handles setup_required 503 before any auth refresh logic', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw makeError(config, 503, {
          detail: 'Initial setup required',
          setup_required: true,
        }, 'Service Unavailable')
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      expect(window.location.pathname).toBe('/welcome')
      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('retries request after 401 using refresh token', async () => {
      let callCount = 0
      let retryConfig: InternalAxiosRequestConfig | undefined
      window.localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, 'hh-123')

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        if (callCount === 1) {
          throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
        }

        retryConfig = config
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
      expect(retryConfig?.headers?.Authorization).toBe('Bearer refreshed-token')
      expect(retryConfig?.headers?.['X-Household-Id']).toBeUndefined()
    })

    it('clears module token and redirects to /login when refresh fails', async () => {
      setAccessToken('old-token')

      const locationMock = { href: 'http://localhost/' }
      Object.defineProperty(window, 'location', { configurable: true, writable: true, value: locationMock })

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('refresh failed'))

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      expect(getAccessToken()).toBeNull()
      expect(locationMock.href).toBe('/login')
    })

    it('deduplicates concurrent refresh attempts across 401 responses', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        if (config.headers?.Authorization === 'Bearer shared-token') {
          return makeOkResponse({ result: config.url }, config)
        }

        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      let resolveRefresh!: (value: AxiosResponse<{
        access_token: string
        token_type: string
      }>) => void
      const refreshRequest = new Promise<AxiosResponse<{ access_token: string; token_type: string }>>((resolve) => {
        resolveRefresh = resolve
      })

      const refreshSpy = vi.spyOn(axios, 'post').mockImplementation(
        () => refreshRequest as Promise<AxiosResponse<{ access_token: string; token_type: string }>>,
      )

      const requestOne = apiClient.get('/api/protected-1')
      const requestTwo = apiClient.get('/api/protected-2')

      await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1))

      resolveRefresh({
        data: { access_token: 'shared-token', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
      })

      const [responseOne, responseTwo] = await Promise.all([requestOne, requestTwo])

      expect(refreshSpy).toHaveBeenCalledTimes(1)
      expect(getAccessToken()).toBe('shared-token')
      expect(responseOne.data).toEqual({ result: '/api/protected-1' })
      expect(responseTwo.data).toEqual({ result: '/api/protected-2' })
    })

    it('deduplicates direct refreshAccessToken calls from two concurrent callers (spec-035 T-01)', async () => {
      let resolveRefresh!: (value: AxiosResponse<{
        access_token: string
        token_type: string
      }>) => void
      const refreshRequest = new Promise<AxiosResponse<{ access_token: string; token_type: string }>>((resolve) => {
        resolveRefresh = resolve
      })

      const refreshSpy = vi.spyOn(axios, 'post').mockImplementation(
        () => refreshRequest as Promise<AxiosResponse<{ access_token: string; token_type: string }>>,
      )

      const callers = [
        refreshAccessToken(),
        refreshAccessToken(),
      ]

      await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1))

      resolveRefresh({
        data: { access_token: 'shared-two-caller-token', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
      })

      await expect(Promise.all(callers)).resolves.toEqual([
        'shared-two-caller-token',
        'shared-two-caller-token',
      ])
      expect(refreshSpy).toHaveBeenCalledWith('/auth/refresh', null, { withCredentials: true })
      expect(refreshSpy).toHaveBeenCalledTimes(1)
    })

    it('deduplicates direct refreshAccessToken calls from three concurrent callers (spec-035 T-02)', async () => {
      let resolveRefresh!: (value: AxiosResponse<{
        access_token: string
        token_type: string
      }>) => void
      const refreshRequest = new Promise<AxiosResponse<{ access_token: string; token_type: string }>>((resolve) => {
        resolveRefresh = resolve
      })

      const refreshSpy = vi.spyOn(axios, 'post').mockImplementation(
        () => refreshRequest as Promise<AxiosResponse<{ access_token: string; token_type: string }>>,
      )

      const callers = [
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]

      await waitFor(() => expect(refreshSpy).toHaveBeenCalledTimes(1))

      resolveRefresh({
        data: { access_token: 'shared-direct-token', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
      })

      await expect(Promise.all(callers)).resolves.toEqual([
        'shared-direct-token',
        'shared-direct-token',
        'shared-direct-token',
      ])
      expect(refreshSpy).toHaveBeenCalledWith('/auth/refresh', null, { withCredentials: true })
      expect(refreshSpy).toHaveBeenCalledTimes(1)
    })

    it('clears the in-flight refresh guard after settlement so later refresh calls are independent', async () => {
      const refreshSpy = vi.spyOn(axios, 'post')
        .mockResolvedValueOnce({
          data: { access_token: 'first-token', token_type: 'bearer' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        })
        .mockResolvedValueOnce({
          data: { access_token: 'second-token', token_type: 'bearer' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        })

      await expect(refreshAccessToken()).resolves.toBe('first-token')
      await expect(refreshAccessToken()).resolves.toBe('second-token')

      expect(refreshSpy).toHaveBeenCalledTimes(2)
    })

    it('keeps refresh tokens out of browser-readable storage after refresh (spec-035 storage constraint)', async () => {
      const localSetItemSpy = vi.spyOn(window.localStorage, 'setItem')
      const sessionSetItemSpy = vi.spyOn(window.sessionStorage, 'setItem')

      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { access_token: 'memory-only-token', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      })

      await expect(refreshAccessToken()).resolves.toBe('memory-only-token')

      const localStorageKeys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index) ?? '',
      )
      const sessionStorageKeys = Array.from({ length: window.sessionStorage.length }, (_, index) =>
        window.sessionStorage.key(index) ?? '',
      )

      expect(localSetItemSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/refresh|rt/i),
        expect.any(String),
      )
      expect(sessionSetItemSpy).not.toHaveBeenCalled()
      expect(localStorageKeys.join(' ')).not.toMatch(/refresh|rt/i)
      expect(sessionStorageKeys.join(' ')).not.toMatch(/refresh|rt/i)
      expect(document.cookie).not.toContain('rt=')
    })

    it('does not attempt refresh for /auth/login 401 (skip path)', async () => {
      let callCount = 0

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy()

      expect(callCount).toBe(1)
      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not attempt refresh for /auth/register 401 (skip path)', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/register', {})).rejects.toBeTruthy()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not attempt refresh for /auth/refresh 401 (skip path)', async () => {
      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      const refreshSpy = vi.spyOn(axios, 'post')

      await expect(apiClient.post('/auth/refresh')).rejects.toBeTruthy()

      expect(refreshSpy).not.toHaveBeenCalled()
    })

    it('does not retry more than once (_retry flag prevents loop)', async () => {
      let callCount = 0

      apiClient.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        callCount++
        throw makeError(config, 401, { detail: 'Unauthorized' }, 'Unauthorized')
      }

      vi.spyOn(axios, 'post').mockResolvedValueOnce({
        data: { access_token: 'tok', token_type: 'bearer' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      })

      await expect(apiClient.get('/api/protected')).rejects.toBeTruthy()

      expect(callCount).toBe(2)
      expect(axios.post).toHaveBeenCalledTimes(1)
    })
  })
})
